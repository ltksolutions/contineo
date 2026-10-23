/**
 * widgetSources.ts — zdroje, z ktorých si človek vo widgete kanála vyberá
 * (KANAL-widget-zdroje, Ján 23. 10. 2026; ADR-028, ADR-029).
 *
 * Správca kanála zdroje **povoľuje** (`connectorScopes`), človek si z nich
 * vyberá. Knižnica je vždy; živé zdroje len verejné (D174) a len tie, ktoré
 * má kanál v `connectorScopes` — jeden riadok za konektor, nie za rozsah (Q4).
 * Predvolene sú zapnuté všetky povolené (Q3) — ako widget hľadal doteraz.
 */

import type { HelpdeskChannel } from "./channels"
import { liveConnectorsFor } from "./liveSources"

export interface WidgetSource {
  /** `"library"` alebo id konektora. */
  id: string
  name: string
}

/** Povolené zdroje kanála v poradí: Knižnica, potom konektory podľa nastavenia. */
export async function widgetSources(companyCode: string, channel: Pick<HelpdeskChannel, "connectorScopes">, libraryName: string): Promise<WidgetSource[]> {
  const refs = channel.connectorScopes ?? []
  // Prázdne `connectorScopes` = kanál živé zdroje nepoužíva. `liveConnectorsFor`
  // by bez nich vrátil všetky verejné, preto sa vôbec nevolá.
  const live = refs.length ? await liveConnectorsFor(companyCode, "public", refs) : []
  return [{ id: "library", name: libraryName }, ...live.map(c => ({ id: c.id, name: c.name }))]
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
