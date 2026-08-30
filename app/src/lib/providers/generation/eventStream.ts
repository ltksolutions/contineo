/**
 * eventStream.ts — čítanie binárneho AWS event streamu.
 *
 * Bedrock neposiela odpoveď ako SSE, ale ako sled binárnych rámcov. Vnútri
 * nich je ale **úplne rovnaký event Anthropic Messages API** ako pri
 * priamom API — len zabalený.
 *
 * Tvar jedného rámca:
 *
 *   ┌────────────┬───────────────┬─────────────┬─────────┬─────────┬─────────┐
 *   │ dĺžka (4B) │ dĺžka hláv(4B)│ CRC preludu │ hlavičky│ telo    │ CRC (4B)│
 *   └────────────┴───────────────┴─────────────┴─────────┴─────────┴─────────┘
 *
 * Všetko je big-endian. Telo je JSON `{"bytes": "<base64>"}`, kde po
 * dekódovaní je samotný event.
 *
 * CRC zámerne NEOVERUJEME — na to by bolo treba implementovať CRC32,
 * a chybný rámec sa spoľahlivo prejaví tak, že sa JSON nerozparsuje.
 * Radšej menej kódu, ktorý nemáme ako otestovať.
 */

const PRELUDE = 12   // dĺžka + dĺžka hlavičiek + CRC preludu
const TRAILING_CRC = 4

/**
 * Rozdelí súvislý buffer na rámce. Vráti nájdené telá a zvyšok, ktorý
 * ešte nie je úplný — ten patrí na začiatok ďalšieho čítania.
 *
 * Bez toho by sa rámec rozdelený medzi dva TCP pakety stratil. Presne
 * na túto chybu sme už raz naleteli pri SSE.
 */
export function splitFrames(buf: Uint8Array<ArrayBuffer>): { tela: Uint8Array<ArrayBuffer>[]; zvysok: Uint8Array<ArrayBuffer> } {
  const bodies: Uint8Array<ArrayBuffer>[] = []
  let off = 0

  while (buf.length - off >= PRELUDE) {
    const dv = new DataView(buf.buffer, buf.byteOffset + off, PRELUDE)
    const totalLength = dv.getUint32(0, false)
    const headerLength = dv.getUint32(4, false)

    // Nezmyselná dĺžka = poškodený stream; ďalej sa nedá pokračovať.
    if (totalLength < PRELUDE + TRAILING_CRC || totalLength > 16 * 1024 * 1024) break
    if (buf.length - off < totalLength) break          // rámec ešte nie je celý

    const bodyStart = off + PRELUDE + headerLength
    const bodyEnd = off + totalLength - TRAILING_CRC
    if (bodyEnd > bodyStart) {
      bodies.push(buf.subarray(bodyStart, bodyEnd))
    }
    off += totalLength
  }

  return { tela: bodies, zvysok: buf.subarray(off) }
}

/** Spojí dva buffery. */
export function concatBuffers(a: Uint8Array<ArrayBuffer>, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const v = new Uint8Array(a.length + b.length)
  v.set(a, 0)
  v.set(b, a.length)
  return v
}

/**
 * Vytiahne z tela rámca vnorený event.
 *
 * Bedrock balí event dvakrát: telo rámca je JSON s poľom `bytes`, ktoré
 * obsahuje base64 so skutočným eventom. Vráti null, keď rámec event
 * neobsahuje (napr. ping alebo metadáta o využití).
 */
export function unwrapEvent(body: Uint8Array<ArrayBuffer>): any | null {
  let outer: any
  try {
    outer = JSON.parse(new TextDecoder().decode(body))
  } catch {
    return null
  }
  if (typeof outer?.bytes !== "string") return null
  try {
    return JSON.parse(Buffer.from(outer.bytes, "base64").toString("utf8"))
  } catch {
    return null
  }
}

/** Prečíta celý stream a postupne vydáva rozbalené eventy. */
export async function* readEventStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<any> {
  const reader = body.getReader()
  let buf = new Uint8Array(new ArrayBuffer(0))

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf = concatBuffers(buf, value)

    const { tela: bodies, zvysok: rest } = splitFrames(buf)
    buf = rest
    for (const t of bodies) {
      const ev = unwrapEvent(t)
      if (ev) yield ev
    }
  }
}
