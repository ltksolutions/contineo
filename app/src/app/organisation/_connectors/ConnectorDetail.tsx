/**
 * Detail konektora `/organisation/connectors/<id>` (návrh ORG-konektory,
 * 9. 10. 2026, Q2–Q5, Q13, Q14).
 *
 * Zhora: hlavička s ikonou a stavom → pásik stavu pripojenia → O serveri →
 * Nástroje → Vyskúšať hľadanie → Použitia → Ďalšie akcie. Najprv to, čo
 * server je a vie, potom ako ho používame. Nič podstatné nie je v
 * rozbaľovačke; pokyny servera sa skracujú a celé sa ukážu cez
 * `?instructions=1`, odstránenie sa potvrdzuje cez `?remove=1#more`.
 *
 * Plné tlačidlo je jedno: „Pripojiť" v pásiku, keď konektor nie je
 * pripojený alebo je v chybe, inak „Uložiť" v lište Použití (Q5).
 */

import Link from "next/link"
import SubmitButton from "@/components/SubmitButton"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { searchSetup, type ConnectorView } from "@/lib/connectors"
import type { ToolInfo } from "@/lib/mcp/generic"
import { connectConnectorAction, disconnectConnectorAction, removeConnectorAction } from "../actions"
import ServerIcon from "./ServerIcon"
import { CONNECTORS_HREF, statusTagClass } from "./ConnectorList"
import ConnectorUses from "./ConnectorUses"
import ConnectorTry from "./ConnectorTry"
import type { CallContext } from "@/lib/mcp/client"

export interface DetailQuery {
  instructions?: string
  remove?: string
  try?: string
  scope?: string
}

function ConnectForm({ id, label, full, reload = false }: { id: string; label: string; full: boolean; reload?: boolean }) {
  return (
    <form action={connectConnectorAction}>
      <input type="hidden" name="id" value={id} />
      {reload && <input type="hidden" name="reload" value="1" />}
      <SubmitButton className={full ? "button" : "button button--quiet"}>{label}</SubmitButton>
    </form>
  )
}

/** Štítky len z výslovne poslaných `annotations` (Q9) — chýbajúci údaj nie je „mení dáta". */
function ToolTags({ tool, isSearch, t }: { tool: ToolInfo; isSearch: boolean; t: ReturnType<typeof dictionary>["org"]["connectors"] }) {
  const a = tool.annotations
  return (
    <>
      {isSearch && <span className="tag tag--accent">{t.annSearch}</span>}
      {a?.readOnlyHint === true && <span className="tag">{t.annReadOnly}</span>}
      {(a?.readOnlyHint === false || a?.destructiveHint === true) && <span className="tag tag--warn">{t.annWrites}</span>}
      {a?.openWorldHint === true && <span className="tag">{t.annOpenWorld}</span>}
    </>
  )
}

export default function ConnectorDetail({ c, channels, query, language, redirectUrl, ctx }: {
  c: ConnectorView
  channels: { key: string; name: string; scopes: string[] }[]
  query: DetailQuery
  language: UiLanguage
  redirectUrl: string
  ctx: CallContext
}) {
  const d = dictionary(language)
  const t = d.org.connectors
  const href = `${CONNECTORS_HREF}/${encodeURIComponent(c.id)}`
  const connected = c.status === "connected"
  const setup = searchSetup(c)
  const tools = c.capabilities?.tools ?? []
  const s = c.server
  const fullInstructions = query.instructions === "1"
  const removing = query.remove === "1"

  return (
    <div className="connector-detail">
      <div className="page-head page-head--section connector-head">
        <ServerIcon c={c} large />
        <h2>{c.name}</h2>
        <span className={statusTagClass(c.status)}>{t.status[c.status]}</span>
      </div>

      {/* Pásik stavu (Q5). Tlačidlo je vlastný formulár mimo Použití. */}
      {connected ? (
        <div className="lnote lnote--info connector-band">
          <span className="lnote-mark" aria-hidden="true">✓</span>
          <span className="lnote-text">
            {c.auth.connectedBy ? t.connectedBy(c.auth.connectedBy, c.auth.connectedAt ? formatDate(c.auth.connectedAt, language) : "—") : t.status.connected}
            <small>{t.personalAccountNote}</small>
          </span>
          <ConnectForm id={c.id} label={t.reconnect} full={false} />
        </div>
      ) : c.status === "error" ? (
        <div className="lnote lnote--bad connector-band" role="status">
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{t.lastError}: {c.lastError ?? "—"}<small>{t.tryFallback}</small></span>
          <ConnectForm id={c.id} label={t.reconnect} full />
        </div>
      ) : (
        <div className="lnote lnote--warn connector-band">
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{t.bandIdle}<small>{t.bandIdleNote}</small></span>
          <ConnectForm id={c.id} label={t.connect} full />
        </div>
      )}

      {/* O serveri — čo sa server sám povedal v `initialize`; čo nedal, sa nekreslí. */}
      <section className="form-group" id="about">
        <h2 className="form-group-head">{t.about}</h2>
        <div className="card connector-about">
          {s && (s.title || s.name) && (
            <div className="lc"><span>{t.aboutName}</span><span>{[s.title, s.name].filter(Boolean).filter((x, i, xs) => xs.indexOf(x) === i).join(" · ")}</span></div>
          )}
          {s?.version && <div className="lc"><span>{t.aboutVersion}</span><span>{s.version}</span></div>}
          {s?.websiteUrl && <div className="lc"><span>{t.aboutWeb}</span><span><a href={s.websiteUrl} target="_blank" rel="noreferrer noopener">{s.websiteUrl}</a></span></div>}
          <div className="lc"><span>{t.aboutEndpoint}</span><span><code>{c.endpoint}</code></span></div>
          <div className="lc"><span>{t.aboutAuth}</span><span>{c.auth.customClient ? t.authCustom : t.authAuto}</span></div>
          {s?.instructions && (
            <div className="lc">
              <span>{t.aboutInstructions}</span>
              <span className="connector-instr">
                {/* Pokyny sú obsah zo servera, nie pokyn pre nás ani pre model (D174, Q13). */}
                <span className={fullInstructions ? "connector-instr-text is-full" : "connector-instr-text"}>{s.instructions}</span>
                <span className="quiet connector-instr-foot">
                  {t.instructionsNote}{" "}
                  {fullInstructions
                    ? <Link href={`${href}#about`}>{t.showLess}</Link>
                    : <Link href={`${href}?instructions=1#about`}>{t.showAll}</Link>}
                </span>
              </span>
            </div>
          )}
        </div>
        {!c.capabilities && <p className="quiet form-group-foot">{t.aboutAfterConnect}</p>}
      </section>

      {/* Nástroje (Q3) — vždy viditeľné; povolenia pre asistenta sú len naznačené. */}
      {c.capabilities && (
        <section className="form-group" id="tools">
          <div className="gh">
            <h2 className="form-group-head">{t.tools} · {tools.length}</h2>
            <span className="quiet">{t.toolsLoaded(formatDate(c.capabilities.discoveredAt, language))}</span>
            <span className="page-head-spacer" aria-hidden="true" />
            {connected && <ConnectForm id={c.id} label={t.reload} full={false} reload />}
          </div>
          {tools.length === 0 ? (
            <div className="card empty empty--compact"><div className="empty-text">{t.toolsEmpty}</div></div>
          ) : (
            <div className="card connector-tools">
              {tools.map(tool => (
                <div key={tool.name} className="tool">
                  <span className="tool-main">
                    <span className="tool-title">
                      {tool.title && <b>{tool.title}</b>}
                      <code>{tool.name}</code>
                      <ToolTags tool={tool} isSearch={setup?.tool === tool.name} t={t} />
                    </span>
                    {tool.description && <span className="tool-desc" title={tool.description}>{tool.description}</span>}
                  </span>
                  <label className="perm">
                    <span>{t.agentPerm}</span>
                    <select disabled defaultValue="never" aria-label={`${t.agentPerm}: ${tool.name}`}>
                      <option value="always">{t.agentPermAlways}</option>
                      <option value="ask">{t.agentPermAsk}</option>
                      <option value="never">{t.agentPermNever}</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
          <p className="quiet form-group-foot">{t.agentToolsSoon}</p>
        </section>
      )}

      {connected && c.uses.retrieval.enabled && setup && (
        <ConnectorTry c={c} query={query} language={language} redirectUrl={redirectUrl} ctx={ctx} />
      )}

      <ConnectorUses c={c} language={language} plainSave={!connected} />

      {/* Ďalšie akcie (ADR-025 vzor): odpojenie tiché, odstránenie cez potvrdenie v adrese. */}
      <section className="card more" id="more">
        <div className="more-head"><h2>{d.common.moreActions}</h2></div>
        {c.auth.hasTokens && (
          <form action={disconnectConnectorAction} className="more-row">
            <input type="hidden" name="id" value={c.id} />
            <div className="more-main"><b>{t.disconnect}</b><span>{t.disconnectNote}</span></div>
            <div className="more-acts"><SubmitButton className="button button--quiet">{t.disconnect}</SubmitButton></div>
          </form>
        )}
        <div className="more-row">
          <div className="more-main"><b>{t.remove}</b><span>{t.removeNote}</span></div>
          {!removing && <div className="more-acts"><Link className="button button--danger" href={`${href}?remove=1#more`}>{t.remove}</Link></div>}
        </div>
        {removing && (
          <form action={removeConnectorAction} className="more-confirm">
            <input type="hidden" name="id" value={c.id} />
            <p>{t.removeConfirm(c.name, [...new Set(channels.flatMap(ch => ch.scopes))].map(k => c.scopes.find(sc => sc.key === k)?.label ?? k).join(", "), channels.map(ch => ch.name))}</p>
            <div className="more-acts">
              <SubmitButton className="button button--danger">{t.removeConfirmButton}</SubmitButton>
              <Link className="button button--quiet" href={`${href}#more`}>{t.cancel}</Link>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
