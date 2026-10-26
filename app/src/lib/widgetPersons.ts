/**
 * widgetPersons.ts — osoba z tokenu cudzieho systému (ADR-028, D166; ADR-042, D280).
 *
 * Človek, ktorý sa pýta cez ISSF, je pre Contineo osoba: potrebuje
 * identitu pre výkaz spotreby, históriu otázok, strop požiadaviek a ticket.
 *
 * **Osoba je e-mailový kontakt, účet v cudzom systéme je údaj** (D280).
 * Jeden e-mail v ISSF zdieľa viac účtov — rodič za deti, klubový manažér za
 * hráčov. Do 27. 10. 2026 sa osoba hľadala najprv podľa účtu (`sub`) a pri
 * striedaní účtov z jednej adresy sa jej identifikátor a meno prepisovali.
 * Teraz:
 *
 *   1. podľa e-mailu — kontakt, ktorý tu už bol (aj zamestnanec, ktorý sa
 *      pýta cez ISSF; intranet mu ostáva); účet sa **pridá** do zoznamu
 *      `externalRef.widget.<kanál>`, nič sa neprepíše;
 *   2. inak sa založí s druhom `external` — do intranetu nepatrí
 *      (`personMaySignIn()`, D168), bez rolí, so zoznamom s jedným účtom.
 *
 * Meno osoby je meno **z prvého tokenu** a ďalej sa nemení — držiteľ účtu
 * (hráč) nie je nutne ten, kto píše. Meno, roly, klub a účet v čase správy
 * nesie ticket (`asker`, kópia z tokenu, D24).
 */

import { randomUUID } from "node:crypto"
import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, normalizeEmail, type Person } from "./persons"
import { composeFullName } from "./personFields"
import { requireCompanyCode } from "./tenantScope"
import type { WidgetIdentity } from "./widgetToken"

/** Účty pri osobe pre kanál — zoznam; reťazec spred migrácie ako zoznam s jedným prvkom. */
export function widgetRefs(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

export async function ensureWidgetPerson(companyCode: string, channelKey: string, id: WidgetIdentity, fallbackLanguage: Person["language"]): Promise<Person> {
  const code = requireCompanyCode(companyCode, "ensureWidgetPerson")
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const now = new Date()
  const email = normalizeEmail(id.email)
  const language = id.language ?? fallbackLanguage

  const byEmail = await col.findOne({ companyCode: code, email })
  if (byEmail) {
    const current = byEmail.externalRef?.widget?.[channelKey]
    const refs = widgetRefs(current)
    const next = refs.includes(id.externalId) ? refs : [...refs, id.externalId]
    // Celý zoznam sa zapíše ako hodnota — `$addToSet` by na reťazci spred
    // migrácie zlyhal. Zapisuje sa len pri novom účte alebo starom tvare.
    // Súbežné otázky z dvoch nových účtov naraz sú zriedkavé; stratený účet
    // sa doplní pri ďalšej otázke.
    const write = next !== refs || !Array.isArray(current)
    await col.updateOne({ _id: byEmail._id }, {
      $set: { lastLoginAt: now, ...(write ? { [`externalRef.widget.${channelKey}`]: next } : {}) },
    } as never)
    return byEmail
  }

  const person: Person = {
    id: randomUUID(),
    companyCode: code,
    email,
    fullName: composeFullName(id.givenName, id.familyName) || id.name || email,
    ...(id.givenName ? { givenName: id.givenName } : {}),
    ...(id.familyName ? { surname: id.familyName } : {}),
    personType: "external",
    status: "active",
    language,
    tracks: [], groups: [], roles: [],
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null, widget: { [channelKey]: [id.externalId] } },
    firstLoginAt: now, lastLoginAt: now,
    createdBy: `widget:${channelKey}`,
    createdAt: now,
  } as Person
  await col.insertOne(person)
  return person
}
