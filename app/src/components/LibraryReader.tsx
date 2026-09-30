/**
 * LibraryReader — Knižnica pre osobu bez roly správy obsahu
 * (SHELL-menu-v-hlavicke, 30. 9. 2026).
 *
 * Knižnica je od 30. 9. v lište aj v menu u každého. Kto nie je správca
 * obsahu, vidí tu **platné dokumenty svojej organizácie** (`readableDocuments()`)
 * a číta ich v čitateľskom detaile `/documents/{id}` — tie isté, ktoré smie
 * otvoriť aj priamym odkazom (D90). Žiadne koncepty, kurácia, priečinky ani
 * akcie správy. Hľadanie v názve je `GET` formulár, bez skriptu funguje.
 *
 * Prázdny zoznam je „Zatiaľ tu pre vás nie sú žiadne dokumenty", nie 403.
 */

import Link from "next/link"
import AppShell from "./AppShell"
import { readableDocuments } from "@/lib/documents"
import { matchesQuery } from "@/lib/askHistoryMatch"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"

export default async function LibraryReader({
  companyCode,
  language,
  search,
}: {
  companyCode: string
  language?: UiLanguage
  search: string
}) {
  const d = dictionary(language)
  const t = d.library
  const all = await readableDocuments(companyCode)
  const q = search.trim()
  const docs = q ? all.filter(doc => matchesQuery(doc.title, q)) : all

  return (
    <AppShell language={language}>
      <div className="library-reader">
        <h1 className="page-title">{d.nav.library}</h1>
        <p className="quiet page-lead">{t.reader.lead}</p>

        {all.length > 0 && (
          <form className="library-reader-search" method="get" action="/library" role="search">
            <input className="field-input" type="search" name="search" defaultValue={q}
                   placeholder={t.reader.search} aria-label={t.reader.search} />
            <button className="button button--quiet" type="submit">{t.reader.searchSubmit}</button>
          </form>
        )}

        {all.length === 0 ? (
          <p className="empty">{t.emptyForYou}</p>
        ) : docs.length === 0 ? (
          <p className="quiet">{t.reader.emptyFilter}</p>
        ) : (
          <ul className="card library-reader-list">
            {docs.map(doc => (
              <li key={doc.documentId}>
                <Link href={`/documents/${encodeURIComponent(doc.documentId)}`} className="library-reader-row">
                  <span className="library-reader-title">{doc.title}</span>
                  <span className="quiet library-reader-meta">
                    {doc.versionLabel} · {t.reader.validFrom(formatDate(doc.effectiveFrom, language))}
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
