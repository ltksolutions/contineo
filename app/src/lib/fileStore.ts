/**
 * fileStore.ts — pôvodné nahraté súbory (D53).
 *
 * **Prečo v databáze a nie v cudzom úložisku:** ďalšia služba znamená ďalší
 * token, ďalšiu vec, ktorá môže vypadnúť, a — čo je pri normách podstatnejšie
 * — ďalšie miesto, kde žijú údaje zákazníka. Dátová rezidencia je vyriešená
 * raz, pri Atlase (ADR-002); s druhým úložiskom by sa riešila druhýkrát.
 *
 * **Prečo GridFS a nie pole v zázname:** dokument v Mongu má strop 16 MB
 * a PDF normy sa mu vedia priblížiť. GridFS ho rozdelí na kúsky sám a číta
 * sa prúdom, takže sa celý súbor nemusí zmestiť do pamäte funkcie.
 *
 * Pôvodný súbor sa **nikdy nemaže pri prevode**. Markdown je odvodenina
 * a odvodenina sa dá spraviť znova len vtedy, keď existuje originál — a pri
 * norme je otázka „čo bolo v tom PDF, ktoré nám poslali" celkom bežná.
 */

import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { Binary, GridFSBucket, ObjectId } from "mongodb"
import { getDb } from "./mongodb"
import { AppError } from "./appError"

export const BUCKET = "cms_files"

/**
 * Strop pôvodného súboru — **25 MB** (ADR-011, D98; najväčšie dokumenty SFZ).
 *
 * Súbor nad 4 MB nejde v tele jednej požiadavky, lebo Vercel pustí do funkcie
 * najviac 4,5 MB a nastaviť sa to nedá. Posiela sa **po kúskoch**
 * (`startUpload` → `putChunk` → `finishUpload`) a skladá sa priamo v GridFS.
 * 23. 9. 2026 bol strop dočasne 4 MB, kým po kúskoch nahrávať nešlo.
 */
export const MAX_BYTES = 25 * 1024 * 1024

/**
 * Strop pre nahratie **formulárom bez JavaScriptu** — súbor ide celý v tele
 * serverovej akcie, takže nad strop Vercelu (4,5 MB) sa nedostane. Rezerva
 * na obal `multipart` a ostatné polia. `bodySizeLimit` v `next.config.mjs`
 * je zámerne nad týmto číslom: 4,2 MB súbor dostane vetu, nie chybu servera.
 */
export const MAX_FORM_BYTES = 4 * 1024 * 1024

/**
 * Veľkosť kúska pri nahrávaní po častiach — a zároveň `chunkSize` súboru
 * v GridFS. Jedna požiadavka = jeden chunk GridFS, takže sa nič nerozrezáva
 * druhýkrát. 3 MB je pod stropom Vercelu s rezervou a 25 MB súbor je deväť
 * požiadaviek.
 */
export const CHUNK_BYTES = 3 * 1024 * 1024

/** Nedokončené nahratie po sebe nenechá smeti — kúsky zmaže TTL index. */
const PENDING_HOURS = 6

/**
 * Prípony, ktoré formulár nahrávania ponúka. Jedno miesto pre `accept`
 * aj pre popis zóny (NAHRAVANIE, úloha 3) — keď pribudne formát, text sa
 * zmení s ním. Starý `.doc`/`.xls` zámerne nie: prevod ich nevie.
 */
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".md", ".txt", ".csv"] as const

export interface StoredFile {
  id: string
  name: string
  contentType: string
  bajtov: number
  /**
   * SHA-256 bajtov súboru (hex). Pri PDF znenia je to **dôkaz** — ide do kola
   * schvaľovania, do znenia aj do potvrdenia (ADR-011, D96–D97). Súbory
   * spred ADR-011 ho nemajú.
   */
  sha256: string
  uploadedAt: Date
}

async function bucket(): Promise<GridFSBucket> {
  const db = await getDb()
  return new GridFSBucket(db, { bucketName: BUCKET })
}

export class FileStoreError extends AppError {}

/**
 * Uloží súbor a vráti jeho identifikátor.
 *
 * `companyCode` ide do metadát a **do každého čítania ako podmienka** —
 * identifikátor v GridFS sa dá uhádnuť a súbory cudzej organizácie sa nesmú
 * dať vytiahnuť skúšaním (D32).
 */
export async function saveFile(
  companyCode: string,
  name: string,
  contentType: string,
  data: Buffer,
  actor: string,
): Promise<StoredFile> {
  if (!data?.byteLength) throw new FileStoreError("file.empty", "Súbor je prázdny.")
  if (data.byteLength > MAX_BYTES) throw tooLarge(data.byteLength)

  const sha256 = createHash("sha256").update(data).digest("hex")
  const b = await bucket()
  const stream = b.openUploadStream(name, {
    contentType,
    metadata: { companyCode, actor, uploadedAt: new Date(), sha256 },
  })

  await new Promise<void>((done, failed) => {
    stream.on("error", failed)
    stream.on("finish", () => done())
    stream.end(data)
  })

  return {
    id: String(stream.id),
    name: name,
    contentType,
    bajtov: data.byteLength,
    sha256,
    uploadedAt: new Date(),
  }
}

function tooLarge(bytes: number): FileStoreError {
  const mb = Math.ceil(bytes / 1024 / 1024)
  return new FileStoreError(
    "file.tooLarge",
    `Súbor má ${mb} MB, strop je ${MAX_BYTES / 1024 / 1024} MB.`,
    { mb, maxMb: MAX_BYTES / 1024 / 1024 },
  )
}

/** Údaje o súbore vlastnej organizácie bez obsahu. `null`, keď taký nie je. */
export async function fileInfo(
  companyCode: string,
  id: string,
): Promise<{ id: string; name: string; contentType: string; bytes: number; sha256: string | null } | null> {
  if (!ObjectId.isValid(id)) return null
  const b = await bucket()
  // Podmienka na organizáciu je v dotaze, nie v kontrole nad ním (D32).
  const [record] = await b.find({ _id: new ObjectId(id), "metadata.companyCode": companyCode }).toArray()
  if (!record) return null
  return {
    id,
    name: record.filename,
    contentType: record.contentType ?? "application/octet-stream",
    bytes: record.length,
    sha256: (record.metadata?.sha256 as string | undefined) ?? null,
  }
}

/**
 * Súbor ako **prúd** — na posielanie prehliadaču.
 *
 * Odpoveď v prúde nemá strop 4,5 MB, ktorý Vercel kladie na odpoveď poslanú
 * naraz (ADR-011, D98). `loadFile()` načíta celý súbor do pamäte — to je
 * v poriadku pri prevode, nie pri 25 MB PDF, ktoré si otvára schvaľovateľ.
 */
export async function openFileStream(
  companyCode: string,
  id: string,
): Promise<{ stream: ReadableStream<Uint8Array>; name: string; bytes: number; sha256: string | null } | null> {
  const info = await fileInfo(companyCode, id)
  if (!info) return null
  const b = await bucket()
  const node = b.openDownloadStream(new ObjectId(id))
  return {
    stream: Readable.toWeb(node) as ReadableStream<Uint8Array>,
    name: info.name,
    bytes: info.bytes,
    sha256: info.sha256,
  }
}

/** Načíta súbor vlastnej organizácie. `null`, keď taký nie je. */
export async function loadFile(
  companyCode: string,
  id: string,
): Promise<{ data: Buffer; contentType: string; name: string } | null> {
  if (!ObjectId.isValid(id)) return null
  const b = await bucket()

  // Podmienka na organizáciu je v dotaze, nie v kontrole nad ním.
  const [record] = await b.find({ _id: new ObjectId(id), "metadata.companyCode": companyCode }).toArray()
  if (!record) return null

  const parts: Buffer[] = []
  await new Promise<void>((done, failed) => {
    const stream = b.openDownloadStream(new ObjectId(id))
    stream.on("data", (k: Buffer) => parts.push(k))
    stream.on("error", failed)
    stream.on("end", () => done())
  })

  return {
    data: Buffer.concat(parts),
    contentType: record.contentType ?? "application/octet-stream",
    name: record.filename,
  }
}

/**
 * Zmaže súbor.
 *
 * Používa sa **len** pri neúspešnom nahratí, keď záznam dokumentu ani
 * nevznikol. Pôvodný súbor publikovaného dokumentu sa nemaže nikdy — je to
 * jediný dôkaz, z čoho Markdown vznikol.
 */
export async function deleteFile(companyCode: string, id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return
  const b = await bucket()
  const [record] = await b.find({ _id: new ObjectId(id), "metadata.companyCode": companyCode }).toArray()
  if (!record) return
  await b.delete(new ObjectId(id))
}


// ── Nahrávanie po kúskoch (ADR-011, D98) ────────────────────────────────────

/**
 * Rozpracované nahratie. Kým nie je dokončené, **súbor v GridFS neexistuje** —
 * sú len kúsky s `pendingUntil`. Záznam v `cms_files.files` vznikne až vo
 * `finishUpload()`, keď sedí počet a je spočítaný odtlačok. Čítanie, ktoré
 * ide cez `cms_files.files`, tak polovičný súbor nikdy neuvidí.
 */
const UPLOADS_COLLECTION = "cms_uploads"

interface UploadSession {
  _id: ObjectId
  companyCode: string
  actor: string
  name: string
  bytes: number
  chunkSize: number
  createdAt: Date
  expiresAt: Date
}

/** Počet kúskov súboru danej veľkosti. */
export function chunkCount(bytes: number, chunkSize = CHUNK_BYTES): number {
  return Math.ceil(bytes / chunkSize)
}

/**
 * Koľko bajtov musí mať kúsok `n`. GridFS číta podľa `chunkSize` — každý kúsok
 * okrem posledného musí mať presne túto dĺžku, inak by sa súbor poskladal
 * s dierou alebo presahom a nikto by si to nevšimol až do otvorenia PDF.
 */
export function expectedChunkLength(bytes: number, n: number, chunkSize = CHUNK_BYTES): number | null {
  const count = chunkCount(bytes, chunkSize)
  if (!Number.isInteger(n) || n < 0 || n >= count) return null
  return n < count - 1 ? chunkSize : bytes - chunkSize * (count - 1)
}

let indexesReady = false

/**
 * TTL indexy na nedokončené nahratia. Idempotentné, stačí raz za beh funkcie.
 * Na kúskoch je index **čiastočný** (`pendingUntil` existuje): dokončený súbor
 * pole nemá, takže ho TTL nikdy nezmaže.
 */
async function ensureUploadIndexes(): Promise<void> {
  if (indexesReady) return
  const db = await getDb()
  await db.collection(`${BUCKET}.chunks`).createIndex(
    { pendingUntil: 1 },
    { expireAfterSeconds: 0, partialFilterExpression: { pendingUntil: { $exists: true } }, name: "pending_ttl" },
  )
  await db.collection(UPLOADS_COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expires_ttl" })
  indexesReady = true
}

/** Začne nahrávanie. Veľkosť sa overí tu, nie až po deviatich kúskoch. */
export async function startUpload(
  companyCode: string,
  actor: string,
  name: string,
  bytes: number,
): Promise<{ uploadId: string; chunkSize: number; chunks: number }> {
  const clean = String(name ?? "").trim().slice(0, 255)
  if (!clean) throw new FileStoreError("file.nameRequired", "Súbor nemá názov.")
  if (!Number.isInteger(bytes) || bytes <= 0) throw new FileStoreError("file.empty", "Súbor je prázdny.")
  if (bytes > MAX_BYTES) throw tooLarge(bytes)

  await ensureUploadIndexes()
  const db = await getDb()
  const now = new Date()
  const session: UploadSession = {
    _id: new ObjectId(),
    companyCode,
    actor,
    name: clean,
    bytes,
    chunkSize: CHUNK_BYTES,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PENDING_HOURS * 3600_000),
  }
  await db.collection<UploadSession>(UPLOADS_COLLECTION).insertOne(session)
  return { uploadId: String(session._id), chunkSize: CHUNK_BYTES, chunks: chunkCount(bytes) }
}

async function sessionOf(companyCode: string, actor: string, uploadId: string): Promise<UploadSession> {
  if (!ObjectId.isValid(uploadId)) throw new FileStoreError("file.uploadNotFound", "Nahrávanie sa nenašlo.")
  const db = await getDb()
  // Organizácia **aj autor** v podmienke: rozpracované nahratie je jeho,
  // nikto iný doň nemá čo pridávať kúsky.
  const s = await db.collection<UploadSession>(UPLOADS_COLLECTION).findOne({
    _id: new ObjectId(uploadId), companyCode, actor,
  })
  if (!s) throw new FileStoreError("file.uploadNotFound", "Nahrávanie sa nenašlo alebo vypršalo. Začni znova.")
  return s
}

/**
 * Zapíše jeden kúsok. **Opakovateľné** — ten istý kúsok poslaný druhýkrát
 * (výpadok siete, opakovaná požiadavka) prepíše sám seba, nič nezdvojí.
 */
export async function putChunk(
  companyCode: string,
  actor: string,
  uploadId: string,
  n: number,
  data: Buffer,
): Promise<void> {
  const s = await sessionOf(companyCode, actor, uploadId)
  const expected = expectedChunkLength(s.bytes, n, s.chunkSize)
  if (expected === null) throw new FileStoreError("file.chunkInvalid", "Kúsok súboru nesedí.")
  if (data.byteLength !== expected) {
    throw new FileStoreError("file.chunkInvalid", `Kúsok ${n} má ${data.byteLength} B, čakalo sa ${expected} B.`)
  }
  const db = await getDb()
  await db.collection(`${BUCKET}.chunks`).updateOne(
    { files_id: s._id, n },
    { $set: { files_id: s._id, n, data: new Binary(data), pendingUntil: s.expiresAt } },
    { upsert: true },
  )
}

/**
 * Dokončí nahrávanie: overí, že sú všetky kúsky, spočíta SHA-256 **zo
 * zapísaných bajtov** (nie z toho, čo tvrdí prehliadač) a až potom založí
 * záznam súboru. Od tej chvíle je to bežný súbor GridFS.
 */
export async function finishUpload(
  companyCode: string,
  actor: string,
  uploadId: string,
): Promise<StoredFile> {
  const s = await sessionOf(companyCode, actor, uploadId)
  const db = await getDb()
  const chunks = db.collection<{ files_id: ObjectId; n: number; data: Binary }>(`${BUCKET}.chunks`)
  const count = chunkCount(s.bytes, s.chunkSize)

  const hash = createHash("sha256")
  let total = 0
  let seen = 0
  for await (const c of chunks.find({ files_id: s._id }).sort({ n: 1 })) {
    if (c.n !== seen) break
    const bytes = Buffer.from(c.data.buffer)
    hash.update(bytes)
    total += bytes.byteLength
    seen++
  }
  if (seen !== count || total !== s.bytes) {
    throw new FileStoreError("file.uploadIncomplete", `Prišlo ${seen} z ${count} kúskov súboru. Skús nahrať znova.`)
  }

  const sha256 = hash.digest("hex")
  const uploadedAt = new Date()
  await db.collection(`${BUCKET}.files`).insertOne({
    _id: s._id,
    length: s.bytes,
    chunkSize: s.chunkSize,
    uploadDate: uploadedAt,
    filename: s.name,
    contentType: "application/octet-stream",
    metadata: { companyCode, actor, uploadedAt, sha256 },
  })
  await chunks.updateMany({ files_id: s._id }, { $unset: { pendingUntil: "" } })
  await db.collection(UPLOADS_COLLECTION).deleteOne({ _id: s._id })

  return { id: String(s._id), name: s.name, contentType: "application/octet-stream", bajtov: s.bytes, sha256, uploadedAt }
}
