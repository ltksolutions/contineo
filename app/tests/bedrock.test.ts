/**
 * bedrock.test.ts — SigV4 podpis a binárny event stream.
 *
 * Adaptér nemáme kde integračne overiť (nemáme AWS účet), takže sa opierame
 * o dve veci, ktoré overiť vieme:
 *
 *   1. SigV4 proti OFICIÁLNYM testovacím vektorom AWS. Ak sedí podpis pre
 *      ich zverejnený príklad, sedí algoritmus.
 *   2. Parser rámcov proti syntetickým dátam, ktoré si zostavíme presne
 *      podľa špecifikácie — vrátane rámca rozdeleného medzi dve čítania.
 */
import { signRequest, sha256Hex, amzDate } from "../src/lib/providers/generation/sigv4"
import { splitFrames, concatBuffers, unwrapEvent, readEventStream } from "../src/lib/providers/generation/eventStream"
import { isEuRegion } from "../src/lib/providers/generation/bedrock"
import { anthropicEvent } from "../src/lib/providers/generation/anthropic"

import { t } from "./helper"

async function running() {

// ── SigV4 proti oficiálnym testovacím vektorom AWS ───────────────────────────
//
// Zdroj: AWS Signature Version 4 test suite, prípad `get-vanilla`.
// Kľúče aj dátum sú z dokumentácie, nie skutočné.
const AWS_KEY = "AKIDEXAMPLE"
const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"
const DATE = new Date(Date.UTC(2015, 7, 30, 12, 36, 0))

t("sha256: prázdny reťazec má známy hash",
  (await sha256Hex("")) === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

t("amzDate: tvar 20150830T123600Z",
  amzDate(DATE) === "20150830T123600Z", amzDate(DATE))

const signature = await signRequest({
  method: "GET",
  url: "https://example.amazonaws.com/",
  region: "us-east-1",
  service: "service",
  body: "",
  accessKeyId: AWS_KEY,
  secretAccessKey: AWS_SECRET,
  now: DATE,
})

t("sigv4: Authorization má správny scope",
  signature.Authorization.includes(`Credential=${AWS_KEY}/20150830/us-east-1/service/aws4_request`),
  signature.Authorization)
t("sigv4: podpísané hlavičky sú zoradené",
  signature.Authorization.includes("SignedHeaders=host;x-amz-date"),
  signature.Authorization)
t("sigv4: podpis sedí s oficiálnym vektorom AWS (get-vanilla)",
  signature.Authorization.includes(
    "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"),
  signature.Authorization)
t("sigv4: hlavička x-amz-date je v odpovedi",
  signature["x-amz-date"] === "20150830T123600Z")
t("sigv4: host sa odvodí z URL",
  signature.host === "example.amazonaws.com", signature.host)

// Dočasné údaje (STS) pridávajú token, ktorý MUSÍ vstúpiť do podpisu.
const withToken = await signRequest({
  method: "POST", url: "https://bedrock-runtime.eu-central-1.amazonaws.com/model/x/invoke",
  region: "eu-central-1", service: "bedrock", body: "{}",
  accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET,
  sessionToken: "TOKEN123", now: DATE,
})
t("sigv4: session token je medzi podpísanými hlavičkami",
  withToken.Authorization.includes("x-amz-security-token"), withToken.Authorization)
t("sigv4: token bez podpisu by neplatil — je aj v hlavičkách",
  withToken["x-amz-security-token"] === "TOKEN123")

const withoutToken = await signRequest({
  method: "POST", url: "https://bedrock-runtime.eu-central-1.amazonaws.com/model/x/invoke",
  region: "eu-central-1", service: "bedrock", body: "{}",
  accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET, now: DATE,
})
t("sigv4: iné telo dá iný podpis",
  withoutToken.Authorization !== withToken.Authorization)

// ── Binárny event stream ─────────────────────────────────────────────────────

/** Zostaví rámec presne podľa špecifikácie AWS. */
function frame(body: string, headers = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const t = new TextEncoder().encode(body)
  const total = 12 + headers.length + t.length + 4
  const buf = new Uint8Array(new ArrayBuffer(total))
  const dv = new DataView(buf.buffer)
  dv.setUint32(0, total, false)
  dv.setUint32(4, headers.length, false)
  dv.setUint32(8, 0, false)                 // CRC preludu — neoverujeme
  buf.set(headers, 12)
  buf.set(t, 12 + headers.length)
  return buf
}

const ev = (obj: unknown) =>
  JSON.stringify({ bytes: Buffer.from(JSON.stringify(obj)).toString("base64") })

const delta = { type: "content_block_delta", delta: { type: "text_delta", text: "Ahoj" } }

const one = splitFrames(frame(ev(delta)))
t("stream: jeden rámec sa prečíta", one.tela.length === 1, String(one.tela.length))
t("stream: po jednom rámci nezostáva zvyšok", one.zvysok.length === 0)
t("stream: event sa rozbalí z base64",
  unwrapEvent(one.tela[0])?.delta?.text === "Ahoj",
  JSON.stringify(unwrapEvent(one.tela[0])))

const two = splitFrames(concatBuffers(frame(ev(delta)), frame(ev(delta))))
t("stream: dva rámce za sebou", two.tela.length === 2, String(two.tela.length))

// Najdôležitejší test: rámec rozdelený medzi dve čítania sa NESMIE stratiť.
const whole = frame(ev(delta))
const first = whole.subarray(0, 10)
const second = whole.subarray(10)
const partial = splitFrames(first as Uint8Array<ArrayBuffer>)
t("stream: neúplný rámec sa odloží, nie zahodí",
  partial.tela.length === 0 && partial.zvysok.length === 10,
  `${partial.tela.length} tiel, zvyšok ${partial.zvysok.length}`)
const finished = splitFrames(concatBuffers(partial.zvysok, second))
t("stream: po doplnení sa rámec prečíta celý",
  finished.tela.length === 1 && unwrapEvent(finished.tela[0])?.delta?.text === "Ahoj")

// Rámec s hlavičkami — telo sa musí nájsť až za nimi.
const withHeaders = splitFrames(frame(ev(delta), new Uint8Array([1, 2, 3, 4, 5])))
t("stream: hlavičky sa preskočia",
  unwrapEvent(withHeaders.tela[0])?.delta?.text === "Ahoj")

t("stream: nezmyselná dĺžka nespôsobí zacyklenie",
  splitFrames(new Uint8Array(new ArrayBuffer(16))).tela.length === 0)
t("stream: rámec bez poľa bytes sa preskočí",
  unwrapEvent(splitFrames(frame('{"metrics":{}}')).tela[0]) === null)
t("stream: nevalidný JSON sa preskočí",
  unwrapEvent(splitFrames(frame("nie json")).tela[0]) === null)

// ── celý stream cez citajEventy ──────────────────────────────────────────────

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(c) { i < chunks.length ? c.enqueue(chunks[i++]) : c.close() },
  })
}

const citation = {
  type: "content_block_delta",
  delta: { type: "citations_delta", citation: { document_index: 0, cited_text: "úryvok" } },
}
const all: any[] = []
for await (const e of readEventStream(streamOf([
  whole.subarray(0, 7), whole.subarray(7), frame(ev(citation)),
]))) all.push(e)

t("stream: prečíta oba eventy aj pri rozdelení paketov",
  all.length === 2, String(all.length))

const events = [...anthropicEvent(all[0], []), ...anthropicEvent(all[1], [])]
t("stream: text_delta sa premení na text", events[0]?.type === "text")
t("stream: citations_delta sa premení na citáciu", events[1]?.type === "citation")

// ── EU regióny ───────────────────────────────────────────────────────────────

for (const [r, expected] of [
  ["eu-central-1", true], ["eu-west-1", true], ["eu-north-1", true],
  ["us-east-1", false], ["ap-south-1", false], [undefined, false],
] as const) {
  t(`región ${r ?? "(chýba)"} → ${expected ? "EÚ" : "mimo EÚ"}`, isEuRegion(r) === expected)
}

}

// Testy sú v async funkcii, lebo podpisovanie je asynchrónne (Web Crypto)
// a suita sa bundluje do CommonJS, kde top-level await nie je.
await running()
