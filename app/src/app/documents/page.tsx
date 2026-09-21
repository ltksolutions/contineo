/**
 * Zoznam dokumentov, ktoré má prihlásená osoba potvrdiť.
 *
 * Stav sa **odvodzuje** z potvrdení (D27), nikde sa neukladá — preto je to
 * serverový komponent bez vlastného stavu. Po potvrdení sa stránka jednoducho
 * načíta znova a číslo sa zmení samo.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { acknowledgementDuties } from "@/lib/pending"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/lib/appNav"
import type { RawQuery } from "@/lib/urlParams"
import { normalizeQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { dueState } from "@/lib/due"

export const dynamic = "force-dynamic"

export default async function DocumentsPage({
  searchParams,
}: {
  // Variant navigácie je zatiaľ len z adresy (`?layout=sidebar`), rovnako
  // ako v knižnici. Uložiť ho na osobu je zmena schémy a samostatné
  // rozhodnutie.
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await onboardingContext()

  // Neznámy hostiteľ sa správa ako zakázaný (D29) — a to `notFound()`, nie
  // vysvetľujúcou hláškou. Kto si nasmeruje vlastnú doménu na naše nasadenie,
  // sa nemá dozvedieť ani to, že tu nejaká aplikácia beží.
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")

  if (ctx.state === "not-in-tenant") {
    // Prihlásený, ale medzi osobami tohto tenanta nie je — typicky správca,
    // ktorý prešiel núdzovou brzdou `ALLOWED_EMAILS`, alebo človek inej
    // organizácie na cudzej doméne. Poslať ho späť na prihlásenie by vyzeralo
    // ako pokazená stránka: je predsa prihlásený.
    // Zámerne **bez shellu**: kto nie je medzi osobami tenanta, nemá kam
    // navigovať — navigácia by mu ponúkla sekcie, do ktorých ho stránky
    // nepustia.
    return (
      <div className="wrap" style={{ padding: "36px 20px 80px", maxWidth: 760 }}>
        <h1 className="page-title" style={{ margin: "0 0 8px" }}>
          {dictionary(ctx.tenant.defaultLanguage).onboarding.listHeading}
        </h1>
        <p className="card" style={{ padding: 20 }}>
          {dictionary(ctx.tenant.defaultLanguage).documents.notInOrganisation(
            ctx.email ?? "",
            ctx.tenant.branding.displayName,
          )}
        </p>
      </div>
    )
  }

  const person = ctx.person
  const branding = brandingView(ctx.tenant)

  const t = dictionary(person.language).onboarding
  // „do 12. 9. 2026" je ten istý kľúč ako na Prehľade — nie nový.
  const tOverview = dictionary(person.language).overview
  const now = new Date()

  /*
    Jeden výpočet pre štítok aj pre túto obrazovku.

    Dovtedy tu stálo len `trackProgress()`, teda **iba trasy**. Kto mal
    dokument pridelený mimo trasy, videl v navigácii „Na potvrdenie 1"
    a tu „Momentálne nemáte nič na potvrdenie" — povinnosť dostal a cestu
    k jej splneniu nie. Nájdené nácvikom 2026-09-14.
  */
  const duties = await acknowledgementDuties(person)
  const tracks = duties.tracks
  const outside = duties.outsideTracks
  /*
    Termín kroku (DOCUMENTS, úloha 1). Kroky trasy (`tracks[].steps`) termín
    nenesú, ale položky z tých istých krokov (`fromTracks`) áno — ten istý
    výpočet, ktorý kreslí chip na Prehľade. Netreba nový návratový typ ani
    druhý dotaz, stačí ich spárovať podľa dokumentu.
  */
  const dueByDocument = new Map(duties.fromTracks.map(i => [i.id, i.due]))
  const done = tracks.reduce((a, tr) => a + tr.doneCount, 0)
  const total = tracks.reduce((a, tr) => a + tr.totalCount, 0)

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={person.language}>
    {/* Šírka 760 px zostáva: je to text na čítanie, nie tabuľka. Shell dáva
        odsadenie a navigáciu, obmedzenie riadka je vec obsahu. */}
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <h1 className="page-title" style={{ margin: "0 0 8px" }}>
        {t.listHeading}
      </h1>
      <p className="quiet page-lead" style={{ margin: "0 0 8px" }}>{t.listIntro}</p>

      {/*
        Celkový súčet len pri viacerých trasách. Pri jednej by pod sebou
        stálo dvakrát to isté číslo — raz ako súčet, raz pri trase.
      */}
      {total > 0 && tracks.length > 1 && (
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 24px" }}>
          {t.progress(done, total)}
        </p>
      )}

      {total === 0 && outside.length === 0 && (
        <p className="card" style={{ padding: 20 }}>{t.nothingToDo}</p>
      )}

      {/*
        Trasy sa **nesplošťujú**. Jedna kopa dokumentov by zahodila poradie
        aj to, kde človek skončil — a práve to sú jediné dve veci, ktoré
        trasa navyše hovorí.
      */}
      {tracks.map(tr => (
        <section key={tr.key} style={{ margin: "0 0 32px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 4px" }}>
            <h2 style={{ fontSize: "var(--fs-section)", letterSpacing: "-0.01em", margin: 0, flex: "1 1 auto" }}>
              {tr.title}
            </h2>
            <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
              {tr.nextOrder === null ? t.trackComplete : t.progress(tr.doneCount, tr.totalCount)}
            </span>
          </div>

          {tr.description && (
            <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 12px" }}>{tr.description}</p>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 12 }}>
            {tr.steps.map(s => {
              const isNext = s.order === tr.nextOrder
              // Bez termínu bez chipu — absencia termínu je bežný stav, nie šum.
              const due = s.done || s.blocked ? null : dueByDocument.get(s.documentId) ?? null
              return (
                <li
                  key={`${tr.key}-${s.order}`}
                  className="card"
                  style={{
                    padding: "16px 18px",
                    // Miesto, kde človek skončil, musí byť vidieť na prvý
                    // pohľad — nie až po prečítaní všetkých štítkov.
                    borderColor: isNext ? "var(--accent)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className="quiet" style={{ fontSize: "var(--fs-small)", flex: "0 0 auto" }}>
                      {t.step(s.order, tr.totalCount)}
                    </span>
                    <strong style={{ fontSize: "var(--fs-lead)", flex: "1 1 260px" }}>{s.title}</strong>

                    {due && (
                      <span className={`due-chip duty-due due-chip--${dueState(due, now)}`}>
                        {tOverview.by(formatDate(due, person.language))}
                      </span>
                    )}

                    {s.blocked ? (
                      <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                        {t.blocked}
                      </span>
                    ) : s.done ? (
                      <span className="tag" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                        {t.done}
                      </span>
                    ) : (
                      <span className="tag">{isNext ? t.continueHere : t.todo}</span>
                    )}
                  </div>

                  <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>
                    {s.blocked
                      ? t.blockedReason[s.blocked] ?? s.blocked
                      : t.version(s.versionLabel ?? "", formatDate(s.effectiveFrom!, person.language))}
                  </p>

                  {!s.blocked && (
                    <p style={{ margin: "12px 0 0" }}>
                      <Link
                        className={isNext ? "button" : "button button--quiet"}
                        /*
                          Kľúč trasy ide so sebou, aby sa do dôkazného
                          záznamu dostalo, **ako** sa človek k dokumentu
                          dostal. Server si ho aj tak overí — z adresy je to
                          tvrdenie prehliadača, nie fakt.
                        */
                        href={`/documents/${encodeURIComponent(s.documentId)}?track=${encodeURIComponent(tr.key)}`}
                      >
                        {t.open}
                      </Link>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {/*
        Pridelené mimo trasy. Vlastná sekcia, nie prilepenie k trasám: trasa
        hovorí „a v tomto poradí", pridelenie hovorí len „toto je vaša
        povinnosť". Zmiešať ich by predstieralo poradie, ktoré nikto neurčil.
      */}
      {outside.length > 0 && (
        <section style={{ margin: "0 0 32px" }}>
          <h2 style={{ fontSize: "var(--fs-section)", letterSpacing: "-0.01em", margin: "0 0 12px" }}>
            {t.assignedHeading}
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {outside.map(item => (
              <li key={item.id} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "var(--fs-lead)", flex: "1 1 260px" }}>{item.title}</strong>
                  {item.due && (
                    <span className={`due-chip duty-due due-chip--${dueState(item.due, now)}`}>
                      {tOverview.by(formatDate(item.due, person.language))}
                    </span>
                  )}
                  <span className="tag">{t.todo}</span>
                </div>
                {item.detail && (
                  <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>{item.detail}</p>
                )}
                <p style={{ margin: "12px 0 0" }}>
                  <Link className="button" href={item.href}>{t.open}</Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
    </AppShell>
  )
}
