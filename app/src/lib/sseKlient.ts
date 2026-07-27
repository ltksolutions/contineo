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

export interface Zdroj {
  index: number
  title: string
  slug?: string
  url?: string
  articleRef?: string
  heading?: string
  accessLevel?: string
}

export interface Citacia {
  chunkIndex: number
  citedText: string
  documentTitle?: string
  articleRef?: string | null
}

/** Zhrnutie, ktoré príde v poslednej udalosti. */
export interface Dokoncenie {
  sources: Zdroj[]
  citations: Citacia[]
  model: string
  provider: string
  verifiedCitations: boolean
  /** Trvanie jednotlivých fáz pred generovaním (ms). */
  casy?: Record<string, number>
  /** Prečo model prestal písať; "max_tokens" = useknuté. */
  dovodUkoncenia?: string
}

export type UdalostSSE =
  | { type: "token"; token: string }
  | { type: "citation"; citation: Citacia }
  | ({ type: "done" } & Partial<Dokoncenie>)
  | { type: "error"; message: string }

/**
 * Rozdelí buffer na úplné SSE bloky. Vráti nájdené udalosti a zvyšok,
 * ktorý patrí na začiatok ďalšieho čítania.
 */
export function rozdelUdalosti(buf: string): { udalosti: UdalostSSE[]; zvysok: string } {
  const udalosti: UdalostSSE[] = []
  let zvysok = buf

  for (;;) {
    const koniec = zvysok.indexOf("\n\n")
    if (koniec === -1) break

    const blok = zvysok.slice(0, koniec)
    zvysok = zvysok.slice(koniec + 2)

    // Blok môže mať viac riadkov; nás zaujímajú len tie s `data:`.
    // Komentáre (`:` na začiatku) sa používajú ako keep-alive.
    const data = blok
      .split("\n")
      .filter(r => r.startsWith("data:"))
      .map(r => r.slice(5).trim())
      .join("")

    if (!data) continue

    try {
      udalosti.push(JSON.parse(data) as UdalostSSE)
    } catch {
      // Poškodená udalosť sa preskočí. Zhodiť celú odpoveď kvôli jednému
      // zlému bloku by bolo horšie než prísť o jeden token.
    }
  }

  return { udalosti, zvysok }
}

/** Postupne vydáva udalosti z tela odpovede. */
export async function* citajUdalosti(
  telo: ReadableStream<Uint8Array>
): AsyncGenerator<UdalostSSE> {
  const reader = telo.getReader()
  const dekoder = new TextDecoder()
  let buf = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      // `stream: true` je dôležité — viacbajtový znak (napr. „š") sa môže
      // rozdeliť medzi dva pakety a bez toho by sa dekódoval ako otáznik.
      buf += dekoder.decode(value, { stream: true })

      const { udalosti, zvysok } = rozdelUdalosti(buf)
      buf = zvysok
      for (const u of udalosti) yield u
    }

    // Posledný blok nemusí byť ukončený prázdnym riadkom.
    buf += dekoder.decode()
    if (buf.trim()) {
      const { udalosti } = rozdelUdalosti(buf + "\n\n")
      for (const u of udalosti) yield u
    }
  } finally {
    reader.releaseLock()
  }
}

export interface Priebeh {
  /** Postupne rastúci text odpovede. */
  text: string
  citacie: Citacia[]
}

export interface Vysledok extends Priebeh {
  zdroje: Zdroj[]
  model: string
  provider: string
  overeneCitacie: boolean
  /**
   * Čas po prvý token v milisekundách. D9 meria p95 pod 2 s a nikde inde
   * sa to zmerať nedá — server nevie, kedy to dorazilo k človeku.
   */
  ttftMs: number | null
  celkovoMs: number
  /** Rozpad času pred generovaním na fázy — bez neho je TTFT bez príčiny. */
  casy?: Record<string, number>
  /**
   * Prečo model prestal písať. `"max_tokens"` znamená, že odpoveď je
   * useknutá — používateľ to musí vidieť, nie sa domýšľať.
   */
  dovodUkoncenia?: string
  chyba?: string
}

/**
 * Pošle dotaz a priebežne hlási, ako pribúda odpoveď.
 *
 * `onZmena` sa volá po každej udalosti — komponent si ju len prekreslí.
 */
export async function polozOtazku(
  otazka: string,
  onZmena: (p: Priebeh) => void,
  init?: { signal?: AbortSignal; url?: string }
): Promise<Vysledok> {
  const zaciatok = Date.now()
  let ttftMs: number | null = null
  let text = ""
  const citacie: Citacia[] = []

  const hotovo = (extra: Partial<Vysledok> = {}): Vysledok => ({
    text, citacie,
    zdroje: [], model: "", provider: "", overeneCitacie: false,
    ttftMs, celkovoMs: Date.now() - zaciatok,
    ...extra,
  })

  const odpoved = await fetch(init?.url ?? "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: otazka }),
    signal: init?.signal,
  })

  if (!odpoved.ok || !odpoved.body) {
    // Chybové odpovede z route.ts sú obyčajný text, nie SSE.
    const sprava = await odpoved.text().catch(() => "")
    return hotovo({ chyba: sprava || `Server vrátil ${odpoved.status}` })
  }

  for await (const u of citajUdalosti(odpoved.body)) {
    if (u.type === "token") {
      if (ttftMs === null) ttftMs = Date.now() - zaciatok
      text += u.token
      onZmena({ text, citacie })
    } else if (u.type === "citation") {
      citacie.push(u.citation)
      onZmena({ text, citacie })
    } else if (u.type === "error") {
      return hotovo({ chyba: u.message })
    } else if (u.type === "done") {
      return hotovo({
        zdroje: u.sources ?? [],
        // Adaptéry bez Citations API vracajú prázdne pole; vtedy sa
        // opierame o citácie nazbierané počas streamu (žiadne) a o zdroje.
        citacie: u.citations?.length ? u.citations : citacie,
        model: u.model ?? "",
        provider: u.provider ?? "",
        overeneCitacie: u.verifiedCitations ?? false,
        casy: u.casy,
        dovodUkoncenia: u.dovodUkoncenia,
      })
    }
  }

  // Stream skončil bez `done` — server spadol uprostred.
  return hotovo({ chyba: text ? undefined : "Odpoveď sa prerušila." })
}
