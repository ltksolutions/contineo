/**
 * session.ts — od prihlásenej relácie k osobe.
 *
 * Relácia (NextAuth) vie len e-mail. Onboarding potrebuje osobu: jej
 * `companyCode` rozhoduje o tom, na ktoré dokumenty vidí (D32), `tracks`
 * o tom, čo má prejsť, a `language` o tom, v akej reči sa s ňou hovorí.
 *
 * Správca, ktorý prešiel núdzovou brzdou (`POVOLENE_EMAILY`), v `persons`
 * byť nemusí — vtedy tu nie je osoba a stránky onboardingu mu nemajú čo
 * ukázať. Nie je to chyba, je to legitímny stav.
 */

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { findPerson } from "./persons"
import type { Person } from "./persons"

export async function currentPerson(): Promise<Person | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return null
  try {
    return await findPerson(email)
  } catch (e) {
    // Nahlas — inak by výpadok databázy vyzeral ako „nie si nikto".
    console.error("[session] osobu sa nepodarilo načítať:", e)
    return null
  }
}
