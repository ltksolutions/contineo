/**
 * Detail otázky zo zlatej sady.
 *
 * Server nájde otázku aj tú nasledujúcu, aby sa dalo plynulo pokračovať.
 * Preskakujú sa vyradené a už posúdené — hodnotiteľ chce ďalšiu prácu,
 * nie prechádzať to, čo je hotové.
 */

import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { loadGoldenSet, questionText } from "@/lib/goldenSet"
import GoldenSetQuestion from "@/components/GoldenSetQuestion"

export const dynamic = "force-dynamic"

// `params` je od Next 15 prísľub.
export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const all = await loadGoldenSet(session?.user?.email ?? "")
  const question = all.find(o => o.id === id)
  if (!question) notFound()

  const position = all.findIndex(o => o.id === id)
  const remaining = all.slice(position + 1)

  // Najprv hľadáme otázku, ktorú TENTO človek ešte neposúdil — nie ktorú
  // neposúdil nikto. Pri prekryve je druhý posudok rovnako potrebný ako prvý.
  const next =
    remaining.find(o => !o.vyradena && o.stav === null)?.id ??
    all.find(o => !o.vyradena && o.stav === null && o.id !== id)?.id ??
    null

  return (
    <div className="obal" style={{ padding: "28px 20px 80px" }}>
      <GoldenSetQuestion
        id={question.id}
        znenie={questionText(question)}
        povodne={question.povodneZnenie}
        upravene={question.upraveneZnenie}
        vyradena={question.vyradena}
        dovodVyradenia={question.dovodVyradenia}
        trapType={question.trapType}
        expectedBehaviour={question.expectedBehaviour}
        precedenceRule={question.precedenceRule}
        searchMode={question.searchMode}
        prekryv={question.prekryv}
        cudzie={question.cudzie.map(c => ({ hodnotitel: c.hodnotitel, spravna: c.spravna }))}
        dalsia={next}
      />
    </div>
  )
}
