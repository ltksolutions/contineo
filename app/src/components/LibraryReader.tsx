/**
 * LibraryReader — Knižnica pre osobu bez roly správy obsahu
 * (SHELL-menu-v-hlavicke, 30. 9. 2026; ADR-041 D270–D271).
 *
 * Knižnica je od 30. 9. v lište aj v menu u každého. Kto nie je správca
 * obsahu, vidí tu **platné dokumenty svojej organizácie** (`readableDocuments()`)
 * a odoberané predpisy z katalógu legislatívy — v jednom zozname, lebo
 * čitateľ nerozlišuje, odkiaľ obsah prišiel. Jediné členenie je **druh**
 * (`?kind=`, prepínač pohľadu); predpis je druh Zákon. Dokument sa číta
 * v čitateľskom detaile `/documents/{id}`, predpis v `/documents/law/{actId}`.
 * Žiadne koncepty, kurácia, priečinky ani akcie správy.
 *
 * Hľadanie a druhy sú tie isté ako v paneli Dokumenty na Prehľade
 * (PREHLAD-ulohy-a-dokumenty): pole s lupou filtruje počas písania
 * (`LiveFilter`, bez skriptu `GET` formulár), počty pri druhoch sú po
 * hľadaní a pás druhov sa na telefóne roluje (`.view-switch--scroll`).
 *
 * Prázdny zoznam je „Zatiaľ tu pre vás nie sú žiadne dokumenty", nie 403.
 */

import Link from "next/link"
import AppShell from "./AppShell"
import LiveFilter from "./LiveFilter"
import SearchStrip from "./SearchStrip"
import { readableDocuments } from "@/lib/documents"
import { mergeReaderDocuments, findReaderDocuments, LAW_CATEGORY } from "@/lib/overview"
import { codelistOptions, type CodelistExtras } from "@/lib/codelists"
import type { LawActOverview } from "@/lib/lawCatalog"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"

export default async function LibraryReader({
  companyCode,
  language,
  search,
  kind,
  extras,
  acts,
}: {
  companyCode: string
  language?: UiLanguage
  search: string
  /** Kľúč číselníka `category`; prázdne = všetky druhy. */
  kind: string
  extras: CodelistExtras
  /** Odoberané predpisy; prázdne, keď Legislatíva pre organizáciu nie je. */
  acts: LawActOverview[]
}) {
  const d = dictionary(language)
  const t = d.library
  const now = new Date()
  const all = mergeReaderDocuments(await readableDocuments(companyCode, now), acts, now)
    .sort((a, b) => a.title.localeCompare(b.title, "sk"))
  const found = findReaderDocuments(all, search, kind)

  // Názov druhu z číselníka (aj vlastného druhu organizácie); predpis bez položky v číselníku má názov z prekladu.
  const labels = new Map(codelistOptions("category", extras).map(o => [o.value, o.label]))
  const kindLabel = (key: string) => labels.get(key) ?? (key === LAW_CATEGORY ? t.reader.kindLaw : key)
  const href = (k: string) => {
    const p = new URLSearchParams({ ...(k ? { kind: k } : {}), ...(found.query ? { search: found.query } : {}) }).toString()
    return p ? `/library?${p}` : "/library"
  }

  return (
    <AppShell language={language}>
      <div className="library-reader">
        <h1 className="page-title">{d.nav.library}</h1>
        <p className="quiet page-lead">{t.reader.lead}</p>

        {all.length > 0 && (
          <div className="library-toolbar">
            <LiveFilter className="library-search" action="/library" label={t.reader.search}>
              <SearchStrip name="search" defaultValue={found.query} placeholder={t.reader.search}
                           label={t.reader.search} submitLabel={t.reader.searchSubmit} />
              {found.activeKind && <input type="hidden" name="kind" value={found.activeKind} />}
            </LiveFilter>
            {/* Prepínač pohľadu podľa druhu — sivý, bez farby organizácie (ZAKLAD-podmenu-a-akcie). Pri jedinom druhu sa nekreslí. */}
            {(found.kinds.length > 1 || found.activeKind) && (
              <nav className="view-switch view-switch--scroll" aria-label={t.reader.kindAll}>
                <Link className={`view-switch-item${found.activeKind ? "" : " is-on"}`}
                      aria-current={found.activeKind ? undefined : "true"} href={href("")} scroll={false}>
                  {t.reader.kindAll}<span className="view-switch-count">{found.matchedTotal}</span>
                </Link>
                {found.kinds.map(k => (
                  <Link key={k.key} className={`view-switch-item${k.key === found.activeKind ? " is-on" : ""}`}
                        aria-current={k.key === found.activeKind ? "true" : undefined} href={href(k.key)} scroll={false}>
                    {kindLabel(k.key)}<span className="view-switch-count">{k.count}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        )}

        {all.length === 0 ? (
          <div className="empty"><div className="empty-title">{t.emptyForYou}</div></div>
        ) : found.shown.length === 0 ? (
          <div className="empty"><div className="empty-title">{t.reader.emptyFilter}</div></div>
        ) : (
          <ul className="card library-reader-list">
            {found.shown.map(r => (
              <li key={r.key}>
                <Link href={r.href} className="library-reader-row">
                  <span className="library-reader-title">{r.title}</span>
                  <span className="quiet library-reader-meta">
                    {[r.category ? kindLabel(r.category) : null, t.reader.validFrom(formatDate(r.effectiveFrom, language))]
                      .filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
