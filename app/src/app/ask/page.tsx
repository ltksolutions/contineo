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
import { scopeFromQuery, documentIdsFromQuery, type AskScopeDocument } from "@/lib/askScope"
import { askLiveSources } from "@/lib/askSources"
import { loadDocumentFor } from "@/lib/documents"

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
  const short = branding.shortName?.trim() || branding.displayName

  /*
   * Či človek uvidí pod odpoveďou celý hodnotiaci panel, alebo len
   * „sedí / nesedí". Rozhoduje sa **na serveri**; klient si rolu
   * neodvodzuje a ani keby si príznak podstrčil, API posudok bez roly
   * odmietne (D32).
   */
  const canEvaluate = (await evaluationContext()).state === "ready"
  // Živé zdroje (ADR-029): len tie, ktoré sa pri otázke naozaj zavolajú —
  // s úrovňou pýtajúceho sa a bez volania servera.
  const liveSources = await askLiveSources(ctx)
  // Rozsah z adresy — oba tvary `src` (so skriptom aj bez neho), `askScope.ts`.
  const initialScope = scopeFromQuery(q?.src, liveSources.map(l => l.id))
  /*
   * Zúženie knižnice na dokumenty (`?doc=`, ADR-029 D269). Dokument sa
   * načíta **pre osobu** (D32): cudzí alebo neviditeľný sa z adresy zahodí
   * ako neznáme id zdroja. Názov je kópia do hlavičky a záznamu.
   */
  const documents: AskScopeDocument[] = person
    ? (await Promise.all(documentIdsFromQuery(q?.doc).map(id => loadDocumentFor(person, id))))
        .filter(d => d !== null)
        .map(d => ({ id: d.documentId, title: d.title }))
    : []

  return (
    <AppShell language={person?.language}>
      <div className="ask-page">
        {asked ? (
          // `key` mení identitu komponentu s otázkou: nová otázka z hlavičky
          // je nová adresa a má byť aj nový beh, nie pokračovanie starého.
          // Aj iný výber zdrojov k tej istej otázke (plachta, ASK-zdroje-v-plachte).
          <Search
            key={`${asked}\u0000${initialScope.join(",")}\u0000${documents.map(d => d.id).join(",")}`}
            preset={asked}
            organisation={short}
            language={person?.language}
            canEvaluate={canEvaluate}
            liveSources={liveSources}
            initialScope={initialScope}
            documents={documents}
          />
        ) : (
          <>
            <h1 className="page-title">{t.heading}</h1>
            <p className="quiet page-lead ask-empty-lead">{t.emptyLead}</p>
            {/* Zdroje zo servera — vložená plachta ich má aj bez JS (ASK-zdroje-v-plachte). */}
            <AskSheet
              mode="inline"
              organisation={short}
              live={liveSources}
              language={person?.language}
              initialSources={initialScope.length ? initialScope : undefined}
              initialDocuments={documents}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
