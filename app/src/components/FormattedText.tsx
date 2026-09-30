/**
 * FormattedText.tsx — vykreslenie ľahkého markdownu ako React uzlov.
 *
 * Ten istý rozklad (`formatText.ts`) používajú dve veci s rovnakou
 * požiadavkou a rôznym pôvodom textu:
 *
 *   1. **odpoveď modelu** (`Answer.tsx`) — text, ktorý sme nenapísali my,
 *   2. **znenie predpisu** (detail dokumentu, schvaľovanie) — text, ktorý
 *      prešiel prepisom cez model, takže je v markdowne.
 *
 * Nikde tu nie je `dangerouslySetInnerHTML`. Vstup sa mení na dátovú
 * štruktúru a React ju vykreslí ako obyčajné uzly — ani výstup modelu, ani
 * obsah cudzieho dokumentu sa nikdy nestane HTML.
 *
 * Komponent nemá `"use client"` ani stav: použiteľný je aj zo serverového
 * komponentu (detail dokumentu), aj z klientskeho (`Answer.tsx`).
 */

import type { ReactNode } from "react"
import Link from "next/link"
import { toBlocks, markCitations, CITE_TOKEN, type Segment } from "@/lib/formatText"

/**
 * Riadok rozložený na bežné, tučné a odkazujúce úseky.
 *
 * Odkaz smeruje len dovnútra aplikácie — vzor v `formatText.ts` cudziu
 * adresu neprepustí, takže `<Link>` je bezpečný.
 */
export function Segments({ segments: segments }: { segments: Segment[] }) {
  // Zarážky citácií (`markCitations`) — len v odpovedi s citáciami zo streamu.
  if (segments.some(u => u.text.includes("\uE000") || u.text.includes("\uE002"))) {
    return <CitedSegments segments={segments} />
  }
  return (
    <>
      {segments.map((u, i) =>
        u.druh === "tucne"
          ? <strong key={i}>{u.text}</strong>
          : u.druh === "odkaz"
            ? <Link key={i} href={u.href}>{u.text}</Link>
            : <span key={i}>{u.text}</span>
      )}
    </>
  )
}

/**
 * Úseky so značkami citácií (ASK-odpoved-dva-stlpce). Text citovanej vety
 * je v `span.cite-sentence`, značka na jej konci je `<button class="cite">`
 * s číslom citácie. Obe nesú `data-cite` — prepojenie s citáciou vpravo
 * (zvýraznenie, pripnutie) robí `Answer` delegovanými udalosťami, tento
 * komponent ostáva bez stavu.
 */
function CitedSegments({ segments }: { segments: Segment[] }) {
  const out: ReactNode[] = []
  let open: string | null = null
  let key = 0
  const wrap = (node: ReactNode) =>
    open ? <span key={key++} className="cite-sentence" data-cite={open.replace(/,/g, " ")}>{node}</span> : node

  for (const u of segments) {
    let last = 0
    const pieces: { text: string }[] = []
    for (const m of u.text.matchAll(CITE_TOKEN)) {
      if (m.index! > last) pieces.push({ text: u.text.slice(last, m.index) })
      pieces.push({ text: m[0] })
      last = m.index! + m[0].length
    }
    if (last < u.text.length) pieces.push({ text: u.text.slice(last) })

    for (const { text } of pieces) {
      const token = /^\uE002([\d,]+)\uE001$|^\uE000([\d,]+)\uE001$/.exec(text)
      if (token?.[1]) {
        open = token[1]
        continue
      }
      if (token?.[2]) {
        for (const n of token[2].split(",")) {
          out.push(
            <button key={key++} type="button" className="cite" data-cite={n} aria-describedby={`citation-${n}`}>
              {n}
            </button>,
          )
        }
        open = null
        continue
      }
      const node =
        u.druh === "tucne" ? <strong key={key++}>{text}</strong>
          : u.druh === "odkaz" ? <Link key={key++} href={u.href}>{text}</Link>
          : <span key={key++}>{text}</span>
      out.push(wrap(node))
    }
  }
  return <>{out}</>
}

export default function FormattedText({
  text,
  citations,
}: {
  text: string
  /**
   * Citácie odpovede s polohou `at` zo streamu — vložia sa ako značky `[n]`
   * na konce viet. Bez nich (alebo bez `at`) text ostáva, ako je.
   */
  citations?: { citedText: string; at?: number }[]
}) {
  const blocks = toBlocks(citations?.length ? markCitations(text, citations) : text)
  return (
    <>
      {blocks.map((b, i) =>
        b.druh === "nadpis" ? (
          <div
            key={i}
            style={{
              fontSize: b.level <= 2 ? 16.5 : 15.5,
              fontWeight: 700,
              margin: i === 0 ? "0 0 8px" : "18px 0 8px",
            }}
          >
            <Segments segments={b.segments} />
          </div>
        ) : b.druh === "odsek" ? (
          <p key={i} style={{ margin: "0 0 12px" }}>
            <Segments segments={b.segments} />
          </p>
        ) : b.numbered ? (
          <ol key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.items.map((p, j) => <li key={j}><Segments segments={p} /></li>)}
          </ol>
        ) : (
          <ul key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.items.map((p, j) => <li key={j}><Segments segments={p} /></li>)}
          </ul>
        )
      )}
    </>
  )
}
