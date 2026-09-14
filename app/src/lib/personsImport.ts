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
import type { CodelistItem } from "./codelists"
import { normalizePhone, matchWorkplace, composeFullName } from "./personFields"

/** Hlavičky sa normalizujú (malé písmená, bez diakritiky), takže stačí tvar. */
export const ALIASES: Record<string, string[]> = {
  email: ["email", "mail", "emailovaadresa", "adresa"],
  // `meno` samo o sebe ostáva celým menom kvôli starým súborom; keď je v súbore
  // aj `priezvisko`, rozhodujú časti (`resolveName`).
  fullName: ["menoapriezvisko", "celemeno", "fullname", "name", "priezviskoameno"],
  givenName: ["meno", "krstnemeno", "givenname", "firstname"],
  surname: ["priezvisko", "surname", "lastname", "familyname"],
  titleBefore: ["titul", "titulpredmenom", "tituly", "titlebefore"],
  titleAfter: ["titulzamenom", "titleafter"],
  jobTitle: ["pozicia", "pracovnapozicia", "funkcia", "jobtitle", "position"],
  mobilePhone: ["mobil", "mobilnytelefon", "telefon", "mobile", "mobilephone", "phone"],
  workplace: ["pracovisko", "miestovykonuprace", "mesto", "obec", "workplace", "officelocation"],
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

/**
 * Nastavenia organizácie, ktoré import potrebuje (D85, D86).
 *
 * Predvoľba telefónu a zoznam pracovísk sú vlastnosťou tenanta. Keď chýbajú,
 * import beží ďalej — len sa tie dve polia nevyplnia.
 */
export interface ImportSettings {
  phonePrefix?: string
  workplaces?: CodelistItem[]
}

/** Čo sa v súbore našlo, ale nedalo sa použiť. Riadok kvôli tomu nepadá. */
export interface RowNotes {
  /** Hodnoty pracoviska, ktoré v číselníku organizácie nie sú. */
  unknownWorkplaces: string[]
  /** Čísla, ktoré sa nedali prečítať ako telefón. */
  badPhones: string[]
}

export function rowToPerson(
  row: Record<string, string>,
  settings: ImportSettings = {},
  notes?: RowNotes,
): NewPerson {
  const date = fieldValue(row, "startDate")
  const tracks = fieldValue(row, "tracks")
  const groups = fieldValue(row, "groups")
  const type = fieldValue(row, "personType")

  // Neuložiteľné číslo a neznáme pracovisko pole **nevyplnia a riadok nezahodia**
  // (D85). Meno, adresa a oddelenie sú platné aj bez nich; zahodiť celého
  // človeka pre jedno evidenčné pole by znamenalo, že personalista rieši
  // preklep v číselníku namiesto toho, aby mal ľudí v systéme.
  const rawPhone = fieldValue(row, "mobilePhone")
  const phone = normalizePhone(rawPhone, settings.phonePrefix)
  if (rawPhone && !phone.ok) notes?.badPhones.push(rawPhone)

  const rawWorkplace = fieldValue(row, "workplace")
  const workplace = matchWorkplace(rawWorkplace, settings.workplaces ?? [])
  if (rawWorkplace && !workplace) notes?.unknownWorkplaces.push(rawWorkplace)

  /*
    O tom, či je „Meno" krstné meno alebo celé meno, rozhoduje **prítomnosť
    stĺpca Priezvisko** — a rozhodnúť sa to dá jedine tu, kde vidno stĺpce.

    Bez toho by starý súbor s jediným stĺpcom „Meno" zapísal „Anna Bieliková"
    ako krstné meno a organizácia by mala priezviská prázdne. Keď priezvisko
    v súbore je, časti rozhodujú; keď nie je, hodnota je celé meno a rozdelí ju
    `resolveName()` pri zápise.
  */
  const rawGiven = fieldValue(row, "givenName")
  const rawSurname = fieldValue(row, "surname")
  const hasParts = Boolean(rawSurname)

  return {
    email: fieldValue(row, "email"),
    fullName: hasParts
      ? composeFullName(rawGiven, rawSurname)
      : (fieldValue(row, "fullName") || rawGiven),
    givenName: hasParts ? (rawGiven || undefined) : undefined,
    surname: hasParts ? rawSurname : undefined,
    titleBefore: fieldValue(row, "titleBefore") || undefined,
    titleAfter: fieldValue(row, "titleAfter") || undefined,
    jobTitle: fieldValue(row, "jobTitle") || undefined,
    mobilePhone: (phone.ok && phone.value) ? phone.value : undefined,
    workplace: workplace ?? undefined,
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
export function csvToPersons(
  text: string,
  defaultOrganisation?: string,
  settings: ImportSettings = {},
  notes?: RowNotes,
): NewPerson[] {
  return parseCsv(text).rows.map(r => {
    const o = rowToPerson(r, settings, notes)
    return defaultOrganisation ? { ...o, companyCode: defaultOrganisation } : o
  })
}

/** Prázdny zápisník pre `csvToPersons()` — aby ho volajúci nemusel skladať. */
export function emptyNotes(): RowNotes {
  return { unknownWorkplaces: [], badPhones: [] }
}
