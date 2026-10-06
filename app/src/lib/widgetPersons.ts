/**
 * widgetPersons.ts — osoba z tokenu cudzieho systému (ADR-028, D166).
 *
 * Človek, ktorý sa pýta cez ISSF, je pre Contineo osoba: potrebuje
 * identitu pre výkaz spotreby, históriu otázok, strop požiadaviek a ticket.
 * Hľadá sa v tomto poradí:
 *
 *   1. podľa `externalRef.widget.<kanál>` = `sub` z tokenu — už tu bol;
 *   2. podľa e-mailu — zamestnanec, ktorý sa pýta aj cez ISSF; spáruje sa,
 *      intranet mu ostáva;
 *   3. inak sa založí s druhom `external` — do intranetu nepatrí
 *      (`personMaySignIn()`, D168), bez rolí.
 *
 * Meno a e-mail sú **kópia z tokenu** v čase otázky; u osoby z widgetu sa
 * pri zmene prepíšu, u zamestnanca nie — jeho údaje spravuje organizácia.
 */

import { randomUUID } from "node:crypto"
import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, normalizeEmail, type Person } from "./persons"
import { composeFullName } from "./personFields"
import { requireCompanyCode } from "./tenantScope"
import type { WidgetIdentity } from "./widgetToken"

export async function ensureWidgetPerson(companyCode: string, channelKey: string, id: WidgetIdentity, fallbackLanguage: Person["language"]): Promise<Person> {
  const code = requireCompanyCode(companyCode, "ensureWidgetPerson")
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const refPath = `externalRef.widget.${channelKey}`
  const now = new Date()
  const email = normalizeEmail(id.email)
  const language = id.language ?? fallbackLanguage

  const byRef = await col.findOne({ companyCode: code, [refPath]: id.externalId } as never)
  if (byRef) {
    if (byRef.personType === "external" && (byRef.email !== email || (id.name && byRef.fullName !== id.name))) {
      const names = id.givenName || id.familyName ? { givenName: id.givenName, surname: id.familyName } : {}
      await col.updateOne({ _id: byRef._id }, { $set: { email, ...(id.name ? { fullName: id.name, ...names } : {}), lastLoginAt: now } })
      return { ...byRef, email, fullName: id.name || byRef.fullName }
    }
    await col.updateOne({ _id: byRef._id }, { $set: { lastLoginAt: now } })
    return byRef
  }

  const byEmail = await col.findOne({ companyCode: code, email })
  if (byEmail) {
    await col.updateOne({ _id: byEmail._id }, { $set: { [refPath]: id.externalId, lastLoginAt: now } } as never)
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
    externalRef: { sportnetId: null, entraObjectId: null, googleSub: null, widget: { [channelKey]: id.externalId } },
    firstLoginAt: now, lastLoginAt: now,
    createdBy: `widget:${channelKey}`,
    createdAt: now,
  } as Person
  await col.insertOne(person)
  return person
}
