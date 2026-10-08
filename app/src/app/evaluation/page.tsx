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
import SubmitButton from "@/components/SubmitButton"

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
    {/* EVAL-posudok (8. 10. 2026): položka fronty je jedna karta, posudok
        jej sekcia; bez inline štýlov. */}
    <div className="page-narrow page-narrow--wide" style={tenantStyle(branding)}>
      {/* Hlavička stránky (DESIGN_ODCHYLKY P1); počet čakajúcich ako štítok vedľa. */}
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        {queue.length > 0 && <span className="tag">{t.waiting(queue.length)}</span>}
      </div>
      <p className="quiet page-lead eval-lead">{t.intro}</p>

      <Notice language={language} message={message} error={error === "1"} back="/evaluation" />

      {queue.length === 0 && (
        <div className="empty">
          <div className="empty-title">{t.empty}</div>
          <div className="empty-text">{t.emptyNote}</div>
        </div>
      )}

      {queue.map(item => (
        <article key={item.id} className="card eval-item">
          <div className="eval-main">
            <div className="eval-head">
              {item.readerVerdict === 0 && <span className="tag tag--expired">{t.saidDoesNotFit}</span>}
              {item.readerNote && <span className="tag">{t.reported}</span>}
              <span className="eval-date">{t.askedAt} {formatDate(item.askedAt, language)}</span>
            </div>

            <p className="eval-q">{item.question}</p>

            {/*
              Slová čitateľa sa vypisujú **doslovne a celé**. Je to jediná
              veta, kvôli ktorej sa niekto namáhal niečo napísať, a zhrnúť
              sa nedá bez toho, aby sa stratilo práve to, čo mu vadilo.
              Citát, nie `.lnote` — hláška aplikácie by slovám čitateľa
              dodala váhu systémového varovania (EVAL-posudok Q5).
            */}
            {item.readerNote && (
              <blockquote className="quote">
                <span className="quote-who">{t.reader}</span>
                <span className="quote-text">{item.readerNote}</span>
              </blockquote>
            )}

            {/* Odpoveď je zabalená: hodnotiteľ často vie z otázky a poznámky,
                o čo ide, a rozbalená odpoveď by z karty spravila stranu. */}
            <details className="eval-ans">
              <summary>
                {t.showAnswer}
                {item.sources.length > 0 && ` · ${t.sources(item.sources.length)}`}
              </summary>
              <div className="eval-ans-body">{item.answer}</div>
              {item.sources.length > 0 && (
                <ul className="eval-ans-sources quiet">
                  {item.sources.map((s, i) => (
                    <li key={i}>{[s.title, s.articleRef].filter(Boolean).join(" · ")}</li>
                  ))}
                </ul>
              )}
            </details>
          </div>

          <Rating recordId={item.id} canEvaluate as="section" language={language} />
        </article>
      ))}

      {/*
        Druhá časť obrazovky: z posúdenej odpovede sa robí **overená
        odpoveď do znalostí**. Je tu, a nie inde, lebo to robí ten istý
        človek hneď po posudku — samostatná obrazovka by znamenala ďalšie
        miesto, kam sa treba dostať.

        Zverejňuje **správca obsahu**, nie hodnotiteľ. Preto je tlačidlo
        „Pripraviť pár", nie „Zverejniť".
      */}
      <section className="form-group form-group--lg eval-prepare">
        <h2 className="form-group-head form-group-head--step">{tc.prepareHeading}</h2>
        <p className="form-group-lead quiet">{tc.prepareIntro}</p>

        {toPrepare.length === 0 && <p className="quiet form-group-lead">{tc.prepareEmpty}</p>}

        {toPrepare.map(item => (
          <form key={item.id} action={prepareCurationAction} className="card prep">
            <input type="hidden" name="id" value={item.id} />

            <div className="eval-head">
              {item.draft && <span className="tag">{tc.draftBadge}</span>}
              <span className="eval-date">{formatDate(item.evaluatedAt, language)}</span>
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

            {/* Zdroje ako riadky priamo v karte — bez karty v karte
                (EVAL-posudok Q4, rovnako ako karta osoby). */}
            <fieldset className="sec-rows">
              <legend className="sec-rows-head">{tc.sourcesLabel}</legend>
              <div className="sec-rows-body">
              {item.sources.length === 0 ? (
                <p className="quiet sec-rows-empty">{tc.noSources}</p>
              ) : (
                // Riadky s kruhom vľavo (ZAKLAD-vyber-a-prepinace, 6. 10. 2026).
                <div className="form-list">
                  {item.sources.map(src => (
                    <label key={src.chunkId} className="form-row select-row">
                      <input type="checkbox" name="chunkIds" value={src.chunkId}
                             defaultChecked={item.draft?.chunkIds?.includes(src.chunkId) ?? true} />
                      <span className="form-row-main">{[src.title, src.articleRef].filter(Boolean).join(" · ")}</span>
                    </label>
                  ))}
                </div>
              )}
              </div>
              <p className="sec-rows-foot quiet">
                {tc.sourcesHint}
                {item.correctSources && <> {tc.evaluatorSources(item.correctSources)}</>}
              </p>
            </fieldset>

            {item.sources.length > 0 && (
              <div>
                {/* Každá položka má vlastné uloženie — tiché (R1, 6. 10. 2026). */}
                <SubmitButton className="button button--quiet">{tc.save}</SubmitButton>
              </div>
            )}
          </form>
        ))}

        <p className="form-group-foot">
          <Link href="/library/curation">{tc.open}</Link>
        </p>
      </section>
    </div>
    </AppShell>
  )
}
