/**
 * Použitia konektora (návrh ORG-konektory, 9. 10. 2026, Q4; D178).
 *
 * Jeden formulár `.set-form` so sekciami Konektor, Živý zdroj, Rozsahy,
 * Import do knižnice a Redukcia a s lištou Uložiť. Štandard MCP nehovorí,
 * ktorý nástroj je hľadanie — vyberá ho správca; profil známeho servera ho
 * len predvyplní. Polia rozsahu sú vstupy toho nástroja z `inputSchema`.
 *
 * Bez JavaScriptu: zmena nástroja sa prejaví po uložení, riadky zoznamov
 * majú vždy jeden voľný riadok navyše a krížik pri riadku je tlačidlo
 * `remove=<druh>:<i>`, ktoré formulár uloží bez toho riadku.
 */

import SubmitButton from "@/components/SubmitButton"
import Select from "@/components/Select"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { canImport, searchSetup, type ConnectorView } from "@/lib/connectors"
import { profileFor } from "@/lib/mcp/profiles"
import { isSearchCandidate, optionsFor, scopeFields, stringInputs, type ScopeField } from "@/lib/mcp/generic"
import { SCRUB_PRESETS } from "@/lib/connectorReduction"
import { saveConnectorAction } from "../actions"

type T = ReturnType<typeof dictionary>["org"]["connectors"]

function RemoveButton({ value, what, t }: { value: string; what: string; t: T }) {
  return <button type="submit" className="button button--quiet button--sm line-remove" name="remove" value={value} formNoValidate aria-label={t.removeRow(what)} title={t.removeRow(what)}>✕</button>
}

/** Zoznam riadkov s krížikom a jedným voľným riadkom navyše. */
function Lines({ name, kind, values, label, hint, t, mono = false }: { name: string; kind: string; values: string[]; label: string; hint: string; t: T; mono?: boolean }) {
  return (
    <div className="field">
      <span className="field-label" id={`${name}-label`}>{label}</span>
      <div className="lines" role="group" aria-labelledby={`${name}-label`}>
        {[...values, ""].map((v, i) => (
          <div key={`${i}-${v}`} className="line">
            <input className={mono ? "field-input field-input--mono" : "field-input"} name={name} defaultValue={v}
                   aria-label={v ? `${label}: ${v}` : label} spellCheck={false} autoCapitalize="none" />
            {v && <RemoveButton value={`${kind}:${i}`} what={v} t={t} />}
          </div>
        ))}
      </div>
      <span className="quiet field-hint">{hint}</span>
    </div>
  )
}

function ScopeValue({ field, row, value, options, label }: { field: ScopeField; row: number; value: string; options: string[] | undefined; label: string }) {
  const name = `scope.${row}.${field.key}`
  // Hodnoty zo schémy (`enum`) → výber; ponúknuté hodnoty → `datalist`, do ktorého sa dá písať aj vlastná.
  if (field.options && !field.list) {
    return (
      <select className="field-input" name={name} defaultValue={value} aria-label={label}>
        <option value="">—</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input className="field-input" name={name} defaultValue={value} aria-label={label}
           list={options?.length ? `opts-${field.key}` : undefined} title={field.description}
           spellCheck={false} autoCapitalize="none" />
  )
}

export default function ConnectorUses({ c, language, plainSave }: { c: ConnectorView; language: UiLanguage; plainSave: boolean }) {
  const t = dictionary(language).org.connectors
  const r = c.uses.retrieval
  const profile = profileFor(c.profile)
  const tools = c.capabilities?.tools ?? []
  const setup = searchSetup(c)
  const searchTool = tools.find(tl => tl.name === setup?.tool)
  const candidates = tools.filter(isSearchCandidate)
  // Starší záznam bez `inputSchema` (pred 9. 10. 2026): polia rozsahu z profilu, kým sa nenačíta znova.
  const fields: ScopeField[] = searchTool?.inputSchema
    ? scopeFields(searchTool, setup?.queryArg)
    : profile.filterFields.map(f => ({ key: f.key, label: f.label, list: f.key === "tags" }))
  const fieldValues = (key: string) => {
    const own = optionsFor(c.capabilities?.fieldOptions, key)
    return own?.length ? own : c.capabilities?.resourcePrefixes
  }
  const importable = canImport(c)

  return (
    <section className="form-group" id="uses">
      <div className="gh">
        <h2 className="form-group-head">{t.uses}</h2>
        <span className="quiet">{t.usesLead}</span>
      </div>
      <form action={saveConnectorAction} className="card set-form">
        {/* Enter v poli uloží formulár — bez tohto by ho prevzal prvý krížik pri riadku. */}
        <button type="submit" className="form-default-submit" tabIndex={-1} aria-hidden="true" />
        <input type="hidden" name="id" value={c.id} />

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.secConnector}</h2><p>{t.secConnectorNote}</p></div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.name}</span>
              <input className="field-input" name="name" maxLength={120} defaultValue={c.autoName ? "" : c.name} placeholder={c.name} />
              <span className="quiet field-hint">{t.nameAuto}</span>
            </label>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.secRetrieval}</h2><p>{t.secRetrievalNote}</p></div>
          <div className="set-sec-body">
            {c.profile !== "generic" && setup?.viaProfile && <div className="pnote">{t.fromProfile(profile.label)}</div>}
            <label className="form-row form-row--bare">
              <input type="checkbox" className="toggle" role="switch" name="retrievalEnabled" defaultChecked={r.enabled} />
              <span>{t.retrievalOn}</span>
            </label>
            <label className="form-row form-row--bare">
              <input type="checkbox" className="toggle" role="switch" name="retrievalDefaultOn" defaultChecked={r.defaultOn ?? false} />
              <span>{t.defaultOn}</span>
            </label>
            <span className="quiet field-hint">{t.defaultOnNote}</span>
            {c.capabilities && (candidates.length ? (
              <div className="uses-pair">
                <div className="field">
                  <span className="field-label">{t.searchTool}</span>
                  <Select language={language} name="searchTool" fieldLabel={t.searchTool} initial={setup?.tool ?? ""}
                          options={[{ value: "", label: t.noneOption }, ...candidates.map(tl => ({ value: tl.name, label: tl.title ? `${tl.title} · ${tl.name}` : tl.name }))]} />
                </div>
                <div className="field">
                  <span className="field-label">{t.searchQueryArg}</span>
                  <Select language={language} name="searchQueryArg" fieldLabel={t.searchQueryArg} initial={setup?.queryArg ?? ""}
                          options={[{ value: "", label: t.noneOption }, ...(searchTool ? stringInputs(searchTool) : setup ? [setup.queryArg] : []).map(k => ({ value: k, label: k }))]} />
                </div>
                <span className="quiet field-hint uses-pair-hint">{t.toolChangeHint}</span>
              </div>
            ) : <span className="quiet field-hint">{t.noSearchTools}</span>)}
            <div className="field">
              <span className="field-label" id="access-label">{t.accessLevel}</span>
              <div className="card form-group-body form-group-body--rows" role="radiogroup" aria-labelledby="access-label">
                <div className="form-list">
                  {(["internal", "public"] as const).map(level => (
                    <label key={level} className="form-row choice-row">
                      <span className="form-row-main"><span>{level === "internal" ? t.accessInternal : t.accessPublic}</span></span>
                      <input type="radio" name="accessLevel" value={level} defaultChecked={r.accessLevel === level} />
                    </label>
                  ))}
                </div>
              </div>
              <span className="quiet field-hint">{t.accessHint}</span>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.secScopes}</h2><p>{t.secScopesNote}</p></div>
          <div className="set-sec-body">
            {!setup && !profile.filterFields.length ? (
              <span className="quiet field-hint">{t.scopesNeedTool}</span>
            ) : (
              <>
                <input type="hidden" name="scopesShown" value="1" />
                {tools.length > 0 && (
                  <div className="field">
                    <span className="field-label">{t.optionsTool}</span>
                    <Select language={language} name="optionsTool" fieldLabel={t.optionsTool} initial={r.optionsTool || profile.defaults?.optionsTool || ""}
                            options={[{ value: "", label: t.noneOption }, ...tools.map(tl => ({ value: tl.name, label: tl.title ? `${tl.title} · ${tl.name}` : tl.name }))]} />
                    <span className="quiet field-hint">{t.optionsToolHint}</span>
                  </div>
                )}
                {fields.map(f => {
                  const vals = fieldValues(f.key)
                  return vals?.length ? (
                    <datalist key={f.key} id={`opts-${f.key}`}>{vals.slice(0, 500).map(v => <option key={v} value={v} />)}</datalist>
                  ) : null
                })}
                <div className="scope-table" style={{ ["--scope-cols" as string]: String(fields.length) }}>
                  <div className="scope-row scope-row--head" aria-hidden="true">
                    <span>{t.scopeKey}</span><span>{t.scopeLabel}</span>
                    {fields.map(f => <span key={f.key}>{f.label}</span>)}
                    <span />
                  </div>
                  {[...c.scopes, null].map((sc, i) => (
                    <div key={sc?.key ?? "new"} className={sc ? "scope-row" : "scope-row is-new"}>
                      {!sc && <span className="scope-new">{t.scopeNew}</span>}
                      <label className="field">
                        <span className="field-label">{t.scopeKey}</span>
                        {sc ? (
                          <>
                            {/* Kľúč uloženého rozsahu sa nemení — kanály sa naň odkazujú (D175). */}
                            <span className="field-input is-locked" title={t.scopeKeyLocked}>{sc.key}</span>
                            <input type="hidden" name={`scopeKey.${i}`} value={sc.key} />
                          </>
                        ) : (
                          <input className="field-input" name={`scopeKey.${i}`} aria-label={t.scopeKey} pattern="[a-z0-9][a-z0-9_-]*" maxLength={40} spellCheck={false} autoCapitalize="none" />
                        )}
                      </label>
                      <label className="field">
                        <span className="field-label">{t.scopeLabel}</span>
                        <input className="field-input" name={`scopeLabel.${i}`} defaultValue={sc?.label ?? ""} aria-label={t.scopeLabel} maxLength={80} />
                      </label>
                      {fields.map(f => (
                        <label key={f.key} className="field">
                          <span className="field-label">{f.label}</span>
                          <ScopeValue field={f} row={i} value={sc?.filter[f.key] ?? ""} options={fieldValues(f.key)} label={sc ? `${f.label} (${sc.label})` : f.label} />
                        </label>
                      ))}
                      <span className="scope-remove">{sc && <RemoveButton value={`scope:${i}`} what={sc.label} t={t} />}</span>
                    </div>
                  ))}
                </div>
                <span className="quiet field-hint">{t.scopeKeyLocked} {t.scopeKeyHint}</span>
              </>
            )}
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.ingestOn}</h2><p>{t.ingestNote}</p></div>
          <div className="set-sec-body">
            {importable && <input type="hidden" name="ingestShown" value="1" />}
            <label className="form-row form-row--bare">
              <input type="checkbox" className="toggle" role="switch" name="ingestEnabled" defaultChecked={importable && c.uses.ingest.enabled} disabled={!importable} />
              <span>{t.ingestOn}</span>
            </label>
            {!importable && <span className="quiet field-hint">{t.ingestUnavailable}</span>}
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.secReduction}</h2><p>{t.secReductionNote} {t.audienceNote}</p></div>
          <div className="set-sec-body">
            <Lines name="dropSections" kind="drop" values={r.reduction.dropSections} label={t.dropSections} hint={t.dropSectionsHint} t={t} />
            <Lines name="skipPaths" kind="skip" values={r.reduction.skipPaths} label={t.skipPaths} hint={t.skipPathsHint} t={t} mono />
            <div className="field">
              <span className="field-label" id="presets-label">{t.scrubPresetsLabel}</span>
              <div className="card form-group-body form-group-body--rows" role="group" aria-labelledby="presets-label">
                <div className="form-list">
                  {SCRUB_PRESETS.map(p => (
                    <label key={p} className="form-row select-row">
                      <input type="checkbox" name="scrubPresets" value={p} defaultChecked={(r.reduction.scrubPresets ?? []).includes(p)} />
                      <span className="form-row-main"><span>{t.scrubPreset[p]}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Lines name="scrubPatterns" kind="scrub" values={r.reduction.scrubPatterns} label={t.ownPatterns} hint={t.scrubPatternsHint} t={t} mono />
          </div>
        </section>

        <div className="set-savebar">
          <SubmitButton className={plainSave ? "button button--quiet" : "button"}>{t.save}</SubmitButton>
          <span className="quiet">{t.saveUses}</span>
        </div>
      </form>
    </section>
  )
}
