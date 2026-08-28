/**
 * middleware.ts — brána pred celým rozhraním.
 *
 * Beží PRED každou stránkou aj API volaním. Bez toho by prihlásenie bolo
 * len ozdoba: `/api/chat` sa dá zavolať priamo a bez kontroly by ktokoľvek
 * na internete dostal odpovede nad korpusom.
 *
 * Zoznam chránených ciest je zámerne definovaný ako „všetko okrem…", nie
 * ako výpočet chránených. Nová stránka je tak chránená automaticky —
 * opačné poradie by znamenalo, že sa raz na niečo zabudne a nikto si to
 * nevšimne, kým nebude neskoro.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Cesty prístupné bez prihlásenia. Držať krátke a vedieť o každej prečo.
 */
const VEREJNE = [
  "/prihlasenie",
  "/api/auth",      // samotné prihlasovanie
  // Logá tenantov. Prihlasovacia stránka nesie logo organizácie a načítava ho
  // ako obrázok — teda ďalšou požiadavkou, ktorá v tej chvíli ešte nie je
  // prihlásená. Bez tejto výnimky by sa presmerovala na `/prihlasenie` a
  // z hlavičky by zostal holý text. Sú to verejné značkové súbory, nie obsah
  // noriem; jediné, čo prezradia, je že tá organizácia tu má portál — a to
  // prezradí už samotná doména.
  "/tenants/",
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (VEREJNE.some(c => pathname.startsWith(c))) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (token) return NextResponse.next()

  // API vracia 401, nie presmerovanie. Presmerovanie na HTML stránku by
  // klient dostal ako odpoveď na dotaz a pokúsil by sa ju čítať ako SSE.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ chyba: "Neprihlásený" }, { status: 401 })
  }

  const kam = new URL("/prihlasenie", req.url)
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
