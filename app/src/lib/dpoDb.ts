/**
 * Výkaz právnych základov z databázy a štvrťročný e-mail pre DPO (ADR-012, D104).
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type DocumentRecord } from "./documents"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { brandingView, type Tenant } from "./tenants"
import { legalBasisReport, summarize, quarterKey, DPO_ROLE, type LegalBasisRow } from "./dpo"
import { claimReminder } from "./reminders"
import { send, dpoReportEmail } from "./ecomail"
import { normalizeLanguage } from "./i18n"

/** Platné znenia organizácie s právnym základom a tým, čo chýba. */
export async function legalBasisRows(companyCode: string, now: Date = new Date()): Promise<LegalBasisRow[]> {
  const docs = await (await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION))
    .find({ companyCode }, { projection: { documentId: 1, title: 1, versions: 1 } })
    .toArray()
  const active = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode, status: { $ne: "inactive" } }, { projection: { id: 1 } })
    .toArray()
  return legalBasisReport(docs, new Set(active.map(p => p.id)), now)
}

/**
 * Pošle štvrťročný výkaz každej osobe s rolou DPO. Volá ho denný cron **len
 * v prvý deň kvartálu**; zápis do `reminder_log` s kľúčom kvartálu zaručí,
 * že opakovaný beh v ten istý deň druhý e-mail nepošle.
 *
 * Vracia počet odoslaných e-mailov.
 */
export async function sendQuarterlyDpoReports(tenant: Tenant, now: Date = new Date()): Promise<number> {
  const dpos = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode: tenant.companyCode, roles: DPO_ROLE, status: { $ne: "inactive" } })
    .toArray()
  if (dpos.length === 0) return 0

  const summary = summarize(await legalBasisRows(tenant.companyCode, now))
  const quarter = quarterKey(now)
  const host = tenant.hostnames[0]
  const branding = brandingView(tenant)
  let sent = 0
  for (const p of dpos) {
    if (!(await claimReminder(tenant.companyCode, `dpo-report:${p.id}`, quarter))) continue
    try {
      await send({
        to: p.email,
        ...dpoReportEmail(`https://${host}/dpo`, host, quarter, summary, normalizeLanguage(p.language), branding),
      })
      sent++
    } catch (e) {
      console.error(`[dpo] štvrťročný výkaz na ${p.email} zlyhal:`, e)
    }
  }
  return sent
}
