/**
 * middleware.js — koreň `/` vracia stránku, nie presmerovanie.
 *
 * ## Prečo
 *
 * `app/page.js` robil `redirect("/sk")`, čo je odpoveď **307**. Next do jej
 * tela meta značky síce vloží — overené 22. 9. 2026, `og:image` tam bol
 * a `/opengraph-image.png` vracal 200 — ale scraper, ktorý vidí stavový kód
 * 3xx, telo spravidla vôbec nečíta. A 307 je „dočasné presmerovanie", teda
 * to najslabšie, čo sa dá poslať.
 *
 * Dôsledok: `https://contineo.app` sa zdieľal **bez náhľadu**, kým
 * `https://contineo.app/sk` náhľad mal. Adresa bez jazyka je pritom presne
 * tá, ktorú človek napíše a pošle.
 *
 * ## Prepis, nie presmerovanie
 *
 * `rewrite` znamená, že sa **adresa nemení** a klientovi sa vráti **200**
 * s celou stránkou vrátane metadát. Pre návštevníka aj pre scraper je to
 * obyčajná stránka na `contineo.app`.
 *
 * Duplicitný obsah tým nevzniká: `app/[lang]/layout.js` nastavuje
 * `alternates.canonical` na `/sk`, takže `/` sa sám hlási k jazykovej
 * verzii ako ku kanonickej.
 *
 * ## Prečo nie 308
 *
 * `permanentRedirect()` by bol jednoslovná zmena a sémanticky správnejší
 * než 307, lebo jazykový základ nie je dočasný. Crawlery s 301/308
 * zaobchádzajú lepšie — ale náhľad aj tak pripíšu cieľovej adrese. Chceli
 * sme, aby náhľad mala tá adresa, ktorú ľudia zdieľajú.
 *
 * ## Rozsah
 *
 * `matcher` je **výhradne `/`**. Middleware beží na okraji pri každej
 * požiadavke, ktorá mu vyhovie; nie je dôvod platiť to na obrázkoch,
 * statických súboroch ani na jazykových routách, ktoré fungujú samy.
 */
import { NextResponse } from "next/server"

/** Predvolený jazyk. Zhodné s `x-default` v `alternates` a s pádom v `getDictionary()`. */
const VYCHODZI_JAZYK = "sk"

export function middleware(request) {
  const url = request.nextUrl.clone()
  url.pathname = `/${VYCHODZI_JAZYK}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: "/",
}
