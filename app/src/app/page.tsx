/**
 * Domovská strana.
 *
 * Poradie na nej nie je vecou vkusu. Odkaz na prihlásenie príde človeku
 * e-mailom a prvá obrazovka, ktorú po kliknutí uvidí, je táto — takže hore
 * patrí to, čo od neho chceme, a nie ukážka toho, čo systém vie. Hľadanie
 * zostáva pod tým: hodnotiteľ ho má stále na dosah (D9, otvorený bod E1).
 *
 * Widget sa **neukazuje každému**. Kto nemá ani jednu trasu, nemá tam čo
 * dostať ani o rok — prázdna karta „Nevybavené žiadosti" by mu len zabrala
 * prvú obrazovku. Rovnako sa neukazuje správcovi, ktorý prešiel núdzovou
 * brzdou a v `persons` nie je vôbec.
 */

import { notFound } from "next/navigation"
import Hladanie from "@/components/Search"
import NevybaveneZiadosti from "@/components/PendingWidget"
import { onboardingContext } from "@/lib/session"
import { pendingForPerson } from "@/lib/pending"

// Stránka číta hlavičky požiadavky (hostiteľ → tenant) a reláciu, takže sa
// nedá predgenerovať. Bez tohto by Next.js skúsil statický výstup a spadol.
export const dynamic = "force-dynamic"

export default async function Domov() {
  const ctx = await onboardingContext()

  // Neznámy hostiteľ je zakázaný, nie predvolený (D29). `notFound()`, nie
  // vysvetlenie: kto si nasmeruje vlastnú doménu na naše nasadenie, sa nemá
  // dozvedieť ani to, že tu nejaká aplikácia beží.
  if (ctx.state === "unknown-host") notFound()

  const person = ctx.state === "ready" ? ctx.person : null
  const overview =
    person && person.tracks.length > 0 ? await pendingForPerson(person) : null

  return (
    <div className="obal" style={{ padding: "28px 20px 80px" }}>
      {overview && person && (
        <div style={{ marginBottom: 32 }}>
          <NevybaveneZiadosti overview={overview} language={person.language} />
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Vyskúšajte, ako systém odpovedá
        </h1>
        <p className="tichy" style={{ fontSize: 15.5, margin: 0, maxWidth: 620 }}>
          Odpoveď sa skladá výlučne z nahraných dokumentov. Ak informácia
          v nich nie je, systém to má povedať — a to je rovnako dôležité ako
          správna odpoveď.
        </p>
      </div>

      <Hladanie />
    </div>
  )
}
