import { AnthropicGenerationProvider } from "../src/lib/providers/generation/anthropic"
import { OpenAICompatGenerationProvider } from "../src/lib/providers/generation/openai"
import { classifyQuery, classifyByHeuristic } from "../src/lib/queryClassifier"
import { preprocessQuery, parsePreprocessed } from "../src/lib/queryPreprocessor"
import { GenerationProvider } from "../src/lib/providers/types"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

function mockFetch(handler: (url: string, body: any) => { status?: number; json?: any; text?: string }) {
  const volania: { url: string; body: any }[] = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null
    volania.push({ url, body })
    const r = handler(url, body)
    return {
      ok: (r.status ?? 200) < 400, status: r.status ?? 200,
      json: async () => r.json, text: async () => r.text ?? JSON.stringify(r.json),
    }
  }
  return volania
}

/** Falošný adaptér — vráti, čo mu povieme, alebo hodí chybu. */
const fake = (odpoved: string | Error): GenerationProvider => ({
  kind: "openai", model: "test", supportsCitations: false,
  async *stream() {},
  async complete() { if (odpoved instanceof Error) throw odpoved; return odpoved },
})

async function main() {
  // ── complete(): Anthropic ────────────────────────────────────────────
  process.env.ANTHROPIC_API_KEY = "k"
  let volania = mockFetch(() => ({ json: { content: [{ type: "text", text: "  hybrid  " }] } }))
  const ant = new AnthropicGenerationProvider({ kind: "anthropic", model: "claude-haiku-4-5-20251001" })
  let out = await ant.complete("otazka", { maxTokens: 5 })
  t("anthropic complete: vrati orezany text", out === "hybrid", JSON.stringify(out))
  t("anthropic complete: nestreamuje", volania[0].body.stream === undefined)
  t("anthropic complete: respektuje maxTokens", volania[0].body.max_tokens === 5)

  mockFetch(() => ({ status: 429, text: "rate limit" }))
  let chyba = false
  try { await ant.complete("x") } catch { chyba = true }
  t("anthropic complete: chyba servera vyhodi", chyba)

  // ── complete(): OpenAI-compat ────────────────────────────────────────
  volania = mockFetch(() => ({ json: { choices: [{ message: { content: "vector" } }] } }))
  const oai = new OpenAICompatGenerationProvider({ kind: "openai", url: "http://vllm:8000/v1", model: "Qwen3-8B" })
  out = await oai.complete("otazka")
  t("openai complete: vrati text", out === "vector")
  t("openai complete: posiela stream:false", volania[0].body.stream === false)
  t("openai complete: spravna cesta", volania[0].url === "http://vllm:8000/v1/chat/completions", volania[0].url)

  // ── klasifikátor ─────────────────────────────────────────────────────
  // 10 slov -> heuristika vracia "vector" (prah VECTOR_MIN_WORDS = 8)
  const dlha = "ako sa registruje novy hrac do sutaze za novy klub"
  t("heuristika: § -> fulltext", classifyByHeuristic("§ 84 ods. 2") === "fulltext")
  t("heuristika: dlha otazka (10 slov) -> vector", classifyByHeuristic(dlha) === "vector")
  t("heuristika: stredne dlha (7 slov) -> hybrid",
    classifyByHeuristic("ako sa registruje novy hrac do sutaze") === "hybrid")
  t("heuristika: kratky vyraz -> fulltext", classifyByHeuristic("prestup hraca") === "fulltext")

  t("predvolene sa model NEVOLA",
    await classifyQuery(dlha, false, fake("fulltext")) === "vector")
  t("s useLLM sa model pouzije",
    await classifyQuery(dlha, true, fake("fulltext")) === "fulltext")
  t("nezmyselna odpoved modelu -> heuristika",
    await classifyQuery(dlha, true, fake("banan")) === "vector")
  t("vypadok modelu -> heuristika",
    await classifyQuery(dlha, true, fake(new Error("timeout"))) === "vector")
  t("bez adaptera -> heuristika",
    await classifyQuery(dlha, true, undefined) === "vector")

  // ── parsovanie preprocessora ─────────────────────────────────────────
  let p = parsePreprocessed('{"rewritten":"prepis","subQueries":["a","b"],"keywords":["k1"]}', "povodna")
  t("parse: cisty JSON", p.rewritten === "prepis" && p.subQueries.length === 2)

  p = parsePreprocessed('```json\n{"rewritten":"z bloku","subQueries":[],"keywords":[]}\n```', "povodna")
  t("parse: JSON v markdown bloku", p.rewritten === "z bloku", JSON.stringify(p))

  p = parsePreprocessed('Tu je vysledok: {"rewritten":"v texte","subQueries":[],"keywords":[]} dufam ze pomohol', "povodna")
  t("parse: JSON obaleny textom", p.rewritten === "v texte", JSON.stringify(p))

  p = parsePreprocessed('{"subQueries":[],"keywords":[]}', "povodna")
  t("parse: chybajuci rewritten -> povodny dotaz", p.rewritten === "povodna")

  p = parsePreprocessed('{"rewritten":"x","subQueries":["a","b","c","d","e"],"keywords":[]}', "q")
  t("parse: subQueries orezane na 3", p.subQueries.length === 3)

  p = parsePreprocessed('{"rewritten":"x","subQueries":[1,null,"ok"],"keywords":"nie pole"}', "q")
  t("parse: nestringove polozky sa odfiltruju", p.subQueries.length === 1 && p.keywords.length === 0, JSON.stringify(p))

  // ── preprocessQuery ──────────────────────────────────────────────────
  p = await preprocessQuery("kratky dotaz", fake('{"rewritten":"NEMALO SA VOLAT"}'))
  t("kratky dotaz sa nepredspracuva", p.rewritten === "kratky dotaz")

  p = await preprocessQuery(dlha, undefined)
  t("bez adaptera vrati povodny dotaz", p.rewritten === dlha)

  p = await preprocessQuery(dlha, fake(new Error("model padol")))
  t("vypadok modelu vrati povodny dotaz", p.rewritten === dlha)

  p = await preprocessQuery(dlha, fake("toto nie je JSON"))
  t("nevalidna odpoved vrati povodny dotaz", p.rewritten === dlha)

  p = await preprocessQuery(dlha, fake('{"rewritten":"vycisteny dotaz","subQueries":[],"keywords":[]}'))
  t("uspesny prepis sa pouzije", p.rewritten === "vycisteny dotaz")

  const zle = R.filter(([ok]) => !ok)
  for (const [ok, n] of R) console.log(`${ok ? "OK   " : "CHYBA"} ${n}`)
  console.log("\n" + "=".repeat(56))
  console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
  process.exit(zle.length ? 1 : 0)
}
main()
