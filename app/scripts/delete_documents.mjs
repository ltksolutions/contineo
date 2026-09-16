/**
 * delete_documents.mjs — zmaže dokumenty a upratá, čo na nich visí (D74, D79).
 *
 *     npm run docs:delete -- --company SFZ --tag test                  náhľad
 *     npm run docs:delete -- --company SFZ --id sfz:stanovy            náhľad
 *     npm run docs:delete -- --company SFZ --grandfathered             náhľad
 *     npm run docs:delete -- --company SFZ --tag test --naozaj         vykoná
 *
 * **Predvolene beží nasucho.** Mazať sa musí vypýtať — rovnako ako každý
 * skript, ktorý sa dotýka ostrých dát.
 *
 * ## Tri poistky, ktoré tu sú zámerne
 *
 * **1. Výber musí byť menovitý.** Skript nemá režim „zmaž všetko v organizácii".
 * Pravidlo (`--tag`, `--grandfathered`) alebo zoznam (`--id`) — jedno z nich,
 * povinne. Prepínač, ktorý zmaže knižnicu jedným slovom, sa raz použije omylom.
 *
 * **2. Dokument s väzbami sa pravidlom nezmaže nikdy.** Ak naň ukazuje
 * potvrdenie, pridelenie, krok onboardingu alebo kolo schvaľovania, hromadný
 * výber ho preskočí a vypíše prečo. Zmazať sa dá len menovite cez `--id`
 * spolu s `--aj-s-vazbami` — teda vtedy, keď človek napísal jeho identifikátor
 * rukou. Dôvod je ADR-005: potvrdenie bez dokumentu je dôkaz bez predmetu.
 *
 * **A práve preto `--aj-s-vazbami` tie väzby aj zmaže.** Do 2026-09-14 ich
 * len **počítal** a nechal ležať: po zmazaní dokumentu zostalo potvrdenie,
 * pridelenie a kolo schvaľovania ukazujúce na dokument, ktorý už neexistuje,
 * a `npm run check` to hlásil ako rozpor. Nájdené nácvikom — pri mazaní
 * skúšobného dokumentu, teda presne tým úkonom, ktorý čaká celý skúšobný
 * korpus. Ponechať ich nie je opatrnosť: dôkaz bez predmetu je bezcenný **aj
 * tak**, len k tomu pribudne nekonzistentná databáza.
 *
 * **3. Úseky sa archivujú, nemažú.** Predvolené správanie je zhodné s D6 —
 * `isActive: false` a `effectiveTo`. Otázka „ako to bolo narezané vlani" musí
 * mať odpoveď aj po zmazaní dokumentu. Kto chce naozaj zmazať, povie
 * `--useky zmazat`.
 *
 * Návratový kód 1, keď sa niečo preskočilo alebo zlyhalo.
 */

import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { CHUNKS_COLLECTION } from "../src/lib/libraryWrite.ts"
import { ACKNOWLEDGEMENTS_COLLECTION } from "../src/lib/acknowledgements.ts"
import { ASSIGNMENTS_COLLECTION } from "../src/lib/assignments.ts"
import { TRACKS_COLLECTION } from "../src/lib/tracks.ts"
import { APPROVALS_COLLECTION } from "../src/lib/approvals.ts"
import { writeAudit } from "../src/lib/audit.ts"
import { deleteFile } from "../src/lib/fileStore.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", WARN = "\x1b[33m▲\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const val = (f) => {
  const i = args.indexOf(f)
  const v = i === -1 ? null : args[i + 1] ?? null
  return v && !v.startsWith("--") ? v.trim() : null
}

const company = val("--company")
const ids = (val("--id") ?? "").split(",").map(s => s.trim()).filter(Boolean)
const tag = val("--tag")
const grandfathered = has("--grandfathered")
const confirmed = has("--naozaj")
const withLinks = has("--aj-s-vazbami")
const withFiles = has("--aj-subory")
const chunkMode = val("--useky") ?? "archivovat"
const actor = val("--actor") ?? "script:delete_documents"

function usage(message) {
  console.error(`${FAIL} ${message}\n`)
  console.error("Použitie:")
  console.error("  npm run docs:delete -- --company SFZ --tag test")
  console.error("  npm run docs:delete -- --company SFZ --id sfz:stanovy,sfz:volebny_poriadok")
  console.error("  npm run docs:delete -- --company SFZ --grandfathered")
  console.error("")
  console.error("Prepínače:")
  console.error("  --naozaj          vykoná zmazanie (bez neho len náhľad)")
  console.error("  --useky zmazat    úseky zmazať namiesto archivácie (predvolene archivovat)")
  console.error("  --aj-subory       zmazať aj pôvodné nahrané súbory")
  console.error("  --aj-s-vazbami    zmaže dokument aj jeho potvrdenia, pridelenia, kroky trás")
  console.error("                    a kolá schvaľovania — len spolu s --id")
  process.exit(1)
}

if (!company) usage("Chýba --company (napr. --company SFZ)")
const rules = [ids.length > 0, Boolean(tag), grandfathered].filter(Boolean).length
if (rules === 0) usage("Chýba výber: --id, --tag alebo --grandfathered")
if (rules > 1) usage("Zadaj práve jeden spôsob výberu, nie viac naraz")
if (chunkMode !== "archivovat" && chunkMode !== "zmazat") usage("--useky musí byť 'archivovat' alebo 'zmazat'")
if (withLinks && ids.length === 0) usage("--aj-s-vazbami sa dá použiť len spolu s menovitým --id")

// ── Výber ────────────────────────────────────────────────────────────────────

const documents = await getCollection(DOCUMENTS_COLLECTION)
const filter = { companyCode: company }
if (ids.length > 0) filter.documentId = { $in: ids }
if (tag) filter.tags = tag
if (grandfathered) filter["versions.publishedBefore"] = true

const rows = await documents.find(filter).toArray()

if (ids.length > 0) {
  const found = new Set(rows.map(d => d.documentId))
  for (const id of ids.filter(i => !found.has(i))) {
    console.error(`${WARN} ${id} — taký dokument v ${company} nie je, preskakujem`)
  }
}
if (rows.length === 0) {
  console.log(`${OK} Výberu nezodpovedá žiadny dokument — niet čo mazať.`)
  process.exit(0)
}

// ── Väzby ────────────────────────────────────────────────────────────────────

const chunks = await getCollection(CHUNKS_COLLECTION)
const acks = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
const assignments = await getCollection(ASSIGNMENTS_COLLECTION)
const tracks = await getCollection(TRACKS_COLLECTION)
const approvals = await getCollection(APPROVALS_COLLECTION)

async function linksFor(documentId) {
  const [ack, assigned, inTracks, rounds, chunksTotal, chunksActive] = await Promise.all([
    acks.countDocuments({ documentId }),
    assignments.countDocuments({ "subject.documentId": documentId }),
    tracks.countDocuments({ "steps.documentId": documentId }),
    approvals.countDocuments({ documentId }),
    chunks.countDocuments({ documentId }),
    chunks.countDocuments({ documentId, isActive: true }),
  ])
  return { ack, assigned, inTracks, rounds, chunksTotal, chunksActive }
}

const plan = []
for (const d of rows) {
  const links = await linksFor(d.documentId)
  const blocking = links.ack + links.assigned + links.inTracks + links.rounds
  // Menovitý výber s `--aj-s-vazbami` je jediná cesta k dokumentu s dôkazmi.
  const allowed = blocking === 0 || (withLinks && ids.includes(d.documentId))
  plan.push({ doc: d, links, blocking, allowed })
}

// ── Náhľad ───────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padEnd(n)
console.log(`\nOrganizácia: ${company} · režim: ${confirmed ? "\x1b[31mMAŽEM\x1b[0m" : "náhľad (bez --naozaj sa nič nezmení)"}`)
console.log(`Úseky: ${chunkMode === "zmazat" ? "\x1b[31mzmazať\x1b[0m" : "archivovať"} · pôvodné súbory: ${withFiles ? "zmazať" : "nechať"}`)
// Že sa zmažú aj väzby, musí byť vidieť **pred** potvrdením, nie až z výpisu.
if (withLinks) {
  console.log(`\x1b[31mVäzby: potvrdenia, pridelenia, kolá schvaľovania a kroky trás sa zmažú spolu s dokumentom.\x1b[0m`)
}
console.log("")
console.log([pad("documentId", 38), pad("úseky a/c", 12), pad("potvrd.", 8), pad("prid.", 6), pad("kroky", 6), pad("kolá", 5), "stav"].join(" "))
console.log("─".repeat(100))
for (const p of plan) {
  console.log([
    pad(p.doc.documentId, 38),
    pad(`${p.links.chunksActive}/${p.links.chunksTotal}`, 12),
    pad(p.links.ack, 8),
    pad(p.links.assigned, 6),
    pad(p.links.inTracks, 6),
    pad(p.links.rounds, 5),
    p.allowed ? `${OK} zmazať` : `${WARN} preskočené — má väzby`,
  ].join(" "))
}
console.log("─".repeat(100))

const toDelete = plan.filter(p => p.allowed)
const skipped = plan.filter(p => !p.allowed)
console.log(`${toDelete.length} na zmazanie · ${skipped.length} preskočených`)

if (skipped.length > 0) {
  console.log(`\n${INFO} Preskočené dokumenty majú potvrdenia, pridelenia, kroky onboardingu`)
  console.log(`  alebo kolá schvaľovania. Zmazať sa dajú len menovite:`)
  console.log(`  npm run docs:delete -- --company ${company} --id ${skipped.map(p => p.doc.documentId).join(",")} --aj-s-vazbami --naozaj`)
  console.log(`  Rozmysli si to — ADR-005: potvrdenie bez dokumentu je dôkaz bez predmetu.`)
}

if (!confirmed) {
  console.log(`\n${INFO} Náhľad. Spusti znova s --naozaj, ak to takto má byť.`)
  process.exit(skipped.length > 0 ? 1 : 0)
}
if (toDelete.length === 0) {
  console.error(`\n${FAIL} Niet čo zmazať.`)
  process.exit(1)
}

// ── Zmazanie ─────────────────────────────────────────────────────────────────

console.log("")
let failures = 0

for (const p of toDelete) {
  const id = p.doc.documentId
  try {
    // Poradie je zámerné: najprv úseky, potom dokument. Opačne by pád uprostred
    // nechal úseky bez dokumentu — presne ten stav, ktorý `npm run check` hlási
    // ako rozpor a ktorý sa potom ťažko priraďuje k príčine.
    let chunkNote
    if (chunkMode === "zmazat") {
      const r = await chunks.deleteMany({ documentId: id })
      chunkNote = `úsekov zmazaných: ${r.deletedCount}`
    } else {
      const r = await chunks.updateMany(
        { documentId: id, isActive: true },
        { $set: { isActive: false, effectiveTo: new Date() } },
      )
      chunkNote = `úsekov archivovaných: ${r.modifiedCount}`
    }

    if (withFiles && p.doc.originalFile?.id) {
      try {
        await deleteFile(company, p.doc.originalFile.id)
      } catch (e) {
        console.error(`${WARN} ${id} — pôvodný súbor sa nepodarilo zmazať: ${e?.message ?? e}`)
      }
    }

    await documents.deleteOne({ documentId: id, companyCode: company })

    /*
      Väzby idú s dokumentom. Nechať ich znamená dôkaz bez predmetu (ADR-005)
      **a** rozpor, ktorý nahlási `npm run check` — teda to najhoršie z oboch.
      Beží to až po zmazaní dokumentu: keby to padlo uprostred, zostane
      dokument bez väzieb, čo je stav, z ktorého sa dá pokračovať, nie väzby
      bez dokumentu.
    */
    const cleaned = []
    if (p.blocking > 0) {
      const [a1, a2, a3] = await Promise.all([
        acks.deleteMany({ documentId: id }),
        assignments.deleteMany({ "subject.documentId": id }),
        approvals.deleteMany({ documentId: id }),
      ])
      if (a1.deletedCount) cleaned.push(`potvrdení: ${a1.deletedCount}`)
      if (a2.deletedCount) cleaned.push(`pridelení: ${a2.deletedCount}`)
      if (a3.deletedCount) cleaned.push(`kôl: ${a3.deletedCount}`)

      /*
        Krok sa z trasy **vyberie a zvyšok sa prečísluje**. Bez prečíslovania
        zostane v poradí diera (1, 3, 4) a obrazovka, ktorá píše „Krok N z M",
        by ukázala „Krok 3 z 2" — číslo, ktoré nedáva zmysel.
      */
      let steps = 0
      for (const t of await tracks.find({ "steps.documentId": id }).toArray()) {
        const zostalo = (t.steps ?? [])
          .filter(k => k.documentId !== id)
          .sort((x, y) => x.order - y.order)
          .map((k, i) => ({ ...k, order: i + 1 }))
        steps += (t.steps ?? []).length - zostalo.length
        await tracks.updateOne({ _id: t._id }, { $set: { steps: zostalo } })
      }
      if (steps) cleaned.push(`krokov trás: ${steps}`)
    }

    // Audit až po úspešnej zmene (tak to robí `writeAudit()` všade inde).
    await writeAudit({
      companyCode: company,
      subject: "document",
      action: "deleted",
      actor,
      targetId: id,
      targetLabel: p.doc.title ?? id,
      note: [
        chunkNote,
        `verzií: ${(p.doc.versions ?? []).length}`,
        p.blocking > 0 ? `zmazané väzby: ${cleaned.join(", ") || "žiadne"}` : null,
        withFiles ? "aj pôvodný súbor" : null,
      ].filter(Boolean).join(" · "),
    })

    console.log(`${OK} ${pad(id, 38)} ${[chunkNote, ...cleaned].join(" · ")}`)
  } catch (e) {
    failures++
    console.error(`${FAIL} ${id} — ${e?.message ?? e}`)
  }
}

console.log(`\nHotovo: ${toDelete.length - failures} zmazaných, ${failures} zlyhaní, ${skipped.length} preskočených.`)
console.log(`${INFO} Spusti \`npm run check\` — overí, že po zmazaní nezostali rozpory.`)
process.exit(failures > 0 || skipped.length > 0 ? 1 : 0)
