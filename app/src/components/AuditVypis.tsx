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
import type { AuditZaznam } from "@/lib/audit"
import type { UiLanguage } from "@/lib/i18n"

const PREDMETY: Record<string, string> = {
  osoba: "osoba",
  utvar: "oddelenie",
  dokument: "dokument",
  priecinok: "priečinok",
  pridelenie: "pridelenie",
  organizacia: "organizácia",
  domena: "doména",
  "prihlasenie-nastavenie": "prihlasovanie",
  tenant: "tenant",
}

const AKCIE: Record<string, string> = {
  zalozene: "založené",
  zmenene: "zmenené",
  vyradene: "vyradené",
  vratene: "vrátené",
  premenovane: "premenované",
  presunute: "presunuté",
  zrusene: "zrušené",
  pridelene: "pridelené",
  odvolane: "odvolané",
  oznamene: "oznámené",
  poziadane: "požiadané",
  overene: "overené",
  publikovane: "publikované",
  "nahrate-nove-znenie": "nahraté nové znenie",
}

/** Ľudské názvy polí. Neznáme pole sa ukáže tak, ako sa volá — radšej
 *  technický názov než zamlčaná zmena. */
const POLIA: Record<string, string> = {
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

function hodnotaText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—"
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export default function AuditVypis({
  zaznamy,
  jazyk = "sk",
}: {
  zaznamy: AuditZaznam[]
  jazyk?: UiLanguage
}) {
  if (zaznamy.length === 0) {
    return (
      <p className="karta" style={{ padding: 18, fontSize: 15 }}>
        Zatiaľ tu nie je nič. Záznamy pribúdajú pri každej správcovskej zmene —
        pri role, prístupe, oddelení, pridelení aj nastavení organizácie.
      </p>
    )
  }

  return (
    <ul className="audit">
      {zaznamy.map(z => (
        <li key={String(z._id)} className="karta audit-zaznam">
          <div className="audit-hlavicka">
            <span className="stitok">{PREDMETY[z.predmet] ?? z.predmet}</span>
            <strong>{AKCIE[z.akcia] ?? z.akcia}</strong>
            {z.cielPopis && <span className="audit-ciel">{z.cielPopis}</span>}
          </div>

          <div className="tichy audit-kto">
            {z.aktor} · {formatDate(z.kedy, jazyk)}
          </div>

          {z.zmeny && Object.keys(z.zmeny).length > 0 && (
            <ul className="audit-zmeny">
              {Object.entries(z.zmeny).map(([pole, v]) => (
                <li key={pole}>
                  <span className="audit-pole">{POLIA[pole] ?? pole}</span>
                  {"z" in v ? (
                    <>
                      <span className="audit-stara">{hodnotaText(v.z)}</span>
                      <span aria-hidden="true"> → </span>
                      <span className="audit-nova">{hodnotaText(v.na)}</span>
                    </>
                  ) : (
                    <span className="audit-nova">{hodnotaText(v.na)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {z.poznamka && <div className="tichy audit-poznamka">{z.poznamka}</div>}
        </li>
      ))}
    </ul>
  )
}
