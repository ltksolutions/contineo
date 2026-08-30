/**
 * sseKlient.ts — čítanie odpovede z `/api/chat`.
 *
 * Server posiela Server-Sent Events v tvare `data: {…}\n\n`. Vyzerá to
 * jednoducho, ale je tu rovnaká pasca ako pri binárnom streame z Bedrocku:
 * **jedna udalosť sa môže rozdeliť medzi dve čítania.** Naivné
 * `JSON.parse(chunk)` funguje na localhoste a rozsype sa v produkcii, kde
 * medzi serverom a prehliadačom je viac vrstiev a pakety chodia inak.
 *
 * Preto sa tu drží buffer a spracúvajú sa len úplné bloky ukončené `\n\n`.
 *
 * Modul je zámerne bez závislosti na React a bez `fetch` v podpise, aby sa
 * dal otestovať nad umelým streamom — viď `tests/sseKlient.test.ts`.
 */

import type { TokenCounts, Cost } from "./pricing"

export interface AnswerSource {
  index: number
  title: string
  slug?: string
  url?: string
  articleRef?: string
  heading?: string
  accessLevel?: string
}

export interface Citation {
  chunkIndex: number
  citedText: string
  documentTitle?: string
  articleRef?: string | null
}

/** Zhrnutie, ktoré príde v poslednej udalosti. */
export interface Completion {
  sources: AnswerSource[]
  citations: Citation[]
  model: string
  provider: string
  verifiedCitations: boolean
  /** Trvanie jednotlivých fáz pred generovaním (ms). */
  timings?: Record<string, number>
  /** Prečo model prestal písať; "max_tokens" = useknuté. */
  dovodUkoncenia?: string
  tokens?: TokenCounts
  cost?: Cost
}

export type SseEvent =
  | { type: "token"; token: string }
  | { type: "citation"; citation: Citation }
  | ({ type: "done" } & Partial<Completion>)
  | { type: "error"; message: string }

/**
 * Rozdelí buffer na úplné SSE bloky. Vráti nájdené udalosti a zvyšok,
 * ktorý patrí na začiatok ďalšieho čítania.
 */
export function splitEvents(buf: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  let rest = buf

  for (;;) {
    const end = rest.indexOf("\n\n")
    if (end === -1) break

    const block = rest.slice(0, end)
    rest = rest.slice(end + 2)

    // Blok môže mať viac riadkov; nás zaujímajú len tie s `data:`.
    // Komentáre (`:` na začiatku) sa používajú ako keep-alive.
    const data = block
      .split("\n")
      .filter(r => r.startsWith("data:"))
      .map(r => r.slice(5).trim())
      .join("")

    if (!data) continue

    try {
      events.push(JSON.parse(data) as SseEvent)
    } catch {
      // Poškodená udalosť sa preskočí. Zhodiť celú odpoveď kvôli jednému
      // zlému bloku by bolo horšie než prísť o jeden token.
    }
  }

  return { events, rest }
}

/** Postupne vydáva udalosti z tela odpovede. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      // `stream: true` je dôležité — viacbajtový znak (napr. „š") sa môže
      // rozdeliť medzi dva pakety a bez toho by sa dekódoval ako otáznik.
      buf += decoder.decode(value, { stream: true })

      const { events, rest } = splitEvents(buf)
      buf = rest
      for (const u of events) yield u
    }

    // Posledný blok nemusí byť ukončený prázdnym riadkom.
    buf += decoder.decode()
    if (buf.trim()) {
      const { events } = splitEvents(buf + "\n\n")
      for (const u of events) yield u
    }
  } finally {
    reader.releaseLock()
  }
}

export interface AskProgress {
  /** Postupne rastúci text odpovede. */
  text: string
  citations: Citation[]
}

export interface AskResult extends AskProgress {
  sources: AnswerSource[]
  model: string
  provider: string
  verifiedCitations: boolean
  /**
   * Čas po prvý token v milisekundách. D9 meria p95 pod 2 s a nikde inde
   * sa to zmerať nedá — server nevie, kedy to dorazilo k človeku.
   */
  ttftMs: number | null
  totalMs: number
  /** Rozpad času pred generovaním na fázy — bez neho je TTFT bez príčiny. */
  timings?: Record<string, number>
  /**
   * Prečo model prestal písať. `"max_tokens"` znamená, že odpoveď je
   * useknutá — používateľ to musí vidieť, nie sa domýšľať.
   */
  dovodUkoncenia?: string
  /** Spotreba tokenov podľa modelu — vstup, výstup a cache zvlášť. */
  tokens?: TokenCounts
  /** Odhad ceny v deň položenia otázky, aj s označením cenníka. */
  cost?: Cost
  error?: string
}

/**
 * Pošle dotaz a priebežne hlási, ako pribúda odpoveď.
 *
 * `onZmena` sa volá po každej udalosti — komponent si ju len prekreslí.
 */
export async function askQuestion(
  question: string,
  onChange: (p: AskProgress) => void,
  init?: { signal?: AbortSignal; url?: string }
): Promise<AskResult> {
  const start = Date.now()
  let ttftMs: number | null = null
  let text = ""
  const citations: Citation[] = []

  const done = (extra: Partial<AskResult> = {}): AskResult => ({
    text, citations: citations,
    sources: [], model: "", provider: "", verifiedCitations: false,
    ttftMs, totalMs: Date.now() - start,
    ...extra,
  })

  const answer = await fetch(init?.url ?? "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: question }),
    signal: init?.signal,
  })

  if (!answer.ok || !answer.body) {
    // Chybové odpovede z route.ts sú obyčajný text, nie SSE.
    const message = await answer.text().catch(() => "")
    return done({ error: message || `Server vrátil ${answer.status}` })
  }

  for await (const u of readEvents(answer.body)) {
    if (u.type === "token") {
      if (ttftMs === null) ttftMs = Date.now() - start
      text += u.token
      onChange({ text, citations: citations })
    } else if (u.type === "citation") {
      citations.push(u.citation)
      onChange({ text, citations: citations })
    } else if (u.type === "error") {
      return done({ error: u.message })
    } else if (u.type === "done") {
      return done({
        sources: u.sources ?? [],
        // Adaptéry bez Citations API vracajú prázdne pole; vtedy sa
        // opierame o citácie nazbierané počas streamu (žiadne) a o zdroje.
        citations: u.citations?.length ? u.citations : citations,
        model: u.model ?? "",
        provider: u.provider ?? "",
        verifiedCitations: u.verifiedCitations ?? false,
        timings: u.timings,
        dovodUkoncenia: u.dovodUkoncenia,
        tokens: u.tokens,
        cost: u.cost,
      })
    }
  }

  // Stream skončil bez `done` — server spadol uprostred.
  return done({ error: text ? undefined : "Odpoveď sa prerušila." })
}
