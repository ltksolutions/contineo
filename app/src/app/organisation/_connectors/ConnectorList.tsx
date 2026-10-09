/**
 * Organizácia → Konektory, prehľad (návrh ORG-konektory, 9. 10. 2026, Q1, Q6).
 *
 * Zoznam riadkov-odkazov na detail ako prehľad kanálov: ikona servera,
 * názov, hostiteľ · verzia, štítky použití, stav a počet nástrojov. Jediné
 * plné tlačidlo „Pridať konektor" je v hlavičke časti a otvorí úlohu
 * `?new=1`, ktorá ho prevezme. Úloha chce len adresu; prihlásenie a údaje
 * o serveri dá štandard MCP (D178). Bez JavaScriptu.
 */

import Link from "next/link"
import SubmitButton from "@/components/SubmitButton"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { ConnectorView } from "@/lib/connectors"
import { addAndConnectAction } from "../actions"
import ServerIcon from "./ServerIcon"

export const CONNECTORS_HREF = "/organisation/connectors"

export function statusTagClass(s: ConnectorView["status"]): string {
  return s === "connected" ? "tag tag--published" : s === "error" ? "tag tag--warn" : "tag"
}

function host(endpoint: string): string {
  try { return new URL(endpoint).host } catch { return endpoint }
}

export default function ConnectorList({ connectors, language, query }: {
  connectors: ConnectorView[]
  language: UiLanguage
  query: { new?: string; endpoint?: string; name?: string; error?: string; msg?: string }
}) {
  const d = dictionary(language)
  const t = d.org.connectors
  const adding = query.new === "1"
  return (
    <>
      <div className="page-head page-head--section">
        <h2>{d.org.tabs.connectors}</h2>
        <span className="page-head-spacer" aria-hidden="true" />
        {!adding && <Link className="button" href={`${CONNECTORS_HREF}?new=1#new`}>{t.add}</Link>}
      </div>
      <p className="quiet connectors-lead">{t.introShort}</p>

      {adding && (
        <form action={addAndConnectAction} className="card task-card" id="new">
          <h2>{t.add}</h2>
          <p className="quiet">{t.newIntro}</p>
          {/* Chyba pri zakladaní sa ukáže tu, nie v pruhu hore — úloha ostáva otvorená. */}
          {query.error === "1" && query.msg && (
            <div className="lnote lnote--bad" role="alert"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{query.msg}</span></div>
          )}
          <label className="field">
            <span className="field-label">{t.endpoint}</span>
            <input className="field-input" name="endpoint" type="url" required defaultValue={query.endpoint ?? ""}
                   placeholder="https://mcp.example.com/mcp" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <span className="quiet field-hint">{t.endpointHint}</span>
          </label>
          <label className="field">
            <span className="field-label">{t.name}</span>
            <input className="field-input" name="name" maxLength={120} defaultValue={query.name ?? ""} />
            <span className="quiet field-hint">{t.nameAuto}</span>
          </label>
          {/* Jediná rozbaľovačka na obrazovke, vedome (Q1): väčšina serverov
              registruje klienta sama a tieto polia nikto nepotrebuje. */}
          <details className="adv">
            <summary className="adv-sum">{t.advancedAuth}</summary>
            <div className="adv-body">
              <p className="quiet field-hint">{t.advancedAuthHint}</p>
              <label className="field">
                <span className="field-label">{t.clientId}</span>
                <input className="field-input" name="clientId" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
              </label>
              <label className="field">
                <span className="field-label">{t.clientSecret}</span>
                <input className="field-input" name="clientSecret" type="password" autoComplete="new-password" />
              </label>
            </div>
          </details>
          <div className="task-acts">
            <SubmitButton className="button">{t.connect}</SubmitButton>
            <Link className="button button--quiet" href={CONNECTORS_HREF}>{t.cancel}</Link>
          </div>
          <p className="quiet field-hint connectors-hint">{t.connectHint}</p>
        </form>
      )}

      {connectors.length === 0 ? (
        <div className="card empty">
          <div className="empty-title">{t.emptyTitle}</div>
          <div className="empty-text">{t.emptyText}</div>
          {!adding && <div className="empty-action"><Link href={`${CONNECTORS_HREF}?new=1#new`}>{t.add}</Link></div>}
        </div>
      ) : (
        <div className="card form-group-body form-group-body--rows">
          <div className="form-list">
            {connectors.map(c => {
              const r = c.uses.retrieval
              const tools = c.capabilities?.tools.length ?? 0
              const tags = (
                <>
                  {r.enabled && <span className="tag">{t.tagLive}</span>}
                  {c.uses.ingest.enabled && <span className="tag">{t.tagImport}</span>}
                  {r.enabled && <span className="tag">{r.accessLevel === "public" ? t.levelPublic : t.levelInternal}</span>}
                  <span className={statusTagClass(c.status)}>{t.status[c.status]}</span>
                  {c.capabilities && <span className="connector-count">{t.toolsCount(tools)}</span>}
                </>
              )
              return (
                <Link key={c.id} className="form-row channel-row connector-row" href={`${CONNECTORS_HREF}/${encodeURIComponent(c.id)}`}
                      title={c.status === "error" && c.lastError ? c.lastError : undefined}>
                  <ServerIcon c={c} />
                  <span className="form-row-main">
                    <b>{c.name}</b>
                    <span className="form-row-sub">{[host(c.endpoint), c.server?.version].filter(Boolean).join(" · ")}</span>
                    <span className="channel-tags channel-tags--below">{tags}</span>
                  </span>
                  <span className="channel-tags channel-tags--end">{tags}</span>
                  <span className="channel-chev" aria-hidden="true">›</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
