/**
 * Fronta hodnotiteľa — odpovede, pri ktorých niekto povedal, že nesedia.
 *
 * **Nie je to zoznam všetkého, čo sa systém opýtali.** Do fronty sa dostane
 * len odpoveď, ktorú čitateľ označil „Nesedí" alebo k nej napísal, čo je na
 * nej zle (rozhodnutie Jána Letka 2026-09-15). Potvrdzovať správne odpovede
 * by znamenalo minúť ten najdrahší čas v celom cykle na klikanie „áno, bolo
 * to dobré" — a fronta, do ktorej sa nikto nepozrie, je presne to, na čom
 * stroskotala zlatá sada.
 *
 * Posudok sa zapisuje tým istým panelom ako pod odpoveďou (`Rating.tsx`
 * v režime hodnotiteľa) a tou istou cestou `PATCH /api/rating` — druhá cesta
 * k tomu istému zápisu by sa raz s prvou rozišla. Prvý posudok nastaví
 * `evaluatedAt` a záznam tým z fronty odchádza; na obrazovke zostane, kým sa
 * nenačíta znova, aby sa dalo dopísať overené znenie a §.
 *
 * Stránka je serverová a načítava sa pri každom zobrazení — hodnotiteľov
 * môže byť viac a musia vidieť, čo už spravil niekto iný.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { evaluationContext, evaluationQueue } from "@/lib/evaluation"
import { preparableAnswers } from "@/lib/curation"
import { prepareCurationAction } from "./actions"
import Notice from "@/components/Notice"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import Rating from "@/components/Rating"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await evaluationContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const language = ctx.person.language
  const t = dictionary(language).evaluation
  const tc = dictionary(language).curation
  const branding = brandingView(ctx.tenant)
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const [queue, toPrepare] = await Promise.all([
    evaluationQueue(ctx.person.companyCode),
    preparableAnswers(ctx.person.companyCode),
  ])

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 860, ...tenantStyle(branding) }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          {t.heading}
          {queue.length > 0 && (
            <span className="tag" style={{ fontSize: 12, marginLeft: 10, verticalAlign: "middle" }}>
              {t.waiting(queue.length)}
            </span>
          )}
        </h1>
        <p className="quiet" style={{ fontSize: 15, margin: 0, maxWidth: 660 }}>{t.intro}</p>
      </div>

      <Notice message={message} error={error === "1"} back="/evaluation" />

      {queue.length === 0 && (
        <div className="card">
          <p style={{ margin: "0 0 6px", fontSize: 15.5 }}>{t.empty}</p>
          <p className="quiet" style={{ margin: 0, fontSize: 14 }}>{t.emptyNote}</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {queue.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              {item.readerVerdict === 0 && (
                <span className="tag" style={{ background: "var(--bad-bg)", color: "var(--bad-fg)", fontSize: 11, fontWeight: 600 }}>
                  {t.saidDoesNotFit}
                </span>
              )}
              {item.readerNote && (
                <span className="tag" style={{ fontSize: 11, fontWeight: 600 }}>{t.reported}</span>
              )}
              <span className="quiet" style={{ fontSize: 12.5, marginLeft: "auto" }}>
                {t.askedAt} {formatDate(item.askedAt, language)}
              </span>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 16.5, fontWeight: 600, lineHeight: 1.45 }}>
              {item.question}
            </p>

            {/*
              Slová čitateľa sa vypisujú **doslovne a celé**. Je to jediná
              veta, kvôli ktorej sa niekto namáhal niečo napísať, a zhrnúť
              sa nedá bez toho, aby sa stratilo práve to, čo mu vadilo.
            */}
            {item.readerNote && (
              <div
                style={{
                  background: "var(--surface-2)",
                  borderLeft: "3px solid var(--bad-fg)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 14,
                }}
              >
                <div className="quiet" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  {t.reader}
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {item.readerNote}
                </div>
              </div>
            )}

            {/* Odpoveď je zabalená: hodnotiteľ často vie z otázky a poznámky,
                o čo ide, a rozbalená odpoveď by z karty spravila stranu. */}
            <details style={{ marginBottom: 14 }}>
              <summary className="quiet" style={{ cursor: "pointer", fontSize: 13.5 }}>
                {t.showAnswer}
                {item.sources.length > 0 && ` · ${t.sources(item.sources.length)}`}
              </summary>
              <div style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {item.answer}
              </div>
              {item.sources.length > 0 && (
                <ul className="quiet" style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
                  {item.sources.map((s, i) => (
                    <li key={i}>{[s.title, s.articleRef].filter(Boolean).join(" · ")}</li>
                  ))}
                </ul>
              )}
            </details>

            <Rating recordId={item.id} canEvaluate language={language} />
          </div>
        ))}
      </div>

      {/*
        Druhá časť obrazovky: z posúdenej odpovede sa robí **overená
        odpoveď do znalostí**. Je tu, a nie inde, lebo to robí ten istý
        človek hneď po posudku — samostatná obrazovka by znamenala ďalšie
        miesto, kam sa treba dostať.

        Zverejňuje **správca obsahu**, nie hodnotiteľ. Preto je tlačidlo
        „Pripraviť pár", nie „Zverejniť".
      */}
      <div style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 19, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
          {tc.prepareHeading}
        </h2>
        <p className="quiet" style={{ fontSize: 14.5, margin: "0 0 18px", maxWidth: 660 }}>
          {tc.prepareIntro}
        </p>

        {toPrepare.length === 0 && (
          <p className="quiet" style={{ fontSize: 14.5, margin: 0 }}>{tc.prepareEmpty}</p>
        )}

        <div style={{ display: "grid", gap: 18 }}>
          {toPrepare.map(item => (
            <form key={item.id} action={prepareCurationAction} className="card">
              <input type="hidden" name="id" value={item.id} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {item.draft && (
                  <span className="tag" style={{ fontSize: 11, fontWeight: 600 }}>{tc.draftBadge}</span>
                )}
                <span className="quiet" style={{ fontSize: 12.5, marginLeft: "auto" }}>
                  {formatDate(item.evaluatedAt, language)}
                </span>
              </div>

              <label className="field">
                <span className="field-label">{tc.questionLabel}</span>
                <textarea className="field-input" name="question" rows={2}
                          defaultValue={item.draft?.question ?? item.question} required />
                <span className="quiet field-hint">{tc.questionHint}</span>
              </label>

              <label className="field">
                <span className="field-label">{tc.answerLabel}</span>
                <textarea className="field-input" name="answer" rows={5}
                          defaultValue={item.draft?.answer ?? item.verifiedAnswer} required />
              </label>

              <fieldset className="hr-group" style={{ border: "1px solid var(--line)" }}>
                <legend className="field-label">{tc.sourcesLabel}</legend>
                {item.sources.length === 0 ? (
                  <p className="quiet" style={{ margin: 0, fontSize: 13.5 }}>{tc.noSources}</p>
                ) : (
                  <ul className="hr-choices">
                    {item.sources.map(src => (
                      <li key={src.chunkId}>
                        <label className="hr-choice">
                          <input type="checkbox" name="chunkIds" value={src.chunkId}
                                 defaultChecked={item.draft?.chunkIds?.includes(src.chunkId) ?? true} />
                          <span>{[src.title, src.articleRef].filter(Boolean).join(" · ")}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="quiet field-hint" style={{ margin: "6px 0 0" }}>{tc.sourcesHint}</p>
              </fieldset>

              {item.correctSources && (
                <p className="quiet" style={{ fontSize: 13, margin: "10px 0 0" }}>
                  § {item.correctSources}
                </p>
              )}

              {item.sources.length > 0 && (
                <p style={{ margin: "14px 0 0" }}>
                  <button className="button" type="submit">{tc.save}</button>
                </p>
              )}
            </form>
          ))}
        </div>

        <p className="quiet" style={{ fontSize: 13.5, marginTop: 18 }}>
          <Link href="/library/curation">{tc.open} →</Link>
        </p>
      </div>
    </div>
    </AppShell>
  )
}
