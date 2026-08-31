/**
 * AuditVypis — záznamy auditu na obrazovke (D51).
 *
 * Serverový komponent bez klientskeho stavu, zámerne: audit sa číta, nie
 * ovláda, a filter je v adrese, takže sa dá poslať odkazom a vrátiť sa naň
 * z histórie.
 *
 * Používajú ho **dve obrazovky** — nastavenie organizácie a detail tenanta
 * v `/admin`. Keby si každá vykresľovala vlastný výpis, jedna z nich by
 * o pol roka ukazovala iné údaje než druhá a nikto by nevedel, ktorá klame.
 */

import { formatDate, dictionary } from "@/lib/i18n"
import type { AuditRecord } from "@/lib/audit"
import type { UiLanguage } from "@/lib/i18n"

/**
 * Zmena v jednom poli. Staršie záznamy majú kľúče `z`/`na` — audit sa
 * neupravuje (D24), takže sa musia čítať obidve podoby.
 */
function change(v: unknown): { from?: unknown; to?: unknown; hasFrom: boolean } {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    from: "from" in o ? o.from : o.z,
    to: "to" in o ? o.to : o.na,
    hasFrom: "from" in o || "z" in o,
  }
}

function valueText(v: unknown, none: string): string {
  if (v === null || v === undefined || v === "") return none
  if (Array.isArray(v)) return v.length ? v.join(", ") : none
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export default function AuditList({
  records: records,
  language: language = "sk",
}: {
  records: AuditRecord[]
  language?: UiLanguage
}) {
  const t = dictionary(language).audit

  if (records.length === 0) {
    return <p className="karta" style={{ padding: 18, fontSize: 15 }}>{t.empty}</p>
  }

  return (
    <ul className="audit">
      {records.map(z => (
        <li key={String(z._id)} className="karta audit-zaznam">
          <div className="audit-hlavicka">
            <span className="stitok">{t.subjects[z.subject] ?? z.subject}</span>
            <strong>{t.actions[z.action] ?? z.action}</strong>
            {z.targetLabel && <span className="audit-ciel">{z.targetLabel}</span>}
          </div>

          <div className="tichy audit-kto">
            {z.actor} · {formatDate(z.at, language)}
          </div>

          {z.changes && Object.keys(z.changes).length > 0 && (
            <ul className="audit-zmeny">
              {Object.entries(z.changes).map(([field, v]) => {
                const c = change(v)
                return (
                  <li key={field}>
                    <span className="audit-pole">{t.fields[field] ?? field}</span>
                    {c.hasFrom ? (
                      <>
                        <span className="audit-stara">{valueText(c.from, t.none)}</span>
                        <span aria-hidden="true"> → </span>
                        <span className="audit-nova">{valueText(c.to, t.none)}</span>
                      </>
                    ) : (
                      <span className="audit-nova">{valueText(c.to, t.none)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {z.note && <div className="tichy audit-poznamka">{z.note}</div>}
        </li>
      ))}
    </ul>
  )
}
