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

import { formatDate } from "@/lib/i18n"
import type { AuditRecord } from "@/lib/audit"
import type { UiLanguage } from "@/lib/i18n"

const SUBJECTS: Record<string, string> = {
  person: "osoba",
  department: "oddelenie",
  document: "dokument",
  folder: "priečinok",
  assignment: "pridelenie",
  organisation: "organizácia",
  domain: "doména",
  "signin-settings": "prihlasovanie",
  tenant: "tenant",
}

const ACTIONS: Record<string, string> = {
  created: "založené",
  changed: "zmenené",
  excluded: "vyradené",
  restored: "vrátené",
  renamed: "premenované",
  moved: "presunuté",
  deleted: "zrušené",
  assigned: "pridelené",
  revoked: "odvolané",
  notified: "oznámené",
  requested: "požiadané",
  verified: "overené",
  published: "publikované",
  reindexed: "preindexované",
  reordered: "preusporiadané",
  "model-draft": "návrh modelu",
  "version-fix": "oprava znenia",
  "new-version": "nahraté nové znenie",
}

/** Ľudské názvy polí. Neznáme pole sa ukáže tak, ako sa volá — radšej
 *  technický názov než zamlčaná zmena. */
const FIELDS: Record<string, string> = {
  email: "adresa",
  fullName: "meno",
  department: "oddelenie (text)",
  departmentId: "oddelenie",
  personType: "typ osoby",
  status: "stav",
  language: "jazyk",
  tracks: "trasy",
  groups: "skupiny",
  roles: "role",
  nazov: "názov",
  parentId: "nadriadené oddelenie",
  clientId: "clientId",
  clientSecret: "tajomstvo",
  hostnames: "domény",
  autoProvisionDomains: "domény pre automatické zakladanie",
  "branding.displayName": "názov",
  "branding.shortName": "skratka",
  "branding.accentColor": "farba",
  "branding.logoUrl": "logo",
  "branding.supportEmail": "kontakt",
}

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—"
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
  if (records.length === 0) {
    return (
      <p className="karta" style={{ padding: 18, fontSize: 15 }}>
        Zatiaľ tu nie je nič. Záznamy pribúdajú pri každej správcovskej zmene —
        pri role, prístupe, oddelení, pridelení aj nastavení organizácie.
      </p>
    )
  }

  return (
    <ul className="audit">
      {records.map(z => (
        <li key={String(z._id)} className="karta audit-zaznam">
          <div className="audit-hlavicka">
            <span className="stitok">{SUBJECTS[z.subject] ?? z.subject}</span>
            <strong>{ACTIONS[z.action] ?? z.action}</strong>
            {z.targetLabel && <span className="audit-ciel">{z.targetLabel}</span>}
          </div>

          <div className="tichy audit-kto">
            {z.actor} · {formatDate(z.at, language)}
          </div>

          {z.changes && Object.keys(z.changes).length > 0 && (
            <ul className="audit-zmeny">
              {Object.entries(z.changes).map(([field, v]) => (
                <li key={field}>
                  <span className="audit-pole">{FIELDS[field] ?? field}</span>
                  {"z" in v ? (
                    <>
                      <span className="audit-stara">{valueText(v.from)}</span>
                      <span aria-hidden="true"> → </span>
                      <span className="audit-nova">{valueText(v.to)}</span>
                    </>
                  ) : (
                    <span className="audit-nova">{valueText(v.to)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {z.note && <div className="tichy audit-poznamka">{z.note}</div>}
        </li>
      ))}
    </ul>
  )
}
