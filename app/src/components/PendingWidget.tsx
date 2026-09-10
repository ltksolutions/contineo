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
import { dictionary, formatDate } from "@/lib/i18n"
import { dueState, daysLeft } from "@/lib/due"
import type { UiLanguage } from "@/lib/i18n"

/**
 * Koľko položiek sa vypíše.
 *
 * Nie je to estetika, je to mobile first: na displeji širokom 360 px zaberie
 * jedna položka vyše 70 px, takže pätnásť nepotvrdených noriem by odtlačilo
 * všetko ostatné pod tri obrazovky posúvania. Zvyšok je za odkazom.
 */
export const LIMIT = 5

export default function PendingWidget({
  overview,
  language,
}: {
  overview: PendingOverview
  language: UiLanguage
}) {
  const t = dictionary(language).pending
  /* Jeden okamih pre celý zoznam. Keby si ho každý riadok bral sám,
     dva riadky vykreslené o polnoci by mohli byť v inom stave. */
  const now = new Date()
  const { items, total, blockedCount } = overview
  const shown = items.slice(0, LIMIT)

  return (
    <section className="card requests-widget" aria-labelledby="requests-heading">
      <div className="requests-widget-head">
        <h2 id="requests-heading" style={{ fontSize: 17, margin: 0 }}>
          {t.heading}
        </h2>
        {total > 0 && <span className="tag">{t.count(total)}</span>}
      </div>

      {total === 0 ? (
        <p className="quiet" style={{ margin: "10px 0 0", fontSize: 14.5 }}>
          {t.empty}
        </p>
      ) : (
        <ul className="requests-list">
          {shown.map(item => (
            <li key={`${item.source}:${item.id}`} className="request">
              <div style={{ minWidth: 0 }}>
                {/* `min-width: 0` je tu nutné: bez neho flexbox nedovolí
                    dlhému názvu bez medzier zalomiť sa a riadok pretečie. */}
                <Link href={item.href} className="request-title">
                  {item.title}
                </Link>
                {/* Príznak zmizne pri ďalšom prihlásení, nie kliknutím (D39).
                    Je to cena za to, že sa nezakladá kolekcia so záznamami
                    o tom, čo si kto kedy prečítal. */}
                {item.isNew && <span className="tag tag--new">{t.isNew}</span>}
                {/*
                  Termínový chip (D63). Je pri názve, nie v druhom riadku:
                  je to jediný údaj v riadku, ktorý hovorí, čo sa stane, keď
                  človek nič neurobí — a ten sa neschováva medzi metadáta.

                  Farba nesie stav, ale **nie je jediným nositeľom**: text
                  hovorí to isté slovami, takže to funguje aj pri farbosleposti
                  a v čiernobielej tlači.
                */}
                {(() => {
                  const state = dueState(item.due, now)
                  if (state === "none") return null
                  const left = daysLeft(item.due!, now)
                  return (
                    <span className={`due-chip due-chip--${state}`}>
                      {left === 0
                        ? t.dueToday
                        : left < 0
                          ? t.dueOver(-left)
                          : t.dueBy(formatDate(item.due!, language))}
                    </span>
                  )
                })()}
                {/* Dva údaje, jeden riadok. „Čaká od" sa ukáže len tam, kde
                    pridelenie naozaj existuje (D37) — inak by to bol dátum
                    o niečom inom, než čo je pri ňom napísané. */}
                {(item.detail || item.assignedAt) && (
                  <p className="quiet request-detail">
                    {[
                      item.detail,
                      item.assignedAt ? t.waitingSince(formatDate(item.assignedAt, language)) : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Link
                href={item.href}
                className="button button--quiet request-action"
              >
                {t.open}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(total > LIMIT || blockedCount > 0) && (
        <p className="requests-widget-foot">
          {total > LIMIT && (
            <Link href="/documents" className="request-title">
              {t.showAll(total)}
            </Link>
          )}
          {/* Zablokované sa medzi úlohy nedávajú — úloha, s ktorou človek
              nemôže pohnúť, nie je úloha a v zozname by len visela. Zamlčať
              ich ale nemožno: na `/documents` ich uvidí aj s dôvodom. */}
          {blockedCount > 0 && (
            <span className="quiet" style={{ fontSize: 13.5 }}>
              {t.blockedNote(blockedCount)}
            </span>
          )}
        </p>
      )}
    </section>
  )
}
