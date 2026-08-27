/**
 * osoby.test.ts — kolekcia `persons` (Fáza 8, D26).
 *
 * Testuje sa to, čo sa dá pomýliť a čo nepotrebuje databázu: normalizácia
 * adresy a pravidlá pre jeden riadok importu. Zápis samotný je už len
 * `updateOne` a testovať ho bez clustera by znamenalo testovať mongodb driver.
 *
 * Adresa je tu tá istá vec ako v `auth.test.ts`: rozhoduje o tom, kto sa
 * dostane k interným smerniciam. Preto sa overuje aj to, čo vyzerá triviálne.
 */
import { normalizeEmail, validateRow } from "../src/lib/persons"
import type { NewPerson } from "../src/lib/persons"

import { t } from "./helper"

// ── normalizácia adresy ──────────────────────────────────────────────────────

t("veľké písmená sa zjednotia",
  normalizeEmail("Jan.Letko@FutbalSFZ.sk") === "jan.letko@futbalsfz.sk")
t("medzery sa orežú",
  normalizeEmail("  a@sfz.sk  ") === "a@sfz.sk")
t("prázdny vstup nespadne", normalizeEmail("") === "")

// ── riadok importu: čo prejde ────────────────────────────────────────────────

const valid: NewPerson = { email: "Novak@futbalsfz.sk", fullName: "Ján Novák", companyCode: "SFZ" }
const o = validateRow(valid)

t("platný riadok prejde", o.ok)
t("adresa sa uloží normalizovaná", o.ok && o.email === "novak@futbalsfz.sk", JSON.stringify(o))
t("companyCode sa oreže", (() => {
  const r = validateRow({ ...valid, companyCode: "  SFZ  " })
  return r.ok && r.companyCode === "SFZ"
})())

// ── riadok importu: čo neprejde ──────────────────────────────────────────────

const reasonFor = (r: NewPerson): string => {
  const v = validateRow(r)
  return v.ok ? "(prešlo)" : v.reason
}

t("bez zavináča neprejde", reasonFor({ ...valid, email: "novak" }) === "invalid-email",
  reasonFor({ ...valid, email: "novak" }))
t("prázdna adresa neprejde", reasonFor({ ...valid, email: "" }) === "invalid-email")
t("chýbajúci companyCode neprejde", reasonFor({ ...valid, companyCode: "" }) === "missing-companyCode")
t("companyCode zo samých medzier neprejde",
  reasonFor({ ...valid, companyCode: "   " }) === "missing-companyCode")
t("chýbajúce meno neprejde", reasonFor({ ...valid, fullName: "" }) === "missing-name")
t("meno zo samých medzier neprejde", reasonFor({ ...valid, fullName: "  " }) === "missing-name")

// Import stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť
// späť. Preto musí zlyhať nahlas na každom pochybnom riadku, nie ho preskočiť.
t("chybný riadok nesie dôvod, nielen príznak", (() => {
  const v = validateRow({ ...valid, email: "x" })
  return !v.ok && v.reason.length > 0
})())
t("chybný riadok nesie pôvodnú adresu na dohľadanie", (() => {
  const v = validateRow({ email: "nezmysel", fullName: "A", companyCode: "SFZ" })
  return !v.ok && v.email === "nezmysel"
})())

// Vstup z CSV je cudzí — nesmie zhodiť import tým, že chýba pole.
t("chýbajúce polia nespadnú na výnimke", (() => {
  const v = validateRow({} as NewPerson)
  return !v.ok
})())

