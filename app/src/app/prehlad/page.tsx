/**
 * `/prehlad` — presmerovanie na `/`.
 *
 * Prehľad tu žil od chvíle, keď vznikol, dovtedy, kým sa nerozhodlo, že je to
 * prvá obrazovka po prihlásení. Adresa zostáva, lebo **odkaz, ktorý si niekto
 * uložil, nemá spadnúť na 404** — a kto ho otvorí, má skončiť tam, kde obsah
 * naozaj je, nie na stránke s vysvetlením.
 *
 * `permanentRedirect`, nie `redirect`: adresa sa presunula natrvalo a prehliadač
 * aj vyhľadávač si to smú zapamätať.
 */

import { permanentRedirect } from "next/navigation"

export default function PrehladPage(): never {
  permanentRedirect("/")
}
