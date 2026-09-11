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
import Search from "@/components/Search"
import PendingWidget from "@/components/PendingWidget"
import { onboardingContext } from "@/lib/session"
import { pendingForPerson } from "@/lib/pending"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"

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

  return (
    <AppShell language={person?.language}>
    <div>
      {overview && person && (
        <div style={{ marginBottom: 32 }}>
          <PendingWidget overview={overview} language={person.language} />
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          {t.home.heading}
        </h1>
        <p className="quiet" style={{ fontSize: 15.5, margin: 0, maxWidth: 620 }}>
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
      />
    </div>
    </AppShell>
  )
}
