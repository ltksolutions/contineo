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
import { rozdelRamce, spoj, rozbalEvent, citajEventy } from "../src/lib/providers/generation/eventStream"
import { jeEuRegion } from "../src/lib/providers/generation/bedrock"
import { anthropicEvent } from "../src/lib/providers/generation/anthropic"

import { t } from "./pomocnik"

async function bezi() {

// ── SigV4 proti oficiálnym testovacím vektorom AWS ───────────────────────────
//
// Zdroj: AWS Signature Version 4 test suite, prípad `get-vanilla`.
// Kľúče aj dátum sú z dokumentácie, nie skutočné.
const AWS_KEY = "AKIDEXAMPLE"
const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"
const DATUM = new Date(Date.UTC(2015, 7, 30, 12, 36, 0))

t("sha256: prázdny reťazec má známy hash",
  (await sha256Hex("")) === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

t("amzDate: tvar 20150830T123600Z",
  amzDate(DATUM) === "20150830T123600Z", amzDate(DATUM))

const podpis = await signRequest({
  method: "GET",
  url: "https://example.amazonaws.com/",
  region: "us-east-1",
  service: "service",
  body: "",
  accessKeyId: AWS_KEY,
  secretAccessKey: AWS_SECRET,
  now: DATUM,
})

t("sigv4: Authorization má správny scope",
  podpis.Authorization.includes(`Credential=${AWS_KEY}/20150830/us-east-1/service/aws4_request`),
  podpis.Authorization)
t("sigv4: podpísané hlavičky sú zoradené",
  podpis.Authorization.includes("SignedHeaders=host;x-amz-date"),
  podpis.Authorization)
t("sigv4: podpis sedí s oficiálnym vektorom AWS (get-vanilla)",
  podpis.Authorization.includes(
    "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"),
  podpis.Authorization)
t("sigv4: hlavička x-amz-date je v odpovedi",
  podpis["x-amz-date"] === "20150830T123600Z")
t("sigv4: host sa odvodí z URL",
  podpis.host === "example.amazonaws.com", podpis.host)

// Dočasné údaje (STS) pridávajú token, ktorý MUSÍ vstúpiť do podpisu.
const sToken = await signRequest({
  method: "POST", url: "https://bedrock-runtime.eu-central-1.amazonaws.com/model/x/invoke",
  region: "eu-central-1", service: "bedrock", body: "{}",
  accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET,
  sessionToken: "TOKEN123", now: DATUM,
})
t("sigv4: session token je medzi podpísanými hlavičkami",
  sToken.Authorization.includes("x-amz-security-token"), sToken.Authorization)
t("sigv4: token bez podpisu by neplatil — je aj v hlavičkách",
  sToken["x-amz-security-token"] === "TOKEN123")

const bezTokenu = await signRequest({
  method: "POST", url: "https://bedrock-runtime.eu-central-1.amazonaws.com/model/x/invoke",
  region: "eu-central-1", service: "bedrock", body: "{}",
  accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET, now: DATUM,
})
t("sigv4: iné telo dá iný podpis",
  bezTokenu.Authorization !== sToken.Authorization)

// ── Binárny event stream ─────────────────────────────────────────────────────

/** Zostaví rámec presne podľa špecifikácie AWS. */
function ramec(telo: string, hlavicky = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const t = new TextEncoder().encode(telo)
  const celkova = 12 + hlavicky.length + t.length + 4
  const buf = new Uint8Array(new ArrayBuffer(celkova))
  const dv = new DataView(buf.buffer)
  dv.setUint32(0, celkova, false)
  dv.setUint32(4, hlavicky.length, false)
  dv.setUint32(8, 0, false)                 // CRC preludu — neoverujeme
  buf.set(hlavicky, 12)
  buf.set(t, 12 + hlavicky.length)
  return buf
}

const ev = (obj: unknown) =>
  JSON.stringify({ bytes: Buffer.from(JSON.stringify(obj)).toString("base64") })

const delta = { type: "content_block_delta", delta: { type: "text_delta", text: "Ahoj" } }

const jeden = rozdelRamce(ramec(ev(delta)))
t("stream: jeden rámec sa prečíta", jeden.tela.length === 1, String(jeden.tela.length))
t("stream: po jednom rámci nezostáva zvyšok", jeden.zvysok.length === 0)
t("stream: event sa rozbalí z base64",
  rozbalEvent(jeden.tela[0])?.delta?.text === "Ahoj",
  JSON.stringify(rozbalEvent(jeden.tela[0])))

const dva = rozdelRamce(spoj(ramec(ev(delta)), ramec(ev(delta))))
t("stream: dva rámce za sebou", dva.tela.length === 2, String(dva.tela.length))

// Najdôležitejší test: rámec rozdelený medzi dve čítania sa NESMIE stratiť.
const cely = ramec(ev(delta))
const prva = cely.subarray(0, 10)
const druha = cely.subarray(10)
const neuplny = rozdelRamce(prva as Uint8Array<ArrayBuffer>)
t("stream: neúplný rámec sa odloží, nie zahodí",
  neuplny.tela.length === 0 && neuplny.zvysok.length === 10,
  `${neuplny.tela.length} tiel, zvyšok ${neuplny.zvysok.length}`)
const dokoncene = rozdelRamce(spoj(neuplny.zvysok, druha))
t("stream: po doplnení sa rámec prečíta celý",
  dokoncene.tela.length === 1 && rozbalEvent(dokoncene.tela[0])?.delta?.text === "Ahoj")

// Rámec s hlavičkami — telo sa musí nájsť až za nimi.
const sHlavickami = rozdelRamce(ramec(ev(delta), new Uint8Array([1, 2, 3, 4, 5])))
t("stream: hlavičky sa preskočia",
  rozbalEvent(sHlavickami.tela[0])?.delta?.text === "Ahoj")

t("stream: nezmyselná dĺžka nespôsobí zacyklenie",
  rozdelRamce(new Uint8Array(new ArrayBuffer(16))).tela.length === 0)
t("stream: rámec bez poľa bytes sa preskočí",
  rozbalEvent(rozdelRamce(ramec('{"metrics":{}}')).tela[0]) === null)
t("stream: nevalidný JSON sa preskočí",
  rozbalEvent(rozdelRamce(ramec("nie json")).tela[0]) === null)

// ── celý stream cez citajEventy ──────────────────────────────────────────────

function streamZ(kusy: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(c) { i < kusy.length ? c.enqueue(kusy[i++]) : c.close() },
  })
}

const citacia = {
  type: "content_block_delta",
  delta: { type: "citations_delta", citation: { document_index: 0, cited_text: "úryvok" } },
}
const vsetky: any[] = []
for await (const e of citajEventy(streamZ([
  cely.subarray(0, 7), cely.subarray(7), ramec(ev(citacia)),
]))) vsetky.push(e)

t("stream: prečíta oba eventy aj pri rozdelení paketov",
  vsetky.length === 2, String(vsetky.length))

const udalosti = [...anthropicEvent(vsetky[0], []), ...anthropicEvent(vsetky[1], [])]
t("stream: text_delta sa premení na text", udalosti[0]?.type === "text")
t("stream: citations_delta sa premení na citáciu", udalosti[1]?.type === "citation")

// ── EU regióny ───────────────────────────────────────────────────────────────

for (const [r, cakame] of [
  ["eu-central-1", true], ["eu-west-1", true], ["eu-north-1", true],
  ["us-east-1", false], ["ap-south-1", false], [undefined, false],
] as const) {
  t(`región ${r ?? "(chýba)"} → ${cakame ? "EÚ" : "mimo EÚ"}`, jeEuRegion(r) === cakame)
}

}

// Testy sú v async funkcii, lebo podpisovanie je asynchrónne (Web Crypto)
// a suita sa bundluje do CommonJS, kde top-level await nie je.
await bezi()
