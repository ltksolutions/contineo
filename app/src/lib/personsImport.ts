/**
 * personsImport.ts — z CSV riadka na osobu.
 *
 * Mapovanie hlavičiek **je pravidlo**, nie pomôcka skriptu: rozhoduje o tom,
 * či sa stĺpec „Oddelenie" naozaj zapíše ako oddelenie, alebo sa ticho stratí. Preto
 * je v knižnici a volá ho aj skript, aj obrazovka — dva importéry toho istého
 * súboru sú spoľahlivý spôsob, ako jedného dňa naimportovať dva rôzne
 * výsledky.
 */

import { parseCsv } from "./csv"
import type { NewPerson, PersonType } from "./persons"

/** Hlavičky sa normalizujú (malé písmená, bez diakritiky), takže stačí tvar. */
export const ALIASES: Record<string, string[]> = {
  email: ["email", "mail", "emailovaadresa", "adresa"],
  fullName: ["meno", "menoapriezvisko", "celemeno", "fullname", "name", "priezviskoameno"],
  companyCode: ["organizacia", "zvaz", "companycode", "firma", "jednotka", "kodorganizacie"],
  department: ["utvar", "oddelenie", "department", "usek"],
  personType: ["typ", "typosoby", "persontype"],
  startDate: ["nastup", "datumnastupu", "startdate"],
  tracks: ["trasa", "trasy", "tracks"],
  groups: ["skupina", "skupiny", "groups"],
  language: ["jazyk", "language", "lang"],
}

/** Strojové kľúče z `validateRow()` → veta pre človeka. */
export const REASONS: Record<string, string> = {
  "invalid-email": "neplatná e-mailová adresa",
  "missing-companyCode": "chýba organizácia (companyCode)",
  "missing-name": "chýba meno",
  "duplicate-in-file": "duplicita priamo v súbore",
}

export function fieldValue(row: Record<string, string>, field: string): string {
  for (const key of ALIASES[field] ?? []) if (row[key]) return row[key]
  return ""
}

const list = (s: string) => s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)

export function rowToPerson(row: Record<string, string>): NewPerson {
  const date = fieldValue(row, "startDate")
  const tracks = fieldValue(row, "tracks")
  const groups = fieldValue(row, "groups")
  const type = fieldValue(row, "personType")
  return {
    email: fieldValue(row, "email"),
    fullName: fieldValue(row, "fullName"),
    companyCode: fieldValue(row, "companyCode"),
    department: fieldValue(row, "department") || undefined,
    personType: (type || undefined) as PersonType | undefined,
    startDate: date ? new Date(date) : undefined,
    tracks: tracks ? list(tracks) : undefined,
    groups: groups ? list(groups) : undefined,
    // Nevyplnený jazyk necháme `undefined` — `upsertPersons()` ho potom
    // existujúcej osobe neprepíše (inak by opakovaný import prepol každého
    // späť na slovenčinu).
    language: fieldValue(row, "language") || undefined,
  }
}

/**
 * Celý súbor na osoby.
 *
 * `predvolenaOrganizacia` sa doplní tam, kde stĺpec chýba. Na obrazovke to je
 * organizácia toho, kto import robí — **nie voľba**: personalista zväzu
 * nesmie importom založiť človeka do cudzej organizácie (D32).
 */
export function csvToPersons(text: string, defaultOrganisation?: string): NewPerson[] {
  return parseCsv(text).rows.map(r => {
    const o = rowToPerson(r)
    return defaultOrganisation ? { ...o, companyCode: defaultOrganisation } : o
  })
}
