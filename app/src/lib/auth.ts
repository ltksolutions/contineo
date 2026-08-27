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
 *   1. kolekcia `persons` — hlavná cesta, viď `osoby.ts`,
 *   2. `POVOLENE_EMAILY` — **núdzová brzda pre správcov**, ktorá nepotrebuje
 *      databázu. Zostáva zámerne: keď sa pokazí import alebo sa niekto vyklikne
 *      z vlastnej kolekcie, musí existovať cesta späť dnu.
 *
 * Funkcie `povoleneEmaily()` a `jePovoleny()` sa nemenia — sú to čisté funkcie
 * nad premennou a testujú sa samostatne.
 */

import type { NextAuthOptions } from "next-auth"
import type { EmailConfig } from "next-auth/providers/email"
import { mongoAdapter } from "./authAdapter"
import { posli, prihlasovaciEmail } from "./ecomail"
import { osobaSmiePrihlasenie, oznacPrihlasenie } from "./osoby"

/**
 * Rozloží zoznam povolených adries.
 *
 * Oddeľovačom môže byť čiarka, bodkočiarka aj nový riadok — pri vkladaní
 * do Vercelu sa ľahko stane, že adresy prídu pod sebou. Malé písmená,
 * lebo e-mailová schránka nie je citlivá na veľkosť a používateľ napíše
 * adresu tak, ako je zvyknutý.
 */
export function povoleneEmaily(zoznam = process.env.POVOLENE_EMAILY ?? ""): string[] {
  return zoznam
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
export function jePovoleny(email: string, zoznam = povoleneEmaily()): boolean {
  if (!zoznam.length) return false
  const e = email.trim().toLowerCase()

  return zoznam.some(p => {
    // Zápis „@futbalsfz.sk" povolí celú doménu — hodí sa, keď má prístup
    // dostať celé oddelenie.
    if (p.startsWith("@")) return e.endsWith(p)
    return e === p
  })
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
      const hostitel = new URL(url).host
      await posli({ komu: identifier, ...prihlasovaciEmail(url, hostitel) })
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
  callbacks: {
    /**
     * Posledná brána. Beží pri žiadosti o odkaz aj pri jeho použití, takže
     * ani odkaz získaný z cudzej schránky neprepustí niekoho, kto medzitým
     * zo zoznamu vypadol.
     */
    async signIn({ user }) {
      if (!user.email) return false

      // Núdzová brzda ide prvá — nepotrebuje databázu, takže správcu pustí
      // aj vtedy, keď je cluster nedostupný.
      if (jePovoleny(user.email)) return true

      const smie = await osobaSmiePrihlasenie(user.email)
      // Evidencia až po povolení a mimo rozhodovania: keby zápis zlyhal,
      // nesmie to zhodiť prihlásenie človeka, ktorý naň má nárok.
      if (smie) void oznacPrihlasenie(user.email)
      return smie
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
