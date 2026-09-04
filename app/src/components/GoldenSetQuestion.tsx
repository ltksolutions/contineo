"use client"

/**
 * Jedna otázka zlatej sady: znenie, možnosť upraviť ho, položenie otázky
 * systému a posúdenie odpovede.
 *
 * Pasca sa hodnotiteľovi hovorí VOPRED. Znie to ako napovedanie, ale nie je:
 * pri pasci sa neposudzuje, či je odpoveď vecne správna, ale či sa systém
 * správne zdržal. Bez toho upozornenia by hodnotiteľ označil odmietnutie
 * ako chybu — a metrika „správne neviem" by vyšla presne naopak.
 */

import { useState } from "react"
import Link from "next/link"
import Search from "./Search"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function GoldenSetQuestion({
  id, text: questionText, original, edited, excluded, exclusionReason,
  trapType, expectedBehaviour, precedenceRule, searchMode,
  overlap, others: foreign, next, language,
}: {
  id: string
  text: string
  original: string
  edited: string | null
  excluded: boolean
  exclusionReason: string | null
  trapType: string | null
  expectedBehaviour: string
  precedenceRule: string | null
  searchMode: string
  /** Má otázku posúdiť viac ľudí nezávisle? */
  overlap: boolean
  /** Posudky ostatných. Pri prekryve prázdne, kým neposúdim sám. */
  others: { reviewer: string; correct: 0 | 1 | null }[]
  next: string | null
  language?: UiLanguage
}) {
  const d = dictionary(language).goldenSet
  const t = d.detail
  const [text, setText] = useState(questionText)
  const [editing, setEditing] = useState(false)
  const [excludedNow, setExcluded] = useState(excluded)
  const [reason, setReason] = useState(exclusionReason ?? "")
  const [status, setStatus] = useState<"" | "ukladam" | "ulozene" | "chyba">("")
  const [reviewed, setReviewed] = useState(false)

  async function save(change: Record<string, unknown>) {
    setStatus("ukladam")
    try {
      const r = await fetch("/api/sada", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...change }),
      })
      setStatus(r.ok ? "ulozene" : "chyba")
    } catch {
      setStatus("chyba")
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/sada" className="tichy" style={{ fontSize: 13.5, textDecoration: "none" }}>
          {t.back}
        </Link>
        <span className="stitok tichy" style={{ fontSize: 11 }}>{id}</span>
        <span className="stitok tichy" style={{ fontSize: 11 }}>{searchMode}</span>
        {precedenceRule && (
          <span className="stitok tichy" style={{ fontSize: 11 }}>{precedenceRule}</span>
        )}
        <span className="tichy" style={{ fontSize: 12, marginLeft: "auto" }}>
          {status === "ukladam" ? t.saving : status === "ulozene" ? t.saved : status === "chyba" ? t.saveFailed : ""}
        </span>
      </div>

      {/* Otázka pre dvoch — hodnotiteľ má vedieť, prečo cudzí posudok nevidí. */}
      {overlap && foreign.length === 0 && (
        <div className="karta" style={{ fontSize: 14, lineHeight: 1.6 }}>
          <strong>{t.twoReviewersHeading}</strong>{" "}
          <span className="tichy">{t.twoReviewersNote}</span>
        </div>
      )}

      {/* Po vlastnom posudku sa cudzie odkryjú. Nezhoda je nález, nie chyba. */}
      {foreign.length > 0 && (
        <div
          className="karta"
          style={{
            fontSize: 14, lineHeight: 1.6,
            borderColor: foreign.some(c => c.correct !== null) ? "var(--line)" : "var(--line)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.othersHeading}</div>
          {foreign.map((c, i) => (
            <div key={i} className="tichy" style={{ fontSize: 13.5 }}>
              {c.reviewer} — {c.correct === 1 ? t.verdict.correct : c.correct === 0 ? t.verdict.incorrect : t.verdict.none}
            </div>
          ))}
        </div>
      )}

      {/* Čo sa od systému očakáva. Pri pasci je to kľúčové — inak hodnotiteľ
          posúdi správne odmietnutie ako zlyhanie. */}
      {(trapType || expectedBehaviour !== "answer") && (
        <div
          className="karta"
          style={{
            background: "var(--warn-bg)", color: "var(--warn-fg)",
            borderColor: "var(--line)", display: "flex", gap: 10, alignItems: "flex-start",
          }}
        >
          <span aria-hidden="true" style={{ fontWeight: 700 }}>▲</span>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>
            <strong>{t.trapHeading}</strong>{" "}
            {trapType && t.traps[trapType]}
            {t.trapBeforeBehaviour}
            <strong>{t.behaviours[expectedBehaviour] ?? expectedBehaviour}</strong>
            {t.trapAfterBehaviour}
          </span>
        </div>
      )}

      {excludedNow ? (
        <div className="karta">
          <div style={{ fontSize: 15, marginBottom: 8 }}>
            <strong>{t.excludedHeading}</strong>
          </div>
          {reason && <p className="tichy" style={{ fontSize: 14, margin: "0 0 12px" }}>{reason}</p>}
          <button
            type="button"
            className="tlacidlo tlacidlo--tiche"
            onClick={() => { setExcluded(false); save({ excluded: false }) }}
          >
            {t.returnToSet}
          </button>
        </div>
      ) : (
        <>
          <div className="karta">
            {editing ? (
              <div style={{ display: "grid", gap: 10 }}>
                <label className="tichy" style={{ fontSize: 13 }}>
                  {t.editLabel}
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  style={{
                    width: "100%", background: "var(--bg)", color: "var(--ink)",
                    border: "1px solid var(--line)", borderRadius: 9,
                    padding: "10px 13px", fontSize: 15.5, fontFamily: "inherit",
                    lineHeight: 1.6, resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="tlacidlo"
                    style={{ padding: "7px 14px", fontSize: 14 }}
                    onClick={() => { setEditing(false); save({ editedText: text }) }}
                  >
                    {t.saveText}
                  </button>
                  <button
                    type="button"
                    className="tlacidlo tlacidlo--tiche"
                    style={{ padding: "7px 14px", fontSize: 14 }}
                    onClick={() => { setText(questionText); setEditing(false) }}
                  >
                    {t.cancel}
                  </button>
                  {edited && (
                    <button
                      type="button"
                      className="tlacidlo tlacidlo--tiche"
                      style={{ padding: "7px 14px", fontSize: 14 }}
                      onClick={() => { setText(original); setEditing(false); save({ editedText: "" }) }}
                    >
                      {t.restoreOriginal}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 600 }}>{text}</div>
                  {/* Pôvodné znenie zostáva viditeľné — je to podklad pre
                      regresné merania, nie len história. */}
                  {edited && (
                    <div className="tichy" style={{ fontSize: 12.5, marginTop: 8 }}>
                      {t.originally(original)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="tlacidlo tlacidlo--tiche"
                  style={{ padding: "6px 12px", fontSize: 13.5, flexShrink: 0 }}
                  onClick={() => setEditing(true)}
                >
                  {t.edit}
                </button>
              </div>
            )}
          </div>

          <Search
            key={text}
            questionId={id}
            preset={text}
            onReviewed={() => setReviewed(true)}
            language={language}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Ponuka ďalšej otázky sa objaví až po posúdení — dovtedy by
                nabádala preskočiť prácu, kvôli ktorej sme tu. */}
            {reviewed && next && (
              <Link href={`/sada/${next}`} className="tlacidlo" style={{ textDecoration: "none" }}>
                {t.nextQuestion}
              </Link>
            )}
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => {
                const why = window.prompt(t.excludePrompt) ?? ""
                if (why.trim()) {
                  setExcluded(true)
                  setReason(why)
                  save({ excluded: true, exclusionReason: why })
                }
              }}
            >
              {t.excludeQuestion}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
