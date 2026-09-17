/**
 * proxy.ts — brána pred celým rozhraním.
 *
 * Beží PRED každou stránkou aj API volaním. Bez toho by prihlásenie bolo
 * len ozdoba: `/api/chat` sa dá zavolať priamo a bez kontroly by ktokoľvek
 * na internete dostal odpovede nad korpusom.
 *
 * **Do 2026-09-17 to bol `middleware.ts`.** Next 16 ten názov označil za
 * zastaraný a premenoval na `proxy.ts` — a hlavne: proxy beží na Node.js,
 * nie na edge. Práve preto sa dá tenant overiť tu, priamo v databáze. Zápis
 * v TODO („middleware beží na edge a do Atlasu nevidí") platil pre Next 14.
 *
 * **Poradie bránok** (každá ďalšia predpokladá predchádzajúcu):
 *
 *   1. doména patrí tenantovi, inak `404` (D29, D90),
 *   2. preklad starých adries (`legacyRoutes`),
 *   3. verejné cesty,
 *   4. prihlásenie.
 *
 * Zoznam chránených ciest je zámerne definovaný ako „všetko okrem…", nie
 * ako výpočet chránených. Nová stránka je tak chránená automaticky —
 * opačné poradie by znamenalo, že sa raz na niečo zabudne a nikto si to
 * nevšimne, kým nebude neskoro.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { legacyRoute } from "@/lib/legacyRoutes"
import { isHostCheckExempt, isPublicPath } from "@/lib/publicRoutes"
import { resolveTenant } from "@/lib/tenants"


export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Doména musí patriť tenantovi — **ako prvé**, pred prekladom starých
  //    adries aj pred bránou prihlásenia. Dovtedy dostal neznámy hostiteľ
  //    najprv `307` na `/sign-in` a až stránka povedala `404`; cudzia doména
  //    sa tak dozvedela, že tu nejaká prihlasovacia cesta je. D29 hovorí,
  //    že sa nemá dozvedieť nič.
  if (!isHostCheckExempt(pathname)) {
    let known = true
    try {
      // Rovnaký zdroj hostiteľa ako `requestHostname()` v `session.ts`.
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
      known = Boolean(await resolveTenant(host))
    } catch (e) {
      // **Výpadok databázy neotvára prístup, len nerozhoduje tu.** Nechávame
      // dnešné správanie: brána prihlásenia nižšie aj každá stránka si tenanta
      // overujú samy (`onboardingContext()`), takže sa nič neotvorí. Opačná
      // voľba — `404` pri chybe — by pri výpadku tvrdila ľuďom, že ich
      // organizácia neexistuje (rovnaký dôvod ako v `resolveTenant()`).
      console.error("[proxy] tenanta sa nepodarilo overiť:", e)
    }
    if (!known) return new NextResponse(null, { status: 404 })
  }

  // 2. Staré slovenské adresy idú pred bránou prihlásenia.
  // Opačné poradie by neprihlásenému človeku zo starej záložky uložilo do
  // `callbackUrl` cestu, ktorá už neexistuje — prihlásil by sa a skončil
  // na 404.
  const modern = legacyRoute(pathname)
  if (modern) {
    const to = new URL(modern, req.url)
    to.search = req.nextUrl.search
    return NextResponse.redirect(to, 307)
  }

  if (isPublicPath(pathname)) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // API vracia 401, nie presmerovanie. Presmerovanie na HTML stránku by
  // klient dostal ako odpoveď na dotaz a pokúsil by sa ju čítať ako SSE.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 })
  }

  const kam = new URL("/sign-in", req.url)
  // Kam sa chcel dostať — po prihlásení ho tam vrátime.
  if (pathname !== "/") kam.searchParams.set("callbackUrl", pathname)
  return NextResponse.redirect(kam)
}

export const config = {
  matcher: [
    /*
     * Všetko okrem statických súborov a obrázkov. Tie nechávame voľné,
     * lebo neobsahujú obsah noriem a blokovanie by rozbilo aj prihlasovaciu
     * stránku samotnú.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)",
  ],
}
