/**
 * Zoznam osôb organizácie (D46).
 *
 * Vyradení sú v zozname tiež, len označení. Skryť ich by znamenalo, že
 * personalista nevie, prečo sa mu nedá pozvať adresa, ktorú tam „nikto nemá" —
 * a skončil by tak, že skúša tú istú vec dvakrát.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext, listPeople } from "@/lib/people"
import { availableOptions } from "@/lib/codelistsTenant"
import { displayName, needsInvitation, workplaceLabel } from "@/lib/personFields"
import { personTagClass, personDisplayStatus } from "@/lib/persons"
import SubmitButton from "@/components/SubmitButton"
import { resendInviteAction } from "./actions"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import LiveFilter from "@/components/LiveFilter"
import SearchStrip from "@/components/SearchStrip"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { q, msg: message, error } = normalizeQuery<{ q?: string; msg?: string; error?: string }>(await searchParams)
  const people = await listPeople(ctx.person.companyCode, q)
  const workplaces = availableOptions(ctx.tenant, "workplace")
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).people.list
  const td = dictionary(language).people.detail
  // Po odoslaní pozvánky zo zoznamu sa vráti sem, aj s hľadaním.
  const back = q ? `/people?q=${encodeURIComponent(q)}` : "/people"

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      {/*
        Akcie vpravo v riadku nadpisu, plná posledná (ZAKLAD-podmenu-a-akcie,
        2. 10. 2026). Na telefóne plná na celú šírku, dve tiché pod ňou.
      */}
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        <span className="page-head-spacer" aria-hidden="true" />
        <div className="page-actions">
          <Link className="button button--quiet" href="/people/import">{t.importCsv}</Link>
          <Link className="button button--quiet" href="/people/invite">
            {dictionary(language).people.inviteAll.open}
          </Link>
          <Link className="button page-actions-primary" href="/people/new">{t.invite}</Link>
        </div>
      </div>
      <p className="quiet page-lead" style={{ maxWidth: 620 }}>
        {t.introBefore}<strong>{t.introHighlight}</strong>{t.introAfter}
      </p>

      <Notice message={message} error={error === "1"} back={q ? `/people?q=${encodeURIComponent(q)}` : "/people"} />

      {/* Serverový formulár — hľadanie je v adrese, takže sa dá poslať odkazom
          a vrátiť sa naň z histórie prehliadača. */}
      <LiveFilter className="list-search" action="/people" label={t.searchPlaceholder}>
        {/* Lupa vnútri pásu (`SearchStrip`, ZAKLAD odchýlka B): hľadá sa
            reťazec v zozname, nepýta sa model. Odosiela Enter aj `LiveFilter`. */}
        <SearchStrip
          name="q"
          defaultValue={q ?? ""}
          placeholder={t.searchPlaceholder}
          label={t.searchPlaceholder}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </LiveFilter>

      {/* Počet len keď je čo počítať — prázdny stav hovorí za seba. */}
      {people.length > 0 && (
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 10px" }}>
          {t.count(people.length)}{q ? t.matchesSearch : ""}
          {people.length === 500 && t.capped}
        </p>
      )}

      {/* Dva prázdne stavy (OSOBY.md, úloha 4): organizácia bez ľudí nie je
          to isté ako filter, ktorý nič nenašiel — a pri filtri má byť cesta
          späť k celému zoznamu. */}
      {people.length === 0 && (
        <div className="empty">
          <div className="empty-title">{q ? t.emptyFilterTitle : t.emptyTitle}</div>
          <div className="empty-text">{q ? t.emptyFilterText : t.emptyText}</div>
          {q && (
            <div className="empty-action">
              <Link className="button button--quiet" href="/people">{t.clearFilter}</Link>
            </div>
          )}
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {people.map(o => {
          return (
            <li key={o.id} className={`card person-card${o.status === "inactive" ? " is-excluded" : ""}`} style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Link
                  href={`/people/${encodeURIComponent(o.id)}`}
                  style={{ fontSize: "var(--fs-lead)", fontWeight: 700 }}
                >
                  {displayName(o)}
                </Link>
                {/* Stav farbou, role neutrálne (OSOBY.md, úloha 1). */}
                <span className={personTagClass(o)}>{t.status[personDisplayStatus(o)] ?? o.status}</span>
                {o.roles.map(r => (
                  <span key={r} className="tag">{r}</span>
                ))}
                <span className="quiet" style={{ fontSize: "var(--fs-small)", marginLeft: "auto" }}>
                  {o.lastLoginAt ? formatDate(o.lastLoginAt, language) : t.neverSignedIn}
                </span>
              </div>

              {/*
                Pozícia a pracovisko patria do prvého riadku pod meno: keď
                personalista hľadá „správcu ihriska v Senci", je to presne to,
                podľa čoho v zozname rozhoduje. Adresa a skupiny sú až potom.
              */}
              {(o.jobTitle || o.workplace) && (
                <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "5px 0 0" }}>
                  {[o.jobTitle, workplaceLabel(o.workplace, workplaces)].filter(Boolean).join(" · ")}
                </p>
              )}

              <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "3px 0 0", overflowWrap: "anywhere" }}>
                {o.email}
                {o.department && ` · ${o.department}`}
                {o.groups.length > 0 && ` · ${o.groups.join(", ")}`}
              </p>

              {/* Pozvánka priamo zo zoznamu (Ján 28. 9. 2026) — tá istá akcia
                  a to isté pravidlo ako na karte osoby (`needsInvitation`). */}
              {needsInvitation(o) && (
                <form action={resendInviteAction} className="person-invite">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="button button--quiet">{o.invitationSentAt ? td.inviteSubmit : td.inviteSubmitFirst}</SubmitButton>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </div>
    </AppShell>
  )
}
