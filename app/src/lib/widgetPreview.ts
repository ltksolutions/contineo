/**
 * widgetPreview.ts — náhľad widgetu v nastavení kanála (ADR-042, Dodatok 1, D284).
 *
 * Správca uvidí uložené nastavenie (polohu, veľkosť, texty, správanie) na
 * prázdnej stránke skôr než ľudia v cudzom systéme. Token mu podpíše
 * Contineo samo tajným kľúčom kanála — tak, ako by to urobil cudzí systém —
 * s jeho menom a e-mailom; `iss` je prvý povolený pôvod kanála.
 *
 * Náhľad je skutočný widget: otázky sa zapíšu na hodnotenie a správa
 * helpdesku založí ticket. Stránka to hovorí nahlas.
 */

import { signWidgetToken } from "./widgetToken"
import { widgetSecret, type HelpdeskChannel } from "./channels"
import type { Person } from "./persons"

/** Identifikátor správcu v náhľade — nie je to účet v cudzom systéme. */
export function previewSubject(person: Pick<Person, "id">): string {
  return `contineo:${person.id}`
}

/**
 * Token pre náhľad, alebo dôvod, prečo sa nedá: bez tajného kľúča ho niet
 * čím podpísať, bez povoleného pôvodu ho Contineo neprijme.
 */
export function previewToken(
  channel: HelpdeskChannel,
  person: Pick<Person, "id" | "email" | "fullName" | "givenName" | "surname" | "language">,
): { token: string } | { error: "noSecret" | "noOrigins" } {
  const iss = channel.widget.origins[0]
  if (!iss) return { error: "noOrigins" }
  const secret = widgetSecret(channel)
  if (!secret) return { error: "noSecret" }
  return {
    token: signWidgetToken({
      iss, aud: channel.key, sub: previewSubject(person), email: person.email,
      given_name: person.givenName, family_name: person.surname, name: person.fullName,
      lang: person.language,
    }, secret),
  }
}
