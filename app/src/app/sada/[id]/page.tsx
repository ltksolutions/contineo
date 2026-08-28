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
import { nacitajSadu, znenie } from "@/lib/sada"
import OtazkaSady from "@/components/OtazkaSady"

export const dynamic = "force-dynamic"

// `params` je od Next 15 prísľub.
export default async function DetailOtazky({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sedenie = await getServerSession(authOptions)
  const vsetky = await nacitajSadu(sedenie?.user?.email ?? "")
  const otazka = vsetky.find(o => o.id === id)
  if (!otazka) notFound()

  const poradie = vsetky.findIndex(o => o.id === id)
  const zvysne = vsetky.slice(poradie + 1)

  // Najprv hľadáme otázku, ktorú TENTO človek ešte neposúdil — nie ktorú
  // neposúdil nikto. Pri prekryve je druhý posudok rovnako potrebný ako prvý.
  const dalsia =
    zvysne.find(o => !o.vyradena && o.stav === null)?.id ??
    vsetky.find(o => !o.vyradena && o.stav === null && o.id !== id)?.id ??
    null

  return (
    <div className="obal" style={{ padding: "28px 20px 80px" }}>
      <OtazkaSady
        id={otazka.id}
        znenie={znenie(otazka)}
        povodne={otazka.povodneZnenie}
        upravene={otazka.upraveneZnenie}
        vyradena={otazka.vyradena}
        dovodVyradenia={otazka.dovodVyradenia}
        trapType={otazka.trapType}
        expectedBehaviour={otazka.expectedBehaviour}
        precedenceRule={otazka.precedenceRule}
        searchMode={otazka.searchMode}
        prekryv={otazka.prekryv}
        cudzie={otazka.cudzie.map(c => ({ hodnotitel: c.hodnotitel, spravna: c.spravna }))}
        dalsia={dalsia}
      />
    </div>
  )
}
