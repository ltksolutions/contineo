/**
 * Opýtať sa (`/ask`) — jediné miesto, kde sa otázka odpovedá.
 *
 * Kedysi to bola domovská strana; od PR 5 je `/` Prehľad s KPI a táto routa
 * je obrazovka odpovede. **Routa nesmie zmiznúť:** `?q=` sem posiela pole
 * v hlavičke z každej obrazovky portálu aj hero pole Prehľadu. Odpovedá sa
 * na jednom mieste, pýtať sa dá všade.
 *
 * Widget sa **neukazuje každému**. Kto nemá ani jednu trasu, nemá tam čo
 * dostať ani o rok — prázdna karta „Nevybavené žiadosti" by mu len zabrala
 * prvú obrazovku. Rovnako sa neukazuje správcovi, ktorý prešiel núdzovou
 * brzdou a v `persons` nie je vôbec.
 */

import { notFound } from "next/navigation"
import Search from "@/components/Search"
import PendingWidget from "@/components/PendingWidget"
import { onboardingContext } from "@/lib/session"
import { pendingForPerson } from "@/lib/pending"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"
import { evaluationContext } from "@/lib/evaluation"

// Stránka číta hlavičky požiadavky (hostiteľ → tenant) a reláciu, takže sa
// nedá predgenerovať. Bez tohto by Next.js skúsil statický výstup a spadol.
export const dynamic = "force-dynamic"

export default async function HomePage({
  searchParams,
}: {
  /*
   * `?q=` prichádza z globálneho poľa v hlavičke. Je to **odovzdanie otázky,
   * nie filter**: pole v hlavičke je na celom portáli a odpovedať sa dá len
   * tu, takže otázka musí prejsť adresou. Vďaka tomu funguje aj bez
   * JavaScriptu — hlavička odošle obyčajný `GET` a táto stránka ho prečíta.
   */
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const q = await searchParams
  const asked = Array.isArray(q?.q) ? q?.q[0] : q?.q
  const ctx = await onboardingContext()

  // Neznámy hostiteľ je zakázaný, nie predvolený (D29). `notFound()`, nie
  // vysvetlenie: kto si nasmeruje vlastnú doménu na naše nasadenie, sa nemá
  // dozvedieť ani to, že tu nejaká aplikácia beží.
  if (ctx.state === "unknown-host") notFound()

  const person = ctx.state === "ready" ? ctx.person : null
  const t = dictionary(person?.language)
  const overview =
    person && person.tracks.length > 0 ? await pendingForPerson(person) : null

  /*
   * Či človek uvidí pod odpoveďou celý hodnotiaci panel, alebo len
   * „sedí / nesedí". Rozhoduje sa **na serveri**; klient si rolu
   * neodvodzuje a ani keby si príznak podstrčil, API posudok bez roly
   * odmietne (D32).
   */
  const canEvaluate = (await evaluationContext()).state === "ready"

  return (
    <AppShell language={person?.language}>
    <div>
      {overview && person && (
        <div style={{ marginBottom: 32 }}>
          <PendingWidget overview={overview} language={person.language} />
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title" style={{ margin: "0 0 8px" }}>
          {t.home.heading}
        </h1>
        <p className="quiet page-lead" style={{ margin: 0, maxWidth: 620 }}>
          {t.home.intro}
        </p>
      </div>

      {/* `key` mení identitu komponentu s otázkou. `preset` sa v `Search`
          číta len pri pripojení, takže bez tohto by druhá otázka z hlavičky
          pole neprepísala, keby Next navigáciu spracoval na klientovi. */}
      <Search
        key={asked ?? ""}
        language={person?.language}
        preset={asked?.trim() || undefined}
        canEvaluate={canEvaluate}
      />
    </div>
    </AppShell>
  )
}
