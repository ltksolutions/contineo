/**
 * kniznica.zapis.ts — nahratie, prevod a publikovanie dokumentu (D53).
 *
 * Toto je obrazovková obdoba `scripts/import.mjs`. Čo sa **nezdvojuje**:
 * členenie na chunky (`chunker.mjs`) ani validácia číselníkov
 * (`ciselniky.ts`) — obe sú spoločné. Zdvojený je len postup, lebo skript
 * berie hotový `.md` z disku a obrazovka nahratý súbor od človeka.
 *
 * ## Dva stavy, ktoré sa nemiešajú
 *
 * `processingStatus` je technický („čo urobili stroje"), `status` je
 * kurátorský („smie to ísť von"). Dokument môže byť prevedený a zároveň
 * neschválený — a to je bežný stav, nie chyba (CMS_KONCEPCIA A.2).
 *
 * ## Prečo sa publikuje zvlášť
 *
 * Nahratie **nič nepublikuje**. Prevod z PDF nikdy nie je dokonalý a text
 * normy je to, čo ľudia potvrdzujú; medzi „mám súbor" a „toto je znenie,
 * ktoré platí" musí stáť človek, ktorý to prečítal. Preto sa chunky robia až
 * pri publikovaní, nie pri nahratí.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { validAcknowledgements } from "./acknowledgements"
import { chunkText, DEFAULT_PROFILE } from "./chunker.mjs"
import { textFingerprint, chunkingFingerprint, needsReindex, CHUNKER_VERSION } from "./chunkIdentity"
import { textFixProblem, textDiff, versionFixProblem, type TextFixProblem } from "./textFix"
import { checkValue, checkList, KEY_PATTERN } from "./codelists"
import type { CodelistExtras } from "./codelists"
import { saveFile, deleteFile } from "./fileStore"
import { convert, FILE_TYPE_LABEL } from "./conversion"
import { writeAudit, diff } from "./audit"
import type { Chunk } from "./chunker.mjs"
import { toChunkerProfile, chunkingFor, type ChunkingProfile, type ChunkingProfileDef } from "./chunkingProfile"
import { TENANTS_COLLECTION } from "./tenants"
import { AppError } from "./appError"
import { publishBlock } from "./approvals"
import { allDepartments } from "./departments"
import { versionStateFor } from "./approvalsDb"

export const CHUNKS_COLLECTION = "document_chunks"

/** Organizácia len v tom rozsahu, v akom ju potrebuje členenie (D79). */
type ChunkingTenant = {
  chunkingProfiles?: ChunkingProfileDef[]
  chunking?: Partial<ChunkingProfile>
}

/**
 * Načíta profily členenia organizácie.
 *
 * **Číta sa tu, nie sa podáva zvonku.** Dovtedy profil prišiel ako parameter
 * z obrazovky — a to znamenalo, že dávkové preindexovanie prerezalo **všetky**
 * dokumenty profilom organizácie, aj tie, ktoré majú vlastný. Jedným kliknutím
 * by sa tak zahodilo celé ladenie a zistilo by sa to až tým, že model odcituje
 * nesprávny článok.
 */
async function chunkingTenant(companyCode: string): Promise<ChunkingTenant | null> {
  const col = await getCollection(TENANTS_COLLECTION)
  return await col.findOne({ companyCode }) as unknown as ChunkingTenant | null
}

/** Technický stav — čo s dokumentom urobili stroje. */
export type ProcessingState = "uploaded" | "converted" | "indexed" | "failed"

export interface OriginalFile {
  /** Identifikátor v GridFS. */
  id: string
  name: string
  contentType: string
  bytes: number
  type: string
  uploadedAt: Date
  uploadedBy: string
}

export interface DocumentMetadata {
  title: string
  /**
   * Identita dokumentu v rámci organizácie (D80).
   *
   * **Nie je to zaradenie.** `sectionKey` hovorí, kam dokument patrí;
   * `documentKey` hovorí, ktorý dokument to je. Dovtedy to bolo jedno pole
   * a dôsledok bol ten, že dva rôzne dokumenty s tým istým zaradením sa
   * nedali mať — desať zápisníc by potrebovalo desať zaradení.
   *
   * Nevyplnené sa dopĺňa zo `sectionKey`. Vďaka tomu má každý dokument
   * spred D80 rovnaký `documentId` ako predtým — a to je podstatné, lebo
   * `documentId` je cudzí kľúč v `acknowledgements`, `document_chunks`,
   * `assignments`, `approval_rounds`, `onboarding_tracks` aj v audite.
   */
  documentKey: string
  sectionKey: string
  companyCode: string
  scope: string
  accessLevel: string
  language: string
  category?: string
  sourceType?: string
  tags?: string[]
  /**
   * Oddelenie, ktoré dokument spravuje. Nepovinné.
   *
   * **Je to vlastníctvo, nie adresát.** Kto má dokument potvrdiť, vyplýva
   * z pridelení (`assignments`) a mení sa pri každom nástupe; kto ho
   * udržiava, je vlastnosť dokumentu a mení sa zriedka. Jedno pole pre oboje
   * by znamenalo, že smernicu o cestovných náhradách nemožno zveriť
   * ekonomickému oddeleniu bez toho, aby ju potvrdzovalo len ono.
   *
   * Odkazuje do stromu oddelení (D49) nemenným `id`, nie názvom: názov sa
   * mení, väzba nie. Voľný text by vrátil presne to, čo D49 odstránilo —
   * „Legislatíva", „legislatíva" a „Legislat." ako tri oddelenia.
   */
  ownerDepartmentId?: string
  /**
   * Interné číslo predpisu. Nepovinné.
   *
   * **Nie je to identita dokumentu** — tou je `documentKey` — a nie každý
   * predpis ho má. Preto nepovinné a preto **nikdy nevstupuje do formulky
   * potvrdenia**: medzera vo vete, pod ktorú sa človek podpisuje, vyzerá ako
   * chyba systému, nie ako to, že číslo neexistuje.
   */
  internalNumber?: string
}

export class LibraryError extends AppError {}

/**
 * Najväčšia dĺžka interného čísla.
 *
 * Nie je to technický limit, je to hranica medzi číslom a poznámkou. Do
 * stĺpca v zozname sa zmestí krátke označenie („12/2024"), nie veta.
 */
export const MAX_INTERNAL_NUMBER = 40

/** Interné číslo: orezané; prázdne znamená nevyplnené. */
function tidyInternalNumber(value: string | undefined): string | undefined {
  const v = (value ?? "").trim()
  if (!v) return undefined
  if (v.length > MAX_INTERNAL_NUMBER) {
    throw new LibraryError(
      "library.internalNumberTooLong",
      `Interné číslo je dlhšie než ${MAX_INTERNAL_NUMBER} znakov — do zoznamu patrí označenie, nie veta.`,
      { max: String(MAX_INTERNAL_NUMBER) },
    )
  }
  return v
}

/**
 * Overí, že oddelenie existuje v strome organizácie. Vráti `null`, keď nie je
 * vyplnené — pole je nepovinné a prázdna hodnota je platná odpoveď.
 *
 * **Prečo to nerobí `checkMetadata()`.** Oddelenia nie sú číselník v repozitári,
 * ale strom v databáze, iný pre každú organizáciu. `checkMetadata()` je čistá
 * funkcia bez databázy a práve to je jej hodnota — testuje sa bez clustera.
 * Kontrola sa preto robí v zápise, ktorý do databázy siaha tak či tak.
 */
export async function checkOwnerDepartment(
  companyCode: string,
  id: string | undefined | null,
): Promise<string | null> {
  const v = (id ?? "").trim()
  if (!v) return null
  const all = await allDepartments(companyCode)
  if (!all.some(o => o.id === v)) {
    throw new LibraryError(
      "library.unknownDepartment",
      "Také oddelenie v organizačnej štruktúre nie je.",
      { id: v },
    )
  }
  return v
}

/**
 * Identifikátor dokumentu — zhodne so skriptom, nezávisle od názvu súboru.
 *
 * Skladá sa z `documentKey`, nie zo `sectionKey` (D80). Keď `documentKey`
 * chýba, berie sa `sectionKey` — presne to správanie, aké platilo predtým,
 * takže sa žiadnemu existujúcemu dokumentu identita nemení.
 */
export function makeDocumentId(meta: {
  companyCode: string
  documentKey?: string
  sectionKey?: string
}): string {
  const key = (meta.documentKey ?? "").trim() || (meta.sectionKey ?? "").trim()
  return `${meta.companyCode}:${key}`.toLowerCase()
}

/** Overí metadáta z formulára proti číselníkom. Vyhadzuje `KniznicaError`. */
export function checkMetadata(
  input: Partial<DocumentMetadata>,
  extras?: CodelistExtras,
): DocumentMetadata {
  const title = (input.title ?? "").trim()
  if (!title) throw new LibraryError("library.titleRequired", "Názov dokumentu je povinný — bez neho je v zozname len kľúč.")

  // Kľúč dokumentu nie je položka číselníka — je to identita, ktorú si volí
  // kurátor. Overuje sa teda tvarom (`KEY_PATTERN`), nie príslušnosťou do
  // slovníka. Nevyplnený sa dopĺňa zo `sectionKey` (D80).
  const sectionKey = checkValue("sectionKey", input.sectionKey ?? "")
  const documentKey = ((input.documentKey ?? "").trim() || sectionKey).toLowerCase()
  if (!KEY_PATTERN.test(documentKey)) {
    throw new LibraryError(
      "library.documentKeyShape",
      "Kľúč dokumentu smie mať len malé písmená bez diakritiky, číslice a podčiarkovníky.",
      { key: documentKey },
    )
  }

  try {
    return {
      title,
      documentKey,
      sectionKey,
      companyCode: checkValue("companyCode", input.companyCode ?? ""),
      scope: checkValue("scope", input.scope ?? ""),
      accessLevel: checkValue("accessLevel", input.accessLevel ?? ""),
      language: checkValue("language", input.language ?? ""),
      category: input.category ? checkValue("category", input.category, extras) : undefined,
      sourceType: input.sourceType ? checkValue("sourceType", input.sourceType) : undefined,
      tags: checkList("tags", input.tags ?? [], extras),
      // Oddelenie sa tu len oreže; že naozaj existuje, overí
      // `checkOwnerDepartment()` až v zápise — strom je v databáze.
      ownerDepartmentId: (input.ownerDepartmentId ?? "").trim() || undefined,
      internalNumber: tidyInternalNumber(input.internalNumber),
    }
  } catch (e) {
    throw e
  }
}

/**
 * Zámer nahrávania (D80).
 *
 * **Povinný, bez predvolenej hodnoty.** Dovtedy sa zámer neuvádzal a zápis
 * bol `upsert` — nahratie na existujúci kľúč teda ticho prepísalo koncept,
 * metadáta aj pôvodný súbor existujúceho dokumentu a rozhranie o tom
 * nepovedalo nič. Predvolená hodnota by tú istú pascu len schovala hlbšie.
 */
export type UploadMode = "new" | "version"

export interface UploadResult {
  documentId: string
  markdown: string
  warnings: string[]
  isNew: boolean
}

/**
 * Nahrá súbor, prevedie ho a založí (alebo doplní) dokument v stave konceptu.
 *
 * Pôvodný súbor sa ukladá **pred** prevodom: keď prevod zlyhá, súbor v úložisku
 * zostane a dá sa naň pozrieť. Zmaže sa len vtedy, keď nevznikol ani záznam
 * dokumentu — teda keď by po ňom nezostala žiadna stopa, ako sa k nemu dostať.
 */
export async function uploadDocument(
  meta: DocumentMetadata,
  fileName: string,
  data: Buffer,
  actor: string,
  mode: UploadMode,
): Promise<UploadResult> {
  const documentId = makeDocumentId(meta)
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const existing = await col.findOne({ documentId })

  // **Kontrola pred uložením súboru, nie po ňom.** Opačné poradie by pri
  // odmietnutej kolízii nechalo v úložisku súbor, ku ktorému nevedie žiadny
  // záznam — a nikto by ho tam nehľadal.
  if (mode === "new" && existing) {
    throw new LibraryError(
      "library.documentExists",
      `Dokument ${documentId} už existuje. Nové znenie sa nahráva na jeho detaile, nie ako nový dokument.`,
      { documentId, title: String(existing.title ?? documentId) },
    )
  }
  if (mode === "version" && !existing) {
    throw new LibraryError(
      "library.documentNotFound",
      "Taký dokument tu nie je.",
    )
  }

  // Pred uložením súboru, nie po ňom — z rovnakého dôvodu ako kontrola
  // kolízie kľúča vyššie: odmietnutý zápis nemá nechať v úložisku súbor,
  // ku ktorému nevedie žiadny záznam.
  const ownerDepartmentId = await checkOwnerDepartment(meta.companyCode, meta.ownerDepartmentId)

  const file = await saveFile(meta.companyCode, fileName, "application/octet-stream", data, actor)

  let converted
  try {
    converted = await convert(fileName, data)
  } catch (e) {
    await deleteFile(meta.companyCode, file.id)
    throw e
  }

  const now = new Date()

  const original: OriginalFile = {
    id: file.id,
    name: fileName,
    contentType: file.contentType,
    bytes: file.bajtov,
    type: converted.type,
    uploadedAt: now,
    uploadedBy: actor,
  }

  await col.updateOne(
    { documentId },
    {
      $set: {
        documentId,
        title: meta.title,
        slug: documentId.replace(/:/g, "-"),
        documentKey: meta.documentKey,
        sectionKey: meta.sectionKey,
        companyCode: meta.companyCode,
        scope: meta.scope,
        accessLevel: meta.accessLevel,
        language: meta.language,
        category: meta.category ?? null,
        sourceType: meta.sourceType ?? converted.type,
        tags: meta.tags ?? [],
        ownerDepartmentId: ownerDepartmentId,
        internalNumber: meta.internalNumber ?? null,
        // Koncept: text existuje, ale nikto ho ešte neprečítal a nepustil von.
        draftMarkdown: converted.markdown,
        processingStatus: "converted" as ProcessingState,
        processingError: null,
        conversion: { method: converted.method, warnings: converted.warnings, at: now },
        originalFile: original,
        updatedAt: now,
        updatedBy: actor,
      },
      $setOnInsert: { createdAt: now, createdBy: actor, status: "draft", versions: [] },
    },
    { upsert: true },
  )

  await writeAudit({
    companyCode: meta.companyCode,
    subject: "document",
    action: existing ? "nahrate-nove-znenie" : "zalozene",
    actor: actor,
    targetId: documentId,
    targetLabel: meta.title,
    note: `${FILE_TYPE_LABEL[converted.type]} · ${fileName} · ${converted.method}`,
  })

  return {
    documentId,
    markdown: converted.markdown,
    warnings: converted.warnings,
    isNew: !existing,
  }
}

/** Uloží upravený Markdown konceptu. Publikované znenie sa tým nemení. */
export async function saveDraft(
  companyCode: string,
  documentId: string,
  markdown: string,
  actor: string,
): Promise<void> {
  const text = (markdown ?? "").trim()
  if (!text) throw new LibraryError("library.emptyText", "Prázdny text sa uložiť nedá — dokument by nemal čo obsahovať.")

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { documentId, companyCode },
    { $set: { draftMarkdown: text, updatedAt: new Date(), updatedBy: actor } },
  )
  if (!r.matchedCount) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")
}

export interface PublishResult {
  versionId: string
  chunks: number
  archived: number
  alreadyDone: boolean
}

/**
 * Publikuje koncept ako novú verziu: rozseká ho a zaindexuje.
 *
 * **`effectiveFrom` je povinné.** Znenie bez dátumu platnosti sa nedá ani
 * potvrdiť (D6) a potvrdzovacia formulka ho obsahuje doslovne (D28), takže by
 * vznikla úloha, ktorá sa nedá splniť.
 *
 * **`label` píše človek.** Kým ho písal skript, bolo to „1.0" pri všetkých
 * deviatich normách — vymyslené číslo, ktoré sa objavuje v zázname
 * o potvrdení a nedá sa overiť.
 *
 * Verzia sa počíta z **výsledných chunkov**, nie zo zdrojového textu: oprava
 * v chunkeri je rovnako podstatná zmena ako oprava v texte, a keď sa hashoval
 * zdroj, tichým dôsledkom bolo, že sa nové členenie nikdy nezapísalo.
 */
export async function publish(
  companyCode: string,
  documentId: string,
  input: { label: string; effectiveFrom: Date; effectiveFromSource?: string; changeNote?: string },
  actor: string,
): Promise<PublishResult> {
  const label = (input.label ?? "").trim()
  if (!label) {
    throw new LibraryError(
      "library.labelRequired",
      "Označenie znenia je povinné — objaví sa doslovne v každom zázname o potvrdení. " +
      "Napíš to, čo je v dokumente (napríklad: úplné znenie z 27. 2. 2026), nie vymyslené číslo.",
    )
  }
  if (!(input.effectiveFrom instanceof Date) || Number.isNaN(input.effectiveFrom.getTime())) {
    throw new LibraryError("library.effectiveFromRequired", "Dátum platnosti je povinný — bez neho sa znenie nedá potvrdiť (D6).")
  }

  /*
   * Zdroj dátumu je **povinný pri publikovaní** (D82).
   *
   * Nie je to evidencia pre evidenciu. Odkedy sa dátum po prvom potvrdení
   * zamyká, okno na bezbolestnú opravu je od publikovania po prvé potvrdenie —
   * teda minúty. Obrana sa tým presúva dopredu: kto musí napísať „uznesenie
   * VV SFZ č. … z …", ten sa doň pozrie. Útočí to na príčinu, nie na následok.
   *
   * Platí len pre **nové** publikovanie; existujúcich znení sa to nedotýka.
   */
  if (!input.effectiveFromSource?.trim()) {
    throw new LibraryError(
      "library.effectiveFromSourceRequired",
      "Zdroj dátumu platnosti je povinný — napíš, odkiaľ dátum je (napríklad uznesenie VV SFZ č. … z …). " +
      "Po prvom potvrdení sa dátum už meniť nedá.",
    )
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

  const markdown = String(doc.draftMarkdown ?? "").trim()
  if (!markdown) throw new LibraryError("library.documentHasNoText", "Dokument nemá text — najprv nahraj súbor alebo napíš znenie.")

  const meta = {
    title: String(doc.title ?? ""),
    sectionKey: String(doc.sectionKey ?? ""),
    companyCode,
    scope: String(doc.scope ?? ""),
    accessLevel: String(doc.accessLevel ?? ""),
    language: String(doc.language ?? ""),
  }
  const tags = Array.isArray(doc.tags) ? (doc.tags as string[]) : []

  const profile = chunkingFor(await chunkingTenant(companyCode), doc.chunkingProfile as string | undefined)
  const forChunker = toChunkerProfile(profile)
  const { chunky: chunks } = chunkText(markdown, { nazovDokumentu: meta.title, profil: forChunker })
  if (!chunks.length) {
    throw new LibraryError(
      "library.noChunks",
      "Z textu nevznikol ani jeden úsek. Skontroluj, či má dokument členenie na články alebo nadpisy.",
    )
  }

  const toDb = (ch: Chunk) => ({
    chunkIndex: ch.chunkIndex,
    text: ch.text,
    heading: ch.heading,
    articleRef: ch.articleRef ?? null,
    chunkType: ch.typ ?? "clanok",
    sectionKey: meta.sectionKey,
    companyCode,
    scope: meta.scope,
    accessLevel: meta.accessLevel,
    language: meta.language,
    tags,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "voyage-4",
    embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1024),
    embeddingProvider: process.env.EMBEDDING_KIND ?? "atlas-auto",
  })

  // **Identita znenia je odtlačok textu, nie chunkov (D57).** Kým sa počítala
  // z chunkov, vyladenie chunkera vyrobilo novú verziu — a tým aj povinnosť
  // potvrdiť normu znova, hoci sa v nej nezmenilo ani slovo. Označenie
  // a dátum platnosti do identity nevstupujú zámerne: preklep v nich sa musí
  // dať opraviť bez toho, aby sa rozbili existujúce potvrdenia.
  const versionId = textFingerprint(markdown)
  const chunkingId = chunkingFingerprint(chunks, { ...DEFAULT_PROFILE, ...forChunker })
  const now = new Date()

  // Rovnaké znenie už publikované? Nič sa nedeje — publikovanie je idempotentné.
  const existing = (doc.versions as { versionId: string }[] | undefined)?.some(v => v.versionId === versionId)
  if (existing) return { versionId, chunks: chunks.length, archived: 0, alreadyDone: true }

  /*
   * ── Brána: neschválený text sa nezverejňuje (D73 posunuté o krok skôr) ──
   *
   * Dovtedy brána stála až pri prideľovaní. To znamenalo, že neschválené
   * znenie sa zverejniť **dalo**: objavilo sa v knižnici, RAG z neho
   * odpovedal, len sa nedalo prideliť na potvrdenie. Kto si predpis nájde
   * sám, číta ho bez ohľadu na to, či ho niekto schválil.
   *
   * Stojí to tu, **v `publish()`, nie v serverovej akcii**: akcií môže raz
   * pribudnúť viac, a brána, ktorú sa dá obísť iným vstupom, nie je brána.
   *
   * Stojí to **až za kontrolou idempotencie** a to je zámer, nie náhoda:
   * opätovné zverejnenie rovnakého textu sa má naďalej ticho nič-nedeje, aj
   * pri znení spred zavedenia schvaľovania (D74). Keby brána predchádzala,
   * dnešný skúšobný korpus by sa prestal dať znovu zverejniť.
   *
   * Kolá sa vedú na `versionId`, teda na **odtlačku textu** (D57) — a keďže
   * tento odtlačok ešte nie je medzi `doc.versions`, ide o odtlačok
   * konceptu. Dôsledok: akákoľvek úprava textu po schválení odtlačok zmení
   * a schválenie prestane platiť. Presne to žiada D28 — potvrdzuje sa text,
   * ktorý ľudia videli.
   */
  const block = publishBlock({ state: await versionStateFor(companyCode, documentId, versionId) })
  if (block === "publish.inReview") {
    throw new LibraryError(
      block,
      "Schvaľovanie tohto znenia práve beží. Počkaj na rozhodnutie — zverejniť sa dá až schválené znenie.",
    )
  }
  if (block) {
    throw new LibraryError(
      block,
      "Znenie nie je schválené. Najprv ho predlož na schválenie; zverejniť sa dá, až keď schvaľovatelia rozhodnú (D73). " +
      "Pozor: po schválení sa text už nesmie meniť — každá úprava zmení odtlačok a schválenie tým prestane platiť (D28).",
    )
  }

  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  // Staré chunky sa **archivujú, nemažú** (D6): do vyhľadávania vstupujú len
  // aktívne, ale otázka „čo tam stálo vlani" musí mať odpoveď.
  const archive = await chunkCol.updateMany(
    { documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: now } },
  )

  /*
   * S novým znením strácajú platnosť aj **overené odpovede z neho odvodené**
   * (D11). Zastaraný pár je horší než žiadny: znie autoritatívne a odvoláva
   * sa na text, ktorý už neplatí.
   *
   * Import je zámerne až tu, vnútri funkcie: `curation.ts` si odtiaľto berie
   * `CHUNKS_COLLECTION`, takže pevný import navrchu by z oboch súborov
   * spravil kruh. Zlyhanie sa nezapočíta — zverejnenie znenia je dôležitejšie
   * než upratanie párov a to sa dá dobehnúť (`npm run check` to vypíše).
   */
  try {
    const { expireCurationFor } = await import("./curation")
    const expired = await expireCurationFor(companyCode, documentId, now)
    if (expired) console.log(`[kuracia] archivovanych overenych odpovedi: ${expired}`)
  } catch (e) {
    console.error("[kuracia] archivacia overenych odpovedi zlyhala:", e)
  }

  await chunkCol.insertMany(
    chunks.map(ch => ({
      ...toDb(ch),
      documentId,
      versionId,
      chunkingId,
      verziaChunkera: CHUNKER_VERSION,
      embeddedAt: now,
      isActive: true,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      createdAt: now,
    })),
    { ordered: false },
  )

  // Predchádzajúcemu otvorenému zneniu sa uzavrie platnosť — až teraz, keď
  // nové platnosť naozaj má.
  await col.updateOne(
    { documentId, companyCode },
    { $set: { "versions.$[stara].effectiveTo": input.effectiveFrom, "versions.$[stara].isActive": false } },
    { arrayFilters: [{ "stara.effectiveTo": null, "stara.versionId": { $ne: versionId } }] },
  )

  await col.updateOne(
    { documentId, companyCode },
    {
      $set: {
        versionId,
        chunkingId,
        markdown,
        status: "published",
        processingStatus: "indexed" as ProcessingState,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        updatedAt: now,
        updatedBy: actor,
      },
      $push: {
        versions: {
          versionId,
          label,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          isActive: true,
          contentHash: versionId,
          effectiveFromSource: input.effectiveFromSource?.trim() || undefined,
          changeNote: input.changeNote?.trim() || undefined,
          markdown,
          // `requiresReacknowledgement` sa zámerne nenastavuje: vypĺňa ho
          // človek (D30) a `false` by bolo tiché rozhodnutie, že zmena nie je
          // podstatná. Chýbajúce pole znamená „nikto zatiaľ nerozhodol".
          publishedAt: now,
          publishedBy: actor,
        },
      },
    } as never,
  )

  await writeAudit({
    companyCode, subject: "document", action: "published", actor: actor,
    targetId: documentId, targetLabel: `${meta.title} — ${label}`,
    note: `${chunks.length} úsekov · platné od ${input.effectiveFrom.toISOString().slice(0, 10)}` +
      (input.effectiveFromSource ? ` · zdroj: ${input.effectiveFromSource}` : ""),
  })

  return { versionId, chunks: chunks.length, archived: archive.modifiedCount, alreadyDone: false }
}


/**
 * Upraví údaje o dokumente.
 *
 * **Kľúč dokumentu (`documentKey`) a organizácia sa meniť nedajú.** Tvoria
 * `documentId` a ten je v `document_chunks`, v prideleniach aj v záznamoch
 * o potvrdení. Zmeniť ho by neznamenalo premenovanie, ale vznik druhého
 * dokumentu, ku ktorému by sa história nedostala. Kto sa pomýlil v kľúči,
 * nahrá dokument znova pod správnym.
 *
 * `sectionKey` je od D80 len **zaradenie** a identitu netvorí — zmeniť sa
 * teda technicky dá. Táto funkcia to zatiaľ neponúka; je to samostatné
 * rozhodnutie (D80/C1), nie vedľajší účinok oddelenia kľúča.
 *
 * Názov sa meniť **dá** — a je to vedomé rozhodnutie: objaví sa v ďalších
 * potvrdeniach, ale staré záznamy si nesú kópiu názvu v čase potvrdenia,
 * takže sa spätne nezmenia (rovnaký princíp ako pri adrese osoby, D45).
 */
export async function saveMetadata(
  companyCode: string,
  documentId: string,
  input: Partial<DocumentMetadata>,
  actor: string,
  extras?: CodelistExtras,
): Promise<void> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const before = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!before) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

  // Kľúč, zaradenie aj organizácia sa berú z existujúceho záznamu, nie
  // z formulára. `documentKey` chýba dokumentom spred D80 — vtedy platí
  // `sectionKey`, presne ako pri `makeDocumentId()`.
  const meta = checkMetadata({
    ...input,
    documentKey: String(before.documentKey ?? before.sectionKey ?? ""),
    sectionKey: String(before.sectionKey ?? ""),
    companyCode,
  }, extras)

  const ownerDepartmentId = await checkOwnerDepartment(companyCode, meta.ownerDepartmentId)

  const set: Record<string, unknown> = {
    title: meta.title,
    scope: meta.scope,
    accessLevel: meta.accessLevel,
    language: meta.language,
    category: meta.category ?? null,
    tags: meta.tags ?? [],
    // Obe nepovinné polia sa zapisujú vždy, aj keď sú prázdne: formulár je
    // úplný, takže nevyplnené pole znamená „zmaž to", nie „nechaj, ako bolo".
    ownerDepartmentId: ownerDepartmentId,
    internalNumber: meta.internalNumber ?? null,
    updatedAt: new Date(),
    updatedBy: actor,
  }

  await col.updateOne({ documentId, companyCode }, { $set: set })

  // Chunky nesú kópiu filtrov (`accessLevel`, `language`, `scope`, `tags`) —
  // bez tejto vety by sa zmena prejavila v knižnici, ale vyhľadávanie by
  // ďalej filtrovalo podľa starých hodnôt. Tichý rozpor presne toho druhu,
  // ktorý sa hľadá týždne.
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  /*
   * **Overené odpovede sa z tejto hromadnej zmeny vynímajú** (D11).
   *
   * Pár vzniká nad viacerými predpismi a jeho úroveň je najprísnejšia z nich.
   * Keby sa mu tu prepísala úrovňou jedného dokumentu, prepnutie toho jedného
   * na verejný by zverejnilo aj to, čo v páre zaznelo z interného. Preto sa
   * párom počíta znova, nižšie.
   */
  await chunkCol.updateMany(
    { documentId, sourceType: { $ne: "qa" } },
    {
      $set: {
        scope: meta.scope,
        accessLevel: meta.accessLevel,
        language: meta.language,
        tags: meta.tags ?? [],
      },
    },
  )

  /*
   * Prepočet úrovne párom. Import až tu — `curation.ts` si odtiaľto berie
   * `CHUNKS_COLLECTION`, takže pevný import navrchu by spravil kruh.
   *
   * **Zlyhanie sa tu neprehliada.** Pri archivácii párov sa dá zhovievavosť
   * obhájiť — nezarchivovaný pár je zastaraný, nie nebezpečný. Tu ide
   * o prístup: pár, ktorému sa úroveň neprepočítala, môže zostať verejný nad
   * obsahom, ktorý sa medzitým stal interným. Preto sa pri zlyhaní **všetky
   * páry z tohto dokumentu stiahnu na `internal`** — a keď zlyhá aj to,
   * chyba ide von. Radšej pár, ktorý nikto nenájde, než pár, ktorý uvidí
   * niekto, kto nemá.
   */
  try {
    const { reconcileCurationAccess } = await import("./curation")
    const changed = await reconcileCurationAccess(companyCode, documentId)
    if (changed) console.log(`[kuracia] prepocitany pristup parom: ${changed}`)
  } catch (e) {
    console.error("[kuracia] prepocet pristupu parom zlyhal, stahujem na internal:", e)
    await chunkCol.updateMany(
      { companyCode, documentId, sourceType: "qa" },
      { $set: { accessLevel: "internal" } },
    )
    await chunkCol.updateMany(
      { companyCode, derivedFrom: documentId, sourceType: "qa" },
      { $set: { accessLevel: "internal" } },
    )
  }

  const beforeMeta = {
    title: before.title, scope: before.scope, accessLevel: before.accessLevel,
    language: before.language, category: before.category ?? null, tags: before.tags ?? [],
    ownerDepartmentId: before.ownerDepartmentId ?? null,
    internalNumber: before.internalNumber ?? null,
  }
  const afterMeta = {
    title: meta.title, scope: meta.scope, accessLevel: meta.accessLevel,
    language: meta.language, category: meta.category ?? null, tags: meta.tags ?? [],
    ownerDepartmentId: ownerDepartmentId,
    internalNumber: meta.internalNumber ?? null,
  }
  await writeAudit({
    companyCode, subject: "document", action: "changed", actor: actor,
    targetId: documentId, targetLabel: meta.title,
    changes: diff(beforeMeta, afterMeta),
  })
}

/**
 * Preindexuje dokument **bez novej verzie** (D57).
 *
 * Toto je tá operácia, kvôli ktorej sa identita rozdelila. Vyladí sa profil
 * členenia, spustí sa toto — a úseky sa vymenia pri tom istom `versionId`.
 * `versions[]` sa nedotkne, potvrdenia zostávajú platné, nikomu nenaskočí
 * povinnosť potvrdzovať znova.
 *
 * Staré úseky sa **archivujú, nemažú** (D6): do vyhľadávania vstupujú len
 * aktívne, ale otázka „ako to bolo narezané vlani" musí mať odpoveď, keď sa
 * bude hľadať, prečo model kedysi odcitoval niečo iné.
 */
export async function reindex(
  companyCode: string,
  documentId: string,
  actor: string,
): Promise<{ chunks: number; archived: number; alreadyDone: boolean; chunkingId: string }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as { versionId: string; isActive?: boolean; markdown?: string }[]
  const effective = versions.find(v => v.isActive)
  const markdown = String(effective?.markdown ?? doc.markdown ?? "").trim()
  if (!markdown || !effective) {
    throw new LibraryError(
      "library.noPublishedVersion",
      "Dokument nemá publikované znenie — preindexovať sa dá len to, čo už je vonku.",
    )
  }

  const meta = {
    title: String(doc.title ?? ""),
    sectionKey: String(doc.sectionKey ?? ""),
    scope: String(doc.scope ?? ""),
    accessLevel: String(doc.accessLevel ?? ""),
    language: String(doc.language ?? ""),
  }
  const tags = Array.isArray(doc.tags) ? (doc.tags as string[]) : []

  // Profil **tohto dokumentu**, nie organizácie (D79).
  const profile = chunkingFor(await chunkingTenant(companyCode), doc.chunkingProfile as string | undefined)
  const forChunker = toChunkerProfile(profile)
  const { chunky: chunks } = chunkText(markdown, { nazovDokumentu: meta.title, profil: forChunker })
  if (!chunks.length) {
    throw new LibraryError("library.noChunksProfile", "Z textu nevznikol ani jeden úsek — skontroluj profil členenia.")
  }

  const chunkingId = chunkingFingerprint(chunks, { ...DEFAULT_PROFILE, ...forChunker })
  if (doc.chunkingId === chunkingId) {
    return { chunks: chunks.length, archived: 0, alreadyDone: true, chunkingId }
  }

  /*
   * ── Poistka: preindexovanie nesmie stratiť rozpoznané články ──
   *
   * Nájdené 2026-09-14. Uložené úseky deviatich predpisov majú 99 % článkov
   * rozpoznaných, ale keď sa dnešný `versions[].markdown` nareže znova,
   * vyjde **0 %** — text v databáze medzitým prešiel prepisom cez jazykový
   * model a hlavičky v ňom nie sú `Článok 5`, ale `## čl. 5 — Názov`.
   * Chunker taký tvar nepozná (D1).
   *
   * Tlačidlo „Preindexovať" by teda knižnicu **pokazilo**: citácie by prišli
   * o odkaz na článok a vyhľadávanie o to, čoho sa chytiť. A zistilo by sa to
   * až tým, že model prestane citovať presne.
   *
   * Preto sa zápis odmietne, keď rozpoznanie článkov spadne z väčšiny na
   * menšinu. Nie je to prepínač na obídenie — je to tvrdenie, že takto
   * narezaný dokument je horší než ten, čo tam je. Keď sa chunker naučí nový
   * tvar hlavičiek, poistka prejde sama.
   */
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const before = await chunkCol.countDocuments({ documentId, isActive: true })
  const beforeWithArticle = await chunkCol.countDocuments({
    documentId, isActive: true, articleRef: { $ne: null },
  })
  const afterWithArticle = chunks.filter(ch => ch.articleRef).length
  const share = (withArticle: number, total: number) => (total > 0 ? withArticle / total : 0)
  const wouldLose =
    before > 0 &&
    share(beforeWithArticle, before) >= 0.5 &&
    share(afterWithArticle, chunks.length) < 0.5

  if (wouldLose) {
    throw new LibraryError(
      "library.reindexWouldLoseArticles",
      `Preindexovanie by tento dokument pokazilo: dnes má ${beforeWithArticle} zo ${before} úsekov ` +
      `s rozpoznaným článkom, po narezaní by ich malo ${afterWithArticle} z ${chunks.length}. ` +
      "Text v databáze má hlavičky v inom tvare, než aký chunker pozná.",
      { before: beforeWithArticle, beforeTotal: before, after: afterWithArticle, afterTotal: chunks.length },
    )
  }

  const now = new Date()
  const archive = await chunkCol.updateMany(
    { documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: now } },
  )

  await chunkCol.insertMany(
    chunks.map(ch => ({
      chunkIndex: ch.chunkIndex,
      text: ch.text,
      heading: ch.heading,
      articleRef: ch.articleRef ?? null,
      chunkType: ch.typ ?? "clanok",
      sectionKey: meta.sectionKey,
      companyCode,
      scope: meta.scope,
      accessLevel: meta.accessLevel,
      language: meta.language,
      tags,
      embeddingModel: process.env.EMBEDDING_MODEL ?? "voyage-4",
      embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1024),
      embeddingProvider: process.env.EMBEDDING_KIND ?? "atlas-auto",
      documentId,
      // Tá istá verzia znenia — mení sa len členenie.
      versionId: effective.versionId,
      chunkingId,
      verziaChunkera: CHUNKER_VERSION,
      embeddedAt: now,
      isActive: true,
      effectiveFrom: (doc.effectiveFrom as Date | null) ?? null,
      effectiveTo: null,
      createdAt: now,
    })),
    { ordered: false },
  )

  await col.updateOne(
    { documentId, companyCode },
    { $set: { chunkingId, updatedAt: now, updatedBy: actor } },
  )

  await writeAudit({
    companyCode, subject: "document", action: "reindexed", actor: actor,
    targetId: documentId, targetLabel: meta.title,
    note: `${chunks.length} úsekov · ${archive.modifiedCount} archivovaných · ` +
      "znenie ani potvrdenia sa nemenili",
  })

  return { chunks: chunks.length, archived: archive.modifiedCount, alreadyDone: false, chunkingId }
}

/**
 * Opraví údaje publikovaného znenia — označenie, dátum, citáciu, poznámku.
 *
 * `versionId` je odtlačok textu, takže oprava týchto údajov identitu nemení
 * a potvrdenia sa nerušia. To ale **neplatí bez výhrady pre dátum platnosti**:
 * potvrdzovacia formulka ho obsahuje doslovne a záznam si ju uložil ako text.
 * Ak bol dátum zlý, tí ľudia potvrdili tvrdenie, ktoré nie je pravdivé —
 * a ticho im ho opraviť pod už podpísaným záznamom by z auditu spravilo
 * niečo, čo sa dá spätne meniť.
 *
 * **Od D82 sa preto po prvom platnom potvrdení zamykajú** — označenie aj
 * dátum. Odomkne ich jedine hromadné odvolanie potvrdení toho znenia
 * (`revokeVersion()`); potom sa údaj opraví a ľudia potvrdia opravenú
 * formulku.
 *
 * Skoršia voľba „oprava zápisu, potvrdenia zostávajú" (ADR-007) je zrušená.
 * Stála na predpoklade, že podľa zlého dátumu nikto nekonal — a ten sa nedá
 * overiť. Druhá voľba, „podstatná zmena", nastavovala
 * `requiresReacknowledgement`, ktorý **nikto nečíta**, takže nerobila nič.
 *
 * Poznámka o zmene a zdroj dátumu sa opravujú naďalej: vo formulke nie sú.
 */
export async function fixVersion(
  companyCode: string,
  documentId: string,
  versionId: string,
  input: {
    label?: string
    effectiveFrom?: Date
    effectiveFromSource?: string
    changeNote?: string
    reason: string
  },
  actor: string,
): Promise<{ acknowledgementCount: number; reacknowledged: boolean }> {
  const reason = input.reason?.trim() ?? ""
  if (!reason) {
    throw new LibraryError(
      "library.reasonRequired",
      "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
    )
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as {
    versionId: string; label: string; effectiveFrom: Date | null
  }[]
  const v = versions.find(x => x.versionId === versionId)
  if (!v) throw new LibraryError("library.versionNotFound", "Také znenie tu nie je.")

  // Brána pri zmene dátumu sa pýta na **platné** potvrdenia: odvolané netreba
  // chrániť, tie už neplatia.
  const acknowledgementCount = (await validAcknowledgements({ companyCode, versionId })).length

  const changesDate = input.effectiveFrom instanceof Date &&
    (!v.effectiveFrom || new Date(v.effectiveFrom).getTime() !== input.effectiveFrom.getTime())

  const changesLabel = Boolean(input.label?.trim()) && input.label!.trim() !== v.label

  const problem = versionFixProblem({
    acknowledgements: acknowledgementCount,
    changesLabel,
    changesEffectiveFrom: changesDate,
    reason,
  })
  if (problem === "versionFix.locked") {
    throw new LibraryError(
      problem,
      `Označenie a dátum platnosti sa už meniť nedajú — toto znenie potvrdilo ${acknowledgementCount} ľudí ` +
      "a oba údaje sú v podpísanej formulke. Najprv treba odvolať potvrdenia tohto znenia.",
      { count: acknowledgementCount },
    )
  }

  // `requiresReacknowledgement` sa od D82 **nezapisuje**. Pole zostáva v type
  // kvôli starým záznamom a histórii verzií; nikto ho nikdy nečítal ako
  // povinnosť a nastavovať ho ďalej by znamenalo klamať aj naďalej.
  const reacknowledge = false

  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: actor }
  if (input.label?.trim()) set["versions.$[v].label"] = input.label.trim()
  if (input.effectiveFrom instanceof Date) {
    set["versions.$[v].effectiveFrom"] = input.effectiveFrom
    // Dokument nesie kópiu platnosti kvôli filtrom; bez tejto vety by sa
    // rozišla s verziou a vyhľadávanie by filtrovalo podľa starého dátumu.
    if (doc.versionId === versionId) set.effectiveFrom = input.effectiveFrom
  }
  if (input.effectiveFromSource !== undefined) {
    set["versions.$[v].effectiveFromSource"] = input.effectiveFromSource.trim() || undefined
  }
  if (input.changeNote !== undefined) {
    set["versions.$[v].changeNote"] = input.changeNote.trim() || undefined
  }
  await col.updateOne(
    { documentId, companyCode },
    {
      $set: set,
      $push: {
        // `fromLabel` a `fromEffectiveFrom` sú stav **pred** opravou. Bez nich
        // by sa z histórie dalo prečítať, že sa niečo zmenilo, ale nie na čo.
        "versions.$[v].fixes": {
          at: new Date(),
          by: actor,
          reason,
          requiresReacknowledgement: reacknowledge,
          fromLabel: v.label,
          fromEffectiveFrom: v.effectiveFrom ?? null,
        },
      },
    } as never,
    { arrayFilters: [{ "v.versionId": versionId }] },
  )

  await writeAudit({
    companyCode, subject: "document", action: "version-fix", actor: actor,
    targetId: documentId, targetLabel: `${String(doc.title ?? documentId)} — ${v.label}`,
    changes: diff(
      { label: v.label, effectiveFrom: v.effectiveFrom ?? null },
      { label: input.label?.trim() ?? v.label, effectiveFrom: input.effectiveFrom ?? v.effectiveFrom ?? null },
    ),
    note: `${reason}${acknowledgementCount > 0 ? ` · potvrdení: ${acknowledgementCount}` : ""}` +
      (reacknowledge ? " · vyžaduje nové potvrdenie" : ""),
  })

  return { acknowledgementCount, reacknowledged: reacknowledge }
}

/** Prečo oprava textu neprešla — hlásenia sú tu, pravidlo v `lib/textFix.ts`. */
const TEXT_FIX_MESSAGE: Record<TextFixProblem, string> = {
  "textFix.notContentManager": "Text znenia opravuje správca obsahu.",
  "textFix.noEffectiveVersion":
    "Dokument nemá platné znenie. Opraviť sa dá len to, čo je vonku — archivované znenie je doklad o tom, čo platilo vtedy.",
  "textFix.emptyText": "Koncept nemá text. Oprava, po ktorej nezostane nič, nie je oprava.",
  "textFix.draftChanged":
    "Koncept sa medzitým zmenil. Pozri si rozdiel znova — uložiť sa má to, čo si videl.",
  "textFix.noChange": "Text sa od platného znenia nelíši. Nie je čo opravovať.",
  "textFix.reasonRequired":
    "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, čo sa v znení zmenilo a prečo pri tom potvrdenia zostali platné.",
}

/**
 * Opraví **text** platného znenia — bez novej verzie a bez straty potvrdení.
 *
 * Dokument je schválený, pridelený ľuďom a v RAG. Príde pripomienka, že je v ňom
 * preklep, ktorý nemení význam. Dovtedy sa to dalo vyriešiť jedine novým znením:
 * nový `versionId`, nová povinnosť pre každého, kto už potvrdil. Za jednu čiarku.
 *
 * **`versionId` sa nemení.** Je to identita znenia, nie odtlačok jeho dnešného
 * textu — visia na ňom potvrdenia, pridelenia, trasy aj chunky. Mení sa
 * `contentHash`, ktorý odteraz hovorí „takto ten text vyzerá teraz“; dovtedy
 * boli obe čísla zhodné, lebo sa nemali ako rozísť.
 *
 * **Potvrdenia zostávajú platné.** Formulka, ktorú ľudia podpísali, cituje názov,
 * označenie a dátum platnosti (D28), nie text — oprava čiarky z nej nerobí
 * nepravdivé tvrdenie. Keby sa menil význam, nie je to oprava, ale nové znenie;
 * rozhodnúť to musí človek, systém ten rozdiel nepozná (D30).
 *
 * **Text sa berie z konceptu, nie z formulára.** Znenie predpisu má aj sto
 * kilobajtov a posielať ho cez formulár len preto, aby sa vrátilo tam, odkiaľ
 * prišlo, je zbytočná cesta, na ktorej sa dá pomýliť. Formulárom ide **odtlačok**
 * toho, čo mal človek pred očami, a ten sa overí.
 *
 * **Schválenie zostáva pri znení, hoci text sa zmenil — a treba to povedať
 * nahlas.** Kolá visia na `versionId` a ten sa nemení, takže po oprave je
 * schválený text T a vonku text T'. Je to vedomá cena tejto cesty a presne
 * dôvod, prečo je dôvod povinný, rozdiel musí byť vidieť a celý predchádzajúci
 * text sa odkladá: opravovať sa smie len to, čo význam nemení. Kto mení význam,
 * publikuje nové znenie a to prejde schvaľovaním celé (D73).
 *
 * Preindexovanie beží hneď za zápisom — `reindex()` vymení chunky **pri tom istom
 * `versionId`**, takže RAG odpovedá z opraveného textu a potvrdení sa to nedotkne.
 */
export async function fixText(
  companyCode: string,
  documentId: string,
  input: { expectedFingerprint: string; reason: string; canManageContent: boolean },
  actor: string,
): Promise<{
  versionId: string
  label: string
  contentHash: string
  added: number
  removed: number
  chunks: number
  archived: number
}> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as {
    versionId: string; label: string; isActive?: boolean; markdown?: string
  }[]
  const effective = versions.find(v => v.isActive)
  const before = String(effective?.markdown ?? doc.markdown ?? "")
  const after = String(doc.draftMarkdown ?? "").trim()

  const problem = textFixProblem({
    canManageContent: input.canManageContent,
    hasEffectiveVersion: Boolean(effective),
    before,
    after,
    expectedFingerprint: input.expectedFingerprint,
    reason: input.reason,
  })
  if (problem) throw new LibraryError(problem, TEXT_FIX_MESSAGE[problem])
  // Pravidlo to už zachytilo; toto je pre prekladač, nie druhá kontrola.
  if (!effective) throw new LibraryError("textFix.noEffectiveVersion", TEXT_FIX_MESSAGE["textFix.noEffectiveVersion"])

  const contentHash = textFingerprint(after)
  const stat = textDiff(before, after)
  const now = new Date()

  const set: Record<string, unknown> = {
    "versions.$[v].markdown": after,
    "versions.$[v].contentHash": contentHash,
    updatedAt: now,
    updatedBy: actor,
  }
  /*
   * Dokument nesie kópiu platného textu kvôli čítaniu (`documents.markdown`).
   * Bez tejto vety by sa rozišla so znením a knižnica by ukazovala starý text.
   * Píše sa len vtedy, keď dokument na toto znenie naozaj ukazuje — pri starších
   * importoch môže `versionId` na dokumente chýbať alebo mieriť inam.
   */
  if (String(doc.versionId ?? "") === effective.versionId) set.markdown = after

  await col.updateOne(
    { documentId, companyCode },
    {
      $set: set,
      $push: {
        "versions.$[v].textFixes": {
          at: now,
          by: actor,
          reason: input.reason.trim(),
          fromHash: textFingerprint(before),
          toHash: contentHash,
          // Celé predchádzajúce znenie, nie rozdiel: rozdiel sa dá z dvoch textov
          // dopočítať, text z rozdielu nie.
          fromMarkdown: before,
        },
      },
    } as never,
    { arrayFilters: [{ "v.versionId": effective.versionId }] },
  )

  await writeAudit({
    companyCode, subject: "document", action: "text-fix", actor: actor,
    targetId: documentId, targetLabel: `${String(doc.title ?? documentId)} — ${effective.label}`,
    note: `${input.reason.trim()} · +${stat.added} / −${stat.removed} riadkov · ` +
      "znenie ani potvrdenia sa nemenia",
  })

  // Až po zápise: `reindex()` číta text zo znenia, takže musí vidieť ten opravený.
  const r = await reindex(companyCode, documentId, actor)

  return {
    versionId: effective.versionId,
    label: effective.label,
    contentHash,
    added: stat.added,
    removed: stat.removed,
    chunks: r.chunks,
    archived: r.archived,
  }
}

export interface ReindexState {
  /** Dokumenty s platným znením — teda tie, ktoré vôbec majú čo indexovať. */
  celkom: number
  /** Z nich tie, ktorých členenie nesedí s aktuálnym profilom. */
  neaktualnych: number
}

/**
 * Koľko dokumentov by nový profil preindexoval.
 *
 * Počíta sa **naozajstným narezaním** každého dokumentu, nie odhadom: to je
 * jediný spôsob, ako povedať, či zmena parametra na tomto obsahu vôbec niečo
 * spraví. Pri desiatkach dokumentov je to zlomok sekundy; pri tisícoch by to
 * chcelo vlastný beh a nie obrazovku.
 */
export async function reindexState(
  companyCode: string,
): Promise<ReindexState> {
  const tenant = await chunkingTenant(companyCode)
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = await col
    .find(
      { companyCode },
      // `versions.$` sa sem raz zatúlalo spolu s `versions` a Mongo taký
      // výber odmieta („Path collision at versions") — celá záložka Členenie
      // padala. Positional `$` sa navyše bez podmienky na to pole ani použiť
      // nedá; potrebujeme celé pole a platné znenie sa vyberá v kóde.
      { projection: { documentId: 1, title: 1, chunkingId: 1, markdown: 1, versions: 1, chunkingProfile: 1 } },
    )
    .toArray() as unknown as {
      documentId: string; title?: string; chunkingId?: string; markdown?: string
      chunkingProfile?: string
      versions?: { isActive?: boolean; markdown?: string }[]
    }[]

  let total = 0
  let outdated = 0

  for (const d of documents) {
    const effective = (d.versions ?? []).find(v => v.isActive)
    const text = String(effective?.markdown ?? d.markdown ?? "").trim()
    if (!text) continue
    total++

    const forChunker = toChunkerProfile(chunkingFor(tenant, d.chunkingProfile))
    const { chunky: chunks } = chunkText(text, { nazovDokumentu: d.title ?? "", profil: forChunker })
    if (!chunks.length) { outdated++; continue }
    const chunkingId = chunkingFingerprint(chunks, { ...DEFAULT_PROFILE, ...forChunker })
    if (needsReindex(d.chunkingId, chunkingId)) outdated++
  }

  return { celkom: total, neaktualnych: outdated }
}

/**
 * Preindexuje všetky dokumenty, ktorých členenie nesedí s profilom (D57).
 *
 * **V dávkach, nie naraz.** Funkcia na Verceli má strop na čas behu a
 * preindexovanie stovky dokumentov by doň nezmestilo — a čo je horšie,
 * spadlo by uprostred a časť dokumentov by zostala narezaná po starom.
 * Preto sa spracuje `limit` dokumentov a vráti sa, koľko ešte zostáva;
 * obrazovka to zopakuje, kým nie je nula.
 *
 * Dokumenty, ktoré už sedia, sa preskakujú — opakované spustenie je preto
 * lacné a bezpečné.
 */
export async function reindexAll(
  companyCode: string,
  actor: string,
  limit = 25,
): Promise<{ preindexovanych: number; preskocenych: number; remaining: number; errors: string[] }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = await col
    .find({ companyCode }, { projection: { documentId: 1 } })
    .toArray() as unknown as { documentId: string }[]

  let reindexed = 0
  let skipped = 0
  let remaining = 0
  const errors: string[] = []

  for (const d of documents) {
    if (reindexed >= limit) { remaining++; continue }
    try {
      const v = await reindex(companyCode, d.documentId, actor)
      if (v.alreadyDone) skipped++
      else reindexed++
    } catch (e) {
      // Dokument bez publikovaného znenia sa preindexovať nedá a nie je to
      // chyba — nemá čo indexovať. Ostatné dôvody sa vypíšu menovite.
      const message = e instanceof LibraryError ? e.message : String(e)
      if (message.includes("publikované znenie")) skipped++
      else errors.push(`${d.documentId}: ${message}`)
    }
  }

  return { preindexovanych: reindexed, preskocenych: skipped, remaining: remaining, errors: errors }
}
