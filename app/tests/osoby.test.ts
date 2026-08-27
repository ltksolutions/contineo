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
import { normalizujEmail, overRiadok } from "../src/lib/osoby"
import type { NovaOsoba } from "../src/lib/osoby"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

// ── normalizácia adresy ──────────────────────────────────────────────────────

t("veľké písmená sa zjednotia",
  normalizujEmail("Jan.Letko@FutbalSFZ.sk") === "jan.letko@futbalsfz.sk")
t("medzery sa orežú",
  normalizujEmail("  a@sfz.sk  ") === "a@sfz.sk")
t("prázdny vstup nespadne", normalizujEmail("") === "")

// ── riadok importu: čo prejde ────────────────────────────────────────────────

const dobry: NovaOsoba = { email: "Novak@futbalsfz.sk", fullName: "Ján Novák", companyCode: "SFZ" }
const o = overRiadok(dobry)

t("platný riadok prejde", o.ok)
t("adresa sa uloží normalizovaná", o.ok && o.email === "novak@futbalsfz.sk", JSON.stringify(o))
t("companyCode sa oreže", (() => {
  const r = overRiadok({ ...dobry, companyCode: "  SFZ  " })
  return r.ok && r.companyCode === "SFZ"
})())

// ── riadok importu: čo neprejde ──────────────────────────────────────────────

const zlyDovod = (r: NovaOsoba): string => {
  const v = overRiadok(r)
  return v.ok ? "(prešlo)" : v.dovod
}

t("bez zavináča neprejde", zlyDovod({ ...dobry, email: "novak" }) === "neplatná adresa",
  zlyDovod({ ...dobry, email: "novak" }))
t("prázdna adresa neprejde", zlyDovod({ ...dobry, email: "" }) === "neplatná adresa")
t("chýbajúci companyCode neprejde", zlyDovod({ ...dobry, companyCode: "" }) === "chýba companyCode")
t("companyCode zo samých medzier neprejde",
  zlyDovod({ ...dobry, companyCode: "   " }) === "chýba companyCode")
t("chýbajúce meno neprejde", zlyDovod({ ...dobry, fullName: "" }) === "chýba meno")
t("meno zo samých medzier neprejde", zlyDovod({ ...dobry, fullName: "  " }) === "chýba meno")

// Import stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť
// späť. Preto musí zlyhať nahlas na každom pochybnom riadku, nie ho preskočiť.
t("chybný riadok nesie dôvod, nielen príznak", (() => {
  const v = overRiadok({ ...dobry, email: "x" })
  return !v.ok && v.dovod.length > 0
})())
t("chybný riadok nesie pôvodnú adresu na dohľadanie", (() => {
  const v = overRiadok({ email: "nezmysel", fullName: "A", companyCode: "SFZ" })
  return !v.ok && v.email === "nezmysel"
})())

// Vstup z CSV je cudzí — nesmie zhodiť import tým, že chýba pole.
t("chýbajúce polia nespadnú na výnimke", (() => {
  const v = overRiadok({} as NovaOsoba)
  return !v.ok
})())

for (const [ok, n] of R) console.log(`${ok ? "OK  " : "ZLE "}  ${n}`)
const zle = R.filter(([ok]) => !ok)
console.log("\n" + "=".repeat(56))
console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
process.exit(zle.length ? 1 : 0)
