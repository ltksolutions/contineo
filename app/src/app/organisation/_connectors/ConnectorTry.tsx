/**
 * Vyskúšať hľadanie (návrh ORG-konektory, 9. 10. 2026, Q7).
 *
 * Formulár GET: otázka a rozsah idú do adresy (`?try=…&scope=…#try`),
 * výsledok vykreslí server — bez JavaScriptu a dá sa poslať kolegovi.
 * Server sa volá **len** pri `?try=`, nikdy pri obyčajnom zobrazení detailu;
 * volanie má stopu (D177). Ukazuje sa to, čo by dostal model: rovnaký
 * nástroj, rozklad a redukcia ako pri otázke. Z výsledku pred redukciou
 * sa navrhne, čo zahodiť a aké rozsahy pridať.
 */

import SubmitButton from "@/components/SubmitButton"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { connectorById, searchSetup, type ConnectorView } from "@/lib/connectors"
import { trySearch, type TryResult } from "@/lib/liveSources"
import { suggestReductions } from "@/lib/connectorReduction"
import { scopeFields } from "@/lib/mcp/generic"
import { profileFor } from "@/lib/mcp/profiles"
import type { CallContext } from "@/lib/mcp/client"
import { applySuggestionsAction } from "../actions"
import type { DetailQuery } from "./ConnectorDetail"

export default async function ConnectorTry({ c, query, language, redirectUrl, ctx }: {
  c: ConnectorView
  query: DetailQuery
  language: UiLanguage
  redirectUrl: string
  ctx: CallContext
}) {
  const t = dictionary(language).org.connectors
  const q = (query.try ?? "").trim().slice(0, 300)
  const scope = c.scopes.some(s => s.key === query.scope) ? query.scope ?? "" : ""
  const setup = searchSetup(c)!

  let result: TryResult | null = null
  let failure: string | null = null
  if (q) {
    try {
      const full = await connectorById(c.companyCode, c.id)
      if (full) result = await trySearch(full, q, scope, redirectUrl, ctx)
    } catch (e) {
      failure = errorText(e, language)
    }
  }

  // Pole, do ktorého patria hodnoty skupín z výsledkov: prvé pole rozsahu
  // (Sportnet: `project`). Bez polí sa rozsahy navrhovať nedajú.
  const tool = c.capabilities?.tools.find(tl => tl.name === setup.tool)
  const fields = tool?.inputSchema ? scopeFields(tool, setup.queryArg) : profileFor(c.profile).filterFields.map(f => ({ key: f.key }))
  const groupField = fields[0]?.key ?? ""
  const suggestions = result ? suggestReductions(result.raw, c.uses.retrieval.reduction, c.scopes) : null
  const skippedCount = result ? result.raw.length - result.shown.length : 0
  const hasSuggestions = suggestions && (suggestions.headings.length || suggestions.paths.length || (groupField && suggestions.groups.some(g => !g.existingScope)))

  return (
    <section className="form-group" id="try">
      <div className="gh">
        <h2 className="form-group-head">{t.tryTitle}</h2>
      </div>
      <div className="card connector-try">
        <p className="quiet connector-try-lead">{t.tryLead}</p>
        <form method="get" action="#try" className="try-form">
          <label className="field try-q">
            <span className="field-label">{t.tryQuestion}</span>
            <input className="field-input" name="try" type="search" defaultValue={q} required maxLength={300} />
          </label>
          {c.scopes.length > 0 && (
            <label className="field try-scope">
              <span className="field-label">{t.tryScope}</span>
              <select className="field-input" name="scope" defaultValue={scope}>
                <option value="">{t.scopeAll}</option>
                {c.scopes.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          )}
          <SubmitButton className="button button--quiet">{t.try}</SubmitButton>
        </form>

        {failure && (
          <div className="lnote lnote--bad" role="alert">
            <span className="lnote-mark" aria-hidden="true">!</span>
            <span className="lnote-text">{failure}<small>{t.tryFallback}</small></span>
          </div>
        )}

        {result && result.shown.length === 0 && skippedCount === 0 && (
          <div className="empty empty--compact"><div className="empty-text">{t.tryEmpty}</div></div>
        )}

        {result && (result.shown.length > 0 || skippedCount > 0) && (
          <>
            <p className="try-count">
              <b>{t.tryCount(result.shown.length, setup.tool)}</b>
              {skippedCount > 0 && <span className="quiet"> · {t.trySkipped(skippedCount)}</span>}
            </p>
            <div className="try-hits">
              {result.shown.map(a => (
                <div key={a.externalId} className="hit">
                  <span className="hit-title">
                    <b>{a.title}</b>
                    {a.group && <span className="tag">{a.group}</span>}
                  </span>
                  <span className="hit-meta"><code>{a.externalId}</code> · {t.tryChars(a.reducedText.length.toLocaleString(language))}</span>
                  <p>{a.reducedText.split("\n").filter(Boolean).slice(0, 3).join("\n")}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {result && suggestions && (
          hasSuggestions ? (
            <form action={applySuggestionsAction} className="try-suggest">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="groupField" value={groupField} />
              <h3>{t.suggestTitle}</h3>
              {suggestions.headings.length > 0 && (
                <fieldset className="form-group">
                  <legend className="form-group-head">{t.dropSections}</legend>
                  <div className="card form-group-body form-group-body--rows"><div className="form-list">
                    {suggestions.headings.map(h => (
                      <label key={h.text} className="form-row select-row">
                        <input type="checkbox" name="drop" value={h.text} />
                        <span className="form-row-main"><span>{h.text}</span></span>
                        <span className="form-row-detail">{h.count}×</span>
                      </label>
                    ))}
                  </div></div>
                </fieldset>
              )}
              {suggestions.paths.length > 0 && (
                <fieldset className="form-group">
                  <legend className="form-group-head">{t.skipPaths}</legend>
                  <div className="card form-group-body form-group-body--rows"><div className="form-list">
                    {suggestions.paths.map(p => (
                      <label key={p.part} className="form-row select-row">
                        <input type="checkbox" name="skip" value={p.part} />
                        <span className="form-row-main"><code>{p.part}</code></span>
                        <span className="form-row-detail">{p.count}×</span>
                      </label>
                    ))}
                  </div></div>
                </fieldset>
              )}
              {groupField && suggestions.groups.length > 0 && (
                <fieldset className="form-group">
                  <legend className="form-group-head">{t.suggestGroups}</legend>
                  <div className="card form-group-body form-group-body--rows"><div className="form-list">
                    {suggestions.groups.map(g => (
                      <label key={g.value} className="form-row select-row">
                        <input type="checkbox" name="group" value={g.value} disabled={Boolean(g.existingScope)} />
                        <span className="form-row-main">
                          <span>{groupField} = {g.value}</span>
                          {g.existingScope && <span className="form-row-sub">{t.suggestExisting(g.existingScope)}</span>}
                        </span>
                        <span className="form-row-detail">{g.count}×</span>
                      </label>
                    ))}
                  </div></div>
                </fieldset>
              )}
              <div><SubmitButton className="button button--quiet">{t.addSelected}</SubmitButton></div>
            </form>
          ) : (result.shown.length > 0 && <p className="quiet try-none">{t.suggestNone}</p>)
        )}
      </div>
    </section>
  )
}
