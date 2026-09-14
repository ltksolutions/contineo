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

import Link from "next/link"
import { toBlocks, type Segment } from "@/lib/formatText"

/**
 * Riadok rozložený na bežné, tučné a odkazujúce úseky.
 *
 * Odkaz smeruje len dovnútra aplikácie — vzor v `formatText.ts` cudziu
 * adresu neprepustí, takže `<Link>` je bezpečný.
 */
export function Segments({ segments: segments }: { segments: Segment[] }) {
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
 * Celý text ako bloky.
 *
 * Úrovne nadpisov sa líšia len jemne — aj odpoveď, aj znenie predpisu má mať
 * jeden hlas, nie hierarchiu ako dokumentácia. Pri norme je to navyše
 * podstatné: „PRVÁ ČASŤ“ a „Článok 3“ sú dve rôzne úrovne členenia, ale
 * čitateľ ich rozoznáva podľa slov, nie podľa veľkosti písma.
 */
export default function FormattedText({ text }: { text: string }) {
  const blocks = toBlocks(text)
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
