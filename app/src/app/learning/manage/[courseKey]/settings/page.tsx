/**
 * /learning/manage/[courseKey]/settings — nastavenia kurzu (rám
 * `docs/design/MANAGE-COURSE-uprava-kurzu.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=settings`; časť, ktorú má cesta
 * pomenovať, má vlastnú adresu (CLAUDE.md, R3 v `docs/DESIGN_ODCHYLKY.md`).
 * Starý tvar presmeruje `proxy.ts` (`legacyQueryRoute`).
 *
 * Obsah ostáva v `../page.tsx` — zdieľa načítanie kurzu, kartu stavu
 * verzie aj podmenu. Táto stránka ho len zapne.
 */
import ManageCoursePage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function CourseSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseKey: string }>
  searchParams: Promise<RawQuery>
}) {
  return ManageCoursePage({ params, searchParams: Promise.resolve({ ...(await searchParams), tab: "settings" }) })
}
