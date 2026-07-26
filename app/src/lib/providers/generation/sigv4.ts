/**
 * sigv4.ts — podpis požiadaviek pre AWS (Signature Version 4).
 *
 * Prečo ručne a nie cez AWS SDK: pridať `@aws-sdk/*` znamená desiatky
 * balíkov kvôli jednej hlavičke. Celý algoritmus je pritom deterministický
 * a AWS k nemu zverejňuje **oficiálne testovacie vektory**, takže sa dá
 * overiť bez AWS účtu — čo je pri adaptéri, ktorý zatiaľ nemáme kde
 * integračne otestovať, podstatnejšie než pohodlie.
 *
 * Postup podľa dokumentácie AWS:
 *   1. kanonická požiadavka
 *   2. reťazec na podpis
 *   3. podpisový kľúč (štyri vnorené HMAC-y)
 *   4. podpis a hlavička Authorization
 */

const enc = new TextEncoder()

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(data: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(data)))
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    "raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  return crypto.subtle.sign("HMAC", k, enc.encode(data))
}

/**
 * Časová pečiatka v tvare, ktorý AWS vyžaduje: 20260726T093000Z.
 * Musí sedieť s dátumom v credential scope, inak podpis neplatí.
 */
export function amzDate(d: Date = new Date()): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

export interface SigV4Input {
  method: string
  url: string
  region: string
  service: string
  body: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  /** Ďalšie hlavičky, ktoré majú vstúpiť do podpisu. */
  headers?: Record<string, string>
  /** Len na testovanie proti pevným vektorom. */
  now?: Date
}

/**
 * Vráti hlavičky vrátane `Authorization`. Volajúci ich pošle tak, ako sú —
 * ktorákoľvek zmena po podpise podpis zneplatní.
 */
export async function signRequest(i: SigV4Input): Promise<Record<string, string>> {
  const u = new URL(i.url)
  const stamp = amzDate(i.now)
  const den = stamp.slice(0, 8)

  const hlavicky: Record<string, string> = {
    host: u.host,
    "x-amz-date": stamp,
    ...(i.sessionToken ? { "x-amz-security-token": i.sessionToken } : {}),
    ...Object.fromEntries(
      Object.entries(i.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])
    ),
  }

  // Kanonické hlavičky musia byť zoradené podľa názvu a s orezanými medzerami.
  const mena = Object.keys(hlavicky).sort()
  const kanonickeHlavicky = mena.map(n => `${n}:${hlavicky[n].trim()}\n`).join("")
  const podpisaneHlavicky = mena.join(";")

  // Query parametre musia byť zoradené a zakódované podľa RFC 3986.
  const query = [...u.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")

  const hashTela = await sha256Hex(i.body)

  const kanonickaPoziadavka = [
    i.method.toUpperCase(),
    u.pathname || "/",
    query,
    kanonickeHlavicky,
    podpisaneHlavicky,
    hashTela,
  ].join("\n")

  const scope = `${den}/${i.region}/${i.service}/aws4_request`
  const naPodpis = [
    "AWS4-HMAC-SHA256",
    stamp,
    scope,
    await sha256Hex(kanonickaPoziadavka),
  ].join("\n")

  // Podpisový kľúč — štyri vnorené HMAC-y, každý z výsledku predchádzajúceho.
  let kluc: ArrayBuffer | Uint8Array = enc.encode(`AWS4${i.secretAccessKey}`)
  for (const cast of [den, i.region, i.service, "aws4_request"]) {
    kluc = await hmac(kluc, cast)
  }
  const podpis = hex(await hmac(kluc, naPodpis))

  return {
    ...Object.fromEntries(mena.map(n => [n, hlavicky[n]])),
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, ` +
      `SignedHeaders=${podpisaneHlavicky}, Signature=${podpis}`,
  }
}
