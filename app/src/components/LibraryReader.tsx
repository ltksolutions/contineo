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
 * Žiadne koncepty, kurácia, priečinky ani akcie správy. Hľadanie v názve je
 * `GET` formulár, bez skriptu funguje.
 *
 * Prázdny zoznam je „Zatiaľ tu pre vás nie sú žiadne dokumenty", nie 403.
 */

import Link from "next/link"
import AppShell from "./AppShell"
import { readableDocuments } from "@/lib/documents"
import { mergeReaderDocuments, LAW_CATEGORY } from "@/lib/overview"
import { matchesQuery } from "@/lib/askHistoryMatch"
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
  const q = search.trim()

  /*
    Druhy len tie, ktoré v zozname sú — prepínač s prázdnou voľbou by človeka
    poslal na prázdnu obrazovku. Názov z číselníka (aj vlastného druhu
    organizácie); predpis bez položky v číselníku má názov z prekladu.
  */
  const labels = new Map(codelistOptions("category", extras).map(o => [o.value, o.label]))
  const kindLabel = (key: string) => labels.get(key) ?? (key === LAW_CATEGORY ? t.reader.kindLaw : key)
  const kinds = [...new Set(all.map(r => r.category).filter((k): k is string => Boolean(k)))]
    .sort((a, b) => kindLabel(a).localeCompare(kindLabel(b), "sk"))
  const byKind = kind && kinds.includes(kind) ? all.filter(r => r.category === kind) : all
  const docs = q ? byKind.filter(r => matchesQuery(r.title, q)) : byKind
  const href = (k: string) => `/library${k || q ? `?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(q ? { search: q } : {}) }).toString()}` : ""}`

  return (
    <AppShell language={language}>
      <div className="library-reader">
        <h1 className="page-title">{d.nav.library}</h1>
        <p className="quiet page-lead">{t.reader.lead}</p>

        {all.length > 0 && (
          <form className="library-reader-search" method="get" action="/library" role="search">
            {kind && <input type="hidden" name="kind" value={kind} />}
            <input className="field-input" type="search" name="search" defaultValue={q}
                   placeholder={t.reader.search} aria-label={t.reader.search} />
            <button className="button button--quiet" type="submit">{t.reader.searchSubmit}</button>
          </form>
        )}

        {/* Prepínač pohľadu podľa druhu — sivý, bez farby organizácie (ZAKLAD-podmenu-a-akcie). Pri jedinom druhu sa nekreslí. */}
        {kinds.length > 1 && (
          <nav className="view-switch view-switch--fit" aria-label={t.reader.kindAll}>
            <Link className={`view-switch-item${!kind || !kinds.includes(kind) ? " is-on" : ""}`}
                  aria-current={!kind || !kinds.includes(kind) ? "true" : undefined} href={href("")}>
              {t.reader.kindAll} <span className="view-switch-count">{all.length}</span>
            </Link>
            {kinds.map(k => (
              <Link key={k} className={`view-switch-item${k === kind ? " is-on" : ""}`} aria-current={k === kind ? "true" : undefined} href={href(k)}>
                {kindLabel(k)} <span className="view-switch-count">{all.filter(r => r.category === k).length}</span>
              </Link>
            ))}
          </nav>
        )}

        {all.length === 0 ? (
          <div className="empty"><div className="empty-title">{t.emptyForYou}</div></div>
        ) : docs.length === 0 ? (
          <div className="empty"><div className="empty-title">{t.reader.emptyFilter}</div></div>
        ) : (
          <ul className="card library-reader-list">
            {docs.map(r => (
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
