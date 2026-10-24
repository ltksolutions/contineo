/**
 * askSources.ts — zdroje hľadania pre `/ask`, plachtu otázky a nástroj `ask`
 * MCP servera (ADR-029, ASK-zdroje-hladania 23. 10. 2026; ADR-040 D266).
 *
 * Tenká vrstva nad registrom zdrojov (`sourcesRegister.ts`): to, čo človek
 * vidí vo výbere, je ten istý zoznam ako v Organizácia → Zdroje. Knižnicu
 * pridáva klient sám; tu sú živé zdroje s „používať predvolene".
 */

import { accessLevelFor } from "./accessLevel"
import { sourcesRegister, liveSourcesFor } from "./sourcesRegister"
import type { onboardingContext } from "./session"
import type { AskLiveSource } from "./askScope"

export async function askLiveSources(ctx: Awaited<ReturnType<typeof onboardingContext>>): Promise<AskLiveSource[]> {
  if (ctx.state === "unknown-host") return []
  const language = ctx.state === "ready" ? ctx.person.language : ctx.tenant.defaultLanguage
  return liveSourcesFor(await sourcesRegister(ctx.tenant.companyCode, language), accessLevelFor(ctx))
}
