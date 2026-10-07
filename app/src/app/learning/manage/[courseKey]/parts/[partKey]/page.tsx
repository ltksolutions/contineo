/**
 * /learning/manage/[courseKey]/parts/[partKey] — detail časti kurzu s blokmi
 * (rám `docs/design/MANAGE-COURSE-uprava-kurzu.md`).
 *
 * Do 7. 10. 2026 to boli parametre `?tab=parts&part=…`; časť, ktorú má
 * cesta pomenovať, má vlastnú adresu (CLAUDE.md, R3 v
 * `docs/DESIGN_ODCHYLKY.md`). Starý tvar presmeruje `proxy.ts`
 * (`legacyQueryRoute`). Formulár „Pridať blok" ostáva v parametri `?add=` —
 * miesto sa ním nemení.
 *
 * Obsah ostáva v `../../page.tsx`; táto stránka ho len zapne.
 */
import { notFound } from "next/navigation"
import ManageCoursePage from "../../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function CoursePartPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseKey: string; partKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const { courseKey, partKey } = await params
  const part = decodeURIComponent(partKey)
  if (!part) notFound()
  return ManageCoursePage({
    params: Promise.resolve({ courseKey }),
    searchParams: Promise.resolve({ ...(await searchParams), tab: "parts", part }),
  })
}
