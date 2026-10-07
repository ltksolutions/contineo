/**
 * /learning/tests/questions/[questionKey] — úprava otázky z banky
 * (rám `docs/design/TESTS-testy-a-banka.md`).
 *
 * Do 7. 10. 2026 to bol parameter `?tab=questions&q=<kľúč>`; časť, ktorú má
 * cesta pomenovať, má vlastnú adresu (CLAUDE.md, R3 v
 * `docs/DESIGN_ODCHYLKY.md`). Starý tvar presmeruje `proxy.ts`
 * (`legacyQueryRoute`). Kľúče `new` a `import` sú preto vyhradené.
 *
 * Obsah ostáva v `/learning/tests/page.tsx`; neznámy kľúč vráti 404.
 */
import LearningTestsPage from "../../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function EditQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const key = decodeURIComponent((await params).questionKey)
  return LearningTestsPage({ searchParams: Promise.resolve({ ...(await searchParams), tab: "questions", q: key }) })
}
