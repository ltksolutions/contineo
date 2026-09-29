"use server"

/**
 * shellActions.ts — prepnutie bočného panela bez JavaScriptu
 * (SHELL-bocny-panel, Q4).
 *
 * S JavaScriptom panel prepne `AppNav` hneď a cookie zapíše sám; táto akcia
 * je cesta pre formulár bez skriptu. Nastaví cookie `nav` a vráti človeka
 * na tú istú stránku — podľa `Referer`, ale len na cestu na tom istom
 * hostiteľovi: presmerovanie podľa hlavičky, ktorú si klient napíše sám,
 * nesmie viesť von z portálu.
 */

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { NAV_COOKIE, normalizeNavState } from "@/lib/appNav"
import { sameOriginPath } from "@/lib/shellBack"

export async function setNavStateAction(fd: FormData) {
  const state = normalizeNavState(fd.get("nav"))
  ;(await cookies()).set(NAV_COOKIE, state, {
    path: "/",
    // Rok: voľba zariadenia, nie relácie. Nič citlivé v nej nie je.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  const h = await headers()
  redirect(sameOriginPath(h.get("referer"), h.get("host")))
}
