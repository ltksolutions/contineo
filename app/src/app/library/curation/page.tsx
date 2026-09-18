/**
 * Overené odpovede čakajúce na zverejnenie do znalostí (D11, kurácia).
 *
 * **Text sa tu nedá meniť.** Kto zverejňuje, schvaľuje presne to, čo napísal
 * hodnotiteľ — `publishCuration()` berie znenie zo záznamu, nie z formulára.
 * Z tejto obrazovky odchádza jediný údaj: ktorý záznam.
 *
 * **Prístupová úroveň sa nevyberá.** Odvodzuje sa zo zdrojov tou
 * najprísnejšou stranou a počíta sa znova pri zverejnení. To, čo je tu
 * napísané, je náhľad — a keby sa medzitým zmenil čo i len jeden úsek,
 * rozhodne zápis, nie tento riadok.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { pendingCurations } from "@/lib/curation"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { publishCurationAction } from "./actions"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function CurationPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const language = ctx.person.language
  const t = dictionary(language).curation
  const branding = brandingView(ctx.tenant)
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const pending = await pendingCurations(ctx.person.companyCode)

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 860, ...tenantStyle(branding) }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: "0 0 8px" }}>
          {t.publishHeading}
          {pending.length > 0 && (
            <span className="tag" style={{ fontSize: "var(--fs-micro)", marginLeft: 10, verticalAlign: "middle" }}>
              {t.waiting(pending.length)}
            </span>
          )}
        </h1>
        <p className="quiet page-lead" style={{ margin: 0, maxWidth: 660 }}>{t.publishIntro}</p>
      </div>

      <Notice message={message} error={error === "1"} back="/library/curation" />

      <p style={{ margin: "0 0 22px" }}>
        <Link className="button button--quiet" href="/library">← {dictionary(language).nav.library}</Link>
      </p>

      {pending.length === 0 && (
        <div className="card">
          <p style={{ margin: "0 0 6px", fontSize: "var(--fs-lead)" }}>{t.publishEmpty}</p>
          <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-body)" }}>{t.publishEmptyNote}</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {pending.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span
                className="tag"
                style={item.accessLevelPreview === "public"
                  ? { fontSize: "var(--fs-micro)", fontWeight: 600 }
                  : { background: "var(--warn-bg)", color: "var(--warn-fg)", fontSize: "var(--fs-micro)", fontWeight: 600 }}
              >
                {t.access}: {item.accessLevelPreview === "public" ? t.accessPublic : t.accessInternal}
              </span>
              <span className="quiet" style={{ fontSize: "var(--fs-micro)", marginLeft: "auto" }}>
                {t.preparedBy} {item.preparedByName || t.preparedByUnknown} · {formatDate(item.preparedAt, language)}
              </span>
            </div>

            <p style={{ margin: "0 0 10px", fontSize: "var(--fs-section)", fontWeight: 600, lineHeight: 1.45 }}>
              {item.question}
            </p>
            <div style={{ fontSize: "var(--fs-body)", lineHeight: 1.65, whiteSpace: "pre-wrap", marginBottom: 12 }}>
              {item.answer}
            </div>

            <ul className="quiet" style={{ margin: "0 0 6px", paddingLeft: 18, fontSize: "var(--fs-small)" }}>
              {item.sources.map(src => (
                <li key={src.chunkId}>{[src.title, src.articleRef].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
            <p className="quiet" style={{ fontSize: "var(--fs-micro)", margin: "0 0 14px" }}>{t.accessNote}</p>

            <form action={publishCurationAction}>
              <input type="hidden" name="id" value={item.id} />
              <button className="button" type="submit">{t.publish}</button>
            </form>
          </div>
        ))}
      </div>
    </div>
    </AppShell>
  )
}
