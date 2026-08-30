/**
 * Oznam — čo sa práve stalo, uprostred obrazovky a s potvrdením.
 *
 * Prešiel dvomi podobami a obe boli horšie:
 *
 *  1. Odsek hore na stránke. Pri dlhom formulári je človek pri tlačidle dole
 *     a neuvidí ho — uloží a nevie, či to prešlo.
 *  2. Prúžok hore, ktorý sám zmizne. Na telefóne je hore úzky pruh, ktorý
 *     človek pri odosielaní formulára nesleduje, a o sedem sekúnd je preč.
 *     Pri chybe to znamená, že sa mu zmena neuložila a **nedozvie sa o tom**.
 *
 * Preto uprostred, cez ztmavené pozadie a **s potvrdením kliknutím**. Je to
 * prerušenie a je zámerné: sú to obrazovky, kde sa ukladá zriedka a kde
 * nevedieť výsledok je drahšie než jeden klik.
 *
 * Bez JavaScriptu funguje rovnako — potvrdenie je obyčajný odkaz na tú istú
 * adresu bez parametra so správou.
 */

import Link from "next/link"

export default function Notice({
  sprava,
  chyba,
  spat,
}: {
  sprava?: string
  /** Rozlíšenie je na volajúcom. Hádať to z textu by sa raz pomýlilo. */
  chyba?: boolean
  /** Kam vedie potvrdenie — tá istá stránka bez parametra so správou. */
  spat: string
}) {
  if (!sprava) return null

  return (
    <div className="oznam-tienidlo">
      <div
        className={`oznam${chyba ? " oznam--chyba" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="oznam-text"
      >
        <span className="oznam-znak" aria-hidden="true">
          {chyba ? (
            <svg width="26" height="26" viewBox="0 0 18 18" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round">
              <circle cx="9" cy="9" r="7" />
              <path d="M9 5.2v4.2M9 12.3v.1" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 18 18" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="9" r="7" />
              <path d="M5.6 9.2 8 11.6l4.4-5" />
            </svg>
          )}
        </span>

        <p id="oznam-text" className="oznam-text">{sprava}</p>

        {/* `autoFocus`: na klávesnici je potvrdenie prvé, kam sa dá stlačiť
            Enter, a nie je nutné hľadať ho tabulátorom cez celú stránku. */}
        <Link href={spat} className="tlacidlo oznam-potvrdit" autoFocus>
          Rozumiem
        </Link>
      </div>
    </div>
  )
}
