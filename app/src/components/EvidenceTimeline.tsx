/**
 * EvidenceTimeline.tsx — časová os jednej povinnosti (ADR-005, krok 3).
 *
 * **Jeden komponent pre obe miesta** — kartu osoby aj obrazovku `/hr/evidence`.
 * Dva pohľady na to isté, ktoré si každý počíta po svojom, sú dva pohľady,
 * ktoré si raz budú odporovať; pri dôkaze je to horšie než nemať druhý.
 *
 * Serverový komponent bez stavu: os sa nikde neukladá, skladá sa pri každom
 * zobrazení z toho, čo už niekde je (D65).
 */

import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import type { EvidenceEvent } from "@/lib/evidence"

export default function EvidenceTimeline({
  timeline,
  language,
}: {
  timeline: EvidenceEvent[]
  language: UiLanguage
}) {
  const t = dictionary(language).evidence

  return (
    <ol className="evidence">
      {timeline.map((e, i) => {
        const when = e.at ? formatDate(e.at, language) : null
        return (
          <li key={`${e.kind}-${i}`} className={`evidence-step evidence-step--${e.weight}`}>
            <span className="evidence-dot" aria-hidden="true" />
            <span className="evidence-body">
              <span className="evidence-what">
                {t.kind[e.kind]}
                {/*
                  Váha je pri riadku, nie v legende pod osou. Kto číta jeden
                  riadok, musí z neho vedieť, čo unesie — legenda o dva
                  odseky nižšie sa pri citovaní stratí.
                */}
                {e.weight === "informative" && (
                  <span className="tag evidence-weight">{t.informative}</span>
                )}
              </span>

              <span className="quiet evidence-when">
                {when ?? t.gap[e.gap ?? "not-yet"]}
                {e.detail?.seconds !== undefined && ` · ${t.seconds(e.detail.seconds)}`}
                {e.detail?.count !== undefined && ` · ${t.times(e.detail.count)}`}
                {e.detail?.by && ` · ${e.detail.by}`}
              </span>

              {e.detail?.reason && (
                <span className="quiet evidence-reason">{e.detail.reason}</span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
