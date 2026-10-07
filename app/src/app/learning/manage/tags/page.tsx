/**
 * /learning/manage/tags — smart:tagy (rám `docs/design/MANAGE-sprava-kurzov.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=tags`; časť, ktorú má cesta
 * pomenovať, má vlastnú adresu (CLAUDE.md, R3 v `docs/DESIGN_ODCHYLKY.md`).
 * Starý tvar presmeruje `proxy.ts` (`legacyQueryRoute`).
 *
 * Obsah ostáva v `../page.tsx` (zdieľa práva, hlavičku a podmenu) — táto
 * stránka ho len zapne. Slovo `tags` je preto vyhradené ako kľúč kurzu.
 */
import LearningManagePage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ManageTagsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return LearningManagePage({ searchParams: Promise.resolve({ ...(await searchParams), tab: "tags" }) })
}
