/**
 * import.mjs — nahrá dokumenty do knižnice ako **koncepty** (D75, ADR-006).
 *
 *     npm run docs:import -- data/issf/manual_klub.pdf --actor jan.letko@futbalsfz.sk
 *     npm run docs:import -- data/issf/*.pdf --actor jan.letko@futbalsfz.sk --zapis
 *     npm run docs:import -- stanovy.pdf --actor jan.letko@futbalsfz.sk --nove-znenie --zapis
 *
 * Na vstupe sú **PDF**, rovnako ako na obrazovke Nahrať. Vedľa každého leží
 * `<základ>.meta.json` a voliteľne upraviteľný zdroj s rovnakým základom:
 *
 *     data/issf/manual_klub.pdf         schvaľovaná podoba (povinné, ADR-011)
 *     data/issf/manual_klub.docx        zdroj textu (alebo .md; nepovinné, D95)
 *     data/issf/manual_klub.meta.json   metadáta
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
 * `uploadDocument()` s tými istými súbormi (PDF + zdroj), s tými istými
 * kontrolami metadát (`checkMetadata()` vrátane rozšírení číselníkov
 * tenanta) a tou istou ochranou pred kolíziou kľúča (D80). Výsledok je koncept. Prečítanie textu, schválenie a zverejnenie
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
 * ## Súbory
 *
 * Do 2026-10-10 skript posielal do `uploadDocument()` jeden súbor ľubovoľného
 * formátu — z čias pred ADR-011, keď PDF ešte nebolo povinné. Funkcia medzitým
 * prijíma `{ pdf, source }` a skript pri `--zapis` padal; nasucho to nebolo
 * vidno, lebo kontrola pozerala len metadáta. Manuály ISSF sa preto nahrávali
 * jednorazovým skriptom. Teraz kontrola nasucho číta aj súbory: PDF musí byť
 * naozaj PDF (podľa obsahu, nie prípony) a zdroj nesmie byť druhé PDF.
 *
 * Zdroj sa hľadá ako `<základ>.md` alebo `<základ>.docx`. Keď sú oba, skript
 * odmietne hádať, z ktorého má byť text.
 *
 * ## Metadáta
 *
 * Z `<základ>.meta.json` — názov súboru **nie je** dátový vstup.
 * Povinné: `title`, `sectionKey`, `companyCode`, `scope`, `accessLevel`,
 * `language`; nepovinné `documentKey` (inak sa berie `sectionKey`), `category`,
 * `tags`, `ownerDepartmentId`, `internalNumber` a ďalej to, čo na obrazovke
 * nasleduje hneď po nahratí:
 *
 *   · `folder` — priečinok knižnice, `id` alebo názov (`assignDocument()`).
 *     Názov musí byť v organizácii jednoznačný, inak treba `id`.
 *   · `responsibleEmail` — zodpovedná osoba konceptu (`saveDraftResponsible()`).
 *     Hľadá sa podľa e-mailu v organizácii, ukladá sa jej `persons.id`.
 *   · `author` — autor znenia (`versionMeta.author`, ADR-013).
 *
 * Pri `--nove-znenie` sa z metadát použije len identita (`companyCode`,
 * `documentKey`/`sectionKey`). Ostatné sa berie z existujúceho záznamu —
 * rovnako ako na obrazovke: nové znenie mení text, nie prístupnosť ani pôsobnosť.
 * Preto sa ignoruje aj `folder` (priečinok je vec dokumentu, nie znenia).
 * `responsibleEmail` a `author` patria konceptu, takže platia aj pre nové znenie.
 *
 * **Všetko alebo nič:** keď čo i len jeden súbor neprejde kontrolou, nezapíše
 * sa nič.
 */
import { readFileSync, existsSync } from "node:fs"
import { basename, extname } from "node:path"

import { getClient, getCollection } from "../src/lib/mongodb.ts"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents.ts"
import { checkMetadata, makeDocumentId, uploadDocument, saveDraftResponsible } from "../src/lib/libraryWrite.ts"
import { allFolders, assignDocument } from "../src/lib/folders.ts"
import { detectFileType } from "../src/lib/conversion.ts"
import { normalizeMeta, isEmptyMeta } from "../src/lib/versionMeta.ts"
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
  console.error("  npm run docs:import -- <súbor.pdf…> --actor <e-mail> [--nove-znenie] [--zapis]")
  console.error("")
  console.error("Vedľa každého PDF: <základ>.meta.json (povinné), <základ>.md alebo .docx (zdroj, nepovinné).")
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

/** `stanovy.pdf` → `stanovy`. Prípona sa odrezáva len posledná. */
function baseOf(file) {
  const ext = extname(file)
  return ext ? file.slice(0, -ext.length) : file
}

const metaPathFor = (file) => baseOf(file) + ".meta.json"

/** Upraviteľné zdroje, ktoré sa hľadajú vedľa PDF (D95). */
const SOURCE_EXTENSIONS = [".md", ".docx"]

/**
 * Zdroj vedľa PDF, alebo `null`. Dva naraz sa odmietnu — z ktorého by mal
 * vzniknúť text, je rozhodnutie človeka, nie poradia v zozname.
 */
function sourcePathFor(file) {
  const found = SOURCE_EXTENSIONS.map(ext => baseOf(file) + ext).filter(p => existsSync(p))
  if (found.length > 1) {
    throw new Error(`vedľa PDF je viac zdrojov (${found.map(p => basename(p)).join(", ")}) — nechaj jeden`)
  }
  return found[0] ?? null
}

/**
 * Súbor tak, ako ho dostane `uploadDocument()`, a jeho typ podľa obsahu.
 * `detectFileType()` je tá istá funkcia, ktorou ho overí knižnica — kontrola
 * nasucho tak odmietne presne to, čo by odmietol zápis.
 */
function readIncoming(path) {
  const data = readFileSync(path)
  return { incoming: { name: basename(path), data }, type: detectFileType(basename(path), data) }
}

/**
 * Priečinok z metadát: najprv `id`, potom názov. Rovnaký názov môže mať
 * viac priečinkov v rôznych vetvách stromu — vtedy sa nehádá.
 */
const foldersByCompany = new Map()
async function resolveFolder(companyCode, wanted) {
  if (!foldersByCompany.has(companyCode)) foldersByCompany.set(companyCode, await allFolders(companyCode))
  const all = foldersByCompany.get(companyCode)
  const byId = all.find(f => f.id === wanted)
  if (byId) return byId
  const key = wanted.toLocaleLowerCase("sk")
  const byName = all.filter(f => f.name.trim().toLocaleLowerCase("sk") === key)
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) {
    throw new Error(`priečinok „${wanted}" je v ${companyCode} viackrát (${byName.map(f => f.id).join(", ")}) — uveď id`)
  }
  throw new Error(`priečinok „${wanted}" v ${companyCode} neexistuje`)
}

/**
 * Zodpovedná osoba podľa e-mailu. Organizácia je v podmienke dotazu (D90);
 * vyradená osoba neprejde rovnako ako v `responsibleSnapshot()`.
 */
async function resolveResponsible(companyCode, email) {
  const persons = await getCollection(PERSONS_COLLECTION)
  const person = await persons.findOne(
    { companyCode, email, status: { $ne: "inactive" } },
    { projection: { id: 1, fullName: 1 } },
  )
  if (!person) throw new Error(`zodpovedná osoba ${email} nie je aktívna osoba organizácie ${companyCode}`)
  return { personId: person.id, fullName: person.fullName }
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
    if (extname(file).toLowerCase() !== ".pdf") {
      throw new Error("na vstupe je PDF (ADR-011) — zdroj .md/.docx a .meta.json sa hľadajú vedľa neho")
    }
    // `detectFileType()` pri `.pdf`, ktoré nie je PDF, hovorí o nepodporovanom
    // formáte — pri PDF z obrazovky to sedí, tu by to viedlo zle.
    const pdf = (() => { try { return readIncoming(file) } catch { return null } })()
    if (pdf?.type !== "pdf") throw new Error("súbor má príponu .pdf, ale obsah nie je PDF")
    const sourcePath = sourcePathFor(file)
    const source = sourcePath ? readIncoming(sourcePath) : null
    if (source?.type === "pdf") throw new Error(`${basename(sourcePath)} je PDF — zdroj má byť upraviteľný`)

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

    const metaSource = mode === "version"
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
    const meta = checkMetadata({ ...metaSource, companyCode }, tenantExtras(tenant))

    // Priečinok je vec dokumentu — pri novom znení sa nemení (ako metadáta).
    const folderWanted = String(raw.folder ?? "").trim()
    const folder = mode === "new" && folderWanted ? await resolveFolder(companyCode, folderWanted) : null

    const responsibleEmail = String(raw.responsibleEmail ?? "").trim().toLowerCase()
    const responsible = responsibleEmail ? await resolveResponsible(companyCode, responsibleEmail) : null

    const versionMeta = normalizeMeta({ author: raw.author })

    prepared.push({
      file, meta, documentId,
      files: { pdf: pdf.incoming, source: source?.incoming ?? null },
      folder, responsible,
      versionMeta: isEmptyMeta(versionMeta) ? null : versionMeta,
    })
    console.log(`${OK} ${meta.title}`)
    console.log(`    ${documentId} · ${mode === "version" ? "nové znenie" : "nový dokument"} · ${basename(file)}` +
      (sourcePath ? ` + zdroj ${basename(sourcePath)}` : " · bez zdroja, text z PDF"))
    if (folder) console.log(`    priečinok: ${folder.name}`)
    if (mode === "version" && folderWanted) console.log(`    ${INFO} folder sa pri novom znení ignoruje`)
    if (responsible) console.log(`    zodpovedná osoba: ${responsible.fullName}`)
    if (versionMeta.author) console.log(`    autor: ${versionMeta.author}`)
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
    const r = await uploadDocument(p.meta, p.files, actorEmail, mode, p.versionMeta)
    console.log(`${OK} ${p.meta.title} — koncept ${r.documentId}`)
    for (const w of r.warnings) console.log(`    ${INFO} ${w}`)
    // Tie isté kroky ako na obrazovke po nahratí — vlastné funkcie, vlastný
    // audit. Koncept už existuje, takže zlyhanie tu ho nezruší; hlási sa
    // menovite, aby sa dalo dokončiť v knižnici.
    if (p.folder) await assignDocument(p.meta.companyCode, r.documentId, p.folder.id, actorEmail)
    if (p.responsible) {
      await saveDraftResponsible(p.meta.companyCode, r.documentId, p.responsible.personId, actorEmail)
    }
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
