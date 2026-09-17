/**
 * import.mjs — nahrá dokumenty do knižnice ako **koncepty** (D75, ADR-006).
 *
 *     npm run docs:import -- data/vzorky/revizny_poriadok.md --actor jan.letko@futbalsfz.sk
 *     npm run docs:import -- data/originaly/*.pdf --actor jan.letko@futbalsfz.sk --zapis
 *     npm run docs:import -- stanovy.pdf --actor jan.letko@futbalsfz.sk --nove-znenie --zapis
 *
 * **Predvolene beží nasucho.** Zápis sa musí vypýtať (`--zapis`) — rovnako ako
 * každý skript, ktorý sa dotýka ostrých dát.
 *
 * ## Prečo skript nič nezverejňuje
 *
 * Do 2026-09-17 skript zapisoval `status: "published"` a rovno aktívne úseky —
 * dokument bol po behu okamžite vo vyhľadávaní a dal sa prideliť. Dôvod v jeho
 * hlavičke znel „kurátorské rozhranie zatiaľ neexistuje". Odvtedy existuje aj
 * schvaľovanie (ADR-006) a D75 hovorí, že oficiálne znenia musia prejsť
 * schvaľovaním, **nie okolo neho**. Skript bol jediná cesta okolo.
 *
 * Teraz robí presne to, čo obrazovka **Nový dokument**: volá tú istú
 * `uploadDocument()`, s tými istými kontrolami metadát (`checkMetadata()`
 * vrátane rozšírení číselníkov tenanta) a tou istou ochranou pred kolíziou
 * kľúča (D80). Výsledok je koncept. Prečítanie textu, schválenie a zverejnenie
 * — a s ním členenie na úseky — idú cez knižnicu. Dve cesty s dvomi sadami
 * pravidiel sa raz rozídu; jedna nie.
 *
 * ## Kto nahráva
 *
 * `--actor` je povinný a musí to byť **osoba danej organizácie s rolou
 * `content-admin`**, ktorá nie je vyradená. Zapisuje sa do auditu a do
 * `createdBy`; schvaľovať ten istý človek nesmie (D69). Reťazec typu
 * „import.mjs" by v audite o rok nepovedal, kto za znenie zodpovedá.
 *
 * Organizácia sa berie z metadát a osoba do nej musí patriť (D90) — skript
 * nevie zapísať dokument do cudzej organizácie ani omylom.
 *
 * ## Metadáta
 *
 * Z `<súbor bez prípony>.meta.json` — názov súboru **nie je** dátový vstup.
 * Povinné: `title`, `sectionKey`, `companyCode`, `scope`, `accessLevel`,
 * `language`; nepovinné `documentKey` (inak sa berie `sectionKey`), `category`,
 * `tags`, `ownerDepartmentId`, `internalNumber`.
 *
 * Pri `--nove-znenie` sa z metadát použije len identita (`companyCode`,
 * `documentKey`/`sectionKey`). Ostatné sa berie z existujúceho záznamu —
 * rovnako ako na obrazovke: nové znenie mení text, nie prístupnosť ani pôsobnosť.
 *
 * **Všetko alebo nič:** keď čo i len jeden súbor neprejde kontrolou, nezapíše
 * sa nič.
 */
import { readFileSync, existsSync } from "node:fs"
import { basename, extname } from "node:path"

import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { checkMetadata, makeDocumentId, uploadDocument } from "../src/lib/libraryWrite.ts"
import { PERSONS_COLLECTION } from "../src/lib/persons.ts"
import { tenantByCompanyCode } from "../src/lib/tenants.ts"
import { tenantExtras } from "../src/lib/codelistsTenant.ts"
import { errorText } from "../src/lib/i18n.ts"
import { AppError } from "../src/lib/appError.ts"

/**
 * Rola nahrávateľa. Zhodná s `CONTENT_ROLE` v `src/lib/library.ts`, ktorý sa
 * odtiaľ importovať nedá — ťahá `next/headers` cez `session.ts` a mimo Nextu
 * padne. Keby sa rola premenovala, skript odmietne každého a povie to menovite.
 */
const CONTENT_ROLE = "content-admin"

const OK = "\x1b[32m✔\x1b[0m", FAIL = "\x1b[31m✘\x1b[0m", INFO = "\x1b[33m·\x1b[0m"

const args = process.argv.slice(2)
const val = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const has = (name) => args.includes(name)

const actorEmail = (val("--actor") ?? "").trim().toLowerCase()
const write = has("--zapis")
const mode = has("--nove-znenie") ? "version" : "new"
const flagsWithValue = new Set(["--actor"])
const files = args.filter((a, i) => !a.startsWith("--") && !flagsWithValue.has(args[i - 1]))

/**
 * Veta pre človeka. Chyby knižnice (`AppError`) majú preklad; vlastné kontroly
 * skriptu sú obyčajné `Error` so slovenskou vetou. `errorText()` by ich
 * zamaskoval všeobecným „Nepodarilo sa to" — pri skripte, ktorý beží v termináli
 * a má povedať presne, ktorý súbor a prečo neprešiel, je to na nič.
 */
const say = (e) => (e instanceof AppError ? errorText(e, "sk") : e?.message ?? String(e))

function usage(message) {
  console.error(`${FAIL} ${message}\n`)
  console.error("Použitie:")
  console.error("  npm run docs:import -- <súbor…> --actor <e-mail> [--nove-znenie] [--zapis]")
  console.error("")
  console.error("Prepínače:")
  console.error("  --actor <e-mail>  osoba organizácie s rolou content-admin (povinné)")
  console.error("  --nove-znenie     koncept nového znenia existujúceho dokumentu")
  console.error("  --zapis           zapíše (bez neho len kontrola a náhľad)")
  process.exit(1)
}

if (!files.length) usage("Chýbajú súbory.")
if (!actorEmail.includes("@")) usage("Chýba --actor s e-mailom osoby, ktorá dokumenty nahráva.")
if (!process.env.MONGODB_URI) usage("Chýba MONGODB_URI — spúšťa sa cez `npm run docs:import`.")

/** `stanovy.pdf` → `stanovy.meta.json`. Prípona sa odrezáva len posledná. */
function metaPathFor(file) {
  const ext = extname(file)
  return (ext ? file.slice(0, -ext.length) : file) + ".meta.json"
}

function readMeta(file) {
  const path = metaPathFor(file)
  if (!existsSync(path)) {
    throw new Error(`chýbajú metadáta ${path} — názov súboru sa ako zdroj metadát nepoužíva`)
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new Error(`${path} nie je platný JSON: ${e.message}`)
  }
}

// ── Kontrola (nič sa nezapisuje) ─────────────────────────────────────────────

const actorsByCompany = new Map()
async function checkActor(companyCode) {
  if (actorsByCompany.has(companyCode)) return actorsByCompany.get(companyCode)
  const persons = await getCollection(PERSONS_COLLECTION)
  const person = await persons.findOne({ companyCode, email: actorEmail })
  let problem = null
  if (!person) problem = `${actorEmail} nie je osoba organizácie ${companyCode}`
  else if (person.status === "inactive") problem = `${actorEmail} je v ${companyCode} vyradená`
  else if (!(person.roles ?? []).includes(CONTENT_ROLE)) problem = `${actorEmail} nemá v ${companyCode} rolu ${CONTENT_ROLE}`
  actorsByCompany.set(companyCode, problem)
  return problem
}

const documents = await getCollection(DOCUMENTS_COLLECTION)
const prepared = []
const problems = []
const seenIds = new Set()

for (const file of files) {
  try {
    if (!existsSync(file)) throw new Error("súbor neexistuje")
    const raw = readMeta(file)
    const companyCode = String(raw.companyCode ?? "").trim()
    if (!companyCode) throw new Error("v metadátach chýba companyCode")

    const tenant = await tenantByCompanyCode(companyCode)
    if (!tenant) throw new Error(`organizácia ${companyCode} neexistuje`)

    const actorProblem = await checkActor(companyCode)
    if (actorProblem) throw new Error(actorProblem)

    const documentId = makeDocumentId(raw)
    if (seenIds.has(documentId)) throw new Error(`${documentId} je v dávke dvakrát`)
    seenIds.add(documentId)

    // Organizácia ide do podmienky dotazu, nie do kontroly nad ním (D32, D90).
    const existing = await documents.findOne({ documentId, companyCode })
    if (mode === "new" && existing) {
      throw new Error(`${documentId} už existuje — nové znenie sa nahráva s --nove-znenie`)
    }
    if (mode === "version" && !existing) {
      throw new Error(`${documentId} neexistuje — nový dokument sa nahráva bez --nove-znenie`)
    }

    const source = mode === "version"
      ? {
          title: String(existing.title ?? ""),
          documentKey: String(existing.documentKey ?? existing.sectionKey ?? ""),
          sectionKey: String(existing.sectionKey ?? ""),
          scope: String(existing.scope ?? ""),
          accessLevel: String(existing.accessLevel ?? ""),
          language: String(existing.language ?? ""),
          category: existing.category ?? undefined,
          tags: Array.isArray(existing.tags) ? existing.tags : [],
          ownerDepartmentId: existing.ownerDepartmentId ?? undefined,
          internalNumber: existing.internalNumber ?? undefined,
        }
      : raw
    const meta = checkMetadata({ ...source, companyCode }, tenantExtras(tenant))

    prepared.push({ file, meta, documentId, isVersion: mode === "version" })
    console.log(`${OK} ${meta.title}`)
    console.log(`    ${documentId} · ${mode === "version" ? "nové znenie" : "nový dokument"} · ${basename(file)}`)
  } catch (e) {
    problems.push(file)
    console.error(`${FAIL} ${file}: ${say(e)}`)
  }
}

if (problems.length) {
  console.error(`\n${FAIL} ${problems.length} súbor(ov) neprešlo kontrolou — nič sa nezapísalo.`)
  await (await getClient()).close()
  process.exit(1)
}

if (!write) {
  console.log(`\n${INFO} Náhľad: ${prepared.length} súbor(ov) prešlo kontrolou. Zapíše sa s --zapis.`)
  await (await getClient()).close()
  process.exit(0)
}

// ── Zápis ────────────────────────────────────────────────────────────────────

let failures = 0
console.log()
for (const p of prepared) {
  try {
    const r = await uploadDocument(p.meta, basename(p.file), readFileSync(p.file), actorEmail, mode)
    console.log(`${OK} ${p.meta.title} — koncept ${r.documentId}`)
    for (const w of r.warnings) console.log(`    ${INFO} ${w}`)
  } catch (e) {
    failures++
    console.error(`${FAIL} ${p.file}: ${say(e)}`)
  }
}

if (prepared.length > failures) {
  console.log(`\n${INFO} Koncepty nie sú vo vyhľadávaní ani sa nedajú prideliť.`)
  console.log(`    Ďalší krok je v knižnici: prečítať text, poslať na schválenie, zverejniť.`)
}

await (await getClient()).close()
process.exit(failures > 0 ? 1 : 0)
