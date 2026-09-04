/**
 * tenants.ts — kto je za touto adresou (D29).
 *
 * `intranet.futbalsfz.sk` a `app.contineo.app` vedú na to isté nasadenie,
 * ale na iného tenanta: iný `companyCode`, iný vzhľad, iný rozsah obsahu.
 * Rozlíšenie musí prísť z hostiteľa, lebo v tej chvíli ešte nie je koho sa
 * spýtať — človek nie je prihlásený a prihlasovacia stránka už musí vedieť,
 * čí je.
 *
 * **Neznámy hostiteľ je zakázaný, nie predvolený** (ADR-002, ADR-003 kap. 5.4).
 * Predvolený tenant by znamenal, že ktokoľvek, kto si nasmeruje vlastnú doménu
 * na naše nasadenie, dostane rozhranie niekoho iného — a bude vyzerať
 * legitímne, lebo certifikát aj obsah sedia.
 *
 * Prečo samostatný modul a nie rozšírenie `tenantProfile.ts`: ten odpovedá na
 * otázku „ktorý model a kde počíta" (ADR-001), tento na otázku „ktorá
 * organizácia". Sú to dve rôzne veci s rôznou životnosťou a rôznym vlastníkom;
 * keby boli v jednom zázname, neznámy hostiteľ by si so sebou priniesol aj
 * nastavenie poskytovateľov a chyba v jednom by tíško menila to druhé.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { normalizeLanguage, UI_LANGUAGES } from "./i18n"
import type { UiLanguage } from "./i18n"
import type { Person } from "./persons"
import type { TenantOAuth } from "./oauth"
import type { ChunkingProfile } from "./chunkingProfile"

export const TENANTS_COLLECTION = "tenants"

/** Ako sa organizácia volá a vyzerá. Text, nie prístupové pravidlo. */
export interface TenantBranding {
  /** Celý názov v hlavičke a v e-mailoch: „Slovenský futbalový zväz". */
  displayName: string
  /** Krátky tvar do úzkych miest: „SFZ". */
  shortName?: string
  /** Absolútna alebo relatívna cesta k logu. Prázdne = bez loga. */
  logoUrl?: string
  /** Doplnková farba rozhrania, formát CSS. */
  accentColor?: string
  /** Kam sa má človek obrátiť, keď mu niečo nesedí. */
  supportEmail?: string
}

export interface Tenant {
  _id?: ObjectId
  companyCode: string
  /**
   * Hostitelia, ktorí vedú na tohto tenanta — vždy malými písmenami, bez
   * portu. Zoznam, nie jeden reťazec: prechod na novú doménu prebieha tak,
   * že chvíľu platia obe, a nikto by kvôli tomu nemal prísť o prístup.
   */
  hostnames: string[]
  branding: TenantBranding
  /** Jazyk pre človeka, ktorý ešte nie je prihlásený (`persons.language` neexistuje). */
  defaultLanguage: UiLanguage
  /** Jazyky, ktoré má tenant zapnuté. Podmnožina `UI_LANGUAGES`. */
  languages: UiLanguage[]
  /**
   * `disabled` = tenant existuje, ale nesmie dnu. Odlíšené od zmazania
   * zámerne: záznamy potvrdení musia prežiť koniec spolupráce (retencia),
   * takže tenant sa nemaže.
   */
  status: "active" | "disabled"

  /**
   * Prihlasovacie údaje k **vlastnej** aplikácii zákazníka (D43).
   *
   * Nie sú to naše údaje — je to prístup do cudzieho systému, ktorý nám niekto
   * zveril. Tajomstvo je preto zašifrované (`lib/tajomstva.ts`) a von sa
   * nevracia; obrazovka ukazuje len „nastavené / nenastavené".
   *
   * Chýbajúci záznam neznamená chybu, len že tenant tento spôsob prihlásenia
   * nemá zapnutý a tlačidlo sa neponúkne.
   */
  oauth?: TenantOAuth

  /**
   * Vlastné položky číselníkov, ktoré si organizácia dopísala (D55).
   *
   * **Dopĺňajú globálne, neprepisujú ich.** V globálnych sú hodnoty, ktorými
   * je už otagovaný existujúci obsah; ich zmiznutie z ponuky by z nich
   * spravilo neplatné údaje na dokumentoch, ktoré nikto nemenil.
   *
   * Len číselníky, ktoré popisujú obsah zákazníka (`category`, `tags`).
   * `scope`, `accessLevel` a `language` zostávajú globálne a uzavreté — sú to
   * filtre, na ktorých stojí prístup, a vlastná hodnota v nich by bola niečo,
   * čomu nikde inde v systéme nikto nerozumie.
   */
  codelists?: Partial<Record<string, { key: string; label?: string }[]>>

  /**
   * Profil členenia dokumentov na úseky (D58).
   *
   * Jeden algoritmus, parametre navonok. Vlastný chunker per zákazník by
   * znamenal N kópií jedného pravidla — a chyba v jednej by sa neprejavila
   * pádom, ale tým, že model odcituje nesprávny článok u jedného zákazníka
   * o pol roka.
   *
   * Chýbajúci profil znamená predvolený, nie „nič" — a predvolený reže presne
   * tak, ako sa rezalo doteraz (overené na deviatich normách).
   */
  chunking?: Partial<ChunkingProfile>

  /**
   * Domény, z ktorých sa človek **založí sám** pri prvom prihlásení
   * pracovným kontom (D47). Napríklad `futbalsfz.sk`, `sfzmarketing.sk`.
   *
   * Bez toho musí každého niekto pozvať ručne — pri organizácii, ktorá má
   * vlastný Entra adresár, je to práca navyše za nič: kto je v ňom, ten do
   * organizácie patrí a už to raz niekto rozhodol.
   *
   * **Platí len pre prihlásenie kontom, nie pre odkaz v e-maile.** Konto
   * z Entra adresára zákazníka je dôkaz príslušnosti (overuje sa `tid`);
   * napísaná adresa nie je nič — a zoznam osôb by sa zaplnil preklepmi
   * a skúšaním.
   */
  autoProvisionDomains?: string[]

  createdAt?: Date
  updatedAt?: Date
}

/** Hostiteľ, ku ktorému neexistuje aktívny tenant. */
export class UnknownHostError extends Error {
  // Priradenie v tele, nie parametrová vlastnosť: tú Node pri spúšťaní
  // skriptov cez `--import ts-hook` odstrániť nevie
  // (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), a tento modul dnes načítava aj
  // `scripts/tenant_set.mjs`.
  readonly hostname: string

  constructor(hostname: string) {
    super(`Neznámy hostiteľ: ${hostname || "(prázdny)"}`)
    this.name = "UnknownHostError"
    this.hostname = hostname
  }
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Kladné aj záporné výsledky. Bez záporných by stačilo v slučke volať
// vymyslené hostiteľské mená a každý dotaz by šiel do databázy; TTL je
// kratšie, aby novo pridaná doména nečakala päť minút.

const HIT_TTL_MS = 5 * 60 * 1000
const MISS_TTL_MS = 30 * 1000

interface CacheEntry { tenant: Tenant | null; expiresAt: number }
const cache = new Map<string, CacheEntry>()

/** Zahodí cache — po pridaní domény alebo zmene vzhľadu. */
export function invalidateTenants(hostname?: string): void {
  if (hostname) cache.delete(normalizeHostname(hostname))
  else cache.clear()
}

// ── Hostiteľ ─────────────────────────────────────────────────────────────────

/**
 * Zjednotí tvar hostiteľa: malé písmená, bez portu, bez koncovej bodky,
 * bez hranatých zátvoriek okolo IPv6.
 *
 * `www.` sa **neodstraňuje**. `www.x` a `x` sú dve rôzne mená a keď majú
 * viesť na to isté, patria obe do `hostnames` — tiché zlučovanie by
 * znamenalo, že zoznam v databáze neopisuje skutočnosť.
 */
export function normalizeHostname(raw: string | null | undefined): string {
  if (!raw) return ""
  let h = raw.trim().toLowerCase()
  // Viac hodnôt v `x-forwarded-host` (reťaz proxy) — platí prvá.
  if (h.includes(",")) h = h.split(",")[0].trim()
  if (h.startsWith("[")) {
    const end = h.indexOf("]")
    if (end > 0) return h.slice(1, end)
  }
  const colon = h.lastIndexOf(":")
  // Dvojbodka je oddeľovač portu len vtedy, keď za ňou je číslo. V IPv6
  // adrese bez zátvoriek je dvojbodiek viac a port to nie je.
  if (colon > 0 && /^\d+$/.test(h.slice(colon + 1)) && h.indexOf(":") === colon) {
    h = h.slice(0, colon)
  }
  if (h.endsWith(".")) h = h.slice(0, -1)
  return h
}

/**
 * Nájde tenanta podľa hostiteľa. `null` = neznámy alebo vypnutý.
 *
 * Výpadok databázy **neotvára** prístup: chyba sa vyhodí a volajúci ju musí
 * riešiť. Vrátiť pri chybe `null` by síce vyzeralo bezpečne (nikto sa
 * nedostane dnu), ale nedalo by sa to odlíšiť od neznámej domény a portál by
 * pri výpadku tvrdil ľuďom, že ich organizácia neexistuje.
 */
export async function resolveTenant(rawHost: string | null | undefined): Promise<Tenant | null> {
  const hostname = normalizeHostname(rawHost)
  if (!hostname) return null

  const hit = cache.get(hostname)
  if (hit && hit.expiresAt > Date.now()) return hit.tenant

  const col = await getCollection<Tenant>(TENANTS_COLLECTION)
  const doc = await col.findOne({ hostnames: hostname, status: "active" })
  const tenant = doc ? normalizeTenant(doc) : null

  cache.set(hostname, {
    tenant,
    expiresAt: Date.now() + (tenant ? HIT_TTL_MS : MISS_TTL_MS),
  })
  return tenant
}

/** Ako `resolveTenant`, ale neznámy hostiteľ je chyba. */
export async function requireTenant(rawHost: string | null | undefined): Promise<Tenant> {
  const tenant = await resolveTenant(rawHost)
  if (!tenant) throw new UnknownHostError(normalizeHostname(rawHost))
  return tenant
}

/**
 * Doplní, čo v zázname chýba, a zahodí nezmysly. Záznam v databáze zakladá
 * človek skriptom a preklep v jazyku nemá zhodiť celý portál.
 */
export function normalizeTenant(doc: Tenant): Tenant {
  const languages = (Array.isArray(doc.languages) ? doc.languages : [])
    .filter(l => (UI_LANGUAGES as readonly string[]).includes(l as string)) as UiLanguage[]
  const defaultLanguage = normalizeLanguage(doc.defaultLanguage)
  return {
    ...doc,
    languages: languages.length ? languages : [defaultLanguage],
    defaultLanguage,
    branding: {
      displayName: doc.branding?.displayName?.trim() || doc.companyCode,
      shortName: doc.branding?.shortName?.trim() || undefined,
      logoUrl: doc.branding?.logoUrl || undefined,
      accentColor: doc.branding?.accentColor || undefined,
      supportEmail: doc.branding?.supportEmail?.toLowerCase() || undefined,
    },
  }
}

/**
 * Vzhľad tenanta ako obyčajné reťazce.
 *
 * `Tenant` nesie `ObjectId` a `Date`; ani jedno sa neprenesie cez hranicu do
 * klientskeho komponentu. Preto sa vzhľad odovzdáva takto zúžený — chyba je
 * tak vylúčená typom, nie objavená až za behu.
 */
export function brandingView(tenant: Tenant): {
  displayName: string
  shortName?: string
  logoUrl?: string
  accentColor?: string
} {
  return {
    displayName: tenant.branding.displayName,
    shortName: tenant.branding.shortName,
    logoUrl: tenant.branding.logoUrl,
    accentColor: tenant.branding.accentColor,
  }
}

/**
 * Patrí osoba k tomuto tenantovi?
 *
 * Prihlásenie samo osebe nestačí: rovnaká relácia by inak fungovala na
 * ktorejkoľvek doméne nasadenia a človek zo SFZ by sa cez cudziu doménu
 * dostal do rozhrania inej organizácie so **svojím** obsahom. Vidieť by
 * cudzí obsah nezačal (o tom rozhoduje D32), ale portál by tvrdil niečo,
 * čo nie je pravda, a auditný záznam by vznikol pod cudzou hlavičkou.
 */
export function personBelongsToTenant(person: Person, tenant: Tenant): boolean {
  return person.companyCode === tenant.companyCode
}
