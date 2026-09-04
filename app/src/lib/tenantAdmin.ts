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
import { writeAudit, diff } from "./audit"
import {
  TENANTS_COLLECTION,
  normalizeHostname,
  normalizeTenant,
  invalidateTenants,
} from "./tenants"
import { UI_LANGUAGES, isUiLanguage } from "./i18n"
import type { UiLanguage } from "./i18n"
import type { Tenant } from "./tenants"
import { encrypt, encryptionAvailable } from "./secrets"
import type { OAuthProviderName } from "./oauth"
import { DEFAULT_CHUNKING, type ChunkingProfile } from "./chunkingProfile"
import { AppError } from "./appError"

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

export class DomainOwnedError extends AppError {
  // Bez parametrových vlastností — viď poznámku pri `UnknownHostError`.
  readonly hostnames: string[]
  readonly owner: string

  constructor(hostnames: string[], owner: string) {
    super(
      "domain.ownedByOther",
      `Doména ${hostnames.join(", ")} už patrí organizácii ${owner}.`,
      { domains: hostnames.join(", "), owner },
    )
    this.hostnames = hostnames
    this.owner = owner
  }
}

export class TenantValidationError extends AppError {}

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
  const collision = await col.findOne({
    hostnames: { $in: hostnames },
    companyCode: { $ne: companyCode },
  })
  if (!collision) return
  const which = hostnames.filter(h => (collision.hostnames ?? []).includes(h))
  throw new DomainOwnedError(which, collision.companyCode)
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
  /** Domény, z ktorých sa človek založí sám pri prihlásení kontom (D47). */
  autoProvisionDomains?: string[]
  chunking?: Partial<ChunkingProfile>
}

/**
 * Domény pre automatické založenie (D47).
 *
 * Zahodí sa zavináč, veľkosť písmen aj medzery, ale **nie poddoménová
 * štruktúra** — kto chce `oblast.futbalsfz.sk`, vypíše ju. Porovnáva sa celá
 * doména, takže `futbalsfz.sk` nikdy nepustí `zlyfutbalsfz.sk`.
 */
export function normalizeDomains(raw: string[] | string): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;\n]/)
  return [...new Set(
    list
      .map(d => String(d ?? "").trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, ""))
      .filter(d => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)),
  )]
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,23}$/

export function normalizeCompanyCode(raw: string): string {
  const code = String(raw ?? "").trim().toUpperCase()
  if (!CODE_PATTERN.test(code)) {
    throw new TenantValidationError(
      "tenant.badCode",
      "Kód organizácie: 2–24 znakov, veľké písmená, číslice, pomlčka alebo podčiarkovník.",
    )
  }
  return code
}

export function normalizeHostnames(raw: string[] | string): string[] {
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[\s,;]+/)
  return [...new Set(list.map(normalizeHostname).filter(Boolean))]
}

function languages(raw: string[] | undefined, where: string): UiLanguage[] | undefined {
  if (!raw) return undefined
  const ok = raw.filter(isUiLanguage)
  if (ok.length !== raw.length) {
    const invalid = raw.filter(l => !isUiLanguage(l))
    throw new TenantValidationError(
      "tenant.unknownLanguage",
      `Neznámy jazyk v ${where}: ${invalid.join(", ")} (povolené: ${UI_LANGUAGES.join(", ")}).`,
      { where, invalid: invalid.join(", "), allowed: UI_LANGUAGES.join(", ") },
    )
  }
  return ok as UiLanguage[]
}

/** Prevedie zmenu na `$set`. Nevyplnené polia sa **nemenia**, nemažú. */
function toSet(change: TenantChange): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (change.hostnames) set.hostnames = change.hostnames
  if (change.displayName !== undefined) set["branding.displayName"] = change.displayName.trim()
  if (change.shortName !== undefined) set["branding.shortName"] = change.shortName.trim()
  if (change.logoUrl !== undefined) set["branding.logoUrl"] = change.logoUrl.trim()
  if (change.accentColor !== undefined) set["branding.accentColor"] = change.accentColor.trim()
  if (change.supportEmail !== undefined) {
    set["branding.supportEmail"] = change.supportEmail.trim().toLowerCase()
  }
  const js = languages(change.languages, "zozname jazykov")
  if (js?.length) set.languages = js
  const dj = languages(change.defaultLanguage ? [change.defaultLanguage] : undefined, "predvolenom jazyku")
  if (dj?.length) set.defaultLanguage = dj[0]
  if (change.status) set.status = change.status
  // Prepisuje sa celé, aj prázdnym: na rozdiel od tajomstva je vidieť, čo
  // v ňom je, takže prázdny zoznam je vedomé „nikoho nezakladať".
  if (change.autoProvisionDomains !== undefined) {
    set.autoProvisionDomains = normalizeDomains(change.autoProvisionDomains)
  }
  if (change.chunking !== undefined) {
    // Čísla sa držia v rozumnom rozsahu tu, nie v chunkeri: chunker dostane
    // hodnotu a poslúchne ju, aj keby bola nezmyselná. Úsek na 20 tokenov
    // znamená tisíce úryvkov bez významu, na 5000 zas jeden úsek na celý
    // dokument — v oboch prípadoch vyhľadávanie prestane fungovať a nikto to
    // nespojí s číslom v nastavení.
    const c = change.chunking
    const between = (v: number | undefined, min: number, max: number, previous: number) =>
      v === undefined || Number.isNaN(v) ? previous : Math.min(Math.max(Math.round(v), min), max)
    // Pole sa volá `chunking`, nie `chunkovanie`: po migrácii na anglické
    // názvy sa zapisovalo do starého poľa, ktoré už nikto nečítal, takže
    // uloženie profilu nemalo žiadny účinok.
    set.chunking = {
      articleWord: (c.articleWord ?? DEFAULT_CHUNKING.articleWord).trim() || DEFAULT_CHUNKING.articleWord,
      annexWord: (c.annexWord ?? DEFAULT_CHUNKING.annexWord).trim() || DEFAULT_CHUNKING.annexWord,
      headerRepeats: between(c.headerRepeats, 2, 50, DEFAULT_CHUNKING.headerRepeats),
      minTokens: between(c.minTokens, 50, 2000, DEFAULT_CHUNKING.minTokens),
      maxTokens: between(c.maxTokens, 100, 4000, DEFAULT_CHUNKING.maxTokens),
    }
  }
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
  const code = normalizeCompanyCode(companyCode)
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)

  const existing = await col.findOne({ companyCode: code })
  if (!existing) throw new TenantValidationError("tenant.notFound", `Organizácia ${code} neexistuje.`, { code })

  if (change.hostnames) {
    if (!change.hostnames.length) {
      throw new TenantValidationError(
        "tenant.needsDomain",
        "Bez domény sa portál organizácie nikde neukáže. Nechaj aspoň jednu.",
      )
    }
    await assertHostnamesFree(code, change.hostnames)
  }

  const set = toSet(change)
  set.updatedBy = actor

  // Bodkové cesty (`branding.displayName`) sa v typoch ovládača vyjadriť
  // nedajú, preto jedno pretypovanie tu a nikde inde.
  await col.updateOne({ companyCode: code }, { $set: set } as never)

  // Rozdiel sa počíta z bodkových ciest (`branding.displayName`), takže
  // pôvodné hodnoty sa čítajú tou istou cestou — inak by v zázname bolo
  // „z: undefined" pri každej zmene značky.
  const value = (o: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o)
  const beforeChange: Record<string, unknown> = {}
  const afterChange: Record<string, unknown> = {}
  for (const k of Object.keys(set)) {
    if (k === "updatedBy" || k === "updatedAt") continue
    beforeChange[k] = value(existing, k)
    afterChange[k] = set[k]
  }
  await writeAudit({
    companyCode: code, subject: "organisation", action: "changed", actor: actor,
    targetId: code, targetLabel: existing.branding?.displayName ?? code,
    changes: diff(beforeChange, afterChange),
  })

  // Bez tohto by sa zmena prejavila až o päť minút (pamäť v `tenants.ts`)
  // a vyzeralo by to, že sa neuložila.
  invalidateTenants()

  const after = await col.findOne({ companyCode: code })
  return normalizeTenant(after!)
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
  const code = normalizeCompanyCode(companyCode)
  if (!change.displayName?.trim()) {
    throw new TenantValidationError("tenant.nameRequired", "Názov organizácie je povinný — je to to, čo ľudia uvidia v hlavičke.")
  }

  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  if (await col.findOne({ companyCode: code })) {
    throw new TenantValidationError("tenant.alreadyExists", `Organizácia ${code} už existuje.`, { code })
  }

  const hostnames = change.hostnames ?? []
  await assertHostnamesFree(code, hostnames)

  const now = new Date()
  const set = toSet(change)
  await col.insertOne({
    companyCode: code,
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
  const after = await col.findOne({ companyCode: code })
  return normalizeTenant(after!)
}

/** Všetky organizácie, zoradené. Len pre správu — bežná cesta ide cez hostiteľa. */
export async function allTenants(): Promise<Tenant[]> {
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  const raw = await col.find({}).sort({ companyCode: 1 }).toArray()
  return raw.map(normalizeTenant)
}

// ── prihlasovacie údaje poskytovateľov (D43) ─────────────────────────────────

/**
 * Uloží prístupové údaje k aplikácii zákazníka.
 *
 * **Prázdne tajomstvo znamená „nemeň", nie „zmaž".** Obrazovka hodnotu nikdy
 * neukazuje, takže pole je pri každom otvorení prázdne — a keby prázdna
 * hodnota mazala, stačilo by uložiť zmenu `clientId` a prihlásenie by
 * prestalo fungovať bez toho, aby to ktokoľvek chcel. Na odstránenie je
 * `zmazOAuth()`.
 */
export async function saveOAuth(
  companyCode: string,
  provider: OAuthProviderName,
  input: {
    clientId?: string
    /** Čitateľné tajomstvo. Zašifruje sa tu a von sa už nikdy nevráti. */
    clientSecret?: string
    tenantMode?: string
    allowedTenantIds?: string[]
    hostedDomain?: string
  },
  actor: string,
): Promise<void> {
  const code = normalizeCompanyCode(companyCode)
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  const existing = await col.findOne({ companyCode: code })
  if (!existing) throw new TenantValidationError("tenant.notFound", `Organizácia ${code} neexistuje.`, { code })

  const set: Record<string, unknown> = {}
  const path = `oauth.${provider}`

  const clientId = input.clientId?.trim()
  if (clientId) set[`${path}.clientId`] = clientId

  const secret = input.clientSecret?.trim()
  if (secret) {
    if (!encryptionAvailable()) {
      throw new TenantValidationError(
        "tenant.noEncryptionKey",
        "Tajomstvo sa nedá uložiť: chýba OAUTH_SECRET_ENCRYPTION_KEY. " +
        "Ukladať ho čitateľne nebudeme — je to prístup do cudzieho systému."
      )
    }
    set[`${path}.clientSecretEnc`] = encrypt(secret)
  }

  if (provider === "microsoft") {
    if (input.tenantMode !== undefined) {
      set[`${path}.tenantMode`] = input.tenantMode.trim() || "organizations"
    }
    // Zoznam sa **prepisuje celý**, aj prázdnym. Na rozdiel od tajomstva je
    // vidieť, čo v ňom je, takže prázdne pole znamená „žiadne obmedzenie"
    // a je to vedomé rozhodnutie, nie prehliadnutie.
    if (input.allowedTenantIds !== undefined) {
      set[`${path}.allowedTenantIds`] = input.allowedTenantIds
    }
  }
  if (provider === "google" && input.hostedDomain !== undefined) {
    set[`${path}.hostedDomain`] = input.hostedDomain.trim().toLowerCase() || undefined
  }

  if (Object.keys(set).length === 0) return

  // Bez `clientId` je tajomstvo na nič a naopak — kontroluje sa až tu, aby
  // sa dala doplniť polovica k tomu, čo už uložené je.
  const idPath = clientId ?? existing.oauth?.[provider]?.clientId
  const secretPath = secret ? true : Boolean(existing.oauth?.[provider]?.clientSecretEnc)
  if (!idPath || !secretPath) {
    throw new TenantValidationError(
      "tenant.needsBothCredentials",
      "Treba aj `clientId`, aj tajomstvo — jedno bez druhého sa nedá použiť."
    )
  }

  set[`${path}.updatedAt`] = new Date()
  set[`${path}.updatedBy`] = actor
  set.updatedBy = actor
  set.updatedAt = new Date()

  await col.updateOne({ companyCode: code }, { $set: set } as never)
  // Tajomstvo sa do auditu nezapisuje — len to, že sa zmenilo. Audit, ktorý
  // zbiera heslá, je sám o sebe únik, a to s dlhšou retenciou než to, čo
  // chráni (D51).
  await writeAudit({
    companyCode: code, subject: "signin-settings", action: "changed", actor: actor,
    targetId: provider, targetLabel: provider,
    changes: {
      ...(clientId ? { clientId: { from: existing.oauth?.[provider]?.clientId ?? null, to: clientId } } : {}),
      ...(secret ? { clientSecret: { to: "(zmenené)" } } : {}),
    },
  })
  invalidateTenants()
}

/** Odstráni údaje poskytovateľa. Tlačidlo prihlásenia tým zmizne. */
export async function deleteOAuth(
  companyCode: string,
  provider: OAuthProviderName,
  actor: string,
): Promise<void> {
  const code = normalizeCompanyCode(companyCode)
  const col = await getCollection<TenantDoc>(TENANTS_COLLECTION)
  await col.updateOne(
    { companyCode: code },
    { $unset: { [`oauth.${provider}`]: "" }, $set: { updatedBy: actor, updatedAt: new Date() } } as never,
  )
  await writeAudit({
    companyCode: code, subject: "signin-settings", action: "deleted", actor: actor,
    targetId: provider, targetLabel: provider,
  })
  invalidateTenants()
}
