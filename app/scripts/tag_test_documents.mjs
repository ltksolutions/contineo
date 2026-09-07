/**
 * tag_test_documents.mjs — označí skúšobné dokumenty značkou „Test".
 *
 *     npm run tag:test -- --company SFZ            náhľad
 *     npm run tag:test -- --company SFZ --zapis    vykoná
 *
 * **Značka nič nezakazuje.** Je to štítok, nie brána: dokument so značkou
 * `test` sa dá stále prideliť aj potvrdiť. Slúži na to, aby bolo pri
 * nahrádzaní ostrými zneniami na prvý pohľad vidieť, čo je čo — nie na to,
 * aby sa skúšobný obsah nedostal k ľuďom. Na to je tenant a doména.
 *
 * Značka sa dopisuje **do číselníka organizácie** (D55), nie do globálneho
 * `codelists/tags.json`: je to upratovací štítok SFZ, nie súčasť slovníka,
 * ktorý dodávame všetkým.
 *
 * Zápis ide cez `addCodelistItem()` a `saveMetadata()`, nie priamo do Mongo —
 * tie funkcie píšu aj auditný záznam. Priamy zápis by dokumenty zmenil bez
 * stopy, kto a kedy.
 */

import { addCodelistItem, tenantExtras } from "../src/lib/codelistsTenant.ts"
import { saveMetadata } from "../src/lib/libraryWrite.ts"
import { getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { TENANTS_COLLECTION } from "../src/lib/tenants.ts"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const write = args.includes("--zapis")
const company = (args[args.indexOf("--company") + 1] ?? "").trim()
const actor = (args[args.indexOf("--actor") + 1] ?? "").trim() || "script:tag_test_documents"

const TAG_KEY = "test"
const TAG_LABEL = "Test"

if (!company || company.startsWith("--")) {
  console.error(`${FAIL} Chýba --company (napr. --company SFZ)`)
  process.exit(1)
}

const tenants = await getCollection(TENANTS_COLLECTION)
const tenant = await tenants.findOne({ companyCode: company })
if (!tenant) {
  console.error(`${FAIL} Organizácia ${company} tu nie je.`)
  process.exit(1)
}

const documents = await getCollection(DOCUMENTS_COLLECTION)
const rows = await documents
  .find(
    { companyCode: company },
    {
      projection: {
        documentId: 1, title: 1, tags: 1,
        // `saveMetadata()` prepisuje **všetky** metadáta naraz, nie len to,
        // čo mu pošleme. Bez týchto polí by sa pri značkovaní stratil rozsah,
        // úroveň prístupu, jazyk aj druh — a nikto by si to nevšimol, kým by
        // dokument prestal byť niekomu viditeľný.
        scope: 1, accessLevel: 1, language: 1, category: 1,
      },
    },
  )
  .sort({ documentId: 1 })
  .toArray()

console.log(`${OK} ${company}: ${rows.length} dokumentov${write ? "" : "  \x1b[33m(NÁHĽAD)\x1b[0m"}\n`)

// ── značka v číselníku organizácie ──
const has = (tenantExtras(tenant).tags ?? []).some(i => i.key === TAG_KEY)
if (has) {
  console.log(`${INFO} značka „${TAG_LABEL}" už v číselníku je`)
} else if (write) {
  await addCodelistItem(company, "tags", TAG_KEY, TAG_LABEL, actor)
  console.log(`${OK} značka „${TAG_LABEL}" dopísaná do číselníka organizácie`)
} else {
  console.log(`${INFO} doplnila by sa značka „${TAG_LABEL}" do číselníka organizácie`)
}

// ── značka na dokumentoch ──
//
// Číselník sa načíta **znova**, až po prípadnom doplnení značky — inak by
// `checkMetadata()` odmietlo hodnotu, ktorú sme o riadok vyššie pridali.
const fresh = await tenants.findOne({ companyCode: company })
const extrasNow = tenantExtras(fresh ?? tenant)

let tagged = 0, skipped = 0, failed = 0
for (const d of rows) {
  const tags = d.tags ?? []
  if (tags.includes(TAG_KEY)) {
    console.log(`   ${INFO} ${d.documentId} — už označený`)
    skipped++
    continue
  }
  if (!write) {
    console.log(`   ${INFO} ${d.documentId} — pridal by sa „${TAG_KEY}"  (teraz: ${tags.join(", ") || "—"})`)
    tagged++
    continue
  }
  try {
    // Značky sa **pridávajú**, neprepisujú — pôvodné triedenie musí zostať.
    // A posielajú sa aj ostatné metadáta, lebo `saveMetadata()` ich prepisuje
    // všetky naraz.
    await saveMetadata(
      company,
      d.documentId,
      {
        title: d.title,
        scope: d.scope,
        accessLevel: d.accessLevel,
        language: d.language,
        category: d.category,
        tags: [...tags, TAG_KEY],
      },
      actor,
      extrasNow,
    )
    console.log(`   ${OK} ${d.documentId}`)
    tagged++
  } catch (e) {
    console.error(`   ${FAIL} ${d.documentId}: ${e.message}`)
    failed++
  }
}

console.log(
  `\n${OK} ${write ? "označené" : "na označenie"}: ${tagged}, preskočené: ${skipped}` +
  (failed ? `, \x1b[31mzlyhalo: ${failed}\x1b[0m` : ""),
)
if (!write) console.log(`${INFO} spusti s --zapis, ak to sedí`)
if (failed) process.exitCode = 1
process.exit(process.exitCode ?? 0)
