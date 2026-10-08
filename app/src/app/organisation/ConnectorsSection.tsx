/**
 * Časť Organizácia → Konektory (ADR-029): zoznam pripojení k cudzím MCP
 * serverom, pripojenie cez OAuth, použitie „živý zdroj", rozsahy a redukcia.
 *
 * Tajomstvá na obrazovku neprídu (`connectorView`); vidieť je stav, kto
 * konektor pripojil a čo server ponúka. Jedno plné tlačidlo na obrazovke
 * nie je — každá karta má vlastné akcie, preto sú všetky tiché (R1).
 */

import SubmitButton from "@/components/SubmitButton"
import Select from "@/components/Select"
import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import { profileOptions, type ConnectorView } from "@/lib/connectors"
import { profileFor } from "@/lib/mcp/profiles"
import { saveConnectorAction, removeConnectorAction, disconnectConnectorAction, connectConnectorAction } from "./actions"

function ConnectorForm({ c, language }: { c: ConnectorView | null; language: UiLanguage }) {
  const t = dictionary(language).org.connectors
  const profile = c ? profileFor(c.profile) : profileFor("sportnet-docs")
  const fields = profile.filterFields.map(f => `${f.key}=…`).join(", ") || "pole=hodnota"
  const scopeLines = (c?.scopes ?? []).map(s => `${s.key} | ${s.label} | ${Object.entries(s.filter).map(([k, v]) => `${k}=${v}`).join(", ")}`).join("\n")
  const r = c?.uses.retrieval
  return (
    <form action={saveConnectorAction} className="set-form" style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="tab" value="connectors" />
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className="field">
        <span className="field-label">{t.name}</span>
        <input className="field-input" name="name" required maxLength={120} defaultValue={c?.name ?? ""} />
      </label>
      <label className="field">
        <span className="field-label">{t.endpoint}</span>
        <input className="field-input" name="endpoint" type="url" required defaultValue={c?.endpoint ?? ""} placeholder="https://mcp.sportnet.online/mcp" autoCapitalize="none" spellCheck={false} />
        <span className="quiet field-hint">{t.endpointHint}</span>
      </label>
      <div className="field">
        <span className="field-label">{t.profile}</span>
        <Select language={language} name="profile" fieldLabel={t.profile} initial={c?.profile ?? "sportnet-docs"} options={profileOptions()} />
      </div>

      <section className="set-sec">
        <div className="set-sec-head"><h2>{t.secRetrieval}</h2><p>{t.secRetrievalNote}</p></div>
        <div className="set-sec-body">
          <label className="form-row form-row--bare">
            <input type="checkbox" className="toggle" role="switch" name="retrievalEnabled" defaultChecked={r?.enabled ?? true} />
            <span>{t.retrievalOn}</span>
          </label>
          <div className="field">
            <span className="field-label">{t.accessLevel}</span>
            <Select language={language} name="accessLevel" fieldLabel={t.accessLevel} initial={r?.accessLevel ?? "internal"}
              options={[{ value: "internal", label: t.accessInternal }, { value: "public", label: t.accessPublic }]} />
            <span className="quiet field-hint">{t.accessHint}</span>
          </div>
        </div>
      </section>

      <section className="set-sec">
        <div className="set-sec-head"><h2>{t.ingestOn}</h2><p>{t.ingestNote}</p></div>
        <div className="set-sec-body">
          <label className="form-row form-row--bare">
            <input type="checkbox" className="toggle" role="switch" name="ingestEnabled" defaultChecked={c?.uses.ingest.enabled ?? false} />
            <span>{t.ingestOn}</span>
          </label>
        </div>
      </section>

      <section className="set-sec">
        <div className="set-sec-head"><h2>{t.secScopes}</h2><p>{t.secScopesNote}</p></div>
        <div className="set-sec-body">
          <label className="field">
            <span className="field-label">{t.scopesField}</span>
            <textarea className="field-input" name="scopes" rows={4} defaultValue={scopeLines} spellCheck={false} />
            <span className="quiet field-hint">{t.scopesHint(fields)}</span>
          </label>
        </div>
      </section>

      <section className="set-sec">
        <div className="set-sec-head"><h2>{t.secReduction}</h2><p>{t.secReductionNote}</p></div>
        <div className="set-sec-body">
          <label className="field">
            <span className="field-label">{t.dropSections}</span>
            <textarea className="field-input" name="dropSections" rows={3} defaultValue={(r?.reduction.dropSections ?? []).join("\n")} />
            <span className="quiet field-hint">{t.dropSectionsHint}</span>
          </label>
          <label className="field">
            <span className="field-label">{t.scrubPatterns}</span>
            <textarea className="field-input" name="scrubPatterns" rows={3} defaultValue={(r?.reduction.scrubPatterns ?? []).join("\n")} spellCheck={false} />
            <span className="quiet field-hint">{t.scrubPatternsHint}</span>
          </label>
          <label className="field">
            <span className="field-label">{t.skipPaths}</span>
            <textarea className="field-input" name="skipPaths" rows={2} defaultValue={(r?.reduction.skipPaths ?? []).join("\n")} spellCheck={false} />
            <span className="quiet field-hint">{t.skipPathsHint}</span>
          </label>
        </div>
      </section>

      <div><SubmitButton className="button button--quiet">{t.save}</SubmitButton></div>
    </form>
  )
}

export default function ConnectorsSection({ connectors, language }: { connectors: ConnectorView[]; language: UiLanguage }) {
  const t = dictionary(language).org.connectors
  const statusTag = (s: ConnectorView["status"]) =>
    s === "connected" ? "tag tag--published" : s === "error" ? "tag tag--warn" : "tag"
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <p className="quiet" style={{ margin: 0, maxWidth: 680 }}>{t.intro}</p>
      {connectors.length === 0 && <p className="quiet" style={{ margin: 0 }}>{t.none}</p>}

      {connectors.map(c => (
        <section key={c.id} className="card detail-block" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <h2 className="detail-block-title" style={{ margin: 0 }}>{c.name}</h2>
            <span className={statusTag(c.status)}>{t.status[c.status]}</span>
          </div>
          <p className="quiet" style={{ margin: 0 }}><code>{c.endpoint}</code> · {profileFor(c.profile).label}</p>
          {c.auth.connectedBy && (
            <p className="quiet" style={{ margin: 0 }}>{t.connectedBy(c.auth.connectedBy, c.auth.connectedAt ? formatDate(c.auth.connectedAt, language) : "—")}</p>
          )}
          {c.lastError && <p className="quiet" style={{ margin: 0 }}>{t.lastError}: {c.lastError}</p>}
          <p className="quiet field-hint" style={{ margin: 0 }}>{t.personalAccountNote}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <form action={connectConnectorAction}>
              <input type="hidden" name="tab" value="connectors" />
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="button button--quiet">{c.status === "connected" ? t.reconnect : t.connect}</SubmitButton>
            </form>
            {c.auth.hasTokens && (
              <form action={disconnectConnectorAction}>
                <input type="hidden" name="tab" value="connectors" />
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton className="button button--quiet">{t.disconnect}</SubmitButton>
              </form>
            )}
            <form action={removeConnectorAction}>
              <input type="hidden" name="tab" value="connectors" />
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton className="button button--quiet" title={t.removeConfirm}>{t.remove}</SubmitButton>
            </form>
          </div>

          <details>
            <summary className="quiet">{t.tools}</summary>
            {c.capabilities?.tools.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {c.capabilities.tools.map(tool => <li key={tool.name}><code>{tool.name}</code>{tool.description ? ` — ${tool.description}` : ""}</li>)}
              </ul>
            ) : <p className="quiet" style={{ margin: "8px 0 0" }}>{t.toolsNone}</p>}
          </details>

          <details>
            <summary className="quiet">{t.edit}</summary>
            <div style={{ marginTop: 12 }}><ConnectorForm c={c} language={language} /></div>
          </details>
        </section>
      ))}

      <details className="card detail-block" id="new">
        <summary>{t.add}</summary>
        <div style={{ marginTop: 12 }}><ConnectorForm c={null} language={language} /></div>
      </details>
    </div>
  )
}
