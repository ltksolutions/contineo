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
import type { EmailConfig } from "next-auth/providers/email"
import { mongoAdapter } from "./authAdapter"
import { send, signInEmail } from "./ecomail"
import { personMaySignIn, recordSignIn, personLanguage } from "./persons"
import { resolveTenant, normalizeHostname } from "./tenants"

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
    async signIn({ user, email }) {
      // `email.verificationRequest` odlíši žiadosť o odkaz od jeho použitia.
      // Bez toho sa v logu nedá rozoznať, či človek o odkaz len požiadal,
      // alebo naň už klikol a neprešiel.
      const faza = email?.verificationRequest ? "ziadost" : "pouzitie-odkazu"
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
      // Evidencia až po povolení a mimo rozhodovania: keby zápis zlyhal,
      // nesmie to zhodiť prihlásenie človeka, ktorý naň má nárok.
      if (allowed) void recordSignIn(user.email)
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
