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

import { createHash } from "node:crypto"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { chunkuj } from "./chunker.mjs"
import { overHodnotu, overZoznam, CiselnikError } from "./ciselniky"
import type { Doplnky } from "./ciselniky"
import { ulozSubor, zmazSubor } from "./ulozisko"
import { preved, NAZOV_TYPU, KonverziaError } from "./konverzia"
import { zapisAudit, rozdiel } from "./audit"
import type { Chunk } from "./chunker"

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

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16)

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

  const { chunky } = chunkuj(markdown, { nazovDokumentu: meta.title })
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

  const versionId = hash(JSON.stringify(chunky.map(doDb)))
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
