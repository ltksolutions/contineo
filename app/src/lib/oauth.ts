/**
 * oauth.ts — čie prihlasovacie údaje sa použijú (D43).
 *
 * **Aplikácia patrí zákazníkovi, nie nám.** SFZ si zaregistruje vlastnú
 * aplikáciu v svojom Entre a pošle nám `clientId` a `clientSecret`. Dôvod nie
 * je technický: zväz, ktorý dá do systému vlastné predpisy, má vedieť sám
 * odvolať prístup a sám vidieť, kto sa prihlasoval — a nemá sa o to prosiť
 * dodávateľa. Jedna naša multi-tenant aplikácia by obe tie veci presunula
 * k nám.
 *
 * Poradie hľadania:
 *
 *   1. údaje tenanta (`tenants.oauth`) — bežný prípad,
 *   2. premenné prostredia — **len núdzový záložný zdroj** pre náš vlastný
 *      tenant a pre vývoj. V produkcii u zákazníka by znamenali, že sa
 *      prihlasuje cez našu aplikáciu bez toho, aby o tom vedel.
 *   3. nič — poskytovateľ sa neponúkne.
 *
 * **Tajomstvo sa nikdy nevracia von z tohto modulu inak než ako súčasť
 * konfigurácie poskytovateľa.** Na obrazovku ide `stavPoskytovatela()`, ktorý
 * hodnotu nepozná.
 */

import { decrypt, SecretError } from "./secrets"
import type { Tenant } from "./tenants"

export type OAuthProviderName = "microsoft" | "google"

export interface TenantOAuthProvider {
  clientId: string
  /** Zašifrované (`lib/tajomstva.ts`). Nikdy nie čitateľná hodnota. */
  clientSecretEnc: string
  updatedAt?: Date
  updatedBy?: string
}

export interface TenantOAuthMicrosoft extends TenantOAuthProvider {
  /**
   * Komu Entra dovolí prihlásiť sa do tejto aplikácie.
   * `organizations` (predvolené) = pracovné a školské kontá,
   * `common` = aj osobné, alebo konkrétne UUID jedného Entra tenanta.
   */
  tenantMode?: string
  /**
   * Entra tenant id (`tid`), ktoré sa smú prihlásiť. Prázdne = nekontroluje sa.
   *
   * Pri `tenantMode: "organizations"` je to **jediná zábrana** proti tomu, aby
   * sa dnu dostal človek z cudzej organizácie, ktorý má rovnakú adresu ako
   * niekto v `persons`.
   */
  allowedTenantIds?: string[]
}

export interface TenantOAuthGoogle extends TenantOAuthProvider {
  /** `hd` — doména Workspace, ktorej kontá sa smú prihlásiť. Prázdne = ktorákoľvek. */
  hostedDomain?: string
}

export interface TenantOAuth {
  microsoft?: TenantOAuthMicrosoft
  google?: TenantOAuthGoogle
}

export interface ResolvedCredentials {
  provider: OAuthProviderName
  clientId: string
  clientSecret: string
  /** `tenant` = vlastná aplikácia zákazníka, `platform` = naša núdzová. */
  source: "tenant" | "platform"
  /** Microsoft. */
  tenantMode: string
  allowedTenantIds: string[]
  /** Google. */
  hostedDomain?: string
}

/** Núdzový záložný zdroj z prostredia. Pre náš tenant a pre vývoj. */
function fromEnv(provider: OAuthProviderName): ResolvedCredentials | null {
  const clientId = provider === "microsoft"
    ? process.env.MICROSOFT_CLIENT_ID
    : process.env.GOOGLE_CLIENT_ID
  const clientSecret = provider === "microsoft"
    ? process.env.MICROSOFT_CLIENT_SECRET
    : process.env.GOOGLE_CLIENT_SECRET

  if (!clientId?.trim() || !clientSecret?.trim()) return null

  return {
    provider,
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    source: "platform",
    tenantMode: process.env.MICROSOFT_TENANT_MODE?.trim() || "organizations",
    allowedTenantIds: splitList(process.env.MICROSOFT_ALLOWED_TENANT_IDS),
    hostedDomain: process.env.GOOGLE_HOSTED_DOMAIN?.trim() || undefined,
  }
}

/** Zoznam oddelený čiarkou, bodkočiarkou alebo novým riadkom. */
export function splitList(s: string | undefined | null): string[] {
  return [...new Set((s ?? "").split(/[,;\n]/).map(x => x.trim().toLowerCase()).filter(Boolean))]
}

/**
 * Údaje pre poskytovateľa, alebo `null`, keď sa nemá ponúknuť.
 *
 * **Nečitateľné tajomstvo sa berie ako „nie je"** — a hlasno sa zapíše do
 * logu. Ponúknuť tlačidlo, ktoré po kliknutí skončí chybou od Microsoftu, je
 * horšie než ho neponúknuť: človek nemá ako zistiť, že chyba nie je jeho.
 */
export function resolveCredentials(
  tenant: Tenant | null,
  provider: OAuthProviderName,
): ResolvedCredentials | null {
  const stored = tenant?.oauth?.[provider]

  if (stored?.clientId && stored?.clientSecretEnc) {
    try {
      const clientSecret = decrypt(stored.clientSecretEnc)
      const ms = provider === "microsoft" ? (stored as TenantOAuthMicrosoft) : null
      const g = provider === "google" ? (stored as TenantOAuthGoogle) : null
      return {
        provider,
        clientId: stored.clientId.trim(),
        clientSecret,
        source: "tenant",
        tenantMode: ms?.tenantMode?.trim() || "organizations",
        allowedTenantIds: (ms?.allowedTenantIds ?? []).map(x => x.trim().toLowerCase()).filter(Boolean),
        hostedDomain: g?.hostedDomain?.trim().toLowerCase() || undefined,
      }
    } catch (e) {
      const why = e instanceof SecretError ? e.message : String(e)
      console.error(
        `[oauth] ${tenant?.companyCode}/${provider}: tajomstvo sa nedá prečítať — ${why}`
      )
      // Zámerne sa **nepadá na premenné prostredia**. Zákazník má nastavené
      // vlastné údaje; prihlásiť ho potichu cez našu aplikáciu by bola presne
      // tá zámena, ktorej sa celý tento model vyhýba.
      return null
    }
  }

  return fromEnv(provider)
}

/** Ktoré tlačidlá sa majú ukázať na prihlasovacej obrazovke. */
export function availableProviders(tenant: Tenant | null): OAuthProviderName[] {
  const out: OAuthProviderName[] = []
  for (const p of ["microsoft", "google"] as const) {
    if (resolveCredentials(tenant, p)) out.push(p)
  }
  return out
}

/**
 * Stav pre správcovskú obrazovku. **Hodnotu tajomstva nepozná.**
 *
 * `necitatelne` je samostatný stav zámerne: znamená, že sa zmenil šifrovací
 * kľúč, a to je úplne iná úloha než „doplň údaje" — treba ich zadať znova,
 * lebo pôvodné sa už prečítať nedajú.
 */
export function providerStatus(
  tenant: Tenant | null,
  provider: OAuthProviderName,
): {
  state: "nenastavene" | "nastavene" | "necitatelne" | "z-prostredia"
  clientId?: string
  zdroj: "tenant" | "platform" | "ziadny"
} {
  const stored = tenant?.oauth?.[provider]
  if (stored?.clientId && stored?.clientSecretEnc) {
    try {
      decrypt(stored.clientSecretEnc)
      return { state: "nastavene", clientId: stored.clientId, zdroj: "tenant" }
    } catch {
      return { state: "necitatelne", clientId: stored.clientId, zdroj: "tenant" }
    }
  }
  const z = fromEnv(provider)
  if (z) return { state: "z-prostredia", clientId: z.clientId, zdroj: "platform" }
  return { state: "nenastavene", zdroj: "ziadny" }
}

/** Ako sa poskytovateľ volá pre človeka. */
export const PROVIDER_LABEL: Record<OAuthProviderName, string> = {
  microsoft: "Microsoft",
  google: "Google",
}

/**
 * Identifikátor poskytovateľa v NextAuthe.
 *
 * Nie je to to isté ako náš názov: NextAuth používa `azure-ad` a tá hodnota
 * je **v adrese návratu** (`/api/auth/callback/azure-ad`), ktorú zákazník
 * zapisuje do svojej Entra aplikácie. Premenovať ju znamená rozbiť nastavenie
 * každému zákazníkovi, takže tu má vlastný názov, nie odvodený.
 */
export const PROVIDER_ID: Record<OAuthProviderName, string> = {
  microsoft: "azure-ad",
  google: "google",
}
