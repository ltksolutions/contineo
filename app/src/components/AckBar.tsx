/**
 * Potvrdenia ako pásik (KNIZNICA.md úloha 2, HR.md úloha 2).
 *
 * Jedno miesto pre prahy a pre tvar: knižnica aj `/hr` kreslia ten istý
 * pásik, takže „68 %" znamená na oboch obrazovkách to isté a mení sa na
 * jednom mieste. Prahy: ≥ 90 % v poriadku, ≥ 50 % beží, pod tým treba
 * pripomenúť — presne ako pri stĺpci knižnice.
 *
 * Bez menovateľa (nikomu nepridelené) sa kreslí pomlčka, nie prázdny pásik:
 * prázdny pásik hovorí „nikto nepotvrdil", a to je iná správa.
 *
 * `label` je celá veta pre `title` a čítačku („142 z 210 pridelených") —
 * skladá ju obrazovka, lebo ona vie, v akom jazyku a s akým podmetom.
 */

import { percentOf } from "@/lib/libraryProgress"

export default function AckBar({
  acknowledged,
  assigned,
  label,
}: {
  acknowledged: number
  assigned: number
  label: string
}) {
  const percent = percentOf(acknowledged, assigned)
  if (percent === null) return <span className="quiet">—</span>
  const tone = percent >= 90 ? "high" : percent >= 50 ? "mid" : "low"
  return (
    <span className="ack-bar" title={label}>
      <span className="ack-track" aria-hidden="true">
        {/* Šírka výplne je inline: je to dátová hodnota, nie štýl. */}
        <span className={`ack-fill ack-fill--${tone}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="ack-value" aria-hidden="true">{percent} %</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
