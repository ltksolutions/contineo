/**
 * /learning/tests/questions/import — import otázok z CSV, nahratie súboru (rám `docs/design/TESTS-testy-a-banka.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=questions&import=1`; časť, ktorú má cesta pomenovať, má
 * vlastnú adresu (CLAUDE.md, R3 v `docs/DESIGN_ODCHYLKY.md`). Starý tvar
 * presmeruje `proxy.ts` (`legacyQueryRoute`).
 *
 * Obsah ostáva v `/learning/tests/page.tsx` — zdieľa práva, hlavičku
 * a podmenu. Táto stránka ho len zapne.
 */
import LearningTestsPage from "../../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ImportQuestionsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return LearningTestsPage({ searchParams: Promise.resolve({ ...(await searchParams), tab: "questions", import: "1" }) })
}
