/**
 * Opýtať sa (`/ask`) — obrazovka odpovede (ASK-otazka-z-hlavicky).
 *
 * Kedysi to bola domovská strana; od PR 5 je `/` Prehľad s KPI a táto routa
 * je obrazovka odpovede. **Routa nesmie zmiznúť:** `?q=` sem posiela pole
 * v hlavičke z každej obrazovky portálu. Odpovedá sa na jednom mieste,
 * pýtať sa dá všade.
 *
 * - **S otázkou** (`?q=`): nadpis je otázka a beh sa spustí hneď
 *   (`Search`) — po odoslaní netreba nič robiť, len čítať.
 * - **Bez otázky** (napr. z tabbaru na telefóne): nadpis, jedna veta
 *   a plachta otázky vložená do stránky (`AskSheet inline`). Je to
 *   `GET` formulár, takže otázka odíde aj bez JavaScriptu.
 *
 * „Nevybavené žiadosti" (`PendingWidget`, D36) a úvod testovacieho
 * rozhrania odtiaľto odišli (Q2, 30. 9. 2026): úlohy sú na Prehľade v KPI
 * aj v paneli „Pre vás" a D36 platilo, kým `/ask` bola úvodná strana.
 */

import { notFound } from "next/navigation"
import Search from "@/components/Search"
import AskSheet from "@/components/AskSheet"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { dictionary } from "@/lib/i18n"
import AppShell from "@/components/AppShell"
import { evaluationContext } from "@/lib/evaluation"

// Stránka číta hlavičky požiadavky (hostiteľ → tenant) a reláciu, takže sa
// nedá predgenerovať. Bez tohto by Next.js skúsil statický výstup a spadol.
export const dynamic = "force-dynamic"

export default async function AskPage({
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
  const asked = (Array.isArray(q?.q) ? q?.q[0] : q?.q)?.trim() || ""
  const ctx = await onboardingContext()

  // Neznámy hostiteľ je zakázaný, nie predvolený (D29). `notFound()`, nie
  // vysvetlenie: kto si nasmeruje vlastnú doménu na naše nasadenie, sa nemá
  // dozvedieť ani to, že tu nejaká aplikácia beží.
  if (ctx.state === "unknown-host") notFound()

  const person = ctx.state === "ready" ? ctx.person : null
  const t = dictionary(person?.language).ask
  const branding = brandingView(ctx.tenant)
  const organisation = branding.displayName
  const short = branding.shortName?.trim() || branding.displayName

  /*
   * Či človek uvidí pod odpoveďou celý hodnotiaci panel, alebo len
   * „sedí / nesedí". Rozhoduje sa **na serveri**; klient si rolu
   * neodvodzuje a ani keby si príznak podstrčil, API posudok bez roly
   * odmietne (D32).
   */
  const canEvaluate = (await evaluationContext()).state === "ready"

  return (
    <AppShell language={person?.language}>
      <div className="ask-page">
        {asked ? (
          // `key` mení identitu komponentu s otázkou: nová otázka z hlavičky
          // je nová adresa a má byť aj nový beh, nie pokračovanie starého.
          <Search
            key={asked}
            preset={asked}
            organisation={short}
            language={person?.language}
            canEvaluate={canEvaluate}
          />
        ) : (
          <>
            <h1 className="page-title">{t.heading}</h1>
            <p className="quiet page-lead ask-empty-lead">{t.emptyLead}</p>
            <AskSheet mode="inline" organisation={organisation} language={person?.language} />
          </>
        )}
      </div>
    </AppShell>
  )
}
