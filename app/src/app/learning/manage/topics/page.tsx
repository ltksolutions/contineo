/**
 * /learning/manage/topics — témy kurzov (rám `docs/design/MANAGE-sprava-kurzov.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=topics`; časť, ktorú má cesta
 * pomenovať, má vlastnú adresu (CLAUDE.md, R3 v `docs/DESIGN_ODCHYLKY.md`).
 * Starý tvar presmeruje `proxy.ts` (`legacyQueryRoute`).
 *
 * Obsah ostáva v `../page.tsx` (zdieľa práva, hlavičku a podmenu) — táto
 * stránka ho len zapne. Slovo `topics` je preto vyhradené ako kľúč kurzu.
 */
import LearningManagePage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ManageTopicsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return LearningManagePage({ searchParams: Promise.resolve({ ...(await searchParams), tab: "topics" }) })
}
