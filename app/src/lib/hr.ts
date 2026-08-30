/**
 * hr.ts — kto smie prideľovať a vidieť, ako je na tom organizácia (D33).
 *
 * Rovnaký vzor ako `admin.ts`, ale o poschodie nižšie: rola `hr` platí
 * **vo vlastnej organizácii** a nikde inde. Obe podmienky musia sedieť naraz
 * — rola aj zhoda `companyCode` s tenantom hostiteľa (D29, D32). Keby stačila
 * rola, jediná chyba pri jej priraďovaní by otvorila prehľad cudzej
 * organizácie.
 *
 * **Správca platformy sem nepatrí.** `platform-admin` vidí počty naprieč
 * tenantmi (D41) — a to je výslovná a úzka výnimka z D32. Táto obrazovka
 * ukazuje **menovite**, kto z ľudí ešte nepotvrdil, a to je obsah, nie
 * prehľad. Kto ho má vidieť, musí byť z tej organizácie.
 */

import { getCollection } from "./mongodb"
import { currentTenant, currentPerson } from "./session"
import { DOCUMENTS_COLLECTION, canSeeDocument, effectiveVersion } from "./documents"
import type { DocumentRecord } from "./documents"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const HR_ROLE = "hr"

export function isHr(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(HR_ROLE))
}

export type HrContext =
  /** Hostiteľ nepatrí žiadnemu tenantovi — stránka tu neexistuje (D29). */
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  /** Prihlásený, ale rolu nemá. Z pohľadu stránky to isté ako zlý hostiteľ. */
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function hrContext(): Promise<HrContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť. Bez tenanta sa nepokračuje.
    console.error("[hr] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isHr(person)) return { state: "forbidden" }

  return { state: "ready", person, tenant }
}

// ── čo sa dá prideliť a komu ────────────────────────────────────────────────

/** Dokument so znením, ktoré sa dá prideliť. */
export interface AssignableDocument {
  documentId: string
  title: string
  versionId: string
  versionLabel: string
  effectiveFrom: Date
}

/**
 * Dokumenty, ktoré má organizácia k dispozícii **a** ktoré majú platné znenie.
 *
 * Dokument bez platného znenia sa v ponuke neobjaví vôbec. Prideliť by sa
 * nedal (D6) a ponúkať niečo, čo skončí chybou, je horšie než to neponúknuť —
 * prečo tam nie je, povie prehľad v `/admin`.
 */
export async function assignableDocuments(companyCode: string): Promise<AssignableDocument[]> {
  const col = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  const raw = await col
    .find({
      $or: [
        { companyCode },
        { accessLevel: "public" },
        { sharedWithCompanyCodes: companyCode },
      ],
    })
    .toArray()

  const asOf = new Date()
  const out: AssignableDocument[] = []
  for (const d of raw) {
    // Dotaz je len predvýber; o viditeľnosti rozhoduje `canSeeDocument`,
    // aby pravidlo D32 zostalo na jednom mieste.
    if (!canSeeDocument({ companyCode }, d)) continue
    const v = effectiveVersion(d, asOf)
    if (!v.ok || !v.version.effectiveFrom) continue
    out.push({
      documentId: d.documentId,
      title: d.title,
      versionId: v.version.versionId,
      versionLabel: v.version.label,
      effectiveFrom: v.version.effectiveFrom,
    })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "sk"))
}
