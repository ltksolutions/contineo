/**
 * Detail otázky zo zlatej sady.
 *
 * Server nájde otázku aj tú nasledujúcu, aby sa dalo plynulo pokračovať.
 * Preskakujú sa vyradené a už posúdené — hodnotiteľ chce ďalšiu prácu,
 * nie prechádzať to, čo je hotové.
 */

import { notFound } from "next/navigation"
import { nacitajSadu, znenie } from "@/lib/sada"
import OtazkaSady from "@/components/OtazkaSady"

export const dynamic = "force-dynamic"

export default async function DetailOtazky({ params }: { params: { id: string } }) {
  const vsetky = await nacitajSadu()
  const otazka = vsetky.find(o => o.id === params.id)
  if (!otazka) notFound()

  const poradie = vsetky.findIndex(o => o.id === params.id)
  const zvysne = vsetky.slice(poradie + 1)

  // Najprv hľadáme neposúdenú za aktuálnou; keď žiadna nie je, vraciame sa
  // na začiatok. Tak sa dá sada dokončiť aj pri preskakovaní.
  const dalsia =
    zvysne.find(o => !o.vyradena && o.stav === null)?.id ??
    vsetky.find(o => !o.vyradena && o.stav === null && o.id !== params.id)?.id ??
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
        dalsia={dalsia}
      />
    </div>
  )
}
