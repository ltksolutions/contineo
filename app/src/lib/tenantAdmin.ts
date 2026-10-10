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
import { withoutCollision } from "./slug"
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
import { formatAddress, normalizePostalCode } from "./address"

/** Časti sídla v `controller` (10. 10. 2026). */
const ADDRESS_PART_KEYS = ["street", "streetNumber", "postalCode", "city"] as const
import { encrypt, encryptionAvailable } from "./secrets"
import type { OAuthProviderName } from "./oauth"
import { DEFAULT_CHUNKING, type ChunkingProfile, type ChunkingProfileDef } from "./chunkingProfile"
import { retentionSettings, type RetentionSettings } from "./retention"
import { AppError } from "./appError"
import { KEY_PATTERN } from "./codelists"

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
  /** Medzinárodná predvoľba pre čísla bez nej (D86). Prázdne = späť na `+421`. */
  phonePrefix?: string
  /** Prevádzkovateľ pre informovanie (C1). Prázdne pole sa zapíše prázdne. */
  controllerLegalName?: string
  /** Sídlo po častiach. Uloženie ktorejkoľvek časti zmaže starý riadok `controller.address`. */
  controllerStreet?: string
  controllerStreetNumber?: string
  controllerPostalCode?: string
  controllerCity?: string
  controllerRegistrationNumber?: string
  /** Krajina sídla prevádzkovateľa (ADR-022). */
  controllerCountry?: string
  /** DIČ a IČ DPH (ADR-031). Prázdne pole sa zapíše prázdne. */
  controllerTaxId?: string
  controllerVatId?: string
  /** Kontakt na dokumentoch (ADR-031). Prázdne pole sa zapíše prázdne. */
  contactWeb?: string
  contactEmail?: string
  contactPhone?: string
  chunking?: Partial<ChunkingProfile>
  /** Pomenované profily členenia (D79). */
  chunkingProfiles?: ChunkingProfileDef[]
  /** Modul Vzdelávanie (ADR-018). `undefined` = nemeniť. */
  learning?: boolean
  /** Po koľkých dňoch je nepotvrdené „meškajúce" (3. 10. 2026). */
  overdueDays?: number
  /** Lehoty uchovávania organizácie (ADR-022, D136) — len DPO. */
  privacyRetention?: Partial<RetentionSettings>
  /** Doplnkový text DPO na `/privacy` (D137). Prázdny reťazec = zmazať. */
  privacyExtra?: Partial<Record<UiLanguage, string>>
  /** Kontakt pre ochranu osobných údajov (D153). Prázdne pole sa zapíše prázdne. */
  privacyContactName?: string
  privacyContactEmail?: string
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
  /*
    Predvoľba telefónu (D86).

    Uloží sa len tvar `+` a číslice — hodnota sa lepí pred zvyšok čísla, takže
    medzera alebo písmeno v nej by vyrobili neplatné číslo pri každej osobe,
    a prejavilo by sa to až vtedy, keď by niekomu niekto skúsil zavolať.

    Prázdne pole sa **zapíše prázdne** a `normalizePhone()` potom padne na
    `+421`. Nie je to „nemeniť": organizácia musí vedieť predvoľbu zrušiť.
  */
  if (change.phonePrefix !== undefined) {
    const prefix = change.phonePrefix.trim().replace(/[\s.\-/()]/g, "")
    if (prefix && !/^\+[1-9]\d{0,3}$/.test(prefix)) {
      throw new TenantValidationError(
        "tenant.phonePrefixShape",
        `Predvoľba „${prefix}" nemá správny tvar — očakáva sa napríklad +421.`,
        { value: prefix },
      )
    }
    set.phonePrefix = prefix
  }
  /*
    Prevádzkovateľ (C1). Prázdne sa zapíše prázdne — organizácia musí vedieť
    údaj zmazať. IČO sa ukladá tak, ako ho človek napísal („00 687 308"),
    overujú sa len číslice: 6 až 12, aby sa zmestili aj zahraničné registre
    a neprešiel preklep typu telefónneho čísla.
  */
  if (change.controllerLegalName !== undefined) set["controller.legalName"] = change.controllerLegalName.trim()
  /*
    Sídlo po častiach (10. 10. 2026). Riadok sa skladá (`formatAddress()`),
    preto sa starý `controller.address` pri uložení častí zmaže — dve pravdy
    o tej istej adrese by sa raz rozišli. PSČ sa ukladá v tvare „821 01".
  */
  const addressChanged = [change.controllerStreet, change.controllerStreetNumber, change.controllerPostalCode, change.controllerCity]
    .some(v => v !== undefined)
  if (addressChanged) {
    const tidy = (v: string | undefined) => (v ?? "").trim().replace(/\s+/g, " ")
    if (change.controllerStreet !== undefined) set["controller.street"] = tidy(change.controllerStreet)
    if (change.controllerStreetNumber !== undefined) set["controller.streetNumber"] = tidy(change.controllerStreetNumber)
    if (change.controllerCity !== undefined) set["controller.city"] = tidy(change.controllerCity)
    if (change.controllerPostalCode !== undefined) {
      const raw = tidy(change.controllerPostalCode)
      const psc = raw ? normalizePostalCode(raw) : ""
      if (psc === null) {
        throw new TenantValidationError("tenant.postalCodeShape", `PSČ „${raw}" nemá správny tvar — očakáva sa 5 číslic, napr. 821 01.`, { value: raw })
      }
      set["controller.postalCode"] = psc
    }
  }
  if (change.controllerRegistrationNumber !== undefined) {
    const reg = change.controllerRegistrationNumber.trim().replace(/\s+/g, " ")
    const digits = reg.replace(/\s/g, "")
    if (reg && !/^\d{6,12}$/.test(digits)) {
      throw new TenantValidationError(
        "tenant.registrationNumberShape",
        `IČO „${reg}" nemá správny tvar — očakáva sa 6 až 12 číslic.`,
        { value: reg },
      )
    }
    set["controller.registrationNumber"] = reg
  }
  /*
    DIČ a IČ DPH (ADR-031). Ukladajú sa tak, ako ich človek napísal, overuje
    sa len tvar: DIČ 8 až 12 číslic (slovenské má 10, české 8 až 10), IČ DPH
    kód krajiny a 8 až 12 znakov. Na faktúre by preklep znamenal neplatný
    doklad — a prejavil by sa až u odberateľa.
  */
  if (change.controllerTaxId !== undefined) {
    const v = change.controllerTaxId.trim().replace(/\s+/g, "")
    if (v && !/^\d{8,12}$/.test(v)) {
      throw new TenantValidationError("tenant.taxIdShape", `DIČ „${v}" nemá správny tvar — očakáva sa 8 až 12 číslic.`, { value: v })
    }
    set["controller.taxId"] = v
  }
  if (change.controllerVatId !== undefined) {
    const v = change.controllerVatId.trim().replace(/\s+/g, "").toUpperCase()
    if (v && !/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(v)) {
      throw new TenantValidationError("tenant.vatIdShape", `IČ DPH „${v}" nemá správny tvar — očakáva sa kód krajiny a číslice.`, { value: v })
    }
    set["controller.vatId"] = v
  }
  /*
    Kontakt na dokumentoch (ADR-031). Web sa ukladá bez `https://` a bez
    lomky na konci — v päte sa číta ako „www.futbalsfz.sk", nie ako odkaz.
  */
  if (change.contactWeb !== undefined) {
    const v = change.contactWeb.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase()
    if (v && !/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(v)) {
      throw new TenantValidationError("tenant.contactWebShape", `„${v}" nie je adresa webu.`, { value: v })
    }
    set["contact.web"] = v
  }
  if (change.contactEmail !== undefined) {
    const v = change.contactEmail.trim().toLowerCase()
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      throw new TenantValidationError("tenant.contactEmailShape", `Adresa „${v}" nemá tvar e-mailovej adresy.`, { value: v })
    }
    set["contact.email"] = v
  }
  if (change.contactPhone !== undefined) {
    const v = change.contactPhone.trim().replace(/\s+/g, " ")
    if (v && !/^\+?[0-9][0-9 ]{5,19}$/.test(v)) {
      throw new TenantValidationError("tenant.contactPhoneShape", `Telefón „${v}" nemá správny tvar.`, { value: v })
    }
    set["contact.phone"] = v
  }
  if (change.privacyRetention !== undefined) set["privacy.retention"] = retentionSettings(change.privacyRetention)
  // Kontakt GDPR (D153). Adresa sa overuje len tvarom — preklep by poslal
  // námietky do prázdna a na `/privacy` by stál nefunkčný odkaz.
  if (change.privacyContactName !== undefined) set["privacy.contact.name"] = change.privacyContactName.trim().replace(/\s+/g, " ")
  if (change.privacyContactEmail !== undefined) {
    const email = change.privacyContactEmail.trim().toLowerCase()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new TenantValidationError(
        "tenant.privacyContactEmailShape",
        `Adresa „${email}" nemá tvar e-mailovej adresy.`,
        { value: email },
      )
    }
    set["privacy.contact.email"] = email
  }
  if (change.privacyExtra !== undefined) {
    for (const [lang, text] of Object.entries(change.privacyExtra)) {
      if (!(UI_LANGUAGES as readonly string[]).includes(lang)) continue
      set[`privacy.extra.${lang}`] = (text ?? "").trim().slice(0, 4000)
    }
  }
  if (change.controllerCountry !== undefined) {
    // Len krajiny, pre ktoré máme úrad a zákony v texte; iná by na stránke
    // Ochrana osobných údajov uviedla cudzí úrad.
    set["controller.country"] = change.controllerCountry === "CZ" ? "CZ" : "SK"
  }
  if (change.chunking !== undefined) {
    // Pole sa volá `chunking`, nie `chunkovanie`: po migrácii na anglické
    // názvy sa zapisovalo do starého poľa, ktoré už nikto nečítal, takže
    // uloženie profilu nemalo žiadny účinok.
    set.chunking = clampChunking(change.chunking)
  }
  if (change.chunkingProfiles !== undefined) {
    // Prepisuje sa celý zoznam. Kľúč je identita — normalizuje sa, ale
    // nedopĺňa: profil bez kľúča by dokumenty nenašli a zoznam by potichu
    // stratil ich členenie.
    set.chunkingProfiles = change.chunkingProfiles.map(p => {
      const key = String(p.key ?? "").trim().toLowerCase()
      if (!KEY_PATTERN.test(key)) {
        throw new TenantValidationError(
          "tenant.profileKeyShape",
          `Kľúč profilu členenia „${key}" nemá správny tvar.`,
          { key },
        )
      }
      return { key, label: String(p.label ?? "").trim() || key, ...clampChunking(p) }
    })
  }
  // Bodková cesta, aby zapnutie jedného modulu nezmazalo ostatné.
  if (change.learning !== undefined) set["modules.learning"] = change.learning
  if (change.overdueDays !== undefined) {
    const n = change.overdueDays
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      throw new TenantValidationError("tenant.overdueDaysRange", "Počet dní musí byť od 1 do 365.")
    }
    set["acknowledgement.overdueDays"] = Math.floor(n)
  }
  return set
}

/**
 * Udrží čísla profilu v rozumnom rozsahu.
 *
 * **Tu, nie v chunkeri.** Chunker hodnotu dostane a poslúchne ju, aj keby bola
 * nezmyselná. Úsek na 20 tokenov znamená tisíce úryvkov bez významu, na 5000
 * zas jeden úsek na celý dokument — v oboch prípadoch vyhľadávanie prestane
 * fungovať a nikto to nespojí s číslom v nastavení.
 */
export function clampChunking(c: Partial<ChunkingProfile>): ChunkingProfile {
  const between = (v: number | undefined, min: number, max: number, previous: number) =>
    v === undefined || Number.isNaN(v) ? previous : Math.min(Math.max(Math.round(v), min), max)
  return {
    articleWord: (c.articleWord ?? DEFAULT_CHUNKING.articleWord).trim() || DEFAULT_CHUNKING.articleWord,
    annexWord: (c.annexWord ?? DEFAULT_CHUNKING.annexWord).trim() || DEFAULT_CHUNKING.annexWord,
    headerRepeats: between(c.headerRepeats, 2, 50, DEFAULT_CHUNKING.headerRepeats),
    minTokens: between(c.minTokens, 50, 2000, DEFAULT_CHUNKING.minTokens),
    maxTokens: between(c.maxTokens, 100, 4000, DEFAULT_CHUNKING.maxTokens),
  }
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

  // Verzia textu Ochrany osobných údajov (ADR-022, D138): zmena čohokoľvek,
  // čo sa na `/privacy` ukazuje (prevádzkovateľ, krajina, lehoty, doplnok),
  // posunie jej dátum — z dátumu sa dá vyčítať, kedy sa zmenilo, čo človek čítal.
  const current = (path: string): unknown =>
    path.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], existing)
  // Sídlo sa porovnáva zložené: rozdelenie toho istého riadku na časti
  // (migrácia, prvé uloženie) nie je zmena textu, ktorý človek čítal.
  const addressKeys = new Set(ADDRESS_PART_KEYS.map(k => `controller.${k}`))
  const addressTouched = Object.keys(set).some(k => addressKeys.has(k))
  const addressBefore = existing.controller ?? {}
  const addressAfter = { ...addressBefore, ...Object.fromEntries(ADDRESS_PART_KEYS.map(k => [k, set[`controller.${k}`] ?? addressBefore[k]])) }
  const privacyChanged = Object.keys(set).some(k =>
    (k.startsWith("controller.") || k.startsWith("privacy.")) && !addressKeys.has(k)
    && JSON.stringify(current(k) ?? "") !== JSON.stringify(set[k] ?? ""))
    || (addressTouched && formatAddress(addressBefore) !== formatAddress({ ...addressAfter, address: undefined }))
  if (privacyChanged) {
    set["privacy.updatedAt"] = new Date()
    set["privacy.updatedBy"] = actor
  }

  // Bodkové cesty (`branding.displayName`) sa v typoch ovládača vyjadriť
  // nedajú, preto jedno pretypovanie tu a nikde inde.
  // Starý jednoriadkový `controller.address` po uložení častí zmizne — riadok
  // sa odteraz skladá (D27).
  await col.updateOne(
    { companyCode: code },
    (addressTouched ? { $set: set, $unset: { "controller.address": "" } } : { $set: set }) as never,
  )

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
    /*
      Hláška nesie **voľný variant**, nie len „obsadené" (ADMIN, úloha 1.4,
      rozhodnutie Jána 2026-09-22). Bez JavaScriptu je „kód je obsadený"
      slepá ulička: admin háda ďalší a skúša znova. Návrh počíta tá istá
      funkcia ako formulár (`withoutCollision`), takže obe strany dôjdu
      k rovnakému kódu.
    */
    const taken = (await col.find({}, { projection: { companyCode: 1 } }).toArray())
      .map(t => t.companyCode)
    const free = withoutCollision(code, taken)
    throw new TenantValidationError(
      "tenant.alreadyExists",
      `Organizácia ${code} už existuje. Voľný je ${free}.`,
      { code, free },
    )
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

/** Vstup jedného poskytovateľa z formulára (`saveOAuth`). */
export interface OAuthInput {
  clientId?: string
  clientSecret?: string
  tenantMode?: string
  allowedTenantIds?: string[]
  hostedDomain?: string
}

/**
 * Ktorých poskytovateľov má spoločné uloženie zapísať — a kontrola **pred**
 * prvým zápisom (ZAKLAD-lista-ulozenia Q6, 7. 10. 2026). Stránka s jednou
 * lištou ukladá oboch naraz; keď jeden neprejde, nezapíše sa nič, inak by
 * človek nevedel, čo z „Uložiť" platí.
 *
 * Poskytovateľ bez vlastného nastavenia, ktorého polia prišli prázdne, sa
 * preskočí — nikto ho nezakladal, len odoslal stránku s druhým.
 */
export async function plannedOAuth(
  companyCode: string,
  inputs: Partial<Record<OAuthProviderName, OAuthInput>>,
): Promise<OAuthProviderName[]> {
  const code = normalizeCompanyCode(companyCode)
  const existing = await (await getCollection<TenantDoc>(TENANTS_COLLECTION)).findOne({ companyCode: code })
  if (!existing) throw new TenantValidationError("tenant.notFound", `Organizácia ${code} neexistuje.`, { code })
  const out: OAuthProviderName[] = []
  for (const provider of Object.keys(inputs) as OAuthProviderName[]) {
    const input = inputs[provider]!
    const clientId = input.clientId?.trim()
    const secret = input.clientSecret?.trim()
    const stored = existing.oauth?.[provider]
    if (!clientId && !secret && !stored?.clientId) continue
    if (secret && !encryptionAvailable()) {
      throw new TenantValidationError(
        "tenant.noEncryptionKey",
        "Tajomstvo sa nedá uložiť: chýba OAUTH_SECRET_ENCRYPTION_KEY.",
      )
    }
    if (!(clientId || stored?.clientId) || !(secret || stored?.clientSecretEnc)) {
      throw new TenantValidationError(
        "tenant.needsBothCredentials",
        "Treba aj `clientId`, aj tajomstvo — jedno bez druhého sa nedá použiť.",
      )
    }
    out.push(provider)
  }
  return out
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
