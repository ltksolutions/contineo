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
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { chunkText, DEFAULT_PROFILE } from "./chunker.mjs"
import { textFingerprint, chunkingFingerprint, needsReindex, CHUNKER_VERSION } from "./chunkIdentity"
import { checkValue, checkList, CodelistError } from "./codelists"
import type { CodelistExtras } from "./codelists"
import { saveFile, deleteFile } from "./fileStore"
import { convert, FILE_TYPE_LABEL, ConversionError } from "./conversion"
import { writeAudit, diff } from "./audit"
import type { Chunk } from "./chunker.mjs"
import { toChunkerProfile, type ChunkingProfile } from "./chunkingProfile"

export const CHUNKS_COLLECTION = "document_chunks"

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
  sectionKey: string
  companyCode: string
  scope: string
  accessLevel: string
  language: string
  category?: string
  sourceType?: string
  tags?: string[]
}

export class LibraryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KniznicaError"
  }
}

/** Identifikátor dokumentu — zhodne so skriptom, nezávisle od názvu súboru. */
export function makeDocumentId(meta: { companyCode: string; sectionKey: string }): string {
  return `${meta.companyCode}:${meta.sectionKey}`.toLowerCase()
}

/** Overí metadáta z formulára proti číselníkom. Vyhadzuje `KniznicaError`. */
export function checkMetadata(
  input: Partial<DocumentMetadata>,
  extras?: CodelistExtras,
): DocumentMetadata {
  const title = (input.title ?? "").trim()
  if (!title) throw new LibraryError("Názov dokumentu je povinný — bez neho je v zozname len kľúč.")

  try {
    return {
      title,
      sectionKey: checkValue("sectionKey", input.sectionKey ?? ""),
      companyCode: checkValue("companyCode", input.companyCode ?? ""),
      scope: checkValue("scope", input.scope ?? ""),
      accessLevel: checkValue("accessLevel", input.accessLevel ?? ""),
      language: checkValue("language", input.language ?? ""),
      category: input.category ? checkValue("category", input.category, extras) : undefined,
      sourceType: input.sourceType ? checkValue("sourceType", input.sourceType) : undefined,
      tags: checkList("tags", input.tags ?? [], extras),
    }
  } catch (e) {
    if (e instanceof CodelistError) throw new LibraryError(e.message)
    throw e
  }
}

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
): Promise<UploadResult> {
  const documentId = makeDocumentId(meta)
  const file = await saveFile(meta.companyCode, fileName, "application/octet-stream", data, actor)

  let converted
  try {
    converted = await convert(fileName, data)
  } catch (e) {
    await deleteFile(meta.companyCode, file.id)
    if (e instanceof ConversionError) throw new LibraryError(e.message)
    throw e
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const existing = await col.findOne({ documentId })
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
        sectionKey: meta.sectionKey,
        companyCode: meta.companyCode,
        scope: meta.scope,
        accessLevel: meta.accessLevel,
        language: meta.language,
        category: meta.category ?? null,
        sourceType: meta.sourceType ?? converted.type,
        tags: meta.tags ?? [],
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
  if (!text) throw new LibraryError("Prázdny text sa uložiť nedá — dokument by nemal čo obsahovať.")

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { documentId, companyCode },
    { $set: { draftMarkdown: text, updatedAt: new Date(), updatedBy: actor } },
  )
  if (!r.matchedCount) throw new LibraryError("Taký dokument tu nie je.")
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
  profile?: Partial<ChunkingProfile>,
): Promise<PublishResult> {
  const label = (input.label ?? "").trim()
  if (!label) {
    throw new LibraryError(
      "Označenie znenia je povinné — objaví sa doslovne v každom zázname o potvrdení. " +
      "Napíš to, čo je v dokumente (napríklad: úplné znenie z 27. 2. 2026), nie vymyslené číslo.",
    )
  }
  if (!(input.effectiveFrom instanceof Date) || Number.isNaN(input.effectiveFrom.getTime())) {
    throw new LibraryError("Dátum platnosti je povinný — bez neho sa znenie nedá potvrdiť (D6).")
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("Taký dokument tu nie je.")

  const markdown = String(doc.draftMarkdown ?? "").trim()
  if (!markdown) throw new LibraryError("Dokument nemá text — najprv nahraj súbor alebo napíš znenie.")

  const meta = {
    title: String(doc.title ?? ""),
    sectionKey: String(doc.sectionKey ?? ""),
    companyCode,
    scope: String(doc.scope ?? ""),
    accessLevel: String(doc.accessLevel ?? ""),
    language: String(doc.language ?? ""),
  }
  const tags = Array.isArray(doc.tags) ? (doc.tags as string[]) : []

  const forChunker = toChunkerProfile(profile)
  const { chunky: chunks } = chunkText(markdown, { nazovDokumentu: meta.title, profil: forChunker })
  if (!chunks.length) {
    throw new LibraryError(
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

  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  // Staré chunky sa **archivujú, nemažú** (D6): do vyhľadávania vstupujú len
  // aktívne, ale otázka „čo tam stálo vlani" musí mať odpoveď.
  const archive = await chunkCol.updateMany(
    { documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: now } },
  )

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
 * **Kľúč (`sectionKey`) a organizácia sa meniť nedajú.** Tvoria `documentId`
 * a ten je v `document_chunks`, v prideleniach aj v záznamoch o potvrdení.
 * Zmeniť ho by neznamenalo premenovanie, ale vznik druhého dokumentu, ku
 * ktorému by sa história nedostala. Kto sa pomýlil v kľúči, nahrá dokument
 * znova pod správnym.
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
  if (!before) throw new LibraryError("Taký dokument tu nie je.")

  // Kľúč aj organizácia sa berú z existujúceho záznamu, nie z formulára.
  const meta = checkMetadata({
    ...input,
    sectionKey: String(before.sectionKey ?? ""),
    companyCode,
  }, extras)

  const set: Record<string, unknown> = {
    title: meta.title,
    scope: meta.scope,
    accessLevel: meta.accessLevel,
    language: meta.language,
    category: meta.category ?? null,
    tags: meta.tags ?? [],
    updatedAt: new Date(),
    updatedBy: actor,
  }

  await col.updateOne({ documentId, companyCode }, { $set: set })

  // Chunky nesú kópiu filtrov (`accessLevel`, `language`, `scope`, `tags`) —
  // bez tejto vety by sa zmena prejavila v knižnici, ale vyhľadávanie by
  // ďalej filtrovalo podľa starých hodnôt. Tichý rozpor presne toho druhu,
  // ktorý sa hľadá týždne.
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  await chunkCol.updateMany(
    { documentId },
    {
      $set: {
        scope: meta.scope,
        accessLevel: meta.accessLevel,
        language: meta.language,
        tags: meta.tags ?? [],
      },
    },
  )

  const beforeMeta = {
    title: before.title, scope: before.scope, accessLevel: before.accessLevel,
    language: before.language, category: before.category ?? null, tags: before.tags ?? [],
  }
  const afterMeta = {
    title: meta.title, scope: meta.scope, accessLevel: meta.accessLevel,
    language: meta.language, category: meta.category ?? null, tags: meta.tags ?? [],
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
  profile?: Partial<ChunkingProfile>,
): Promise<{ chunks: number; archived: number; alreadyDone: boolean; chunkingId: string }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as { versionId: string; isActive?: boolean; markdown?: string }[]
  const effective = versions.find(v => v.isActive)
  const markdown = String(effective?.markdown ?? doc.markdown ?? "").trim()
  if (!markdown || !effective) {
    throw new LibraryError(
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

  const forChunker = toChunkerProfile(profile)
  const { chunky: chunks } = chunkText(markdown, { nazovDokumentu: meta.title, profil: forChunker })
  if (!chunks.length) {
    throw new LibraryError("Z textu nevznikol ani jeden úsek — skontroluj profil členenia.")
  }

  const chunkingId = chunkingFingerprint(chunks, { ...DEFAULT_PROFILE, ...forChunker })
  if (doc.chunkingId === chunkingId) {
    return { chunks: chunks.length, archived: 0, alreadyDone: true, chunkingId }
  }

  const now = new Date()
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
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
 * Rozhodnutie preto patrí človeku a obe možnosti sa zapisujú:
 *
 *   - `correction` — rozdiel je nepodstatný, potvrdenia zostávajú;
 *   - `reacknowledge` — nastaví `requiresReacknowledgement` (D30), takže
 *     znenie sa musí potvrdiť znova.
 *
 * Systém to rozhodnúť nevie: nepozná, či medzi tými dvoma dátumami niekto
 * podľa normy konal.
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
    onDateChange?: "correction" | "reacknowledge"
  },
  actor: string,
): Promise<{ acknowledgementCount: number; reacknowledged: boolean }> {
  const reason = input.reason?.trim() ?? ""
  if (!reason) {
    throw new LibraryError(
      "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
    )
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new LibraryError("Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as {
    versionId: string; label: string; effectiveFrom: Date | null
  }[]
  const v = versions.find(x => x.versionId === versionId)
  if (!v) throw new LibraryError("Také znenie tu nie je.")

  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const acknowledgementCount = await ackCol.countDocuments({
    type: "acknowledgement", companyCode, versionId,
  })

  const changesDate = input.effectiveFrom instanceof Date &&
    (!v.effectiveFrom || new Date(v.effectiveFrom).getTime() !== input.effectiveFrom.getTime())

  if (changesDate && acknowledgementCount > 0 && !input.onDateChange) {
    throw new LibraryError(
      `Toto znenie už potvrdilo ${acknowledgementCount} ľudí a formulka, ktorú podpísali, obsahuje starý dátum. ` +
      "Rozhodni, či je to oprava zápisu, alebo sa má znenie potvrdiť znova.",
    )
  }

  const reacknowledge = Boolean(changesDate && acknowledgementCount > 0 && input.onDateChange === "reacknowledge")

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
  if (reacknowledge) set["versions.$[v].requiresReacknowledgement"] = true

  await col.updateOne(
    { documentId, companyCode },
    {
      $set: set,
      $push: {
        "versions.$[v].opravy": {
          kedy: new Date(), kto: actor, dovod: reason,
          znovaPotvrdit: reacknowledge,
          zLabel: v.label,
          zEffectiveFrom: v.effectiveFrom ?? null,
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
  profile?: Partial<ChunkingProfile>,
): Promise<ReindexState> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = await col
    .find(
      { companyCode },
      // `versions.$` sa sem raz zatúlalo spolu s `versions` a Mongo taký
      // výber odmieta („Path collision at versions") — celá záložka Členenie
      // padala. Positional `$` sa navyše bez podmienky na to pole ani použiť
      // nedá; potrebujeme celé pole a platné znenie sa vyberá v kóde.
      { projection: { documentId: 1, title: 1, chunkingId: 1, markdown: 1, versions: 1 } },
    )
    .toArray() as unknown as {
      documentId: string; title?: string; chunkingId?: string; markdown?: string
      versions?: { isActive?: boolean; markdown?: string }[]
    }[]

  let total = 0
  let outdated = 0

  for (const d of documents) {
    const effective = (d.versions ?? []).find(v => v.isActive)
    const text = String(effective?.markdown ?? d.markdown ?? "").trim()
    if (!text) continue
    total++

    const forChunker = toChunkerProfile(profile)
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
  profile?: Partial<ChunkingProfile>,
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
      const v = await reindex(companyCode, d.documentId, actor, profile)
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
