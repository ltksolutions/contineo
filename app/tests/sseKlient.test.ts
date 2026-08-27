/**
 * sseKlient.test.ts — čítanie SSE z /api/chat.
 *
 * Tieto testy existujú kvôli jednej konkrétnej chybe, ktorú sme už raz
 * spravili pri binárnom streame z Bedrocku: udalosť rozdelená medzi dve
 * čítania sa stratí. Na localhoste sa to neprejaví, lebo odpoveď príde
 * v jednom kuse. Preto sa to musí testovať umelo.
 */
import { rozdelUdalosti, citajUdalosti } from "../src/lib/sseKlient"
import type { UdalostSSE } from "../src/lib/sseKlient"

import { t } from "./pomocnik"

const ramec = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`
const token = (s: string) => ramec({ type: "token", token: s })

async function bezi() {

// ── delenie blokov ───────────────────────────────────────────────────────────

const jeden = rozdelUdalosti(token("Ahoj"))
t("jedna udalosť sa prečíta", jeden.udalosti.length === 1)
t("po úplnej udalosti nezostáva zvyšok", jeden.zvysok === "", JSON.stringify(jeden.zvysok))
t("token sa rozbalí",
  jeden.udalosti[0].type === "token" && (jeden.udalosti[0] as any).token === "Ahoj")

const tri = rozdelUdalosti(token("a") + token("b") + token("c"))
t("tri udalosti za sebou", tri.udalosti.length === 3, String(tri.udalosti.length))

// Jadro veci: neúplná udalosť sa musí odložiť, nie zahodiť.
const cely = token("Rozdelené")
const neuplny = rozdelUdalosti(cely.slice(0, 12))
t("neúplná udalosť sa odloží", neuplny.udalosti.length === 0 && neuplny.zvysok.length === 12,
  `${neuplny.udalosti.length} udalostí, zvyšok ${neuplny.zvysok.length}`)
const doplneny = rozdelUdalosti(neuplny.zvysok + cely.slice(12))
t("po doplnení sa udalosť prečíta celá",
  doplneny.udalosti.length === 1 && (doplneny.udalosti[0] as any).token === "Rozdelené")

// Prvá udalosť úplná, druhá useknutá — nesmie sa stratiť ani jedna.
const zmes = rozdelUdalosti(token("prvy") + token("druhy").slice(0, 10))
t("úplná prejde, neúplná počká",
  zmes.udalosti.length === 1 && zmes.zvysok.length === 10,
  `${zmes.udalosti.length}, zvyšok ${zmes.zvysok.length}`)

t("poškodený JSON sa preskočí, ostatné prejde",
  rozdelUdalosti("data: {nie json}\n\n" + token("ok")).udalosti.length === 1)

t("keep-alive komentár sa ignoruje",
  rozdelUdalosti(": ping\n\n" + token("ok")).udalosti.length === 1)

t("viacriadkový data blok sa spojí",
  (() => {
    const u = rozdelUdalosti('data: {"type":"token",\ndata: "token":"X"}\n\n').udalosti
    return u.length === 1 && (u[0] as any).token === "X"
  })())

// ── čítanie celého streamu ───────────────────────────────────────────────────

function streamZ(kusy: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(c) { i < kusy.length ? c.enqueue(enc.encode(kusy[i++])) : c.close() },
  })
}

const citacia = {
  type: "citation",
  citation: { chunkIndex: 0, citedText: "úryvok z normy", articleRef: "čl. 3" },
}
const koniec = {
  type: "done",
  sources: [{ index: 1, title: "Rokovací poriadok" }],
  citations: [citacia.citation],
  model: "claude-sonnet-5",
  provider: "anthropic",
  verifiedCitations: true,
}

// Rozdelenie je zámerne škaredé: uprostred JSONu aj uprostred `\n\n`.
const surovy = token("Podľa ") + token("čl. 3") + ramec(citacia) + ramec(koniec)
const kusy = [surovy.slice(0, 9), surovy.slice(9, 40), surovy.slice(40, 41), surovy.slice(41)]

const vsetky: UdalostSSE[] = []
for await (const u of citajUdalosti(streamZ(kusy))) vsetky.push(u)

t("prečíta všetky udalosti aj pri škaredom delení", vsetky.length === 4,
  JSON.stringify(vsetky.map(u => u.type)))
t("text sa poskladá v správnom poradí",
  vsetky.filter(u => u.type === "token").map(u => (u as any).token).join("") === "Podľa čl. 3")
t("citácia dorazí", vsetky.some(u => u.type === "citation"))
t("done nesie zdroje aj model",
  vsetky.some(u => u.type === "done" && (u as any).model === "claude-sonnet-5"))

// Viacbajtový znak rozdelený medzi pakety — bez `stream: true` by z „š"
// vyšiel otáznik. Testujeme na úrovni bajtov, nie znakov.
const enc = new TextEncoder()
const bajty = enc.encode(token("príliš žltý kôň"))
const polka = Math.floor(bajty.length / 2)
const bajtovy = new ReadableStream<Uint8Array>({
  start(c) {
    c.enqueue(bajty.slice(0, polka))
    c.enqueue(bajty.slice(polka))
    c.close()
  },
})
const diakritika: UdalostSSE[] = []
for await (const u of citajUdalosti(bajtovy)) diakritika.push(u)
t("diakritika prežije rozdelenie na úrovni bajtov",
  diakritika.length === 1 && (diakritika[0] as any).token === "príliš žltý kôň",
  JSON.stringify(diakritika))

// Stream, ktorý skončí bez ukončujúceho prázdneho riadku.
const bezKonca: UdalostSSE[] = []
for await (const u of citajUdalosti(streamZ([`data: ${JSON.stringify({ type: "token", token: "X" })}`]))) {
  bezKonca.push(u)
}
t("neukončený posledný blok sa nestratí", bezKonca.length === 1, JSON.stringify(bezKonca))

}

await bezi()
