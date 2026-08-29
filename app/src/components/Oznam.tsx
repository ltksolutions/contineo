/**
 * Oznam — čo sa práve stalo.
 *
 * Správa po uložení bola dovtedy odsekom hore na stránke. Pri dlhom formulári
 * je človek v tej chvíli dole pri tlačidle a **nevidí ju** — uloží, nič sa
 * navonok nezmení a nevie, či to prešlo. Preto sa oznam ukáže tam, kde sa
 * naňho pozerá, nie tam, kde sa mu hodí byť v toku stránky.
 *
 * Bez JavaScriptu: zmiznutie po chvíli robí CSS animácia, zavretie obyčajný
 * odkaz na tú istú adresu bez parametra. Oznam pritom zostáva v dokumente —
 * čítačka obrazovky ho prečíta (`role="status"`) aj po tom, čo sa vizuálne
 * stratí.
 */

import Link from "next/link"

export default function Oznam({
  sprava,
  chyba,
  spat,
}: {
  sprava?: string
  /** Rozlíšenie je na volajúcom. Hádať to z textu by sa raz pomýlilo. */
  chyba?: boolean
  /** Kam vedie krížik — tá istá stránka bez parametra so správou. */
  spat: string
}) {
  if (!sprava) return null

  return (
    <div className={`oznam${chyba ? " oznam--chyba" : ""}`} role="status" aria-live="polite">
      <span className="oznam-znak" aria-hidden="true">
        {chyba ? (
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="7" />
            <path d="M9 5.5v4M9 12.4v.1" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 9.5 7 13l7.5-8" />
          </svg>
        )}
      </span>

      <span className="oznam-text">{sprava}</span>

      <Link href={spat} className="oznam-zavriet" aria-label="Zavrieť oznam">×</Link>
    </div>
  )
}
