/**
 * admin.ts — správa tenantov: kto sa k nej dostane a čo v nej vidí (D41, D42).
 *
 * **Dve nezávislé podmienky, nie jedna.** Obrazovka odpovie len vtedy, keď
 * hostiteľ patrí tenantovi dodávateľa (D42) **a** človek má rolu
 * `platform-admin` (D41). Keby stačila rola, jediná chyba v jej kontrole by
 * obrazovku otvorila aj na doméne zákazníka; takto musia zlyhať obe naraz.
 *
 * **Rola otvára prehľad, nie obsah.** Počty, domény, stav — nie dokumenty
 * a nie potvrdenia cudzej organizácie. Je to výslovná výnimka z D32
 * a musí zostať úzka aj vtedy, keď bude zákazníkov dvadsať.
 */

import { getCollection } from "./mongodb"
import { effectiveVersion, DOCUMENTS_COLLECTION } from "./documents"
import { PERSONS_COLLECTION } from "./persons"
import { TRACKS_COLLECTION } from "./tracks"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { TENANTS_COLLECTION, normalizeTenant } from "./tenants"
import { currentTenant, currentPerson } from "./session"
import type { DocumentRecord } from "./documents"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const PLATFORM_ROLE = "platform-admin"

/** Tenant dodávateľa. Zhodné s `scripts/admin_set.mjs`. */
export function platformTenantCode(): string {
  return process.env.PLATFORM_TENANT ?? "LTK"
}

export function isPlatformAdmin(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(PLATFORM_ROLE))
}

export type PlatformContext =
  /** Doména nie je doména dodávateľa — obrazovka tu neexistuje (D42). */
  | { state: "wrong-host" }
  | { state: "not-signed-in" }
  /** Prihlásený, ale rolu nemá. Z pohľadu stránky to isté ako zlý hostiteľ. */
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function platformContext(): Promise<PlatformContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť. Bez tenanta sa nepokračuje.
    console.error("[admin] tenanta sa nepodarilo načítať:", e)
    return { state: "wrong-host" }
  }
  if (!tenant || tenant.companyCode !== platformTenantCode()) return { state: "wrong-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  // Rola sama nestačí: musí patriť tenantovi dodávateľa. Inak by ju stačilo
  // omylom pridať človeku zákazníka a videl by prehľad ostatných organizácií.
  if (person.companyCode !== tenant.companyCode || !isPlatformAdmin(person)) {
    return { state: "forbidden" }
  }
  return { state: "ready", person, tenant }
}

// ── prehľad ──────────────────────────────────────────────────────────────────

export interface TenantOverview {
  companyCode: string
  displayName: string
  status: Tenant["status"]
  languages: string[]
  hostnames: string[]
  people: { total: number; signedIn: number }
  tracks: number
  /** `bezZnenia` sú vypísané menovite — je to najčastejšia tichá príčina
   *  toho, že sa človeku v zozname nič neobjaví (D6). */
  documents: { total: number; withoutVersion: string[] }
  acknowledgements: number
  pokynyPoslane?: { at: Date; to: string }
}

/**
 * Čísla sa **počítajú pri zobrazení**, nikde sa neukladajú. Uložený súčet je
 * druhá kópia pravdy a rozíde sa s ňou (D27) — a rozišiel by sa práve vtedy,
 * keď na ňom niekomu záleží.
 *
 * Dotazy idú po tenantoch, nie jednou agregáciou. Pri hrsti organizácií je to
 * čitateľnejšie a rovnako rýchle; keby ich boli stovky, nahradí to jedna
 * `$facet` agregácia bez zmeny tvaru návratu.
 */
export async function tenantOverviews(): Promise<TenantOverview[]> {
  const tenantCol = await getCollection<Tenant>(TENANTS_COLLECTION)
  const raw = await tenantCol.find({}).sort({ companyCode: 1 }).toArray()

  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const trackCol = await getCollection(TRACKS_COLLECTION)
  const docCol = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  const ackCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)

  const asOf = new Date()
  const out: TenantOverview[] = []

  for (const doc of raw) {
    const t = normalizeTenant(doc)
    const code = t.companyCode

    const [total, signedIn, tracks, acknowledgements, documents] = await Promise.all([
      personCol.countDocuments({ companyCode: code }),
      personCol.countDocuments({ companyCode: code, lastLoginAt: { $exists: true } }),
      trackCol.countDocuments({ companyCode: code }),
      ackCol.countDocuments({ companyCode: code }),
      docCol
        .find({ companyCode: code }, { projection: { documentId: 1, title: 1, versions: 1 } })
        .toArray(),
    ])

    const withoutVersion = documents
      .filter(d => !effectiveVersion(d, asOf).ok)
      .map(d => d.title || d.documentId)

    const ds = (doc as Tenant & { domainSetup?: { requestedAt: Date; requestedTo: string } }).domainSetup

    out.push({
      companyCode: code,
      displayName: t.branding.displayName,
      status: t.status,
      languages: t.languages,
      hostnames: t.hostnames,
      people: { total: total, signedIn: signedIn },
      tracks,
      documents: { total: documents.length, withoutVersion: withoutVersion },
      acknowledgements: acknowledgements,
      ...(ds?.requestedAt
        ? { pokynyPoslane: { at: new Date(ds.requestedAt), to: ds.requestedTo } }
        : {}),
    })
  }

  return out
}
