import { HttpEmbeddingProvider, truncateMRL, parseTeiEmbed, parseOpenAIEmbed } from "../src/lib/providers/embedding/http"
import { HttpRerankProvider, parseTeiRerank, parseInfinityRerank, applyScores } from "../src/lib/providers/rerank/http"

import { t } from "./pomocnik"
const blizko = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

async function hodi(fn: () => Promise<unknown>): Promise<Error | null> {
  try { await fn(); return null } catch (e) { return e as Error }
}

/** Nahradí globálny fetch a zapamätá si, čo sa poslalo. */
function mockFetch(handler: (url: string, body: any) => { status?: number; json?: any; text?: string }) {
  const volania: { url: string; body: any }[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    volania.push({ url, body })
    const r = handler(url, body)
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json),
    }
  }
  return volania
}

const chunk = (id: string, text: string): any => ({ _id: id, text, documentId: "d" })

async function main() {
  // ── MRL truncation ───────────────────────────────────────────────────
  const v = truncateMRL([3, 4, 99, 99], 2)
  t("MRL: skrati na cielovu dimenziu", v.length === 2)
  t("MRL: znormalizuje na jednotkovu dlzku",
    blizko(Math.hypot(...v), 1), String(Math.hypot(...v)))
  t("MRL: zachova smer (3,4) -> (0.6,0.8)", blizko(v[0], 0.6) && blizko(v[1], 0.8), JSON.stringify(v))
  const nezmeneny = truncateMRL([1, 2, 3], 5)
  t("MRL: kratsi vektor nechá tak", nezmeneny.length === 3)
  t("MRL: nulovy vektor nespadne na delenie nulou", truncateMRL([0, 0, 0, 0], 2).length === 2)

  // ── parsovanie odpovedí ──────────────────────────────────────────────
  t("TEI embed: pole poli", JSON.stringify(parseTeiEmbed([[1, 2], [3, 4]])) === "[[1,2],[3,4]]")
  t("Infinity embed: zoradi podla index", JSON.stringify(
    parseOpenAIEmbed({ data: [{ embedding: [9], index: 1 }, { embedding: [1], index: 0 }] })
  ) === "[[1],[9]]")
  t("Infinity embed: chybajuce data spadne",
    !!(await hodi(async () => parseOpenAIEmbed({}))))

  // ── embedding cez TEI ────────────────────────────────────────────────
  let volania = mockFetch(() => ({ json: [[3, 4, 0, 0], [0, 5, 0, 0]] }))
  let emb = new HttpEmbeddingProvider({ kind: "tei", url: "http://tei:8080/", model: "voyage-4-nano", dim: 2 })
  let out = await emb.embedRaw(["a", "b"])
  t("TEI: sprava na /embed", volania[0].url === "http://tei:8080/embed", volania[0].url)
  t("TEI: posiela inputs", JSON.stringify(volania[0].body.inputs) === '["a","b"]', JSON.stringify(volania[0].body))
  t("TEI: vrati 2 vektory", out.length === 2)
  t("TEI: skrati na dim=2 a znormalizuje", out[0].length === 2 && blizko(Math.hypot(...out[0]), 1))
  t("TEI: isInline je false", emb.isInline === false)

  // ── embedding cez Infinity ───────────────────────────────────────────
  volania = mockFetch(() => ({ json: { data: [{ embedding: [1, 0, 0], index: 0 }] } }))
  emb = new HttpEmbeddingProvider({ kind: "infinity", url: "http://inf:7997", model: "BAAI/bge-m3", dim: 3 })
  out = await emb.embedRaw(["x"])
  t("Infinity: sprava na /embeddings", volania[0].url === "http://inf:7997/embeddings", volania[0].url)
  t("Infinity: posiela model a input", volania[0].body.model === "BAAI/bge-m3" && Array.isArray(volania[0].body.input))
  t("Infinity: vrati vektor", JSON.stringify(out) === "[[1,0,0]]", JSON.stringify(out))

  // ── chybové stavy ────────────────────────────────────────────────────
  mockFetch(() => ({ status: 500, text: "model nie je nacitany" }))
  let e = await hodi(async () => emb.embedRaw(["x"]))
  t("chyba servera sa prenesie s detailom",
    !!e && e.message.includes("500") && e.message.includes("model nie je nacitany"), String(e?.message))

  mockFetch(() => ({ json: { data: [{ embedding: [1], index: 0 }] } }))
  e = await hodi(async () => emb.embedRaw(["x", "y"]))
  t("nesedi pocet vektorov -> chyba", !!e && e.message.includes("1 vektorov na 2"), String(e?.message))

  t("prazdny vstup nevola siet", (await emb.embedRaw([])).length === 0)

  // ── poistka: on-prem embedding je uzavretý, kým nie sú prompty (O7 nález B) ──
  emb = new HttpEmbeddingProvider({ kind: "infinity", url: "http://inf:7997", model: "voyage-4-nano", dim: 3 } as any)
  e = await hodi(async () => emb.embed(["x"]))
  t("poistka: embed() odmietne bezat bez promptov", e !== null && /uzavret/.test(e!.message), String(e?.message))
  t("poistka: sprava odkaze na fazu 0", e !== null && /O7_plan_overenia/.test(e!.message), String(e?.message))

  // ── rerank: TEI ──────────────────────────────────────────────────────
  const kandidati = [chunk("1", "prvy"), chunk("2", "druhy"), chunk("3", "treti")]
  volania = mockFetch(() => ({ json: [{ index: 2, score: 0.9 }, { index: 0, score: 0.5 }, { index: 1, score: 0.1 }] }))
  let rr = new HttpRerankProvider({ kind: "tei", url: "http://tei:8080", model: "bge-reranker" })
  let zoradene = await rr.rerank("otazka", kandidati, 2)
  t("TEI rerank: posiela texts", Array.isArray(volania[0].body.texts), JSON.stringify(volania[0].body))
  t("TEI rerank: zoradi podla skore", zoradene.map(c => c._id).join(",") === "3,1", zoradene.map(c => c._id).join(","))
  t("TEI rerank: oreze na topK", zoradene.length === 2)
  t("TEI rerank: zapise skore do chunku", zoradene[0].score === 0.9)
  t("rerank nie je pipeline stage", rr.isPipelineStage === false)

  // ── rerank: Infinity ─────────────────────────────────────────────────
  volania = mockFetch(() => ({ json: { results: [{ index: 1, relevance_score: 0.8 }, { index: 0, relevance_score: 0.2 }] } }))
  rr = new HttpRerankProvider({ kind: "infinity", url: "http://inf:7997", model: "bge-reranker-v2-m3" })
  zoradene = await rr.rerank("otazka", kandidati, 3)
  t("Infinity rerank: posiela documents a top_n",
    Array.isArray(volania[0].body.documents) && volania[0].body.top_n === 3, JSON.stringify(volania[0].body))
  t("Infinity rerank: zoradi podla relevance_score", zoradene.map(c => c._id).join(",") === "2,1")

  // ── applyScores: odolnosť ────────────────────────────────────────────
  t("index mimo rozsahu sa ignoruje",
    applyScores(kandidati, [{ index: 99, score: 1 }, { index: 0, score: 0.5 }], 5).map(c => c._id).join(",") === "1")
  t("prazdne skore -> povodne poradie",
    applyScores(kandidati, [], 2).map(c => c._id).join(",") === "1,2")
  t("NaN skore sa ignoruje",
    applyScores(kandidati, [{ index: 1, score: NaN }, { index: 2, score: 0.3 }], 5).map(c => c._id).join(",") === "3")

}
await main()
