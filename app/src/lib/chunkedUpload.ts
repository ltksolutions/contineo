/**
 * chunkedUpload.ts — nahratie súboru po kúskoch z prehliadača (ADR-011, D98).
 *
 * Protistrana je `/api/library/upload`. Súbor sa rozreže na kúsky po
 * `chunkSize` (určuje server), posielajú sa **po jednom, v poradí** — súbežne
 * by to na pomalej linke nepomohlo a pri výpadku by bolo ťažšie povedať, čo
 * prišlo. Kúsok, ktorý zlyhá na sieti, sa skúsi ešte dvakrát; server ho
 * prepíše, takže opakovanie nič nezdvojí.
 *
 * Bez závislosti na Reacte ani na Nexte — dá sa otestovať s podvrhnutým
 * `fetch` a použiť z hocijakého formulára.
 */

export interface UploadedFile {
  fileId: string
  name: string
  bytes: number
  sha256: string
}

/** Chyba s vetou pre človeka — server ju už poslal preloženú. */
export class UploadError extends Error {}

const RETRIES = 2

async function asJson(r: Response): Promise<Record<string, unknown>> {
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new UploadError(typeof body.error === "string" ? body.error : `HTTP ${r.status}`)
  return body
}

export async function uploadInChunks(
  file: Blob & { name: string },
  onProgress: (sentBytes: number, totalBytes: number) => void = () => {},
  endpoint = "/api/library/upload",
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<UploadedFile> {
  const start = await asJson(await fetchImpl(`${endpoint}?step=start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, bytes: file.size }),
  }))
  const uploadId = String(start.uploadId)
  const chunkSize = Number(start.chunkSize)
  const chunks = Number(start.chunks)

  onProgress(0, file.size)
  for (let n = 0; n < chunks; n++) {
    const part = file.slice(n * chunkSize, Math.min(file.size, (n + 1) * chunkSize))
    const url = `${endpoint}?step=chunk&uploadId=${encodeURIComponent(uploadId)}&n=${n}`
    for (let attempt = 0; ; attempt++) {
      try {
        await asJson(await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: part,
        }))
        break
      } catch (e) {
        // Odmietnutie serverom (UploadError) sa neopakuje — zopakovaný zlý kúsok
        // bude zlý znova. Opakuje sa len výpadok siete.
        if (e instanceof UploadError || attempt >= RETRIES) throw e
      }
    }
    onProgress(Math.min(file.size, (n + 1) * chunkSize), file.size)
  }

  const done = await asJson(await fetchImpl(
    `${endpoint}?step=finish&uploadId=${encodeURIComponent(uploadId)}`,
    { method: "POST" },
  ))
  return {
    fileId: String(done.fileId),
    name: String(done.name),
    bytes: Number(done.bytes),
    sha256: String(done.sha256),
  }
}
