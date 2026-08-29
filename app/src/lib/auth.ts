/**
 * auth.ts — prihlasovanie do testovacieho rozhrania.
 *
 * Prihlasuje sa odkazom v e-maile, bez hesla. Hodnotitelia sú právnici,
 * nie správcovia systému — každé heslo navyše by skončilo na papieriku
 * alebo v zdieľanej tabuľke.
 *
 * Kto sa smie prihlásiť, hovorili pôvodne **len** adresy v premennej
 * `POVOLENE_EMAILY`. Zdôvodnenie znelo: pri piatich až desiatich ľuďoch je
 * zmena premennej prehľadnejšia než admin rozhranie, ktoré by samo potrebovalo
 * správu prístupov. Pri stovke ľudí to prestalo platiť (D26), takže od
 * Fázy 8 sú zdroje povolenia dva:
 *
 *   1. kolekcia `persons` — hlavná cesta, viď `persons.ts`,
 *   2. `POVOLENE_EMAILY` — **núdzová brzda pre správcov**, ktorá nepotrebuje
 *      databázu. Zostáva zámerne: keď sa pokazí import alebo sa niekto vyklikne
 *      z vlastnej kolekcie, musí existovať cesta späť dnu.
 *
 * Funkcie `povoleneEmaily()` a `jePovoleny()` sa nemenia — sú to čisté funkcie
 * nad premennou a testujú sa samostatne.
 */

import { headers } from "next/headers"
import type { NextAuthOptions } from "next-auth"
import type { Provider } from "next-auth/providers/index"
import type { EmailConfig } from "next-auth/providers/email"
import AzureADProvider from "next-auth/providers/azure-ad"
import GoogleProvider from "next-auth/providers/google"
import { mongoAdapter } from "./authAdapter"
import { send, signInEmail } from "./ecomail"
import {
  personMaySignIn, recordSignIn, recordExternalRef, personLanguage,
  zosuladPodlaKonta, zalozPodlaDomeny, jeDomenaPovolena,
} from "./persons"
import { resolveTenant, normalizeHostname } from "./tenants"
import { resolveCredentials, ID_POSKYTOVATELA } from "./oauth"
import type { OAuthProviderName, ResolvedCredentials } from "./oauth"
import type { Tenant } from "./tenants"

/**
 * Rozloží zoznam povolených adries.
 *
 * Oddeľovačom môže byť čiarka, bodkočiarka aj nový riadok — pri vkladaní
 * do Vercelu sa ľahko stane, že adresy prídu pod sebou. Malé písmená,
 * lebo e-mailová schránka nie je citlivá na veľkosť a používateľ napíše
 * adresu tak, ako je zvyknutý.
 */
export function povoleneEmaily(rows = process.env.POVOLENE_EMAILY ?? ""): string[] {
  return rows
    .split(/[,;\n]/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes("@"))
}

/**
 * Smie sa táto adresa prihlásiť?
 *
 * Prázdny zoznam znamená, že sa **nesmie nikto**. Vyzerá to nepohodlne,
 * ale opak by bol horší: zabudnutá premenná pri nasadení by otvorila
 * rozhranie s internými smernicami komukoľvek na internete.
 */
export function jePovoleny(email: string, rows = povoleneEmaily()): boolean {
  if (!rows.length) return false
  const e = email.trim().toLowerCase()

  return rows.some(p => {
    // Zápis „@futbalsfz.sk" povolí celú doménu — hodí sa, keď má prístup
    // dostať celé oddelenie.
    if (p.startsWith("@")) return e.endsWith(p)
    return e === p
  })
}

/**
 * Prepíše hostiteľa v odkaze aj v jeho parametri `callbackUrl`.
 *
 * `NEXTAUTH_URL` je jedna hodnota na celé nasadenie, ale domén máme viac
 * (D29). Bez tohto prepisu by človek, ktorý sa prihlasuje na
 * `intranet.futbalsfz.sk`, dostal do schránky odkaz na `app.contineo.app` —
 * prihlásil by sa na inej adrese, než na akej začal, a prihlasovacia sušienka
 * by mu ostala na doméne, na ktorú sa už nevráti.
 *
 * **Od 2026-08-29 je `NEXTAUTH_URL` v produkcii zámerne nenastavená** a
 * NextAuth si origin odvodzuje z hlavičky požiadavky, takže odkaz býva správny
 * už bez tohto prepisu. Funkcia zostáva: platí lokálne, kde premenná nastavená
 * je, a je to lacná poistka proti tomu, aby premenná niekedy „opravou"
 * pribudla späť (viď `docs/NASADENIE_app.md`). Prepis je pritom bezpečný —
 * mení sa len na hostiteľa, ktorý je v `tenants`.
 */
export function rewriteLinkHost(url: string, hostWithPort: string): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  const original = u.host
  if (!hostWithPort || hostWithPort === original) return url
  u.host = hostWithPort

  const cb = u.searchParams.get("callbackUrl")
  if (cb) {
    try {
      const c = new URL(cb)
      // Mení sa len vtedy, keď `callbackUrl` ukazoval na pôvodnú doménu.
      // Cudziu adresu by prepis „opravil" na našu a tým zamaskoval.
      if (c.host === original) {
        c.host = hostWithPort
        u.searchParams.set("callbackUrl", c.toString())
      }
    } catch {
      // Relatívny `callbackUrl` sa vyhodnotí až voči cieľovej doméne.
    }
  }
  return u.toString()
}

/**
 * Hostiteľ tejto požiadavky aj s portom, alebo prázdny reťazec.
 *
 * Port sa **neodrezáva** — v lokálnom vývoji je `localhost:3000` a odkaz bez
 * portu by neviedol nikam. Na porovnanie s kolekciou `tenants` sa port
 * odreže až v `normalizeHostname()`.
 */
async function requestHost(): Promise<string> {
  try {
    const h = await headers()
    const raw = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim()
    return raw.toLowerCase()
  } catch {
    // Mimo kontextu požiadavky. Nie je to chyba, len sa nemáme čoho chytiť.
    return ""
  }
}

/**
 * Odkaz nasmerovaný na doménu, na ktorej sa človek prihlasuje.
 *
 * Prepíše sa len na **známeho tenanta**. Keby stačil ľubovoľný hostiteľ
 * z hlavičky, dala by sa podvrhnutou hlavičkou `Host` poslať do cudzej
 * schránky adresa útočníka s platným tokenom.
 */
async function linkForRequestHost(url: string): Promise<string> {
  const host = await requestHost()
  if (!host) return url
  try {
    if (!(await resolveTenant(normalizeHostname(host)))) return url
  } catch {
    // Databáza nedostupná — radšej pôvodný odkaz než žiadny e-mail.
    return url
  }
  return rewriteLinkHost(url, host)
}

/**
 * Poskytovateľ prihlásenia e-mailom, zostavený ručne.
 *
 * `next-auth/providers/email` sa nedá použiť: na prvom riadku importuje
 * `nodemailer`, teda SMTP klienta, ktorý by sa nikdy nespustil — Ecomail
 * má REST rozhranie. Balík by sa musel doinštalovať len preto, aby sa dal
 * zostaviť bundle. Provider je pritom obyčajný objekt, takže si ho
 * zostavíme sami a závislosť odpadá.
 */
function emailProvider(): EmailConfig {
  return {
    id: "email",
    type: "email",
    name: "Email",
    // Odkaz platí 24 hodín. Právnik si e-mail otvorí, keď má čas —
    // hodinová platnosť by znamenala, že polovica odkazov vyprší.
    maxAge: 24 * 60 * 60,
    // `from` a `server` sú v type povinné, ale nepoužijú sa.
    from: process.env.EMAIL_ODOSIELATEL ?? "noreply@contineo.app",
    server: { host: "unused", port: 25, auth: { user: "", pass: "" } },
    options: {},
    async sendVerificationRequest({ identifier, url }) {
      const link = await linkForRequestHost(url)
      const host = new URL(link).host

      // Jazyk prostredia z `persons`. Nikdy nehádže — pri neznámej osobe
      // alebo nedostupnej databáze padá na slovenčinu, aby sa e-mail odoslal
      // vždy. Zlý jazyk je nepríjemnosť, neodoslaný odkaz sú zavreté dvere.
      const language = await personLanguage(identifier)

      // Vzhľad organizácie. Zlyhanie tu nesmie zabrániť odoslaniu — bez
      // vzhľadu je e-mail škaredší, bez e-mailu sa človek neprihlási.
      let branding
      try {
        const tenant = await resolveTenant(normalizeHostname(host))
        if (tenant) {
          branding = {
            displayName: tenant.branding.displayName,
            // V e-maile musí byť adresa loga absolútna — relatívna cesta
            // nemá v schránke k čomu byť relatívna.
            logoUrl: tenant.branding.logoUrl?.startsWith("/")
              ? `${new URL(link).origin}${tenant.branding.logoUrl}`
              : tenant.branding.logoUrl,
            accentColor: tenant.branding.accentColor,
          }
        }
      } catch (e) {
        console.error("[auth] vzhľad tenanta pre e-mail sa nepodarilo načítať:", e)
      }

      await send({ to: identifier, ...signInEmail(link, host, language, branding) })
    },
  }
}

export const authOptions: NextAuthOptions = {
  adapter: mongoAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/prihlasenie",
    verifyRequest: "/prihlasenie?odoslane=1",
    error: "/prihlasenie",
  },
  providers: [emailProvider()],

  /**
   * Prihlásenie hovorí nahlas, prečo nevyšlo.
   *
   * NextAuth predvolene zapíše kód chyby len do vlastného výpisu a používateľ
   * uvidí vetu „odkaz už neplatí" bez toho, aby sa dalo zistiť, či token
   * chýbal, vypršal, alebo ho odmietla brána prístupu. Pri prihlasovaní
   * stovky ľudí je rozdiel medzi tými tromi príčinami celý rozdiel medzi
   * opravou za desať minút a hádaním celé popoludnie.
   */
  logger: {
    error(code, metadata) {
      console.error("[next-auth] chyba:", code, metadata)
    },
    warn(code) {
      console.warn("[next-auth] varovanie:", code)
    },
  },

  callbacks: {
    /**
     * Posledná brána. Beží pri žiadosti o odkaz aj pri jeho použití, takže
     * ani odkaz získaný z cudzej schránky neprepustí niekoho, kto medzitým
     * zo zoznamu vypadol.
     */
    async signIn({ user, account, profile, email }) {
      // `email.verificationRequest` odlíši žiadosť o odkaz od jeho použitia.
      // Bez toho sa v logu nedá rozoznať, či človek o odkaz len požiadal,
      // alebo naň už klikol a neprešiel.
      const poskytovatel = poskytovatelZId(account?.provider)
      const faza = poskytovatel ?? (email?.verificationRequest ? "ziadost" : "pouzitie-odkazu")

      // ── konto od Microsoftu alebo Googlu (D45) ──
      //
      // Konto hovorí „toto je naozaj tá adresa". Že ten človek patrí do
      // organizácie, hovorí až `persons` o pár riadkov nižšie.
      let externalId: string | null = null
      if (poskytovatel) {
        const host = await requestHost()
        const obmedzenia = await obmedzeniaPre(poskytovatel, host)
        if (!obmedzenia) {
          console.error(`[auth] ${faza}: obmedzenia sa nedali overiť — neprepúšťam`)
          return false
        }

        const overenie = overOAuthProfil(
          poskytovatel,
          (profile ?? {}) as Record<string, unknown>,
          obmedzenia,
        )
        if (!overenie.ok) {
          // Menovite do logu: každý z tých dôvodov znamená inú opravu
          // a „prihlásenie zlyhalo" neznamená ani jednu z nich.
          console.error(`[auth] ${faza}: profil odmietnutý — ${overenie.dovod}`)
          return false
        }

        // Adresa z overeného profilu prebije to, čo poskytovateľ dal do
        // `user` — beriem tú, ktorú som sám skontroloval.
        user.email = overenie.email
        externalId = overenie.externalId

        // Od tejto chvíle je konto overené: `tid` je z povoleného adresára
        // (Microsoft) alebo je adresa overená (Google). Až teraz sa smie
        // podľa neho čokoľvek zapisovať.
        const tenant = await tenantPreHost(host)
        if (tenant) {
          // 1. Ten istý človek s inou adresou? Rozpozná sa podľa konta —
          //    `oid` je nemenné, adresa nie (D45).
          if (externalId) {
            const znamy = await zosuladPodlaKonta(
              poskytovatel, externalId, overenie.email, tenant.companyCode,
            )
            if (znamy) user.email = znamy.email
          }

          // 2. Ešte tu nie je a je z domény, ktorú organizácia povolila?
          //    Adresár zákazníka už raz rozhodol, že tam patrí (D47).
          if (!(await personMaySignIn(user.email)) &&
              jeDomenaPovolena(user.email, tenant.autoProvisionDomains)) {
            await zalozPodlaDomeny(
              tenant.companyCode,
              user.email,
              typeof (profile as Record<string, unknown>)?.name === "string"
                ? ((profile as Record<string, unknown>).name as string)
                : user.name ?? undefined,
              `auto:${poskytovatel}`,
            )
          }
        }
      }

      if (!user.email) {
        console.error(`[auth] ${faza}: prihlásenie bez adresy`)
        return false
      }

      // Núdzová brzda ide prvá — nepotrebuje databázu, takže správcu pustí
      // aj vtedy, keď je cluster nedostupný.
      if (jePovoleny(user.email)) {
        console.log(`[auth] ${faza}: ${user.email} — cez núdzovú brzdu`)
        return true
      }

      const allowed = await personMaySignIn(user.email)
      console.log(`[auth] ${faza}: ${user.email} — persons ${allowed ? "povolil" : "ODMIETOL"}`)
      // Evidencia až po povolení. `recordSignIn` si chyby prehĺta sám, takže
      // `await` nemôže zhodiť prihlásenie človeka, ktorý naň má nárok —
      // pôvodný dôvod pre `void` tým odpadá.
      //
      // **Bez `await` sa zápis nestihne.** Funkcia na Verceli končí hneď po
      // vrátení hodnoty a rozrobený dotaz do Atlasu sa zahodí. Nezasvieti
      // pri tom nič: človek sa prihlási, relácia funguje, len `lastLoginAt`
      // zostane prázdne a stav `invited`. Zistilo sa to 2026-08-28 náhodou —
      // jediná osoba v `persons` mala platnú reláciu a pritom nulovú
      // evidenciu. Na `lastLoginAt` má stáť príznak „nové" (D39), takže
      // ticho stratený zápis by sa neskôr prejavil ako nefunkčná funkcia
      // niekde úplne inde.
      if (allowed) {
        await recordSignIn(user.email)
        // Až po povolení. Odvtedy vieme, že je to to isté konto, aj keď
        // organizácia zmení človeku adresu — tá sa mení, `oid` nie.
        if (poskytovatel && externalId) {
          await recordExternalRef(user.email, poskytovatel, externalId)
        }
      }
      return allowed
    },
    /**
     * Kam sa smie po prihlásení odísť.
     *
     * Predvolené správanie NextAuthu porovnáva cieľ s `NEXTAUTH_URL`, čo je
     * jedna doména na celé nasadenie. Pri viacerých doménach (D29) by to
     * znamenalo, že človek, ktorý sa prihlásil na `intranet.futbalsfz.sk`,
     * skončí na `app.contineo.app` — a tam nie je prihlásený, lebo sušienka
     * ostala na prvej doméne.
     *
     * Cudzia doména sa **nepovolí**: preverí sa proti kolekcii `tenants`,
     * takže z toho nevznikne otvorené presmerovanie.
     */
    async redirect({ url, baseUrl }) {
      const host = await requestHost()
      // Protokol z proxy; lokálne (`localhost:3000`) je to http a natvrdo
      // zapísané https by odkaz zaviedlo tam, kde nič nepočúva.
      const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https"
      const origin = host ? `${proto}://${host}` : baseUrl

      if (url.startsWith("/")) return `${origin}${url}`
      try {
        const target = new URL(url)
        if (target.origin === origin || target.origin === baseUrl) return url
        if (await resolveTenant(normalizeHostname(target.host))) return url
      } catch {
        // Nepoužiteľná adresa — späť na domovskú.
      }
      return origin
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email
      return token
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email as string
      return session
    },
  },
}

// ── prihlásenie pracovným kontom (D43, D44, D45) ─────────────────────────────

/**
 * Prečo sa konto neprepustilo. Rozlíšené preto, že každý dôvod znamená inú
 * opravu — a „prihlásenie zlyhalo" neznamená ani jednu z nich.
 */
export type DovodOdmietnutia =
  | "ziadna-adresa"
  | "neovereny-email"
  | "cudzi-tenant"
  | "cudzia-domena"

export type OAuthOverenie =
  | { ok: true; email: string; externalId: string | null }
  | { ok: false; dovod: DovodOdmietnutia }

/** Prvá hodnota, ktorá vyzerá ako e-mailová adresa. */
function prvaAdresa(...kandidati: unknown[]): string | null {
  for (const k of kandidati) {
    if (typeof k === "string" && k.includes("@")) return k.trim().toLowerCase()
  }
  return null
}

/**
 * Overí profil od poskytovateľa — **pred** tým, než sa slovo dostane k `persons`.
 *
 * Konto hovorí „toto je naozaj tá adresa". Nehovorí, že ten človek patrí do
 * organizácie; to hovorí `persons`. Táto funkcia overuje len prvú vetu — a je
 * to jediné miesto, kde sa to robí, takže je čistá a testovateľná bez siete.
 *
 * Microsoft vracia adresu raz ako `email`, inokedy ako `preferred_username`
 * alebo `upn` — podľa toho, ako má zákazník nastavené kontá. Berie sa prvá,
 * ktorá vyzerá ako adresa.
 */
export function overOAuthProfil(
  provider: OAuthProviderName,
  profil: Record<string, unknown>,
  obmedzenia: { allowedTenantIds?: string[]; hostedDomain?: string },
): OAuthOverenie {
  if (provider === "microsoft") {
    // `tid` je identifikátor Entra tenanta a v tokene od Entry je vždy.
    // Jeho neprítomnosť znamená, že to nie je to, za čo sa to vydáva.
    const tid = typeof profil.tid === "string" ? profil.tid.toLowerCase() : null
    if (!tid) return { ok: false, dovod: "cudzi-tenant" }

    const povolene = (obmedzenia.allowedTenantIds ?? []).map(x => x.toLowerCase())
    // Prázdny zoznam = nekontroluje sa. Je to vedomé rozhodnutie správcu
    // a je o ňom napísané na obrazovke, kde sa zadáva.
    if (povolene.length > 0 && !povolene.includes(tid)) {
      return { ok: false, dovod: "cudzi-tenant" }
    }

    const email = prvaAdresa(profil.email, profil.preferred_username, profil.upn)
    if (!email) return { ok: false, dovod: "ziadna-adresa" }

    // `oid` je nemenné v rámci tenanta; `sub` je nemenné v rámci aplikácie.
    // Adresa nemenná nie je — ľudia sa vydávajú, organizácie sa premenúvajú.
    const externalId = typeof profil.oid === "string" ? profil.oid
      : typeof profil.sub === "string" ? profil.sub
      : null
    return { ok: true, email, externalId }
  }

  // Google
  // `email_verified` je jediný rozdiel medzi „toto je jeho adresa" a „toto si
  // napísal do profilu". Bez neho by spájanie kont podľa adresy bolo dierou.
  if (profil.email_verified !== true) return { ok: false, dovod: "neovereny-email" }

  const email = prvaAdresa(profil.email)
  if (!email) return { ok: false, dovod: "ziadna-adresa" }

  const hd = obmedzenia.hostedDomain?.trim().toLowerCase()
  if (hd) {
    // `hd` v požiadavke je pre Google len nápoveda, nie obmedzenie —
    // vynucuje sa až tu, na odpovedi.
    const domenaKonta = typeof profil.hd === "string" ? profil.hd.toLowerCase() : null
    if (domenaKonta !== hd) return { ok: false, dovod: "cudzia-domena" }
  }

  const externalId = typeof profil.sub === "string" ? profil.sub : null
  return { ok: true, email, externalId }
}

/**
 * Poskytovateľ pre NextAuth z rozšifrovaných údajov.
 *
 * `allowDangerousEmailAccountLinking` je zapnuté vedome. Ten istý človek sa
 * dnes prihlási odkazom v e-maile a zajtra pracovným kontom; bez spájania by
 * NextAuth druhý pokus odmietol (`OAuthAccountNotLinked`) a človek by nemal
 * ako zistiť prečo.
 *
 * Bezpečné je to preto, že **adresa tu nie je identitou.** Identitou je záznam
 * v `persons`; konto je len dôkaz, že adresa patrí tomu, kto ju napísal. A ten
 * dôkaz sa overuje v `overOAuthProfil()` — neoverená adresa sa nespojí nikdy.
 */
function oauthProvider(c: ResolvedCredentials): Provider {
  if (c.provider === "microsoft") {
    return AzureADProvider({
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      tenantId: c.tenantMode || "organizations",
      allowDangerousEmailAccountLinking: true,
    })
  }
  return GoogleProvider({
    clientId: c.clientId,
    clientSecret: c.clientSecret,
    allowDangerousEmailAccountLinking: true,
    authorization: c.hostedDomain
      // Nápoveda pre Google, aby rovno ponúkol správne konto. Skutočné
      // obmedzenie je až v `overOAuthProfil()` — toto sa dá obísť.
      ? { params: { hd: c.hostedDomain, prompt: "select_account" } }
      : { params: { prompt: "select_account" } },
  })
}

/**
 * Konfigurácia pre konkrétneho hostiteľa (D44).
 *
 * Ktorý Microsoft je „ten správny", závisí od domény: na `intranet.futbalsfz.sk`
 * je to Entra zväzu, na našej doméne naša skúšobná aplikácia. Preto sa
 * poskytovatelia neskladajú pri štarte, ale pri každej požiadavke.
 *
 * Prihlásenie e-mailom je tam **vždy**. Je to jediná cesta, ktorá nezávisí od
 * cudzej služby — a keď Entra vypadne, musí zostať spôsob, ako sa dostať dnu.
 */
export async function authOptionsForHost(rawHost: string): Promise<NextAuthOptions> {
  let tenant: Tenant | null = null
  try {
    tenant = await resolveTenant(normalizeHostname(rawHost))
  } catch (e) {
    // Bez tenanta zostane len e-mail. Výpadok databázy nesmie zhodiť
    // prihlasovanie úplne.
    console.error("[auth] tenanta pre poskytovateľov sa nepodarilo načítať:", e)
  }

  const providers: Provider[] = [emailProvider()]
  for (const p of ["microsoft", "google"] as const) {
    const c = resolveCredentials(tenant, p)
    if (c) providers.push(oauthProvider(c))
  }

  return { ...authOptions, providers }
}

/** Tenant hostiteľa, alebo `null`. Nehádže — zlyhanie znamená „nerobiť nič navyše". */
async function tenantPreHost(rawHost: string): Promise<Tenant | null> {
  try {
    return await resolveTenant(normalizeHostname(rawHost))
  } catch (e) {
    console.error("[auth] tenanta pre hostiteľa sa nepodarilo načítať:", e)
    return null
  }
}

/** Obmedzenia poskytovateľa pre tohto hostiteľa. Prázdne, keď nie je nastavený. */
async function obmedzeniaPre(provider: OAuthProviderName, rawHost: string) {
  try {
    const tenant = await resolveTenant(normalizeHostname(rawHost))
    const c = resolveCredentials(tenant, provider)
    return { allowedTenantIds: c?.allowedTenantIds ?? [], hostedDomain: c?.hostedDomain }
  } catch {
    // Nedostupná databáza — kontrola sa nedá spraviť, takže sa neprepúšťa.
    return null
  }
}

/** Z identifikátora NextAuthu späť na náš názov. `null` pri e-maile. */
export function poskytovatelZId(id: string | undefined): OAuthProviderName | null {
  if (!id) return null
  for (const [nas, nextauth] of Object.entries(ID_POSKYTOVATELA)) {
    if (nextauth === id) return nas as OAuthProviderName
  }
  return null
}
