/**
 * chunkedUpload.test.ts — prehliadačová polovica nahrávania po kúskoch.
 */
import { describe, it, expect, vi } from "vitest"
import { uploadInChunks, UploadError } from "../src/lib/chunkedUpload"

function file(bytes: number): Blob & { name: string } {
  return Object.assign(new Blob([new Uint8Array(bytes).fill(1)]), { name: "Pracovný poriadok.pdf" })
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe("uploadInChunks", () => {
  it("pošle štart, kúsky v poradí so správnou dĺžkou a dokončenie", async () => {
    const calls: { url: string; size?: number }[] = []
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body
      calls.push({ url, size: body instanceof Blob ? body.size : undefined })
      if (url.includes("step=start")) return ok({ uploadId: "u1", chunkSize: 4, chunks: 3 })
      if (url.includes("step=finish")) return ok({ fileId: "u1", name: "x.pdf", bytes: 10, sha256: "ab" })
      return ok({ ok: true })
    })
    const progress: number[] = []
    const r = await uploadInChunks(file(10), sent => progress.push(sent), "/u", f as unknown as typeof fetch)

    expect(calls.map(c => c.url)).toEqual([
      "/u?step=start",
      "/u?step=chunk&uploadId=u1&n=0",
      "/u?step=chunk&uploadId=u1&n=1",
      "/u?step=chunk&uploadId=u1&n=2",
      "/u?step=finish&uploadId=u1",
    ])
    expect(calls.slice(1, 4).map(c => c.size)).toEqual([4, 4, 2])
    expect(progress).toEqual([0, 4, 8, 10])
    expect(r).toEqual({ fileId: "u1", name: "x.pdf", bytes: 10, sha256: "ab" })
  })

  it("výpadok siete pri kúsku sa zopakuje", async () => {
    let failures = 1
    const f = vi.fn(async (url: string) => {
      if (url.includes("step=start")) return ok({ uploadId: "u", chunkSize: 10, chunks: 1 })
      if (url.includes("step=chunk") && failures-- > 0) throw new TypeError("network error")
      if (url.includes("step=finish")) return ok({ fileId: "u", name: "x", bytes: 5, sha256: "c" })
      return ok({ ok: true })
    })
    await expect(uploadInChunks(file(5), undefined, "/u", f as unknown as typeof fetch)).resolves.toMatchObject({ fileId: "u" })
  })

  it("odmietnutie serverom sa neopakuje a nesie jeho vetu", async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes("step=start")) {
        return new Response(JSON.stringify({ error: "Súbor má 30 MB, strop je 25 MB." }), { status: 400 })
      }
      return ok({})
    })
    await expect(uploadInChunks(file(5), undefined, "/u", f as unknown as typeof fetch))
      .rejects.toThrow(new UploadError("Súbor má 30 MB, strop je 25 MB."))
    expect(f).toHaveBeenCalledTimes(1)
  })
})
