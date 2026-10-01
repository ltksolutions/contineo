/**
 * accessLevel.ts — na akej úrovni prístupu sa odpovedá, a kedy je interný
 * zdroj v odpovedi únik.
 *
 * **Jedno miesto pre `/api/chat` aj `/api/rating`.** Chat podľa úrovne filtruje
 * vyhľadávanie, hodnotenie ju zapisuje do záznamu. Keby si ju každá cesta
 * skladala sama, zapísaná úroveň by sa raz rozišla s tou, ktorá filtrovala —
 * a metrika úniku by merala niečo iné, než čo sa stalo.
 *
 * Modul je zámerne bez behových importov: číta ho aj
 * `scripts/ratings_overview.mjs`, ktorý beží v čistom Node.
 */

import type { AccessLevel } from "./ratings"
import type { AnswerSource } from "./sseClient"
import type { OnboardingContext } from "./session"

/**
 * Úroveň prístupu toho, kto sa pýta (`docs/PRISTUPOVE_PRAVA.md`).
 *
 * Prihlásená osoba organizácie domény smie `public` aj `internal`; ktokoľvek
 * iný len `public`. Dnes sa k odpovedi bez prihlásenia nedostane nikto —
 * proxy `/api/chat` ani `/api/rating` nepustí —, ale keď vznikne verejný
 * widget, dostane `public` odtiaľto, nie z vlastnej vetvy.
 */
export function accessLevelFor(ctx: OnboardingContext): AccessLevel {
  return ctx.state === "ready" ? "internal" : "public"
}

/** To, čo metrika potrebuje zo záznamu v `evaluations`. */
export interface LeakCandidate {
  askerAccessLevel?: AccessLevel
  askedBy?: string
  reviewer?: string
  sources?: Pick<AnswerSource, "accessLevel">[]
}

/**
 * Pre akú úroveň prístupu odpoveď vznikla.
 *
 * Záznamy spred 2026-10-01 pole `askerAccessLevel` nemajú. Bez prihlásenia sa
 * vtedy odpoveď dostať nedala, takže **záznam s osobou** (`askedBy`, alebo
 * `reviewer` u starších) bol interný. **Záznam bez osoby** sa berie ako
 * verejný: neznámy stav má bránu radšej zhodiť, než ju pustiť.
 */
export function answerAccessLevel(r: LeakCandidate): AccessLevel {
  if (r.askerAccessLevel) return r.askerAccessLevel
  return r.askedBy || r.reviewer ? "internal" : "public"
}

/**
 * Únik interného obsahu: **verejná** odpoveď, medzi ktorej zdrojmi je
 * `internal`. Interný zdroj v odpovedi prihlásenému zamestnancovi únik nie je
 * — ten ho vidieť smie.
 */
export function isInternalLeak(r: LeakCandidate): boolean {
  return answerAccessLevel(r) === "public"
    && (r.sources ?? []).some(s => s.accessLevel === "internal")
}

/** Interný zdroj v internej odpovedi — v poriadku, metrika ho len ukazuje. */
export function isInternalSourceForInternal(r: LeakCandidate): boolean {
  return answerAccessLevel(r) === "internal"
    && (r.sources ?? []).some(s => s.accessLevel === "internal")
}
