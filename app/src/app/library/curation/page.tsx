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

      {/* `.empty` zo ZAKLADU (SPRAVA, úloha 2.1). Bez akcie: správca si
          prácu nevie nájsť sám — pár mu pripraví hodnotiteľ. */}
      {pending.length === 0 && (
        <div className="empty">
          <div className="empty-title">{t.publishEmpty}</div>
          <div className="empty-text">{t.publishEmptyNote}</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {pending.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              {/* Prístup je stav a farba ho nesie (SPRAVA, úloha 2.2):
                  verejné zelené — smie von; interné sivé — je to predvolený
                  stav, nie chyba, preto nie jantárová ani červená. */}
              <span className={item.accessLevelPreview === "public" ? "tag tag--published" : "tag tag--archived"}>
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

            {/*
              Zdroje ako karty z `/ask` (SPRAVA, úloha 2.3): zdroj je to, čím
              sa odpoveď obhajuje, a dve obrazovky, ktoré zobrazujú to isté,
              to majú zobrazovať rovnako. Tie isté triedy `.answer-source*`,
              bez odkazu — úsek tu nikam nevedie (D9: úsek, nie dokument).
            */}
            <div className="answer-sources">
              {item.sources.map((src, i) => (
                <div key={src.chunkId} className="answer-source">
                  <span className="answer-source-index">{i + 1}.</span>
                  <span className="answer-source-body">
                    <span className="answer-source-title">{src.title}</span>
                    {src.articleRef && (
                      <span className="quiet answer-source-meta">{src.articleRef}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="quiet" style={{ fontSize: "var(--fs-micro)", margin: "10px 0 14px" }}>{t.accessNote}</p>

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
