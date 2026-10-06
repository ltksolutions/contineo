/**
 * ResponsiblePicker — výber zodpovednej osoby za znenie (D91).
 *
 * Prepínače v posuvnom rámiku, rovnako ako výber schvaľovateľov
 * (`ApprovalPanel`): na telefóne sa ovládajú lepšie než rozbaľovací zoznam
 * a fungujú bez JavaScriptu. **Nič nie je predvolené** — ani doterajšia
 * osoba: pri novom znení ju musí niekto vedome zvoliť. Výnimka je `initial`:
 * osoba, ktorú v **tejto** príprave už niekto vedome zvolil (ADR-014).
 *
 * Od 8 osôb nad zoznamom pribudne hľadanie (`PeopleSearch`,
 * KOMPONENT-hladanie-osob) — zoznam prepínačov pod ním ostáva, len filter.
 */

import { dictionary, type UiLanguage } from "@/lib/i18n"
import PeopleSearch, { type PersonChoice } from "./PeopleSearch"

export type ResponsibleChoice = PersonChoice

export default function ResponsiblePicker({
  people,
  language,
  exclude,
  initial,
  required = true,
  note,
  multiple = false,
  initialMany,
  legend,
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
  /**
   * Viac osôb (1..n) — zaškrtávacie políčka namiesto prepínačov. Test môže
   * mať viac zodpovedných osôb za rôzne oblasti (ADR-018, D121). Nič nie je
   * predvolené; povinnosť aspoň jednej stráži server.
   */
  multiple?: boolean
  initialMany?: string[]
  /** Vlastný nadpis skupiny. */
  legend?: string
}) {
  const t = dictionary(language).responsibility
  const choices = exclude ? people.filter(p => p.id !== exclude) : people
  return (
    <fieldset className="form-group">
      <legend className="form-group-head">{legend ?? t.responsiblePerson}</legend>
      <div className="card form-group-body form-group-body--rows">
      <PeopleSearch
        people={choices}
        name="responsiblePersonId"
        language={language}
        multiple={multiple}
        defaultSelected={multiple ? initialMany : initial ? [initial] : []}
        required={!multiple && required}
        listLabel={legend ?? t.responsiblePerson}
        missing="responsible"
      />
      </div>
      <p className="form-group-foot quiet">{note ?? t.responsibleNote}</p>
    </fieldset>
  )
}
