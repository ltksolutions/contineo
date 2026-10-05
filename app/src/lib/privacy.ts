/**
 * Informovanie dotknutých osôb (čl. 13 GDPR) — C1, ADR-012.
 *
 * Text je v `dictionary().privacy`; tu je len to, čo sa doň dopĺňa z dát.
 * Kontakt na DPO sa **nepíše natvrdo**: berie sa z osôb s rolou `dpo`, takže
 * pri zmene DPO sa text opraví sám (`docs/C1_informovanie_dotknutych_osob.md`).
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { DPO_ROLE } from "./dpo"
import type { TenantProfile } from "./providers/types"

/**
 * Dátum verzie textu. **Pri každej zmene textu v `i18n.ts` sa posunie** —
 * je to dôkaz, ktorá verzia informovania bola zverejnená kedy.
 */
export const PRIVACY_NOTICE_VERSION = new Date("2026-10-05T00:00:00Z")

/** Kontakt na DPO organizácie — meno a adresa, nič viac. */
export async function dpoContacts(companyCode: string): Promise<{ fullName: string; email: string }[]> {
  const rows = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find(
      { companyCode, roles: DPO_ROLE, status: { $ne: "inactive" } },
      { projection: { fullName: 1, email: 1 } },
    )
    .toArray()
  return rows.map(p => ({ fullName: p.fullName, email: p.email }))
}

export type ProcessorKey = "atlas" | "vercel" | "anthropic" | "bedrock" | "voyage" | "ecomail"

/**
 * Sprostredkovatelia **podľa toho, čo organizácia naozaj používa** (ADR-022)
 * — z profilu adaptérov (ADR-001), nie natvrdo. Kto má generovanie na
 * vlastnom serveri (`openai` s `url`), Anthropic v zozname nemá; kto nemá
 * Atlas embedding ani rerank, nemá Voyage. Databáza, beh a e-maily sú
 * spoločné pre celé nasadenie.
 */
export function privacyProcessors(profile: Pick<TenantProfile, "providers">): { key: ProcessorKey; region?: string }[] {
  const out: { key: ProcessorKey; region?: string }[] = [{ key: "atlas" }, { key: "vercel" }]
  const models = [profile.providers.generation, profile.providers.utility].filter(Boolean)
  if (models.some(m => m!.kind === "anthropic")) out.push({ key: "anthropic" })
  const bedrock = models.find(m => m!.kind === "bedrock")
  if (bedrock) out.push({ key: "bedrock", region: bedrock.region })
  if (profile.providers.embedding.kind === "atlas-auto" || profile.providers.rerank.kind === "atlas-stage") out.push({ key: "voyage" })
  out.push({ key: "ecomail" })
  return out
}
