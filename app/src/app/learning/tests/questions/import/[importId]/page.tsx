/**
 * /learning/tests/questions/import/[importId] — náhľad nahratého importu
 * otázok (rám `docs/design/TESTS-testy-a-banka.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=questions&import=<id>`; časť, ktorú
 * má cesta pomenovať, má vlastnú adresu (CLAUDE.md, R3 v
 * `docs/DESIGN_ODCHYLKY.md`). Starý tvar presmeruje `proxy.ts`
 * (`legacyQueryRoute`).
 *
 * Obsah ostáva v `/learning/tests/page.tsx`; táto stránka ho len zapne.
 */
import LearningTestsPage from "../../../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ importId: string }>
  searchParams: Promise<RawQuery>
}) {
  const id = decodeURIComponent((await params).importId)
  return LearningTestsPage({ searchParams: Promise.resolve({ ...(await searchParams), tab: "questions", import: id }) })
}
