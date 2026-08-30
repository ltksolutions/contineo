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
import { overVlastnuPolozku, CiselnikError, VLASTNE_CISELNIKY, ciselnikPre } from "./codelists"
import { zapisAudit } from "./audit"
import type { Doplnky, Polozka, VlastnyCiselnik } from "./codelists"
import type { Tenant } from "./tenants"

export const POPIS_CISELNIKA: Record<VlastnyCiselnik, { nazov: string; napoveda: string }> = {
  category: {
    nazov: "Druhy dokumentov",
    napoveda: "Čím dokument je: norma, smernica, metodický pokyn, zápisnica…",
  },
  tags: {
    nazov: "Značky",
    napoveda: "Voľné triedenie naprieč druhmi — napríklad mládež, rozhodcovia, financie.",
  },
}

export function jeVlastny(nazov: string): nazov is VlastnyCiselnik {
  return (VLASTNE_CISELNIKY as readonly string[]).includes(nazov)
}

/** Doplnky organizácie v tvare, aký čaká `ciselniky.ts`. */
export function doplnkyTenanta(tenant: Pick<Tenant, "ciselniky">): Doplnky {
  return (tenant.ciselniky ?? {}) as Doplnky
}

/** Celá ponuka číselníka pre danú organizáciu — globálne aj vlastné. */
export function ponuka(tenant: Pick<Tenant, "ciselniky">, nazov: string): Polozka[] {
  return ciselnikPre(nazov, doplnkyTenanta(tenant)).polozky
}

/** Len to, čo si dopísala organizácia — to jediné sa dá odobrať. */
export function vlastnePolozky(tenant: Pick<Tenant, "ciselniky">, nazov: string): Polozka[] {
  return (tenant.ciselniky?.[nazov] ?? []) as Polozka[]
}

export async function pridajPolozku(
  companyCode: string,
  ciselnik: string,
  kluc: string,
  popis: string,
  aktor: string,
): Promise<void> {
  if (!jeVlastny(ciselnik)) {
    throw new CiselnikError(
      `Číselník ${ciselnik} si organizácia nespravuje sama — sú to filtre, na ktorých stojí prístup k obsahu.`,
    )
  }
  const polozka = overVlastnuPolozku(kluc, popis)

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode })
  if (!t) throw new CiselnikError("Organizácia neexistuje.")

  const uz = ponuka(t, ciselnik).some(p => p.key === polozka.key)
  if (uz) throw new CiselnikError(`„${polozka.key}" v ponuke už je.`)

  await col.updateOne(
    { companyCode },
    { $push: { [`ciselniky.${ciselnik}`]: polozka } } as never,
  )
  invalidateTenants()

  await zapisAudit({
    companyCode, predmet: "organizacia", akcia: "zalozene", aktor,
    cielId: `ciselnik:${ciselnik}`, cielPopis: `${POPIS_CISELNIKA[ciselnik].nazov} — ${polozka.key}`,
    zmeny: { [ciselnik]: { na: polozka.label ?? polozka.key } },
  })
}

export async function odoberPolozku(
  companyCode: string,
  ciselnik: string,
  kluc: string,
  aktor: string,
): Promise<void> {
  if (!jeVlastny(ciselnik)) throw new CiselnikError("Tento číselník sa meniť nedá.")

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  await col.updateOne(
    { companyCode },
    { $pull: { [`ciselniky.${ciselnik}`]: { key: kluc } } } as never,
  )
  invalidateTenants()

  await zapisAudit({
    companyCode, predmet: "organizacia", akcia: "zrusene", aktor,
    cielId: `ciselnik:${ciselnik}`, cielPopis: `${POPIS_CISELNIKA[ciselnik as VlastnyCiselnik].nazov} — ${kluc}`,
    poznamka: "z ponuky; dokumenty, ktoré ho majú, si ho nesú ďalej",
  })
}

/** Koľko dokumentov danú hodnotu používa — aby bolo vidieť, čo sa odoberá. */
export async function pouzitie(
  companyCode: string,
  ciselnik: string,
  kluc: string,
): Promise<number> {
  const col = await getCollection("documents")
  return col.countDocuments({ companyCode, [ciselnik]: kluc })
}
