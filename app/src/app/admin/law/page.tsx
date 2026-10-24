/**
 * /admin/law — katalóg legislatívy, správa platformy (ADR-039, D257).
 *
 * Zoznam predpisov zo Slov-Lexu, ktoré Contineo drží raz pre všetky
 * organizácie: znenia, odberatelia, posledná kontrola. Správca sem predpis
 * pridá, skontroluje ho proti portálu (to isté, čo denný cron, D261)
 * a odstráni ho — len keď ho nikto neodoberá.
 *
 * Na doméne zákazníka stránka neexistuje (D42) — ako celý `/admin`.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { platformContext } from "@/lib/admin"
import { listActs } from "@/lib/lawCatalog"
import { formatDate, dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { addLawActAction, checkLawActAction, removeLawActAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function LawCatalogAdminPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await platformContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const query = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.admin.law
  const acts = await listActs()

  return (
    <AppShell language={language} title={t.heading} trail={{ "/admin": d.admin.list.heading }}>
      <div style={{ maxWidth: 900 }}>
        <Notice language={language} message={query.msg} error={query.error === "1"} back="/admin/law" />
        <div className="page-head">
          <h1 className="page-title">{t.heading}</h1>
        </div>
        <p className="quiet page-lead" style={{ margin: "0 0 24px" }}>{t.intro}</p>

        {/* Pridanie predpisu — jediné plné tlačidlo na obrazovke (ZAKLAD-podmenu-a-akcie). */}
        <form action={addLawActAction} className="card" style={{ padding: "18px 20px", marginBottom: 18, display: "grid", gap: 10 }}>
          <label className="field">
            <span className="field-label">{t.addLabel}</span>
            <input className="field-input" name="address" required placeholder="440/2015" />
          </label>
          <div><SubmitButton className="button">{t.addButton}</SubmitButton></div>
        </form>

        {acts.length === 0 && (
          <div className="empty"><div className="empty-title">{t.empty}</div></div>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {acts.map(a => (
            <li key={a.actId} className="card" style={{ padding: "18px 20px", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Link href={`https://www.slov-lex.sk/pravne-predpisy/${a.actId}/`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--fs-section)", fontWeight: 700 }}>
                  {a.title}
                </Link>
                <span className="tag">{a.actId}</span>
                {a.lastError && <span className="tag tag--warn">!</span>}
              </div>
              <p className="quiet" style={{ margin: 0, fontSize: 13 }}>
                {[
                  t.versions(a.versionCount),
                  t.subscribers(a.subscriberCount),
                  a.current ? d.org.law.current(formatDate(a.current.effectiveFrom, language)) : d.org.law.pending,
                  a.laterCount ? d.org.law.later(a.laterCount) : null,
                  a.lastCheckedAt ? t.checked(formatDate(a.lastCheckedAt, language)) : t.neverChecked,
                ].filter(Boolean).join(" · ")}
              </p>
              {a.lastError && <p className="quiet" style={{ margin: 0, fontSize: 13, color: "var(--bad-fg)" }}>{t.error(a.lastError)}</p>}
              {/* Karty s vlastnou akciou majú tlačidlá tiché (DESIGN_ODCHYLKY R1). */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <form action={checkLawActAction}>
                  <input type="hidden" name="actId" value={a.actId} />
                  <SubmitButton className="button button--quiet button--sm">{t.check}</SubmitButton>
                </form>
                {a.subscriberCount === 0 && (
                  <form action={removeLawActAction}>
                    <input type="hidden" name="actId" value={a.actId} />
                    <SubmitButton className="button button--quiet button--sm">{t.remove}</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  )
}
