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
import { trackProgress } from "@/lib/tracks"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const ctx = await onboardingContext()

  // Neznámy hostiteľ sa správa ako zakázaný (D29) — a to `notFound()`, nie
  // vysvetľujúcou hláškou. Kto si nasmeruje vlastnú doménu na naše nasadenie,
  // sa nemá dozvedieť ani to, že tu nejaká aplikácia beží.
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/prihlasenie")

  if (ctx.state === "not-in-tenant") {
    // Prihlásený, ale medzi osobami tohto tenanta nie je — typicky správca,
    // ktorý prešiel núdzovou brzdou `ALLOWED_EMAILS`, alebo človek inej
    // organizácie na cudzej doméne. Poslať ho späť na prihlásenie by vyzeralo
    // ako pokazená stránka: je predsa prihlásený.
    return (
      <div className="obal" style={{ padding: "36px 20px 80px", maxWidth: 760 }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          {dictionary(ctx.tenant.defaultLanguage).onboarding.listHeading}
        </h1>
        <p className="karta" style={{ padding: 20 }}>
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
  const tracks = await trackProgress(person)
  const done = tracks.reduce((a, tr) => a + tr.doneCount, 0)
  const total = tracks.reduce((a, tr) => a + tr.totalCount, 0)

  return (
    <div className="obal" style={{ padding: "36px 20px 80px", maxWidth: 760, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
        {t.listHeading}
      </h1>
      <p className="tichy" style={{ fontSize: 15.5, margin: "0 0 8px" }}>{t.listIntro}</p>

      {total > 0 && (
        <p className="tichy" style={{ fontSize: 14, margin: "0 0 24px" }}>
          {t.progress(done, total)}
        </p>
      )}

      {total === 0 && (
        <p className="karta" style={{ padding: 20 }}>{t.nothingToDo}</p>
      )}

      {/*
        Trasy sa **nesplošťujú**. Jedna kopa dokumentov by zahodila poradie
        aj to, kde človek skončil — a práve to sú jediné dve veci, ktoré
        trasa navyše hovorí.
      */}
      {tracks.map(tr => (
        <section key={tr.key} style={{ margin: "0 0 32px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 4px" }}>
            <h2 style={{ fontSize: 19, letterSpacing: "-0.01em", margin: 0, flex: "1 1 auto" }}>
              {tr.title}
            </h2>
            <span className="tichy" style={{ fontSize: 13.5 }}>
              {tr.nextOrder === null ? t.trackComplete : t.progress(tr.doneCount, tr.totalCount)}
            </span>
          </div>

          {tr.description && (
            <p className="tichy" style={{ fontSize: 14, margin: "0 0 12px" }}>{tr.description}</p>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 12 }}>
            {tr.steps.map(s => {
              const isNext = s.order === tr.nextOrder
              return (
                <li
                  key={`${tr.key}-${s.order}`}
                  className="karta"
                  style={{
                    padding: "16px 18px",
                    // Miesto, kde človek skončil, musí byť vidieť na prvý
                    // pohľad — nie až po prečítaní všetkých štítkov.
                    borderColor: isNext ? "var(--accent)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className="tichy" style={{ fontSize: 13, flex: "0 0 auto" }}>
                      {t.step(s.order, tr.totalCount)}
                    </span>
                    <strong style={{ fontSize: 16, flex: "1 1 260px" }}>{s.title}</strong>

                    {s.blocked ? (
                      <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                        {t.blocked}
                      </span>
                    ) : s.done ? (
                      <span className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                        {t.done}
                      </span>
                    ) : (
                      <span className="stitok">{isNext ? t.continueHere : t.todo}</span>
                    )}
                  </div>

                  <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
                    {s.blocked
                      ? t.blockedReason[s.blocked] ?? s.blocked
                      : t.version(s.versionLabel ?? "", formatDate(s.effectiveFrom!, person.language))}
                  </p>

                  {!s.blocked && (
                    <p style={{ margin: "12px 0 0" }}>
                      <Link
                        className={isNext ? "tlacidlo" : "tlacidlo tlacidlo--tiche"}
                        href={`/dokumenty/${encodeURIComponent(s.documentId)}`}
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
    </div>
  )
}
