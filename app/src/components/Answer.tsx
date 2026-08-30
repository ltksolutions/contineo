"use client"

/**
 * Zobrazenie odpovede: text, citácie, zdroje a technická pätička.
 *
 * Návrhové rozhodnutie: citácie sú NAD zoznamom zdrojov a sú výraznejšie.
 * Zdroj hovorí len „toto sme prehľadali", citácia hovorí „o toto sa opiera
 * táto veta" — a práve to hodnotiteľ potrebuje, aby vedel posúdiť, či si
 * model niečo nedomyslel.
 */

import type { Citation, AskResult } from "@/lib/sseClient"
import { toBlocks, cleanCitation, mergeCitations } from "@/lib/formatText"
import { formatUsd, formatEur, toEur } from "@/lib/pricing"
import type { Segment } from "@/lib/formatText"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/** Stav odpovede počas streamovania — kým nepríde `done`, máme len text. */
export interface AnswerState {
  question: string
  text: string
  citations: Citation[]
  done: AskResult | null
  running: boolean
}

/**
 * Vykreslenie textu modelu.
 *
 * Nikde tu nie je `dangerouslySetInnerHTML` — text prechádza cez
 * `naBloky()` a stáva sa obyčajnými React uzlami. Výstup modelu nad cudzími
 * dokumentmi sa nesmie dostať do DOM ako HTML.
 */
function Segments({ segments: segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((u, i) =>
        u.druh === "tucne"
          ? <strong key={i}>{u.text}</strong>
          : <span key={i}>{u.text}</span>
      )}
    </>
  )
}

function AnswerText({ text }: { text: string }) {
  const blocks = toBlocks(text)
  return (
    <>
      {blocks.map((b, i) =>
        b.druh === "nadpis" ? (
          <div
            key={i}
            style={{
              // Úrovne sa líšia len jemne — odpoveď má mať jeden hlas,
              // nie hierarchiu ako dokumentácia.
              fontSize: b.level <= 2 ? 16.5 : 15.5,
              fontWeight: 700,
              margin: i === 0 ? "0 0 8px" : "18px 0 8px",
            }}
          >
            <Segments segments={b.segments} />
          </div>
        ) : b.druh === "odsek" ? (
          <p key={i} style={{ margin: "0 0 12px" }}>
            <Segments segments={b.segments} />
          </p>
        ) : b.numbered ? (
          <ol key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.items.map((p, j) => <li key={j}><Segments segments={p} /></li>)}
          </ol>
        ) : (
          <ul key={i} style={{ margin: "0 0 12px", paddingLeft: 22 }}>
            {b.items.map((p, j) => <li key={j}><Segments segments={p} /></li>)}
          </ul>
        )
      )}
    </>
  )
}

function Line({ label: label, value: value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <span className="tichy">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </span>
  )
}

export default function Answer({ state: state, language }: { state: AnswerState; language?: UiLanguage }) {
  const t = dictionary(language).answer
  const { text, citations: citations, done: done, running: running } = state
  if (!text && !running && !done) return null

  const error = done?.error
  const truncated = done?.stopReason === "max_tokens"

  // Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera.
  // Pri dlhej odpovedi ich vznikne aj devätnásť, z toho polovica rovnakých.
  const unique = mergeCitations(citations)

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="karta">
        {error ? (
          <div style={{ color: "var(--bad-fg)", fontSize: 15 }}>
            <strong>{t.failed}</strong>
            <div style={{ marginTop: 6, fontSize: 14 }}>{error}</div>
          </div>
        ) : (
          <div className={running ? "odpoved kurzor" : "odpoved"}>
            {text ? <AnswerText text={text} /> : (running ? null : "—")}
          </div>
        )}

        {/* Useknutá odpoveď sa NESMIE tváriť ako hotová. Záver býva práve to
            zhrnutie, ktoré si čitateľ odnesie — a keď chýba, nemá ako vedieť,
            že mu chýba. */}
        {truncated && (
          <div
            style={{
              display: "flex", gap: 9, alignItems: "flex-start",
              marginTop: 14, padding: "10px 13px",
              background: "var(--warn-bg)", color: "var(--warn-fg)",
              border: "1px solid var(--line)", borderRadius: 9,
              fontSize: 13.5, lineHeight: 1.55,
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 700 }}>▲</span>
            <span>
              <strong>{t.incompleteHeading}</strong>{" "}
              {t.incompleteNote}
            </span>
          </div>
        )}
      </div>

      {/* Citácie — doslovné úryvky, o ktoré sa odpoveď opiera. */}
      {unique.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em",
                       color: "var(--muted)", marginBottom: 10 }}>
            {t.citations(unique.length)}
            {unique.length < citations.length && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {" "}— {citations.length} {t.citationsNote}
              </span>
            )}
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {unique.map((c, i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderLeft: "3px solid var(--teal-700)",
                  borderRadius: 10,
                  padding: "11px 14px",
                }}
              >
                <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>„{cleanCitation(c.citedText)}“</div>
                <div className="tichy" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {[c.documentTitle, c.articleRef].filter(Boolean).join(" · ") || t.sourceMissing}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zdroje — čo sa dostalo do kontextu, aj keď z toho model necitoval. */}
      {done && done.sources.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, textTransform: "uppercase",
                            letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
            {t.sources(done.sources.length)}
          </summary>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {done.sources.map(z => (
              <div
                key={z.index}
                style={{
                  display: "flex", gap: 10, alignItems: "baseline",
                  fontSize: 14, padding: "7px 12px",
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                <span className="tichy" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {z.index}.
                </span>
                <span style={{ flex: 1 }}>
                  {z.title}
                  {z.articleRef && <span className="tichy"> · {z.articleRef}</span>}
                  {z.heading && <span className="tichy"> — {z.heading}</span>}
                </span>
                {/* Interný obsah vo verejnej odpovedi je tvrdá brána D9,
                    preto to musí byť vidieť na prvý pohľad. */}
                {z.accessLevel === "internal" && (
                  <span
                    className="stitok"
                    style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", fontSize: 11 }}
                  >
                    {t.internal}
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Technická pätička — bez nej sa nedá porovnávať medzi konfiguráciami. */}
      {done && !error && (
        <div
          className="tichy"
          style={{
            display: "flex", flexWrap: "wrap", gap: 16,
            fontSize: 12.5, paddingTop: 4,
          }}
        >
          {done.model && <Line label="model" value={done.model} />}
          {done.provider && <Line label={t.adapter} value={done.provider} />}
          {done.ttftMs !== null && (
            <Line label={t.firstToken} value={`${(done.ttftMs / 1000).toFixed(1)} s`} />
          )}
          <Line label="celkom" value={`${(done.totalMs / 1000).toFixed(1)} s`} />

          {/* Tokeny a cena. Cache sa uvádza zvlášť, lebo čítanie z nej stojí
              desatinu ceny vstupu — bez toho rozlíšenia by číslo klamalo. */}
          {done.tokens && (
            <Line
              label="tokeny"
              value={
                `${done.tokens.input.toLocaleString("sk")} → ` +
                `${done.tokens.output.toLocaleString("sk")}` +
                (done.tokens.cacheRead
                  ? ` · z cache ${done.tokens.cacheRead.toLocaleString("sk")}` : "") +
                (done.tokens.cacheWrite
                  ? ` · do cache ${done.tokens.cacheWrite.toLocaleString("sk")}` : "")
              }
            />
          )}
          {done.cost && !done.cost.unknownModel && (
            <span
              className="stitok"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
              title={t.costNote(done.cost.pricelistVersion)}
            >
              ≈ {formatUsd(done.cost.usd)} · {formatEur(toEur(done.cost.usd))}
            </span>
          )}
          {/* Cenník, ktorý prestal platiť, radšej priznáme, než by sme ticho
              počítali starou sadzbou. */}
          {done.cost?.pricelistExpired && (
            <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
              {t.pricelistStale}
            </span>
          )}
          {/* Rozpad na fázy. Nezaujíma hodnotiteľa, ale bez neho sa nedá
              povedať, prečo je prvý token pomalý. */}
          {done.timings && Object.entries(done.timings).filter(([, ms]) => ms >= 50).map(([f, ms]) => (
            <Line key={f} label={f} value={`${(ms / 1000).toFixed(1)} s`} />
          ))}
          <span
            className="stitok"
            style={
              done.verifiedCitations
                ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
                : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            }
          >
            {done.verifiedCitations ? t.citationsVerified : t.citationsUnverified}
          </span>
        </div>
      )}
    </div>
  )
}
