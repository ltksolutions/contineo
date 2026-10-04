/**
 * PhoneField — telefón ako krajina + číslo (D86, rozhodnutie Jána 4. 10. 2026).
 *
 * Vľavo zoznam krajín s predvoľbou, vpravo číslo v domácom tvare. Server ich
 * spojí do E.164 (`normalizeCountryPhone()`); krajina sa neukladá zvlášť,
 * pri úprave ju z uloženého čísla odvodí `splitPhone()`.
 */

import Select from "./Select"
import { phoneCountries, splitPhone, countryForPrefix } from "@/lib/phoneCountries"
import type { UiLanguage } from "@/lib/i18n"

export default function PhoneField({
  label,
  countryLabel,
  hint,
  value,
  country,
  tenantPrefix,
  language,
}: {
  label: string
  countryLabel: string
  hint: string
  /** Uložené číslo (E.164) alebo to, čo človek napísal pred chybou. */
  value?: string
  /** Krajina vrátená z formulára po chybe; inak sa odvodí z čísla. */
  country?: string
  tenantPrefix?: string
  language: UiLanguage
}) {
  const fallback = countryForPrefix(tenantPrefix)
  const split = splitPhone(value, fallback)
  // Po chybe sa vráti presne to, čo človek zadal — vrátane krajiny.
  const initialCountry = country || split.country
  const initialNumber = country ? (value ?? "") : split.national
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="phone-row">
        <Select language={language}
          name="mobilePhoneCountry"
          fieldLabel={countryLabel}
          initial={initialCountry}
          options={phoneCountries(language, fallback).map(c => ({ value: c.code, label: c.label }))}
        />
        <input
          className="field-input"
          name="mobilePhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={label}
          defaultValue={initialNumber}
        />
      </div>
      <span className="quiet field-hint">{hint}</span>
    </div>
  )
}
