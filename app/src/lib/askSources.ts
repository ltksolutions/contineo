/**
 * askSources.ts — zdroje hľadania pre `/ask` a plachtu otázky (ADR-029,
 * ASK-zdroje-hladania, ASK-zdroje-v-plachte 23. 10. 2026; ADR-039 D259).
 *
 * Jedno miesto pre zoznam, ktorý vidí obrazovka odpovede aj plachta v
 * hlavičke: živé zdroje, ktoré sa pri otázke naozaj zavolajú (úroveň
 * pýtajúceho sa), s „používať predvolene". Knižnicu pridáva klient sám.
 *
 * **Legislatíva** (katalóg zo Slov-Lexu) je vstavaný zdroj, nie konektor:
 * nemá server ani prihlásenie, je vždy pripojená. Ponúka sa, keď má
 * organizácia aspoň jeden odoberaný predpis a rezidencia dovoľuje čítať
 * katalóg; v zozname je za konektormi, pod rovnakým tvarom, aby výber
 * zdrojov nepotreboval tretí druh riadku.
 */

import { liveConnectorsFor } from "./liveSources"
import { accessLevelFor } from "./accessLevel"
import { lawSourceState, LAW_SOURCE_ID } from "./lawCatalog"
import { dictionary } from "./i18n"
import type { onboardingContext } from "./session"
import type { AskLiveSource } from "./askScope"

export async function askLiveSources(ctx: Awaited<ReturnType<typeof onboardingContext>>): Promise<AskLiveSource[]> {
  if (ctx.state === "unknown-host") return []
  const companyCode = ctx.tenant.companyCode
  const [connectors, law] = await Promise.all([
    liveConnectorsFor(companyCode, accessLevelFor(ctx)),
    lawSourceState(companyCode),
  ])
  const sources: AskLiveSource[] = connectors.map(c => ({ id: c.id, name: c.name, defaultOn: Boolean(c.uses.retrieval.defaultOn) }))
  if (law.active) {
    const language = ctx.state === "ready" ? ctx.person.language : ctx.tenant.defaultLanguage
    sources.push({ id: LAW_SOURCE_ID, name: dictionary(language).ask.scopeLaw, defaultOn: law.defaultOn })
  }
  return sources
}
