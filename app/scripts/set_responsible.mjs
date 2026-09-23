/**
 * set_responsible.mjs — doplní zodpovednú osobu platným zneniam, ktoré ju nemajú (D91).
 *
 *     node --env-file=.env.local --import ./scripts/lib/ts-hook.mjs \
 *       scripts/set_responsible.mjs SFZ jan.letko@futbalsfz.sk            náhľad
 *     node --env-file=.env.local --import ./scripts/lib/ts-hook.mjs \
 *       scripts/set_responsible.mjs SFZ jan.letko@futbalsfz.sk --zapis    vykoná
 *
 * Znenia spred D91 zodpovednú osobu nemajú a skript ju za človeka **nevyberá** —
 * osobu určí ten, kto ho spúšťa, a skript ju len zapíše. Rozhodnutie Jána
 * z 2026-09-23: kým sa garanti predpisov neurčia menovite, je zodpovedný on.
 *
 * Zapisuje sa cez `setVersionResponsible()`, tou istou cestou ako z knižnice:
 * meno sa berie zo záznamu osoby, do `responsibleChanges[]` pribudne zmena
 * s dôvodom a do auditu záznam. Keď sa neskôr určí iný garant, zmena na
 * obrazovke to zapíše rovnako a história ukáže oboch.
 *
 * **Len platné znenia** (`isActive` a bez `effectiveTo`) — tie isté, ktoré
 * vypisuje `npm run check`. Nahradené znenia sa nechávajú tak: spätne
 * dopísaná osoba by tvrdila, že za ne vtedy niekto zodpovedal. Znenie, ktoré
 * osobu už má, sa nemení.
 *
 * Predvolene beží nasucho.
 */
import { getClient } from "../src/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"
import { responsibleSnapshot, setVersionResponsible } from "../src/lib/versionResponsibilityDb"
import { PERSONS_COLLECTION } from "../src/lib/persons"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"
const write = process.argv.includes("--zapis")
const [companyCode, email] = process.argv.slice(2).filter(a => !a.startsWith("--"))
const REASON = "Doplnenie zodpovednej osoby zneniu spred D91 — kým sa garant neurčí menovite."

if (!process.env.MONGODB_URI) {
  console.error(`${FAIL} Chýba MONGODB_URI. Spusti s --env-file=.env.local`)
  process.exit(1)
}
if (!companyCode || !email) {
  console.error(`${FAIL} Použitie: set_responsible.mjs <companyCode> <e-mail osoby> [--zapis]`)
  process.exit(1)
}

const client = await getClient()
try {
  const db = client.db(process.env.MONGODB_DB ?? "contineo")
  const person = await db.collection(PERSONS_COLLECTION).findOne(
    { companyCode, email: email.trim().toLowerCase() },
    { projection: { id: 1 } },
  )
  const to = person ? await responsibleSnapshot(companyCode, person.id) : null
  if (!to) {
    console.error(`${FAIL} ${email} v organizácii ${companyCode} nie je alebo je vyradená.`)
    process.exit(1)
  }
  console.log(`${INFO} Zodpovedná osoba: ${to.fullName} <${to.email}> (${to.personId})\n`)

  const docs = await db.collection(DOCUMENTS_COLLECTION)
    .find({ companyCode }, { projection: { documentId: 1, versions: 1 } })
    .toArray()

  const todo = []
  for (const d of docs) {
    const v = (d.versions ?? []).find(x => x.isActive && !x.effectiveTo)
    if (!v) continue
    if (v.responsiblePerson) {
      console.log(`${d.documentId.padEnd(48)} ${INFO} má: ${v.responsiblePerson.fullName}`)
      continue
    }
    todo.push({ documentId: d.documentId, versionId: v.versionId, label: v.label })
    console.log(`${d.documentId.padEnd(48)} ${OK} ${v.label} → ${to.fullName}`)
  }

  console.log(`\n${INFO} Doplniť: ${todo.length} z ${docs.length} dokumentov`)
  if (!write) {
    console.log(`${INFO} Náhľad. Spusti znova s --zapis.`)
    process.exit(0)
  }

  for (const t of todo) {
    await setVersionResponsible({
      companyCode, documentId: t.documentId, versionId: t.versionId,
      personId: to.personId, reason: REASON, actor: to.email, canManageContent: true,
    })
  }
  console.log(`${OK} Doplnené: ${todo.length}`)
} catch (e) {
  console.error(`${FAIL} ${e?.message ?? e}`)
  process.exitCode = 1
} finally {
  await client.close()
}
