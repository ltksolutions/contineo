/**
 * ciselnikyTenanta.ts — číselníky, ktoré si organizácia spravuje sama (D55).
 *
 * Doteraz boli všetky číselníky JSON súbory v repozitári. Pri jednom zväze to
 * stačilo; ako produkt to znamená, že druh dokumentu „metodický pokyn" alebo
 * značku „mládež" musí zákazníkovi dopísať vývojár a nasadiť.
 *
 * **Dopĺňa sa, neprepisuje.** Globálne položky zostávajú v ponuke vždy: sú
 * v nich hodnoty, ktorými je otagovaný existujúci obsah, a ich zmiznutie by
 * z nich spravilo neplatné údaje na dokumentoch, ktoré nikto nemenil.
 *
 * **Odstránenie kľúča neodstráni obsah.** Zmizne len z ponuky; dokumenty,
 * ktoré ho majú, si ho nesú ďalej. Prepisovať cudzí obsah kvôli upratovaniu
 * číselníka by bola tichá zmena dát — a tie sa hľadajú najhoršie.
 */

import { getCollection } from "./mongodb"
import { TENANTS_COLLECTION, invalidateTenants } from "./tenants"
import { checkCustomItem, CodelistError, CUSTOM_CODELISTS, codelistFor } from "./codelists"
import { writeAudit } from "./audit"
import type { CodelistExtras, CodelistItem, CustomCodelist } from "./codelists"
import type { Tenant } from "./tenants"

export const CODELIST_LABEL: Record<CustomCodelist, { nazov: string; napoveda: string }> = {
  category: {
    nazov: "Druhy dokumentov",
    napoveda: "Čím dokument je: norma, smernica, metodický pokyn, zápisnica…",
  },
  tags: {
    nazov: "Značky",
    napoveda: "Voľné triedenie naprieč druhmi — napríklad mládež, rozhodcovia, financie.",
  },
}

export function isCustom(nazov: string): nazov is CustomCodelist {
  return (CUSTOM_CODELISTS as readonly string[]).includes(nazov)
}

/** Doplnky organizácie v tvare, aký čaká `ciselniky.ts`. */
export function tenantExtras(tenant: Pick<Tenant, "ciselniky">): CodelistExtras {
  return (tenant.ciselniky ?? {}) as CodelistExtras
}

/** Celá ponuka číselníka pre danú organizáciu — globálne aj vlastné. */
export function availableOptions(tenant: Pick<Tenant, "ciselniky">, nazov: string): CodelistItem[] {
  return codelistFor(nazov, tenantExtras(tenant)).polozky
}

/** Len to, čo si dopísala organizácia — to jediné sa dá odobrať. */
export function customItems(tenant: Pick<Tenant, "ciselniky">, nazov: string): CodelistItem[] {
  return (tenant.ciselniky?.[nazov] ?? []) as CodelistItem[]
}

export async function addCodelistItem(
  companyCode: string,
  ciselnik: string,
  kluc: string,
  popis: string,
  aktor: string,
): Promise<void> {
  if (!isCustom(ciselnik)) {
    throw new CodelistError(
      `Číselník ${ciselnik} si organizácia nespravuje sama — sú to filtre, na ktorých stojí prístup k obsahu.`,
    )
  }
  const polozka = checkCustomItem(kluc, popis)

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  if (!t) throw new CodelistError("Organizácia neexistuje.")

  const uz = availableOptions(t, ciselnik).some(p => p.key === polozka.key)
  if (uz) throw new CodelistError(`„${polozka.key}" v ponuke už je.`)

  await col.updateOne(
    { companyCode },
    { $push: { [`ciselniky.${ciselnik}`]: polozka } } as never,
  )
  invalidateTenants()

  await writeAudit({
    companyCode, predmet: "organizacia", akcia: "zalozene", aktor,
    cielId: `ciselnik:${ciselnik}`, cielPopis: `${CODELIST_LABEL[ciselnik].nazov} — ${polozka.key}`,
    zmeny: { [ciselnik]: { na: polozka.label ?? polozka.key } },
  })
}

export async function removeCodelistItem(
  companyCode: string,
  ciselnik: string,
  kluc: string,
  aktor: string,
): Promise<void> {
  if (!isCustom(ciselnik)) throw new CodelistError("Tento číselník sa meniť nedá.")

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  await col.updateOne(
    { companyCode },
    { $pull: { [`ciselniky.${ciselnik}`]: { key: kluc } } } as never,
  )
  invalidateTenants()

  await writeAudit({
    companyCode, predmet: "organizacia", akcia: "zrusene", aktor,
    cielId: `ciselnik:${ciselnik}`, cielPopis: `${CODELIST_LABEL[ciselnik as CustomCodelist].nazov} — ${kluc}`,
    poznamka: "z ponuky; dokumenty, ktoré ho majú, si ho nesú ďalej",
  })
}

/** Koľko dokumentov danú hodnotu používa — aby bolo vidieť, čo sa odoberá. */
export async function codelistUsage(
  companyCode: string,
  ciselnik: string,
  kluc: string,
): Promise<number> {
  const col = await getCollection("documents")
  return col.countDocuments({ companyCode, [ciselnik]: kluc })
}
