import { HttpEmbeddingProvider, truncateMRL, parseTeiEmbed, parseOpenAIEmbed } from "../src/lib/providers/embedding/http"
import { HttpRerankProvider, parseTeiRerank, parseInfinityRerank, applyScores } from "../src/lib/providers/rerank/http"

import { t } from "./helper"
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

async function throws(fn: () => Promise<unknown>): Promise<Error | null> {
  try { await fn(); return null } catch (e) { return e as Error }
}

/** Nahradí globálny fetch a zapamätá si, čo sa poslalo. */
function mockFetch(handler: (url: string, body: any) => { status?: number; json?: any; text?: string }) {
  const calls: { url: string; body: any }[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    calls.push({ url, body })
    const r = handler(url, body)
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json),
    }
  }
  return calls
}

const chunk = (id: string, text: string): any => ({ _id: id, text, documentId: "d" })

async function main() {
  // ── MRL truncation ───────────────────────────────────────────────────
  const v = truncateMRL([3, 4, 99, 99], 2)
  t("MRL: skrati na cielovu dimenziu", v.length === 2)
  t("MRL: znormalizuje na jednotkovu dlzku",
    close(Math.hypot(...v), 1), String(Math.hypot(...v)))
  t("MRL: zachova smer (3,4) -> (0.6,0.8)", close(v[0], 0.6) && close(v[1], 0.8), JSON.stringify(v))
  const unchanged = truncateMRL([1, 2, 3], 5)
  t("MRL: kratsi vektor nechá tak", unchanged.length === 3)
  t("MRL: nulovy vektor nespadne na delenie nulou", truncateMRL([0, 0, 0, 0], 2).length === 2)

  // ── parsovanie odpovedí ──────────────────────────────────────────────
  t("TEI embed: pole poli", JSON.stringify(parseTeiEmbed([[1, 2], [3, 4]])) === "[[1,2],[3,4]]")
  t("Infinity embed: zoradi podla index", JSON.stringify(
    parseOpenAIEmbed({ data: [{ embedding: [9], index: 1 }, { embedding: [1], index: 0 }] })
  ) === "[[1],[9]]")
  t("Infinity embed: chybajuce data spadne",
    !!(await throws(async () => parseOpenAIEmbed({}))))

  // ── embedding cez TEI ────────────────────────────────────────────────
  let calls = mockFetch(() => ({ json: [[3, 4, 0, 0], [0, 5, 0, 0]] }))
  let emb = new HttpEmbeddingProvider({ kind: "tei", url: "http://tei:8080/", model: "voyage-4-nano", dim: 2 })
  let out = await emb.embedRaw(["a", "b"])
  t("TEI: sprava na /embed", calls[0].url === "http://tei:8080/embed", calls[0].url)
  t("TEI: posiela inputs", JSON.stringify(calls[0].body.inputs) === '["a","b"]', JSON.stringify(calls[0].body))
  t("TEI: vrati 2 vektory", out.length === 2)
  t("TEI: skrati na dim=2 a znormalizuje", out[0].length === 2 && close(Math.hypot(...out[0]), 1))
  t("TEI: isInline je false", emb.isInline === false)

  // ── embedding cez Infinity ───────────────────────────────────────────
  calls = mockFetch(() => ({ json: { data: [{ embedding: [1, 0, 0], index: 0 }] } }))
  emb = new HttpEmbeddingProvider({ kind: "infinity", url: "http://inf:7997", model: "BAAI/bge-m3", dim: 3 })
  out = await emb.embedRaw(["x"])
  t("Infinity: sprava na /embeddings", calls[0].url === "http://inf:7997/embeddings", calls[0].url)
  t("Infinity: posiela model a input", calls[0].body.model === "BAAI/bge-m3" && Array.isArray(calls[0].body.input))
  t("Infinity: vrati vektor", JSON.stringify(out) === "[[1,0,0]]", JSON.stringify(out))

  // ── chybové stavy ────────────────────────────────────────────────────
  mockFetch(() => ({ status: 500, text: "model nie je nacitany" }))
  let e = await throws(async () => emb.embedRaw(["x"]))
  t("chyba servera sa prenesie s detailom",
    !!e && e.message.includes("500") && e.message.includes("model nie je nacitany"), String(e?.message))

  mockFetch(() => ({ json: { data: [{ embedding: [1], index: 0 }] } }))
  e = await throws(async () => emb.embedRaw(["x", "y"]))
  t("nesedi pocet vektorov -> chyba", !!e && e.message.includes("1 vektorov na 2"), String(e?.message))

  t("prazdny vstup nevola siet", (await emb.embedRaw([])).length === 0)

  // ── poistka: on-prem embedding je uzavretý, kým nie sú prompty (O7 nález B) ──
  emb = new HttpEmbeddingProvider({ kind: "infinity", url: "http://inf:7997", model: "voyage-4-nano", dim: 3 } as any)
  e = await throws(async () => emb.embed(["x"]))
  t("poistka: embed() odmietne bezat bez promptov", e !== null && /uzavret/.test(e!.message), String(e?.message))
  t("poistka: sprava odkaze na fazu 0", e !== null && /O7_plan_overenia/.test(e!.message), String(e?.message))

  // ── rerank: TEI ──────────────────────────────────────────────────────
  const candidates = [chunk("1", "prvy"), chunk("2", "druhy"), chunk("3", "treti")]
  calls = mockFetch(() => ({ json: [{ index: 2, score: 0.9 }, { index: 0, score: 0.5 }, { index: 1, score: 0.1 }] }))
  let rr = new HttpRerankProvider({ kind: "tei", url: "http://tei:8080", model: "bge-reranker" })
  let sorted = await rr.rerank("otazka", candidates, 2)
  t("TEI rerank: posiela texts", Array.isArray(calls[0].body.texts), JSON.stringify(calls[0].body))
  t("TEI rerank: zoradi podla skore", sorted.map(c => c._id).join(",") === "3,1", sorted.map(c => c._id).join(","))
  t("TEI rerank: oreze na topK", sorted.length === 2)
  t("TEI rerank: zapise skore do chunku", sorted[0].score === 0.9)
  t("rerank nie je pipeline stage", rr.isPipelineStage === false)

  // ── rerank: Infinity ─────────────────────────────────────────────────
  calls = mockFetch(() => ({ json: { results: [{ index: 1, relevance_score: 0.8 }, { index: 0, relevance_score: 0.2 }] } }))
  rr = new HttpRerankProvider({ kind: "infinity", url: "http://inf:7997", model: "bge-reranker-v2-m3" })
  sorted = await rr.rerank("otazka", candidates, 3)
  t("Infinity rerank: posiela documents a top_n",
    Array.isArray(calls[0].body.documents) && calls[0].body.top_n === 3, JSON.stringify(calls[0].body))
  t("Infinity rerank: zoradi podla relevance_score", sorted.map(c => c._id).join(",") === "2,1")

  // ── applyScores: odolnosť ────────────────────────────────────────────
  t("index mimo rozsahu sa ignoruje",
    applyScores(candidates, [{ index: 99, score: 1 }, { index: 0, score: 0.5 }], 5).map(c => c._id).join(",") === "1")
  t("prazdne skore -> povodne poradie",
    applyScores(candidates, [], 2).map(c => c._id).join(",") === "1,2")
  t("NaN skore sa ignoruje",
    applyScores(candidates, [{ index: 1, score: NaN }, { index: 2, score: 0.3 }], 5).map(c => c._id).join(",") === "3")

}
await main()
