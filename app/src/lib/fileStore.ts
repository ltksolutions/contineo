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

import { GridFSBucket, ObjectId } from "mongodb"
import { getDb } from "./mongodb"
import { AppError } from "./appError"

export const BUCKET = "cms_files"

/**
 * Strop pôvodného súboru — **4 MB, nie 32.**
 *
 * Súbor prichádza v tele serverovej akcie a Vercel pustí do funkcie telo
 * požiadavky najviac 4,5 MB; nad tým odpovie 413 skôr, než sa kód vôbec
 * spustí, a nastavením sa to zvýšiť nedá. Pôvodných 32 MB bol sľub, ktorý
 * sa nedal splniť: 23. 9. 2026 nahrávanie z rozhrania padlo na predvolenom
 * strope Nextu (1 MB) a za ním by čakal ten Vercelu. Dovtedy sa normy
 * nahrávali skriptom, takže to nikto nevidel.
 *
 * 4 MB nechávajú rezervu na obal `multipart` a ostatné polia formulára.
 * Najväčšia norma SFZ má 2,3 MB. Väčší súbor by chcel nahrávanie po
 * kúskoch priamo do GridFS — zapísané v `docs/TODO.md`.
 *
 * `experimental.serverActions.bodySizeLimit` v `next.config.mjs` je zámerne
 * **nad** týmto stropom: súbor s 4,2 MB má prejsť až sem a dostať vetu
 * „strop je 4 MB", nie holú chybu servera.
 */
export const MAX_BYTES = 4 * 1024 * 1024

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
  if (data.byteLength > MAX_BYTES) {
    throw new FileStoreError(
      "file.tooLarge",
      `Súbor má ${Math.round(data.byteLength / 1024 / 1024)} MB, strop je ${MAX_BYTES / 1024 / 1024} MB.`,
      { mb: Math.round(data.byteLength / 1024 / 1024), maxMb: MAX_BYTES / 1024 / 1024 },
    )
  }

  const b = await bucket()
  const stream = b.openUploadStream(name, {
    contentType,
    metadata: { companyCode, actor, uploadedAt: new Date() },
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
    uploadedAt: new Date(),
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
