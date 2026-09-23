/**
 * legalBasesDb.ts — správa číselníka právnych základov organizácie (D92).
 *
 * Spravuje ho správca organizácie (`orgContext()`, rola `people-admin`) —
 * tá istá obrazovka a rola ako ostatné číselníky organizácie. Pravidlá sú
 * v `legalBases.ts`; tu je len zápis a stopa v audite.
 *
 * **Nič sa nemaže.** Vlastná položka sa vyradí, štandardná skryje. Znenia,
 * ktoré ich majú, si nesú kópiu a na ich obsah sa nesiaha.
 */

import { getCollection } from "./mongodb"
import { TENANTS_COLLECTION, invalidateTenants, type Tenant } from "./tenants"
import { DOCUMENTS_COLLECTION } from "./documents"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import {
  STANDARD_LEGAL_BASES, newLegalBasisProblem, tidyLegalBasisItem, type TenantLegalBasis,
} from "./legalBases"
import type { LegalBasis } from "./versionResponsibility"

export class LegalBasisError extends AppError {}

const MESSAGES: Record<string, string> = {
  "legalBasis.badKey": "Kľúč môže obsahovať len malé písmená bez diakritiky, číslice a podčiarkovník.",
  "legalBasis.labelRequired": "Názov právneho základu je povinný.",
  "legalBasis.keyTaken": "Taký kľúč už v číselníku je (aj medzi skrytými a vyradenými položkami).",
  "legalBasis.invalid": "Taký právny základ systém nepozná.",
  "legalBasis.referenceRequired": "Pri zákonnej povinnosti je odkaz na predpis povinný.",
  "legalBasis.referenceTooLong": "Odkaz na predpis je pridlhý — stačí citácia, nie text ustanovenia.",
  "legalBasis.notCustom": "Takú vlastnú položku organizácia nemá.",
  "legalBasis.notStandard": "Taká štandardná položka neexistuje.",
  "codelist.tenantMissing": "Organizácia neexistuje.",
}

function fail(code: string): never {
  throw new LegalBasisError(code, MESSAGES[code] ?? code)
}

const TARGET = "ciselnik:legalBases"

async function tenantFor(companyCode: string) {
  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const t = await col.findOne({ companyCode }, { projection: { legalBases: 1, legalBasesHidden: 1 } })
  if (!t) fail("codelist.tenantMissing")
  return { col, tenant: t }
}

export async function addLegalBasis(input: {
  companyCode: string
  key: string
  label: string
  basis: string
  reference?: string
  actor: string
}): Promise<TenantLegalBasis> {
  const { col, tenant } = await tenantFor(input.companyCode)
  const problem = newLegalBasisProblem(tenant, input)
  if (problem) fail(problem)

  const item: TenantLegalBasis = {
    ...tidyLegalBasisItem({ ...input, basis: input.basis as LegalBasis }),
    createdAt: new Date(),
    createdBy: input.actor,
  }
  await col.updateOne({ companyCode: input.companyCode }, { $push: { legalBases: item } } as never)
  invalidateTenants()

  await writeAudit({
    companyCode: input.companyCode, subject: "organisation", action: "created", actor: input.actor,
    targetId: TARGET, targetLabel: `Právne základy — ${item.label}`,
    changes: { legalBasis: { to: `${item.basis}${item.reference ? ` · ${item.reference}` : ""}` } },
  })
  return item
}

/** Vyradí vlastnú položku z ponuky. Znenia, ktoré ju majú, si ju nesú ďalej. */
export async function retireLegalBasis(companyCode: string, key: string, actor: string): Promise<void> {
  const { col, tenant } = await tenantFor(companyCode)
  const item = (tenant.legalBases ?? []).find(i => i.key === key && !i.retiredAt)
  if (!item) fail("legalBasis.notCustom")

  await col.updateOne(
    { companyCode },
    { $set: { "legalBases.$[i].retiredAt": new Date() } } as never,
    { arrayFilters: [{ "i.key": key }] },
  )
  invalidateTenants()
  await writeAudit({
    companyCode, subject: "organisation", action: "deleted", actor,
    targetId: TARGET, targetLabel: `Právne základy — ${item.label}`,
    note: "vyradené z ponuky; znenia, ktoré ho majú, si ho nesú ďalej",
  })
}

/** Skryje alebo vráti štandardnú položku. */
export async function setStandardLegalBasisHidden(
  companyCode: string, key: string, hidden: boolean, actor: string,
): Promise<void> {
  const item = STANDARD_LEGAL_BASES.find(i => i.key === key)
  if (!item) fail("legalBasis.notStandard")
  const { col } = await tenantFor(companyCode)
  await col.updateOne(
    { companyCode },
    (hidden ? { $addToSet: { legalBasesHidden: key } } : { $pull: { legalBasesHidden: key } }) as never,
  )
  invalidateTenants()
  await writeAudit({
    companyCode, subject: "organisation", action: hidden ? "excluded" : "restored", actor,
    targetId: TARGET, targetLabel: `Právne základy — ${item.label}`,
  })
}

/** Koľko znení má danú položku — aby bolo vidieť, čo sa skrýva alebo vyraďuje. */
export async function legalBasisUsage(companyCode: string): Promise<Map<string, number>> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const rows = await col.aggregate<{ _id: string; n: number }>([
    { $match: { companyCode, "versions.legalBasisKey": { $exists: true } } },
    { $unwind: "$versions" },
    { $match: { "versions.legalBasisKey": { $exists: true } } },
    { $group: { _id: "$versions.legalBasisKey", n: { $sum: 1 } } },
  ]).toArray()
  return new Map(rows.map(r => [r._id, r.n]))
}
