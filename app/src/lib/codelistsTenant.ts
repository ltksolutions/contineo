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

export function isCustom(name: string): name is CustomCodelist {
  return (CUSTOM_CODELISTS as readonly string[]).includes(name)
}

/** Doplnky organizácie v tvare, aký čaká `ciselniky.ts`. */
export function tenantExtras(tenant: Pick<Tenant, "ciselniky">): CodelistExtras {
  return (tenant.ciselniky ?? {}) as CodelistExtras
}

/** Celá ponuka číselníka pre danú organizáciu — globálne aj vlastné. */
export function availableOptions(tenant: Pick<Tenant, "ciselniky">, name: string): CodelistItem[] {
  return codelistFor(name, tenantExtras(tenant)).polozky
}

/** Len to, čo si dopísala organizácia — to jediné sa dá odobrať. */
export function customItems(tenant: Pick<Tenant, "ciselniky">, name: string): CodelistItem[] {
  return (tenant.ciselniky?.[name] ?? []) as CodelistItem[]
}

export async function addCodelistItem(
  companyCode: string,
  codelist: string,
  key: string,
  label: string,
  actor: string,
): Promise<void> {
  if (!isCustom(codelist)) {
    throw new CodelistError(
      `Číselník ${codelist} si organizácia nespravuje sama — sú to filtre, na ktorých stojí prístup k obsahu.`,
    )
  }
  const item = checkCustomItem(key, label)

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  if (!t) throw new CodelistError("Organizácia neexistuje.")

  const existing = availableOptions(t, codelist).some(p => p.key === item.key)
  if (existing) throw new CodelistError(`„${item.key}" v ponuke už je.`)

  await col.updateOne(
    { companyCode },
    { $push: { [`ciselniky.${codelist}`]: item } } as never,
  )
  invalidateTenants()

  await writeAudit({
    companyCode, predmet: "organizacia", akcia: "zalozene", aktor: actor,
    cielId: `ciselnik:${codelist}`, cielPopis: `${CODELIST_LABEL[codelist].nazov} — ${item.key}`,
    zmeny: { [codelist]: { na: item.label ?? item.key } },
  })
}

export async function removeCodelistItem(
  companyCode: string,
  codelist: string,
  key: string,
  actor: string,
): Promise<void> {
  if (!isCustom(codelist)) throw new CodelistError("Tento číselník sa meniť nedá.")

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  await col.updateOne(
    { companyCode },
    { $pull: { [`ciselniky.${codelist}`]: { key: key } } } as never,
  )
  invalidateTenants()

  await writeAudit({
    companyCode, predmet: "organizacia", akcia: "zrusene", aktor: actor,
    cielId: `ciselnik:${codelist}`, cielPopis: `${CODELIST_LABEL[codelist as CustomCodelist].nazov} — ${key}`,
    poznamka: "z ponuky; dokumenty, ktoré ho majú, si ho nesú ďalej",
  })
}

/** Koľko dokumentov danú hodnotu používa — aby bolo vidieť, čo sa odoberá. */
export async function codelistUsage(
  companyCode: string,
  codelist: string,
  key: string,
): Promise<number> {
  const col = await getCollection("documents")
  return col.countDocuments({ companyCode, [codelist]: key })
}
