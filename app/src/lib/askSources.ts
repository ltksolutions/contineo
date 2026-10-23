/**
 * askSources.ts — zdroje hľadania pre `/ask` a plachtu otázky (ADR-029,
 * ASK-zdroje-hladania, ASK-zdroje-v-plachte 23. 10. 2026).
 *
 * Jedno miesto pre zoznam, ktorý vidí obrazovka odpovede aj plachta v
 * hlavičke: živé zdroje, ktoré sa pri otázke naozaj zavolajú (úroveň
 * pýtajúceho sa), s „používať predvolene". Knižnicu pridáva klient sám.
 */

import { liveConnectorsFor } from "./liveSources"
import { accessLevelFor } from "./accessLevel"
import type { onboardingContext } from "./session"
import type { AskLiveSource } from "./askScope"

export async function askLiveSources(ctx: Awaited<ReturnType<typeof onboardingContext>>): Promise<AskLiveSource[]> {
  if (ctx.state === "unknown-host") return []
  return (await liveConnectorsFor(ctx.tenant.companyCode, accessLevelFor(ctx)))
    .map(c => ({ id: c.id, name: c.name, defaultOn: Boolean(c.uses.retrieval.defaultOn) }))
}
