/**
 * assignOrder.ts — poradie zoznamov na `/hr/assign`
 * (HR-pridelit-normy-hladanie, bod 5).
 *
 * Čisté funkcie, aby sa poradie dalo otestovať bez databázy. Filter ani
 * výber poradie nemenia — radí sa raz, na serveri.
 */

import { splitFullName } from "./personFields"

/**
 * Normy podľa platnosti — najnovšie účinné znenie hore. Kto prideľuje, takmer
 * vždy prideľuje práve zverejnenú novelu; abecedne by bola kdekoľvek. Pri
 * rovnakom dátume abecedne, aby poradie nebolo náhodné.
 */
export function sortDocumentsByEffective<T extends { title: string; effectiveFrom: Date | string }>(docs: T[]): T[] {
  const time = (d: T) => new Date(d.effectiveFrom).getTime()
  return [...docs].sort((a, b) => time(b) - time(a) || a.title.localeCompare(b.title, "sk"))
}

/**
 * Osoby podľa priezviska, pri zhode podľa celého mena — rovnako ako adresár
 * (`directory.ts`, `surname, fullName`). Slovenské radenie: č/š/ž po c/s/z.
 * Osoba bez vyplneného priezviska sa radí podľa `splitFullName()`; keď sa ani
 * to nedá (jedno slovo), podľa celého mena.
 */
export function sortPeopleBySurname<T extends { fullName: string; surname?: string | null }>(people: T[]): T[] {
  const key = (p: T) => (p.surname?.trim() || splitFullName(p.fullName)?.surname || p.fullName)
  return [...people].sort((a, b) =>
    key(a).localeCompare(key(b), "sk") || a.fullName.localeCompare(b.fullName, "sk"))
}
