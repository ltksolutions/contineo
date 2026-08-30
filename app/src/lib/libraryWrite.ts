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
import { chunkuj, PREDVOLENY_PROFIL } from "./chunker.mjs"
import { odtlacokTextu, odtlacokClenenia, trebaPreindexovat, VERZIA_CHUNKERA } from "./chunkIdentity"
import { overHodnotu, overZoznam, CiselnikError } from "./codelists"
import type { Doplnky } from "./codelists"
import { ulozSubor, zmazSubor } from "./fileStore"
import { preved, NAZOV_TYPU, KonverziaError } from "./conversion"
import { zapisAudit, rozdiel } from "./audit"
import type { Chunk, ProfilClenenia } from "./chunker"

export const CHUNKS_COLLECTION = "document_chunks"

/** Technický stav — čo s dokumentom urobili stroje. */
export type StavSpracovania = "nahrate" | "prevedene" | "zaindexovane" | "zlyhalo"

export interface PovodnySubor {
  /** Identifikátor v GridFS. */
  id: string
  nazov: string
  contentType: string
  bajtov: number
  typ: string
  nahraneKedy: Date
  nahralKto: string
}

export interface MetadataDokumentu {
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

export class KniznicaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KniznicaError"
  }
}

/** Identifikátor dokumentu — zhodne so skriptom, nezávisle od názvu súboru. */
export function idDokumentu(meta: { companyCode: string; sectionKey: string }): string {
  return `${meta.companyCode}:${meta.sectionKey}`.toLowerCase()
}

/** Overí metadáta z formulára proti číselníkom. Vyhadzuje `KniznicaError`. */
export function overMetadata(
  vstup: Partial<MetadataDokumentu>,
  doplnky?: Doplnky,
): MetadataDokumentu {
  const title = (vstup.title ?? "").trim()
  if (!title) throw new KniznicaError("Názov dokumentu je povinný — bez neho je v zozname len kľúč.")

  try {
    return {
      title,
      sectionKey: overHodnotu("sectionKey", vstup.sectionKey ?? ""),
      companyCode: overHodnotu("companyCode", vstup.companyCode ?? ""),
      scope: overHodnotu("scope", vstup.scope ?? ""),
      accessLevel: overHodnotu("accessLevel", vstup.accessLevel ?? ""),
      language: overHodnotu("language", vstup.language ?? ""),
      category: vstup.category ? overHodnotu("category", vstup.category, doplnky) : undefined,
      sourceType: vstup.sourceType ? overHodnotu("sourceType", vstup.sourceType) : undefined,
      tags: overZoznam("tags", vstup.tags ?? [], doplnky),
    }
  } catch (e) {
    if (e instanceof CiselnikError) throw new KniznicaError(e.message)
    throw e
  }
}

export interface VysledokNahratia {
  documentId: string
  markdown: string
  upozornenia: string[]
  novy: boolean
}

/**
 * Nahrá súbor, prevedie ho a založí (alebo doplní) dokument v stave konceptu.
 *
 * Pôvodný súbor sa ukladá **pred** prevodom: keď prevod zlyhá, súbor v úložisku
 * zostane a dá sa naň pozrieť. Zmaže sa len vtedy, keď nevznikol ani záznam
 * dokumentu — teda keď by po ňom nezostala žiadna stopa, ako sa k nemu dostať.
 */
export async function nahrajDokument(
  meta: MetadataDokumentu,
  nazovSuboru: string,
  data: Buffer,
  aktor: string,
): Promise<VysledokNahratia> {
  const documentId = idDokumentu(meta)
  const subor = await ulozSubor(meta.companyCode, nazovSuboru, "application/octet-stream", data, aktor)

  let prevod
  try {
    prevod = await preved(nazovSuboru, data)
  } catch (e) {
    await zmazSubor(meta.companyCode, subor.id)
    if (e instanceof KonverziaError) throw new KniznicaError(e.message)
    throw e
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const uz = await col.findOne({ documentId })
  const teraz = new Date()

  const povodny: PovodnySubor = {
    id: subor.id,
    nazov: nazovSuboru,
    contentType: subor.contentType,
    bajtov: subor.bajtov,
    typ: prevod.typ,
    nahraneKedy: teraz,
    nahralKto: aktor,
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
        sourceType: meta.sourceType ?? prevod.typ,
        tags: meta.tags ?? [],
        // Koncept: text existuje, ale nikto ho ešte neprečítal a nepustil von.
        draftMarkdown: prevod.markdown,
        processingStatus: "prevedene" as StavSpracovania,
        processingError: null,
        konverzia: { sposob: prevod.sposob, upozornenia: prevod.upozornenia, kedy: teraz },
        originalFile: povodny,
        updatedAt: teraz,
        updatedBy: aktor,
      },
      $setOnInsert: { createdAt: teraz, createdBy: aktor, status: "draft", versions: [] },
    },
    { upsert: true },
  )

  await zapisAudit({
    companyCode: meta.companyCode,
    predmet: "dokument",
    akcia: uz ? "nahrate-nove-znenie" : "zalozene",
    aktor,
    cielId: documentId,
    cielPopis: meta.title,
    poznamka: `${NAZOV_TYPU[prevod.typ]} · ${nazovSuboru} · ${prevod.sposob}`,
  })

  return {
    documentId,
    markdown: prevod.markdown,
    upozornenia: prevod.upozornenia,
    novy: !uz,
  }
}

/** Uloží upravený Markdown konceptu. Publikované znenie sa tým nemení. */
export async function ulozKoncept(
  companyCode: string,
  documentId: string,
  markdown: string,
  aktor: string,
): Promise<void> {
  const text = (markdown ?? "").trim()
  if (!text) throw new KniznicaError("Prázdny text sa uložiť nedá — dokument by nemal čo obsahovať.")

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { documentId, companyCode },
    { $set: { draftMarkdown: text, updatedAt: new Date(), updatedBy: aktor } },
  )
  if (!r.matchedCount) throw new KniznicaError("Taký dokument tu nie je.")
}

export interface VysledokPublikovania {
  versionId: string
  chunkov: number
  archivovanych: number
  uzBolo: boolean
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
export async function publikuj(
  companyCode: string,
  documentId: string,
  vstup: { label: string; effectiveFrom: Date; effectiveFromSource?: string; changeNote?: string },
  aktor: string,
  profil?: Partial<ProfilClenenia>,
): Promise<VysledokPublikovania> {
  const label = (vstup.label ?? "").trim()
  if (!label) {
    throw new KniznicaError(
      "Označenie znenia je povinné — objaví sa doslovne v každom zázname o potvrdení. " +
      "Napíš to, čo je v dokumente (napríklad: úplné znenie z 27. 2. 2026), nie vymyslené číslo.",
    )
  }
  if (!(vstup.effectiveFrom instanceof Date) || Number.isNaN(vstup.effectiveFrom.getTime())) {
    throw new KniznicaError("Dátum platnosti je povinný — bez neho sa znenie nedá potvrdiť (D6).")
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new KniznicaError("Taký dokument tu nie je.")

  const markdown = String(doc.draftMarkdown ?? "").trim()
  if (!markdown) throw new KniznicaError("Dokument nemá text — najprv nahraj súbor alebo napíš znenie.")

  const meta = {
    title: String(doc.title ?? ""),
    sectionKey: String(doc.sectionKey ?? ""),
    companyCode,
    scope: String(doc.scope ?? ""),
    accessLevel: String(doc.accessLevel ?? ""),
    language: String(doc.language ?? ""),
  }
  const tags = Array.isArray(doc.tags) ? (doc.tags as string[]) : []

  const { chunky } = chunkuj(markdown, { nazovDokumentu: meta.title, profil })
  if (!chunky.length) {
    throw new KniznicaError(
      "Z textu nevznikol ani jeden úsek. Skontroluj, či má dokument členenie na články alebo nadpisy.",
    )
  }

  const doDb = (ch: Chunk) => ({
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
  const versionId = odtlacokTextu(markdown)
  const chunkingId = odtlacokClenenia(chunky, { ...PREDVOLENY_PROFIL, ...profil })
  const teraz = new Date()

  // Rovnaké znenie už publikované? Nič sa nedeje — publikovanie je idempotentné.
  const uz = (doc.versions as { versionId: string }[] | undefined)?.some(v => v.versionId === versionId)
  if (uz) return { versionId, chunkov: chunky.length, archivovanych: 0, uzBolo: true }

  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  // Staré chunky sa **archivujú, nemažú** (D6): do vyhľadávania vstupujú len
  // aktívne, ale otázka „čo tam stálo vlani" musí mať odpoveď.
  const archiv = await chunkCol.updateMany(
    { documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: teraz } },
  )

  await chunkCol.insertMany(
    chunky.map(ch => ({
      ...doDb(ch),
      documentId,
      versionId,
      chunkingId,
      verziaChunkera: VERZIA_CHUNKERA,
      embeddedAt: teraz,
      isActive: true,
      effectiveFrom: vstup.effectiveFrom,
      effectiveTo: null,
      createdAt: teraz,
    })),
    { ordered: false },
  )

  // Predchádzajúcemu otvorenému zneniu sa uzavrie platnosť — až teraz, keď
  // nové platnosť naozaj má.
  await col.updateOne(
    { documentId, companyCode },
    { $set: { "versions.$[stara].effectiveTo": vstup.effectiveFrom, "versions.$[stara].isActive": false } },
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
        processingStatus: "zaindexovane" as StavSpracovania,
        effectiveFrom: vstup.effectiveFrom,
        effectiveTo: null,
        updatedAt: teraz,
        updatedBy: aktor,
      },
      $push: {
        versions: {
          versionId,
          label,
          effectiveFrom: vstup.effectiveFrom,
          effectiveTo: null,
          isActive: true,
          contentHash: versionId,
          effectiveFromSource: vstup.effectiveFromSource?.trim() || undefined,
          changeNote: vstup.changeNote?.trim() || undefined,
          markdown,
          // `requiresReacknowledgement` sa zámerne nenastavuje: vypĺňa ho
          // človek (D30) a `false` by bolo tiché rozhodnutie, že zmena nie je
          // podstatná. Chýbajúce pole znamená „nikto zatiaľ nerozhodol".
          publishedAt: teraz,
          publishedBy: aktor,
        },
      },
    } as never,
  )

  await zapisAudit({
    companyCode, predmet: "dokument", akcia: "publikovane", aktor,
    cielId: documentId, cielPopis: `${meta.title} — ${label}`,
    poznamka: `${chunky.length} úsekov · platné od ${vstup.effectiveFrom.toISOString().slice(0, 10)}` +
      (vstup.effectiveFromSource ? ` · zdroj: ${vstup.effectiveFromSource}` : ""),
  })

  return { versionId, chunkov: chunky.length, archivovanych: archiv.modifiedCount, uzBolo: false }
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
export async function ulozUdaje(
  companyCode: string,
  documentId: string,
  vstup: Partial<MetadataDokumentu>,
  aktor: string,
  doplnky?: Doplnky,
): Promise<void> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const pred = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!pred) throw new KniznicaError("Taký dokument tu nie je.")

  // Kľúč aj organizácia sa berú z existujúceho záznamu, nie z formulára.
  const meta = overMetadata({
    ...vstup,
    sectionKey: String(pred.sectionKey ?? ""),
    companyCode,
  }, doplnky)

  const set: Record<string, unknown> = {
    title: meta.title,
    scope: meta.scope,
    accessLevel: meta.accessLevel,
    language: meta.language,
    category: meta.category ?? null,
    tags: meta.tags ?? [],
    updatedAt: new Date(),
    updatedBy: aktor,
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

  const predMeta = {
    title: pred.title, scope: pred.scope, accessLevel: pred.accessLevel,
    language: pred.language, category: pred.category ?? null, tags: pred.tags ?? [],
  }
  const poMeta = {
    title: meta.title, scope: meta.scope, accessLevel: meta.accessLevel,
    language: meta.language, category: meta.category ?? null, tags: meta.tags ?? [],
  }
  await zapisAudit({
    companyCode, predmet: "dokument", akcia: "zmenene", aktor,
    cielId: documentId, cielPopis: meta.title,
    zmeny: rozdiel(predMeta, poMeta),
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
export async function preindexuj(
  companyCode: string,
  documentId: string,
  aktor: string,
  profil?: Partial<ProfilClenenia>,
): Promise<{ chunkov: number; archivovanych: number; uzBolo: boolean; chunkingId: string }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new KniznicaError("Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as { versionId: string; isActive?: boolean; markdown?: string }[]
  const platna = versions.find(v => v.isActive)
  const markdown = String(platna?.markdown ?? doc.markdown ?? "").trim()
  if (!markdown || !platna) {
    throw new KniznicaError(
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

  const { chunky } = chunkuj(markdown, { nazovDokumentu: meta.title, profil })
  if (!chunky.length) {
    throw new KniznicaError("Z textu nevznikol ani jeden úsek — skontroluj profil členenia.")
  }

  const chunkingId = odtlacokClenenia(chunky, { ...PREDVOLENY_PROFIL, ...profil })
  if (doc.chunkingId === chunkingId) {
    return { chunkov: chunky.length, archivovanych: 0, uzBolo: true, chunkingId }
  }

  const teraz = new Date()
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const archiv = await chunkCol.updateMany(
    { documentId, isActive: true },
    { $set: { isActive: false, effectiveTo: teraz } },
  )

  await chunkCol.insertMany(
    chunky.map(ch => ({
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
      versionId: platna.versionId,
      chunkingId,
      verziaChunkera: VERZIA_CHUNKERA,
      embeddedAt: teraz,
      isActive: true,
      effectiveFrom: (doc.effectiveFrom as Date | null) ?? null,
      effectiveTo: null,
      createdAt: teraz,
    })),
    { ordered: false },
  )

  await col.updateOne(
    { documentId, companyCode },
    { $set: { chunkingId, updatedAt: teraz, updatedBy: aktor } },
  )

  await zapisAudit({
    companyCode, predmet: "dokument", akcia: "preindexovane", aktor,
    cielId: documentId, cielPopis: meta.title,
    poznamka: `${chunky.length} úsekov · ${archiv.modifiedCount} archivovaných · ` +
      "znenie ani potvrdenia sa nemenili",
  })

  return { chunkov: chunky.length, archivovanych: archiv.modifiedCount, uzBolo: false, chunkingId }
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
 *   - `oprava` — rozdiel je nepodstatný, potvrdenia zostávajú;
 *   - `znovaPotvrdit` — nastaví `requiresReacknowledgement` (D30), takže
 *     znenie sa musí potvrdiť znova.
 *
 * Systém to rozhodnúť nevie: nepozná, či medzi tými dvoma dátumami niekto
 * podľa normy konal.
 */
export async function opravZnenie(
  companyCode: string,
  documentId: string,
  versionId: string,
  vstup: {
    label?: string
    effectiveFrom?: Date
    effectiveFromSource?: string
    changeNote?: string
    dovod: string
    priZmeneDatumu?: "oprava" | "znovaPotvrdit"
  },
  aktor: string,
): Promise<{ potvrdeni: number; znovaPotvrdit: boolean }> {
  const dovod = vstup.dovod?.trim() ?? ""
  if (!dovod) {
    throw new KniznicaError(
      "Dôvod opravy je povinný — bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.",
    )
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ documentId, companyCode }) as Record<string, unknown> | null
  if (!doc) throw new KniznicaError("Taký dokument tu nie je.")

  const versions = (doc.versions ?? []) as {
    versionId: string; label: string; effectiveFrom: Date | null
  }[]
  const v = versions.find(x => x.versionId === versionId)
  if (!v) throw new KniznicaError("Také znenie tu nie je.")

  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const potvrdeni = await ackCol.countDocuments({
    type: "acknowledgement", companyCode, versionId,
  })

  const meniDatum = vstup.effectiveFrom instanceof Date &&
    (!v.effectiveFrom || new Date(v.effectiveFrom).getTime() !== vstup.effectiveFrom.getTime())

  if (meniDatum && potvrdeni > 0 && !vstup.priZmeneDatumu) {
    throw new KniznicaError(
      `Toto znenie už potvrdilo ${potvrdeni} ľudí a formulka, ktorú podpísali, obsahuje starý dátum. ` +
      "Rozhodni, či je to oprava zápisu, alebo sa má znenie potvrdiť znova.",
    )
  }

  const znovaPotvrdit = Boolean(meniDatum && potvrdeni > 0 && vstup.priZmeneDatumu === "znovaPotvrdit")

  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: aktor }
  if (vstup.label?.trim()) set["versions.$[v].label"] = vstup.label.trim()
  if (vstup.effectiveFrom instanceof Date) {
    set["versions.$[v].effectiveFrom"] = vstup.effectiveFrom
    // Dokument nesie kópiu platnosti kvôli filtrom; bez tejto vety by sa
    // rozišla s verziou a vyhľadávanie by filtrovalo podľa starého dátumu.
    if (doc.versionId === versionId) set.effectiveFrom = vstup.effectiveFrom
  }
  if (vstup.effectiveFromSource !== undefined) {
    set["versions.$[v].effectiveFromSource"] = vstup.effectiveFromSource.trim() || undefined
  }
  if (vstup.changeNote !== undefined) {
    set["versions.$[v].changeNote"] = vstup.changeNote.trim() || undefined
  }
  if (znovaPotvrdit) set["versions.$[v].requiresReacknowledgement"] = true

  await col.updateOne(
    { documentId, companyCode },
    {
      $set: set,
      $push: {
        "versions.$[v].opravy": {
          kedy: new Date(), kto: aktor, dovod,
          znovaPotvrdit,
          zLabel: v.label,
          zEffectiveFrom: v.effectiveFrom ?? null,
        },
      },
    } as never,
    { arrayFilters: [{ "v.versionId": versionId }] },
  )

  await zapisAudit({
    companyCode, predmet: "dokument", akcia: "oprava-znenia", aktor,
    cielId: documentId, cielPopis: `${String(doc.title ?? documentId)} — ${v.label}`,
    zmeny: rozdiel(
      { label: v.label, effectiveFrom: v.effectiveFrom ?? null },
      { label: vstup.label?.trim() ?? v.label, effectiveFrom: vstup.effectiveFrom ?? v.effectiveFrom ?? null },
    ),
    poznamka: `${dovod}${potvrdeni > 0 ? ` · potvrdení: ${potvrdeni}` : ""}` +
      (znovaPotvrdit ? " · vyžaduje nové potvrdenie" : ""),
  })

  return { potvrdeni, znovaPotvrdit }
}

export interface StavPreindexovania {
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
export async function stavPreindexovania(
  companyCode: string,
  profil?: Partial<ProfilClenenia>,
): Promise<StavPreindexovania> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const dokumenty = await col
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

  let celkom = 0
  let neaktualnych = 0

  for (const d of dokumenty) {
    const platna = (d.versions ?? []).find(v => v.isActive)
    const text = String(platna?.markdown ?? d.markdown ?? "").trim()
    if (!text) continue
    celkom++

    const { chunky } = chunkuj(text, { nazovDokumentu: d.title ?? "", profil })
    if (!chunky.length) { neaktualnych++; continue }
    const chunkingId = odtlacokClenenia(chunky, { ...PREDVOLENY_PROFIL, ...profil })
    if (trebaPreindexovat(d.chunkingId, chunkingId)) neaktualnych++
  }

  return { celkom, neaktualnych }
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
export async function preindexujVsetky(
  companyCode: string,
  aktor: string,
  profil?: Partial<ProfilClenenia>,
  limit = 25,
): Promise<{ preindexovanych: number; preskocenych: number; zostava: number; chyby: string[] }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const dokumenty = await col
    .find({ companyCode }, { projection: { documentId: 1 } })
    .toArray() as unknown as { documentId: string }[]

  let preindexovanych = 0
  let preskocenych = 0
  let zostava = 0
  const chyby: string[] = []

  for (const d of dokumenty) {
    if (preindexovanych >= limit) { zostava++; continue }
    try {
      const v = await preindexuj(companyCode, d.documentId, aktor, profil)
      if (v.uzBolo) preskocenych++
      else preindexovanych++
    } catch (e) {
      // Dokument bez publikovaného znenia sa preindexovať nedá a nie je to
      // chyba — nemá čo indexovať. Ostatné dôvody sa vypíšu menovite.
      const sprava = e instanceof KniznicaError ? e.message : String(e)
      if (sprava.includes("publikované znenie")) preskocenych++
      else chyby.push(`${d.documentId}: ${sprava}`)
    }
  }

  return { preindexovanych, preskocenych, zostava, chyby }
}
