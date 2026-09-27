/**
 * Témy kurzov (ADR-018, D117) — číselník organizácie `Tenant.learningTopics`.
 *
 * Kurz má práve jednu tému a nesie jej **kľúč aj kópiu názvu** — téma sa
 * smie premenovať aj vyradiť a kurz musí zostať čitateľný. Položka sa
 * nemaže, len vyradí (`retiredAt`), ako právne základy (D92).
 */

import { getCollection } from "./mongodb"
import { TENANTS_COLLECTION, invalidateTenants, type Tenant } from "./tenants"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { KEY_PATTERN } from "./codelists"
import { slugifyKey } from "./slug"

export type LearningTopic = NonNullable<Tenant["learningTopics"]>[number]

const TARGET = "ciselnik:learningTopics"

/** Témy v ponuke — bez vyradených, podľa názvu. */
export function topicOptions(tenant: Pick<Tenant, "learningTopics"> | null): LearningTopic[] {
  return (tenant?.learningTopics ?? [])
    .filter(t => !t.retiredAt)
    .sort((a, b) => a.label.localeCompare(b.label, "sk"))
}

/** Téma podľa kľúča, aj vyradená — kurz ju môže mať. */
export function findTopic(tenant: Pick<Tenant, "learningTopics"> | null, key: string): LearningTopic | null {
  return (tenant?.learningTopics ?? []).find(t => t.key === key) ?? null
}

export type TopicProblem = "learning.topicLabelRequired" | "learning.topicKeyShape" | "learning.topicKeyTaken"

/** Čo bráni pridať tému. Kľúč z názvu, ak nie je zadaný. */
export function newTopicProblem(
  tenant: Pick<Tenant, "learningTopics">,
  input: { key?: string; label: string },
): { problem: TopicProblem | null; key: string } {
  const key = (input.key?.trim() || slugifyKey(input.label)).toLowerCase()
  if (!input.label.trim()) return { problem: "learning.topicLabelRequired", key }
  if (!KEY_PATTERN.test(key)) return { problem: "learning.topicKeyShape", key }
  // Aj vyradené — kľúč je identita, ktorú nesú kurzy.
  if ((tenant.learningTopics ?? []).some(t => t.key === key)) return { problem: "learning.topicKeyTaken", key }
  return { problem: null, key }
}

async function tenantFor(companyCode: string) {
  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const tenant = await col.findOne({ companyCode }, { projection: { learningTopics: 1 } })
  if (!tenant) throw new AppError("codelist.tenantMissing", `Organizácia ${companyCode} neexistuje.`)
  return { col, tenant }
}

export async function addTopic(input: { companyCode: string; key?: string; label: string; actor: string }): Promise<LearningTopic> {
  const { col, tenant } = await tenantFor(input.companyCode)
  const { problem, key } = newTopicProblem(tenant, input)
  if (problem) throw new AppError(problem, `Tému „${input.label}" sa nepodarilo pridať (${problem}).`, { key })
  const item: LearningTopic = { key, label: input.label.trim(), retiredAt: null, createdAt: new Date(), createdBy: input.actor }
  await col.updateOne({ companyCode: input.companyCode }, { $push: { learningTopics: item } } as never)
  invalidateTenants()
  await writeAudit({ companyCode: input.companyCode, subject: "organisation", action: "created", actor: input.actor, targetId: TARGET, targetLabel: `Témy kurzov — ${item.label}` })
  return item
}

/** Vyradí tému z ponuky. Kurzy, ktoré ju majú, si ju nesú ďalej. */
export async function retireTopic(companyCode: string, key: string, actor: string): Promise<boolean> {
  const { col, tenant } = await tenantFor(companyCode)
  const item = (tenant.learningTopics ?? []).find(t => t.key === key && !t.retiredAt)
  if (!item) return false
  await col.updateOne(
    { companyCode },
    { $set: { "learningTopics.$[t].retiredAt": new Date() } },
    { arrayFilters: [{ "t.key": key }] },
  )
  invalidateTenants()
  await writeAudit({ companyCode, subject: "organisation", action: "retired", actor, targetId: TARGET, targetLabel: `Témy kurzov — ${item.label}` })
  return true
}

/** Vráti vyradenú tému do ponuky. */
export async function restoreTopic(companyCode: string, key: string, actor: string): Promise<boolean> {
  const { col, tenant } = await tenantFor(companyCode)
  const item = (tenant.learningTopics ?? []).find(t => t.key === key && t.retiredAt)
  if (!item) return false
  await col.updateOne({ companyCode }, { $set: { "learningTopics.$[t].retiredAt": null } }, { arrayFilters: [{ "t.key": key }] })
  invalidateTenants()
  await writeAudit({ companyCode, subject: "organisation", action: "restored", actor, targetId: TARGET, targetLabel: `Témy kurzov — ${item.label}` })
  return true
}

/**
 * Premenuje tému. Kľúč ostáva (kurzy naň odkazujú); kópia názvu na kurzoch
 * sa zmení tiež — kurz je živý záznam, zverejnená verzia tému nenesie.
 */
export async function renameTopic(companyCode: string, key: string, label: string, actor: string): Promise<boolean> {
  const name = label.trim()
  if (!name) throw new AppError("learning.topicLabelRequired", "Názov témy je povinný.")
  const { col, tenant } = await tenantFor(companyCode)
  const item = (tenant.learningTopics ?? []).find(t => t.key === key)
  if (!item) return false
  await col.updateOne({ companyCode }, { $set: { "learningTopics.$[t].label": name } }, { arrayFilters: [{ "t.key": key }] })
  invalidateTenants()
  await (await getCollection<{ companyCode: string; topicKey: string }>("courses"))
    .updateMany({ companyCode, topicKey: key }, { $set: { topicLabel: name } })
  await writeAudit({
    companyCode, subject: "organisation", action: "renamed", actor, targetId: TARGET, targetLabel: `Témy kurzov — ${name}`,
    changes: { label: { from: item.label, to: name } },
  })
  return true
}
