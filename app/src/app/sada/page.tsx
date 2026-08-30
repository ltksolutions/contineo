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
import { loadGoldenSet, goldenSetSummary, questionText, verdictCount, AREA_LABEL } from "@/lib/goldenSet"

export const dynamic = "force-dynamic"

function Badge({ text, farba: color }: { text: string; farba?: "ok" | "bad" | "warn" }) {
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

function Meter({ hotovo: done, spolu: total }: { hotovo: number; spolu: number }) {
  const ratio = total ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span className="tichy">Posúdených</span>
        <span style={{ fontWeight: 700 }}>{done} zo {total}</span>
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

  return (
    <div className="obal" style={{ padding: "32px 20px 80px", maxWidth: 1040 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Zlatá sada
        </h1>
        <p className="tichy" style={{ fontSize: 15, margin: 0, maxWidth: 680 }}>
          Otázky sú návrhy. Ak niektorá nedáva zmysel alebo znie neprirodzene,
          upravte ju alebo vyraďte — to je rovnako cenná informácia ako posudok
          odpovede.
        </p>
      </div>

      <div className="karta" style={{ marginBottom: 26 }}>
        <Meter hotovo={s.posudene} spolu={s.spolu} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, fontSize: 13.5 }}>
          <span><strong style={{ color: "var(--ok-fg)" }}>{s.spravne}</strong> <span className="tichy">správnych</span></span>
          <span><strong style={{ color: "var(--bad-fg)" }}>{s.nespravne}</strong> <span className="tichy">nesprávnych</span></span>
          {s.halucinacie > 0 && (
            <span><strong style={{ color: "var(--bad-fg)" }}>{s.halucinacie}</strong> <span className="tichy">s halucináciou</span></span>
          )}
          {s.vyradene > 0 && (
            <span><strong>{s.vyradene}</strong> <span className="tichy">vyradených</span></span>
          )}
        </div>

        {/* Prekryv — otázky, ktoré majú posúdiť dvaja nezávisle. */}
        <div
          className="tichy"
          style={{ fontSize: 13, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", lineHeight: 1.6 }}
        >
          <strong style={{ color: "var(--ink)" }}>{s.prekryvHotove} z {s.vPrekryve}</strong>{" "}
          otázok na precedenciu a pasce má posudok od dvoch ľudí. Pri nich sa cudzí
          posudok ukáže až potom, ako ich posúdite sami — inak by miera zhody merala
          len to, či ste prvému uverili.
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {questions.map(o => {
          const reviewed = o.stav?.spravna !== null && o.stav !== null
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
                  o.vyradena ? "var(--line)"
                  : !reviewed ? "var(--line)"
                  : o.stav?.spravna === 1 ? "var(--ok-fg)" : "var(--bad-fg)"
                }`,
                borderRadius: 10,
                padding: "12px 15px",
                textDecoration: "none",
                opacity: o.vyradena ? 0.55 : 1,
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
                    textDecoration: o.vyradena ? "line-through" : "none",
                  }}
                >
                  {questionText(o)}
                </span>

                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  <Badge text={o.searchMode} />
                  {/* Pasca znamená, že systém NEMÁ odpovedať vecne — hodnotiteľ
                      to musí vedieť vopred, inak posúdi odmietnutie ako chybu. */}
                  {o.trapType && <Badge text={`pasca · ${o.trapType}`} farba="warn" />}
                  {o.precedenceRule && <Badge text={o.precedenceRule} />}
                  {o.upraveneZnenie && <Badge text="upravená" />}
                  <Badge text={AREA_LABEL[o.oblast]} />
                  {o.prekryv && (
                    <Badge
                      text={
                        (counts[o.id] ?? 0) >= 2 ? "posúdili dvaja"
                        : (counts[o.id] ?? 0) === 1 ? "čaká na druhého"
                        : "pre dvoch"
                      }
                      farba={(counts[o.id] ?? 0) >= 2 ? "ok" : undefined}
                    />
                  )}
                  {o.stav?.halucinacia === 1 && <Badge text="halucinácia" farba="bad" />}
                </span>
              </span>

              <span style={{ textAlign: "right", minWidth: 96 }}>
                {o.vyradena ? (
                  <Badge text="vyradená" />
                ) : reviewed ? (
                  <>
                    <Badge
                      text={o.stav?.spravna === 1 ? "správna" : "nesprávna"}
                      farba={o.stav?.spravna === 1 ? "ok" : "bad"}
                    />
                    {/* Nezhoda sa musí vidieť — je to nález, nie chyba. */}
                    {o.cudzie.some(c => c.spravna !== o.stav?.spravna) && (
                      <span style={{ display: "block", marginTop: 5 }}>
                        <Badge text="nezhoda" farba="warn" />
                      </span>
                    )}
                  </>
                ) : (counts[o.id] ?? 0) > 0 ? (
                  <span className="tichy" style={{ fontSize: 12.5 }}>
                    {o.prekryv ? "čaká na vás" : "posúdená"}
                  </span>
                ) : (
                  <span className="tichy" style={{ fontSize: 12.5 }}>neposúdená</span>
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
