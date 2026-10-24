/**
 * widgetSources.ts — zdroje, z ktorých si človek vo widgete kanála vyberá
 * (KANAL-widget-zdroje, Ján 23. 10. 2026; ADR-028, ADR-029; ADR-040 D266).
 *
 * Správca kanála zdroje **povoľuje** (`connectorScopes`), človek si z nich
 * vyberá. Zoznam vzniká z registra zdrojov (`sourcesRegister.ts`) — ten
 * istý, aký vidí Organizácia → Zdroje a výber na Opýtať sa. Knižnica je
 * vždy; konektory len verejné (D174) a len tie, ktoré má kanál
 * v `connectorScopes` — jeden riadok za konektor, nie za rozsah (Q4);
 * legislatíva je verejná a je, keď ju organizácia odoberá (ADR-039 D259).
 * Predvolene sú zapnuté všetky povolené (Q3) — ako widget hľadal doteraz.
 */

import type { HelpdeskChannel } from "./channels"
import { parseScopeRef } from "./connectors"
import { sourcesRegister } from "./sourcesRegister"
import type { UiLanguage } from "./i18n"

export interface WidgetSource {
  /** `"library"`, id konektora alebo `law`. */
  id: string
  name: string
}

/** Povolené zdroje kanála v poradí: Knižnica, konektory podľa nastavenia, Legislatíva. */
export async function widgetSources(companyCode: string, channel: Pick<HelpdeskChannel, "connectorScopes">, language: UiLanguage, libraryName: string): Promise<WidgetSource[]> {
  const refs = channel.connectorScopes ?? []
  // Prázdne `connectorScopes` = kanál živé zdroje konektorov nepoužíva.
  const allowedConnectors = new Set(refs.map(parseScopeRef).filter(Boolean).map(r => r!.connectorId))
  const register = await sourcesRegister(companyCode, language)
  const live = register.filter(s =>
    s.kind !== "file" && s.enabled && s.connected && s.allowed && s.uses.retrieval && s.accessLevel === "public"
    && (s.kind !== "mcp" || allowedConnectors.has(s.id)),
  )
  return [{ id: "library", name: libraryName }, ...live.map(s => ({ id: s.id, name: s.name }))]
}

/**
 * Výber z tela požiadavky: len podmnožina povolených. Prázdny alebo celý
 * neznámy výber = všetky povolené (starý skript widgetu výber neposiela).
 */
export function pickWidgetSources(requested: unknown, allowed: WidgetSource[]): WidgetSource[] {
  const ids = Array.isArray(requested) ? requested.filter((x): x is string => typeof x === "string") : []
  const picked = allowed.filter(s => ids.includes(s.id))
  return picked.length ? picked : allowed
}

/** „V čom sa hľadalo" pre hlavičku a záznam — knižnica a názvy živých zdrojov. */
export function searchedScopeOf(picked: WidgetSource[]): { library: boolean; live: string[] } {
  return { library: picked.some(s => s.id === "library"), live: picked.filter(s => s.id !== "library").map(s => s.name) }
}
