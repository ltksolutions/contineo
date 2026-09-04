/**
 * Zoznam zlatej sady — prehľad všetkých 74 otázok a toho, čo je posúdené.
 *
 * Hodnotiteľ vidí celok naraz a vyberá si, čomu rozumie najlepšie. Pri
 * 4–8 hodinách práce je to podstatné: nikto to neurobí na jeden záťah
 * a nútené poradie by znamenalo, že sa zasekne na otázke mimo svojej
 * oblasti a prestane.
 *
 * Stránka je serverová a načítava sa pri každom zobrazení — hodnotiteľov
 * môže byť viac a musia vidieť, čo už spravil niekto iný.
 */

import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { loadGoldenSet, goldenSetSummary, questionText, verdictCount } from "@/lib/goldenSet"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { currentPerson } from "@/lib/session"

export const dynamic = "force-dynamic"

function Badge({ text, color: color }: { text: string; color?: "ok" | "bad" | "warn" }) {
  const styles =
    color === "ok" ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
    : color === "bad" ? { background: "var(--bad-bg)", color: "var(--bad-fg)" }
    : color === "warn" ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
    : { background: "var(--surface-2)", color: "var(--muted)" }

  return (
    <span className="stitok" style={{ ...styles, fontSize: 11, fontWeight: 600 }}>
      {text}
    </span>
  )
}

function Meter({ done, total, language }: { done: number; total: number; language?: UiLanguage }) {
  const t = dictionary(language).goldenSet
  const ratio = total ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span className="tichy">{t.reviewedLabel}</span>
        <span style={{ fontWeight: 700 }}>{t.doneOf(done, total)}</span>
      </div>
      <div style={{ height: 7, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${ratio}%`, height: "100%", background: "var(--teal-700)" }} />
      </div>
    </div>
  )
}

export default async function GoldenSetPage() {
  const session = await getServerSession(authOptions)
  const self = session?.user?.email ?? ""

  const [questions, counts] = await Promise.all([loadGoldenSet(self), verdictCount()])
  const s = goldenSetSummary(questions, counts)
  const language = (await currentPerson())?.language
  const t = dictionary(language).goldenSet

  return (
    <div className="obal" style={{ padding: "32px 20px 80px", maxWidth: 1040 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 8px" }}>{t.heading}</h1>
        <p className="tichy" style={{ fontSize: 15, margin: 0, maxWidth: 680 }}>{t.intro}</p>
      </div>

      <div className="karta" style={{ marginBottom: 26 }}>
        <Meter done={s.posudene} total={s.total} language={language} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, fontSize: 13.5 }}>
          <span><strong style={{ color: "var(--ok-fg)" }}>{s.spravne}</strong> <span className="tichy">{t.correct}</span></span>
          <span><strong style={{ color: "var(--bad-fg)" }}>{s.nespravne}</strong> <span className="tichy">{t.incorrect}</span></span>
          {s.hallucinations > 0 && (
            <span><strong style={{ color: "var(--bad-fg)" }}>{s.hallucinations}</strong> <span className="tichy">{t.withHallucination}</span></span>
          )}
          {s.vyradene > 0 && (
            <span><strong>{s.vyradene}</strong> <span className="tichy">{t.excluded}</span></span>
          )}
        </div>

        {/* Prekryv — otázky, ktoré majú posúdiť dvaja nezávisle. */}
        <div
          className="tichy"
          style={{ fontSize: 13, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", lineHeight: 1.6 }}
        >
          <strong style={{ color: "var(--ink)" }}>{t.overlapCount(s.prekryvHotove, s.vPrekryve)}</strong>
          {t.overlapNote}
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {questions.map(o => {
          const reviewed = o.state?.correct !== null && o.state !== null
          return (
            <Link
              key={o.id}
              href={`/sada/${o.id}`}
              style={{
                display: "flex", gap: 14, alignItems: "flex-start",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                // Ľavý pruh nesie stav — dá sa prebehnúť očami po stĺpci
                // bez čítania štítkov.
                borderLeft: `3px solid ${
                  o.excluded ? "var(--line)"
                  : !reviewed ? "var(--line)"
                  : o.state?.correct === 1 ? "var(--ok-fg)" : "var(--bad-fg)"
                }`,
                borderRadius: 10,
                padding: "12px 15px",
                textDecoration: "none",
                opacity: o.excluded ? 0.55 : 1,
              }}
            >
              <span
                className="tichy"
                style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", minWidth: 58, paddingTop: 2 }}
              >
                {o.id}
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block", fontSize: 14.5, lineHeight: 1.5,
                    textDecoration: o.excluded ? "line-through" : "none",
                  }}
                >
                  {questionText(o)}
                </span>

                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  <Badge text={o.searchMode} />
                  {/* Pasca znamená, že systém NEMÁ odpovedať vecne — hodnotiteľ
                      to musí vedieť vopred, inak posúdi odmietnutie ako chybu. */}
                  {o.trapType && <Badge text={t.badges.trap(o.trapType)} color="warn" />}
                  {o.precedenceRule && <Badge text={o.precedenceRule} />}
                  {o.editedText && <Badge text={t.badges.edited} />}
                  <Badge text={t.areas[o.oblast] ?? o.oblast} />
                  {o.overlap && (
                    <Badge
                      text={
                        (counts[o.id] ?? 0) >= 2 ? t.badges.reviewedByTwo
                        : (counts[o.id] ?? 0) === 1 ? t.badges.waitingForSecond
                        : t.badges.forTwo
                      }
                      color={(counts[o.id] ?? 0) >= 2 ? "ok" : undefined}
                    />
                  )}
                  {o.state?.hallucination === 1 && <Badge text={t.badges.hallucination} color="bad" />}
                </span>
              </span>

              <span style={{ textAlign: "right", minWidth: 96 }}>
                {o.excluded ? (
                  <Badge text={t.badges.excluded} />
                ) : reviewed ? (
                  <>
                    <Badge
                      text={o.state?.correct === 1 ? t.badges.correct : t.badges.incorrect}
                      color={o.state?.correct === 1 ? "ok" : "bad"}
                    />
                    {/* Nezhoda sa musí vidieť — je to nález, nie chyba. */}
                    {o.others.some(c => c.correct !== o.state?.correct) && (
                      <span style={{ display: "block", marginTop: 5 }}>
                        <Badge text={t.badges.disagreement} color="warn" />
                      </span>
                    )}
                  </>
                ) : (counts[o.id] ?? 0) > 0 ? (
                  <span className="tichy" style={{ fontSize: 12.5 }}>
                    {o.overlap ? t.badges.waitingForYou : t.badges.reviewed}
                  </span>
                ) : (
                  <span className="tichy" style={{ fontSize: 12.5 }}>{t.badges.notReviewed}</span>
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
