/**
 * tenantAdmin.ts — zápisová strana tenantov (Fáza 5b, rozsahy B a C).
 *
 * Zámerne oddelené od `tenants.ts`. Ten odpovedá na otázku „ktorá organizácia
 * je za touto adresou" pri **každej** požiadavke a má pamäť; tento modul sa
 * dotkne raz za čas a mení. Rôzna cesta, rôzna cena chyby.
 *
 * **Kontrola vlastníctva domén je tu a nikde inde.** Predtým žila v
 * `scripts/tenant_set.mjs` a obrazovka by ju musela napísať druhýkrát — a
 * druhá kópia pravidla o tom, komu doména patrí, je presne to, čo nesmie
 * vzniknúť. Skript ju odteraz volá odtiaľto.
 */

import { getCollection } from "./mongodb"
import {
  TENANTS_COLLECTION,
  normalizeHostname,
  normalizeTenant,
  invalidateTenants,
} from "./tenants"
import { UI_LANGUAGES, isUiLanguage } from "./i18n"
import type { UiLanguage } from "./i18n"
import type { Tenant } from "./tenants"

/**
 * `Tenant` plus polia, ktoré nesie len správa: kto zmenu spravil a kedy boli
 * zákazníkovi poslané pokyny k doméne. V `tenants.ts` zámerne nie sú —
 * čítacia cesta ich nepotrebuje a rozširovať kvôli nim hlavný typ by
 * znamenalo, že ich uvidí každé miesto v aplikácii.
 */
type TenantDoc = Tenant & {
  createdBy?: string
  updatedBy?: string
  domainSetup?: { requestedAt: Date; requestedTo: string; hostnames: string[] }
}

export class DomainOwnedError extends Error {
  // Bez parametrových vlastností — viď poznámku pri `UnknownHostError`.
  readonly hostnames: string[]
  readonly owner: string

  constructor(hostnames: string[], owner: string) {
    super(`Doména ${hostnames.join(", ")} už patrí organizácii ${owner}.`)
    this.name = "DomainOwnedError"
    this.hostnames = hostnames
    this.owner = owner
  }
}

export class TenantValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TenantValidationError"
  }
}

/**
 * Doména patrí najviac jednej organizácii.
 *
 * Kontrola ide **pred** zápisom: po ňom sa už nedá zistiť, čo tam bolo
 * predtým. A odmieta sa, neprepisuje — tiché prevzatie domény sa zistí až
 * vtedy, keď ľudia z jednej organizácie uvidia hlavičku druhej.
 */
export async function assertHostnamesFree(
  companyCode: string,
  hostnames: string[],
): Promise<void> {
  if (!hostnames.length) return
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  const kolizia = await col.findOne({
    hostnames: { $in: hostnames },
    companyCode: { $ne: companyCode },
  })
  if (!kolizia) return
  const ktore = hostnames.filter(h => (kolizia.hostnames ?? []).includes(h))
  throw new DomainOwnedError(ktore, kolizia.companyCode)
}

export interface TenantChange {
  displayName?: string
  shortName?: string
  logoUrl?: string
  accentColor?: string
  supportEmail?: string
  languages?: string[]
  defaultLanguage?: string
  status?: "active" | "disabled"
  hostnames?: string[]
}

const KOD = /^[A-Z0-9][A-Z0-9_-]{1,23}$/

export function normalizeCompanyCode(raw: string): string {
  const kod = String(raw ?? "").trim().toUpperCase()
  if (!KOD.test(kod)) {
    throw new TenantValidationError(
      "Kód organizácie: 2–24 znakov, veľké písmená, číslice, pomlčka alebo podčiarkovník.",
    )
  }
  return kod
}

export function normalizeHostnames(raw: string[] | string): string[] {
  const zoznam = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[\s,;]+/)
  return [...new Set(zoznam.map(normalizeHostname).filter(Boolean))]
}

function jazyky(raw: string[] | undefined, kde: string): UiLanguage[] | undefined {
  if (!raw) return undefined
  const ok = raw.filter(isUiLanguage)
  if (ok.length !== raw.length) {
    const zle = raw.filter(l => !isUiLanguage(l))
    throw new TenantValidationError(
      `Neznámy jazyk v ${kde}: ${zle.join(", ")} (povolené: ${UI_LANGUAGES.join(", ")}).`,
    )
  }
  return ok as UiLanguage[]
}

/** Prevedie zmenu na `$set`. Nevyplnené polia sa **nemenia**, nemažú. */
function naSet(change: TenantChange): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (change.hostnames) set.hostnames = change.hostnames
  if (change.displayName !== undefined) set["branding.displayName"] = change.displayName.trim()
  if (change.shortName !== undefined) set["branding.shortName"] = change.shortName.trim()
  if (change.logoUrl !== undefined) set["branding.logoUrl"] = change.logoUrl.trim()
  if (change.accentColor !== undefined) set["branding.accentColor"] = change.accentColor.trim()
  if (change.supportEmail !== undefined) {
    set["branding.supportEmail"] = change.supportEmail.trim().toLowerCase()
  }
  const js = jazyky(change.languages, "zozname jazykov")
  if (js?.length) set.languages = js
  const dj = jazyky(change.defaultLanguage ? [change.defaultLanguage] : undefined, "predvolenom jazyku")
  if (dj?.length) set.defaultLanguage = dj[0]
  if (change.status) set.status = change.status
  return set
}

/**
 * Uloží zmenu existujúcej organizácie.
 *
 * `actor` je adresa človeka, ktorý zmenu spravil. Bez nej sa po čase nedá
 * povedať, kto organizáciu vypol — a vypnutie je jediná zmena, ktorá ľudí
 * okamžite odstrihne od portálu.
 */
export async function saveTenant(
  companyCode: string,
  change: TenantChange,
  actor: string,
): Promise<Tenant> {
  const kod = normalizeCompanyCode(companyCode)
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)

  const existuje = await col.findOne({ companyCode: kod })
  if (!existuje) throw new TenantValidationError(`Organizácia ${kod} neexistuje.`)

  if (change.hostnames) {
    if (!change.hostnames.length) {
      throw new TenantValidationError(
        "Bez domény sa portál organizácie nikde neukáže. Nechaj aspoň jednu.",
      )
    }
    await assertHostnamesFree(kod, change.hostnames)
  }

  const set = naSet(change)
  set.updatedBy = actor

  // Bodkové cesty (`branding.displayName`) sa v typoch ovládača vyjadriť
  // nedajú, preto jedno pretypovanie tu a nikde inde.
  await col.updateOne({ companyCode: kod }, { $set: set } as never)

  // Bez tohto by sa zmena prejavila až o päť minút (pamäť v `tenants.ts`)
  // a vyzeralo by to, že sa neuložila.
  invalidateTenants()

  const po = await col.findOne({ companyCode: kod })
  return normalizeTenant(po!)
}

/**
 * Založí novú organizáciu.
 *
 * Domény sa **nepridávajú do Vercelu tu** — to robí volajúci (obrazovka alebo
 * skript) až po tomto zápise. Poradie je zámerné: `tenants` je zdroj pravdy
 * a výpadok cudzieho API nesmie brániť organizáciu založiť.
 */
export async function createTenant(
  companyCode: string,
  change: TenantChange & { displayName: string },
  actor: string,
): Promise<Tenant> {
  const kod = normalizeCompanyCode(companyCode)
  if (!change.displayName?.trim()) {
    throw new TenantValidationError("Názov organizácie je povinný — je to to, čo ľudia uvidia v hlavičke.")
  }

  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  if (await col.findOne({ companyCode: kod })) {
    throw new TenantValidationError(`Organizácia ${kod} už existuje.`)
  }

  const hostnames = change.hostnames ?? []
  await assertHostnamesFree(kod, hostnames)

  const now = new Date()
  const set = naSet(change)
  await col.insertOne({
    companyCode: kod,
    hostnames,
    branding: { displayName: change.displayName.trim() },
    defaultLanguage: "sk",
    languages: ["sk"],
    status: "active",
    createdAt: now,
    createdBy: actor,
    ...set,
  } as unknown as TenantDoc)

  invalidateTenants()
  const po = await col.findOne({ companyCode: kod })
  return normalizeTenant(po!)
}

/** Všetky organizácie, zoradené. Len pre správu — bežná cesta ide cez hostiteľa. */
export async function allTenants(): Promise<Tenant[]> {
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  const surove = await col.find({}).sort({ companyCode: 1 }).toArray()
  return surove.map(normalizeTenant)
}
