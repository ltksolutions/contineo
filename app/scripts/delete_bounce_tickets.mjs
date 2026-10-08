/**
 * delete_bounce_tickets.mjs — zmaže tickety, ktoré vznikli zo správ
 * o nedoručení (Ján 8. 10. 2026).
 *
 *     npm run tickets:delete-bounces -- --company SFZ              náhľad
 *     npm run tickets:delete-bounces -- --company SFZ --naozaj     vykoná
 *
 * Návrat od poštového servera (`mailer-daemon`, „Undelivered Mail Returned
 * to Sender") nie je otázka človeka a od 8. 10. ho synchronizácia ako ticket
 * nezakladá (`mailbox.skipBounces`). Tie, čo vznikli skôr, nie sú dôkazný
 * záznam (D24) — nemajú odoslanú odpoveď — a nesú len cudzie adresy; čakať
 * na ne 24 mesiacov do mazacej dávky (D178) nemá dôvod.
 *
 * **Predvolene beží nasucho.** Poistky:
 *
 * 1. **Každá** prijatá správa ticketu musí byť návrat (`isBounce()` — tá
 *    istá funkcia ako pri synchronizácii). Ticket, kde je čo i len jedna
 *    správa od človeka, sa preskočí.
 * 2. Ticket nesmie mať odoslanú odpoveď ani odchádzajúcu správu — tá by bola
 *    dôkaz komunikácie.
 * 3. Ticket musí byť **zavretý** — zmaže sa len to, čo riešiteľ už odložil.
 *
 * Každé zmazanie má záznam v audite (predmet a odosielateľ ako kópia).
 * Návratový kód 1, keď sa niečo nepodarilo.
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { TICKETS_COLLECTION } from "../src/lib/tickets.ts"
import { isBounce } from "../src/lib/mailbox/bounce.ts"
import { writeAudit } from "../src/lib/audit.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const has = f => args.includes(f)
const val = f => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}

const company = val("--company")
const apply = has("--naozaj")
if (!company) {
  console.error("Chýba --company (napr. --company SFZ).")
  process.exit(2)
}

/** Ticket, ktorý je celý len návrat od poštového servera — všetky tri poistky. */
function onlyBounces(t) {
  if (t.source !== "email") return false
  if (t.state !== "closed") return false
  if (t.sentAnswer) return false
  const msgs = Array.isArray(t.messages) ? t.messages : []
  if (!msgs.length) return false
  if (msgs.some(m => m.direction !== "in")) return false
  return msgs.every(m => isBounce({ from: m.from, subject: m.subject ?? "", outgoing: false }))
}

const col = await getCollection(TICKETS_COLLECTION)
const candidates = await col.find({ companyCode: company, source: "email", state: "closed" }).toArray()
const doomed = candidates.filter(onlyBounces)
const kept = candidates.length - doomed.length

console.log(`${INFO} Organizácia ${company}: zavretých e-mailových ticketov ${candidates.length}, z toho len návraty ${doomed.length}, ostáva ${kept}.`)
for (const t of doomed.slice(0, 200)) {
  console.log(`  ${t.subject}  ·  ${t.messages?.[0]?.from?.address ?? "—"}  ·  ${new Date(t.createdAt).toISOString().slice(0, 10)}`)
}
if (doomed.length > 200) console.log(`  … a ďalších ${doomed.length - 200}`)

if (!apply) {
  console.log(`${INFO} Nasucho — nič sa nezmazalo. Zmazať: pridaj --naozaj.`)
  process.exit(0)
}

let failed = 0
for (const t of doomed) {
  try {
    await col.deleteOne({ _id: t._id, companyCode: company, state: "closed" })
    await writeAudit({
      companyCode: company, subject: "ticket", action: "zmazany-navrat", actor: "script:delete_bounce_tickets",
      targetId: String(t._id), targetLabel: t.subject,
      note: `návrat od ${t.messages?.[0]?.from?.address ?? "—"} (mailbox.skipBounces, 8. 10. 2026)`,
    })
  } catch (e) {
    failed++
    console.error(`${FAIL} ${t.subject}: ${e?.message ?? e}`)
  }
}
console.log(`${failed ? FAIL : OK} Zmazané: ${doomed.length - failed}${failed ? `, zlyhalo: ${failed}` : ""}.`)
process.exit(failed ? 1 : 0)
