/**
 * providers/embedding/http.ts
 *
 * Embedding cez HTTP službu — TEI alebo Infinity (ADR-001, krok 4).
 * Používa sa v on-prem režime, kde embedding nesmie ísť cez Voyage API.
 *
 * Tvary API sa medzi službami líšia, preto jedna trieda s dvomi vetvami:
 *
 *   TEI       POST {url}/embed        { inputs: [...] }        -> [[...], [...]]
 *   Infinity  POST {url}/embeddings   { model, input: [...] }  -> { data: [{ embedding, index }] }
 *
 * TEI vie aj OpenAI-kompatibilné /v1/embeddings, ale natívne /embed je
 * jednoduchšie a stabilnejšie, tak ideme cezeň.
 */

import {
  EmbeddingConfig, EmbeddingProvider, ProviderConfigError,
} from "../types"

/**
 * MRL truncation — skráti vektor na cieľový počet dimenzií a znormalizuje.
 *
 * Modely trénované s Matryoshka Representation Learning (napr. voyage-4-nano)
 * majú najdôležitejšiu informáciu na začiatku vektora, takže sa dá odrezať
 * chvost s minimálnou stratou. Po skrátení sa MUSÍ znova normalizovať na
 * jednotkovú dĺžku, inak prestane sedieť kosínusová podobnosť.
 *
 * POZOR: či je 1024-rozmerný voyage-4-nano naozaj porovnateľný s 1024-rozmerným
 * voyage-4 z Atlasu, je otvorená otázka O1 — treba zmerať, nie predpokladať.
 */
export function truncateMRL(vector: number[], targetDim: number): number[] {
  if (targetDim >= vector.length) return vector
  const head = vector.slice(0, targetDim)
  let sumSq = 0
  for (const v of head) sumSq += v * v
  const norm = Math.sqrt(sumSq)
  if (norm === 0) return head
  return head.map(v => v / norm)
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly kind: "tei" | "infinity"
  readonly model: string
  readonly dim: number
  readonly isInline = false
  private url: string
  private apiKey?: string

  constructor(cfg: EmbeddingConfig) {
    if (cfg.kind !== "tei" && cfg.kind !== "infinity") {
      throw new ProviderConfigError(`HttpEmbeddingProvider nepodporuje kind="${cfg.kind}"`)
    }
    if (!cfg.url) throw new ProviderConfigError(`embedding.kind="${cfg.kind}" vyžaduje url`)
    this.kind = cfg.kind
    this.url = cfg.url.replace(/\/+$/, "")
    this.model = cfg.model
    this.dim = cfg.dim
    this.apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`

    const [path, body] = this.kind === "tei"
      ? ["/embed", { inputs: texts, truncate: true }]
      : ["/embeddings", { model: this.model, input: texts }]

    const res = await fetch(`${this.url}${path}`, {
      method: "POST", headers, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`${this.kind} embedding ${res.status}: ${detail.slice(0, 300)}`)
    }

    const raw = await res.json()
    const vectors = this.kind === "tei"
      ? parseTeiEmbed(raw)
      : parseOpenAIEmbed(raw)

    if (vectors.length !== texts.length) {
      throw new Error(
        `${this.kind} vrátil ${vectors.length} vektorov na ${texts.length} textov`
      )
    }
    return vectors.map(v => truncateMRL(v, this.dim))
  }
}

/** TEI /embed vracia priamo pole polí. */
export function parseTeiEmbed(raw: unknown): number[][] {
  if (!Array.isArray(raw)) throw new Error("TEI: očakávalo sa pole vektorov")
  return raw as number[][]
}

/** Infinity /embeddings vracia OpenAI tvar; poradie treba zoradiť podľa index. */
export function parseOpenAIEmbed(raw: any): number[][] {
  const data = raw?.data
  if (!Array.isArray(data)) throw new Error("Infinity: v odpovedi chýba pole data")
  return [...data]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d: any) => {
      if (!Array.isArray(d.embedding)) throw new Error("Infinity: položka bez poľa embedding")
      return d.embedding as number[]
    })
}
