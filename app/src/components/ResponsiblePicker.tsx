/**
 * ResponsiblePicker — výber zodpovednej osoby za znenie (D91).
 *
 * Prepínače v posuvnom rámiku, rovnako ako výber schvaľovateľov
 * (`ApprovalPanel`): na telefóne sa ovládajú lepšie než rozbaľovací zoznam
 * a fungujú bez JavaScriptu. **Nič nie je predvolené** — ani doterajšia
 * osoba: pri novom znení ju musí niekto vedome zvoliť. Výnimka je `initial`:
 * osoba, ktorú v **tejto** príprave už niekto vedome zvolil (ADR-014).
 */

import { dictionary, type UiLanguage } from "@/lib/i18n"

export interface ResponsibleChoice {
  id: string
  fullName: string
  email: string
  department?: string
}

export default function ResponsiblePicker({
  people,
  language,
  exclude,
  initial,
  required = true,
  note,
}: {
  people: ResponsibleChoice[]
  language: UiLanguage
  /** Osoba, ktorá sa neponúka — pri zmene tá súčasná. */
  exclude?: string
  /** Osoba určená v príprave (ADR-014, D109). */
  initial?: string
  /** V príprave je voľba nepovinná — povinná je až pri zverejnení. */
  required?: boolean
  /** Vlastná nápoveda namiesto všeobecnej. */
  note?: string
}) {
  const t = dictionary(language).responsibility
  const choices = exclude ? people.filter(p => p.id !== exclude) : people
  return (
    <fieldset className="hr-group">
      <legend className="field-label">{t.responsiblePerson}</legend>
      <span className="quiet field-hint">{note ?? t.responsibleNote}</span>
      <div className="approval-people">
        {choices.map(p => (
          <label key={p.id} className="approval-person">
            <input type="radio" name="responsiblePersonId" value={p.id} required={required}
                   defaultChecked={p.id === initial} />
            <span>
              <span className="approval-person-name">{p.fullName}</span>
              <span className="quiet approval-person-meta">
                {p.department ? `${p.department} · ` : ""}{p.email}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
