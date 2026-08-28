/**
 * Widget „Nevybavené žiadosti" — prvá vec na úvodnej strane (D36).
 *
 * Osobná schránka: **čo čaká na mňa**, nie prehľad organizácie. Kto zo sto
 * ľudí ešte nepotvrdil, je iná obrazovka s inými právami (rozsah B, rola `hr`).
 *
 * Komponent je zámerne bez načítavania dát — dostane hotový prehľad. Vďaka
 * tomu sa dá otestovať bez databázy a widget zostáva tým, čím má byť:
 * vypísaním zoznamu.
 */

import Link from "next/link"
import type { PendingOverview } from "@/lib/pending"
import { dictionary } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"

/**
 * Koľko položiek sa vypíše.
 *
 * Nie je to estetika, je to mobile first: na displeji širokom 360 px zaberie
 * jedna položka vyše 70 px, takže pätnásť nepotvrdených noriem by odtlačilo
 * všetko ostatné pod tri obrazovky posúvania. Zvyšok je za odkazom.
 */
export const LIMIT = 5

export default function NevybaveneZiadosti({
  overview,
  language,
}: {
  overview: PendingOverview
  language: UiLanguage
}) {
  const t = dictionary(language).pending
  const { items, total, blockedCount } = overview
  const shown = items.slice(0, LIMIT)

  return (
    <section className="karta widget-ziadosti" aria-labelledby="ziadosti-nadpis">
      <div className="widget-ziadosti-hlavicka">
        <h2 id="ziadosti-nadpis" style={{ fontSize: 17, margin: 0 }}>
          {t.heading}
        </h2>
        {total > 0 && <span className="stitok">{t.count(total)}</span>}
      </div>

      {total === 0 ? (
        <p className="tichy" style={{ margin: "10px 0 0", fontSize: 14.5 }}>
          {t.empty}
        </p>
      ) : (
        <ul className="ziadosti-zoznam">
          {shown.map(item => (
            <li key={`${item.source}:${item.id}`} className="ziadost">
              <div style={{ minWidth: 0 }}>
                {/* `min-width: 0` je tu nutné: bez neho flexbox nedovolí
                    dlhému názvu bez medzier zalomiť sa a riadok pretečie. */}
                <Link href={item.href} className="ziadost-nazov">
                  {item.title}
                </Link>
                {item.detail && (
                  <p className="tichy ziadost-detail">{item.detail}</p>
                )}
              </div>
              <Link
                href={item.href}
                className="tlacidlo tlacidlo--tiche ziadost-akcia"
              >
                {t.open}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(total > LIMIT || blockedCount > 0) && (
        <p className="widget-ziadosti-pata">
          {total > LIMIT && (
            <Link href="/dokumenty" className="ziadost-nazov">
              {t.showAll(total)}
            </Link>
          )}
          {/* Zablokované sa medzi úlohy nedávajú — úloha, s ktorou človek
              nemôže pohnúť, nie je úloha a v zozname by len visela. Zamlčať
              ich ale nemožno: na `/dokumenty` ich uvidí aj s dôvodom. */}
          {blockedCount > 0 && (
            <span className="tichy" style={{ fontSize: 13.5 }}>
              {t.blockedNote(blockedCount)}
            </span>
          )}
        </p>
      )}
    </section>
  )
}
