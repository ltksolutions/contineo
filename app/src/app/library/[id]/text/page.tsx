/**
 * Editor textu — originál vedľa Markdownu (D53).
 *
 * **Prečo obidve strany naraz:** prevod z PDF je odhad. Rozdiel medzi „vyzerá
 * to dobre" a „je to naozaj to, čo je v norme" sa dá zistiť len porovnaním
 * a človek, ktorý musí prepínať okná, ho neurobí. Na telefóne sa stĺpce
 * poskladajú pod seba — originál je vtedy zbalený, aby sa text dal upravovať.
 *
 * Bez klientskeho stavu: je to formulár, ktorý sa odosiela na server. Návrh
 * modelu je uložený vedľa konceptu, nie v pamäti prehliadača — inak by sa
 * stratil obnovením stránky, presne keď má človek rozhodnúť.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail } from "@/lib/libraryRead"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary, errorText } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { createHash } from "node:crypto"
import TextEditor from "@/components/TextEditor"
import { saveTextAction, sendToModelAction, decideOnDraftAction, convertWithModelAction, confirmDifferencesAction } from "../../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"
import { markupChanges } from "@/lib/markupGuard"
import { canRewritePdf } from "@/lib/llmRewrite"
import { aiForCompany } from "@/lib/aiSettings"
import { isOrgAdmin } from "@/lib/people"
import { AppError } from "@/lib/appError"
import type { AiConversion } from "@/lib/aiConversionJob"
import { conversionNote } from "@/lib/conversionNote"
import ConversionProgress from "@/components/ConversionProgress"
import { freshConversionCheck, isConverting } from "@/lib/conversionCheckDb"
import { reviewDifferences } from "@/lib/conversionReview"

export const dynamic = "force-dynamic"

/**
 * Krátky odtlačok textu — len na rozlíšenie, či sa zmenil.
 *
 * Nie je to bezpečnostná funkcia a nemusí ňou byť: rozhoduje o tom, či sa
 * má znovu postaviť editor, nie o obsahu dokumentu.
 */
function textKey(text: string): string {
  return `${text.length}:${createHash("sha256").update(text).digest("hex").slice(0, 12)}`
}

/**
 * Veta okolo rozdielu s vyznačenými slovami (KNIZ-kontrola-slov Q3).
 * `gone` — slovo z PDF, ktoré v texte chýba, prečiarknuté.
 */
function excerpt(before: string, marked: string, after: string, nothing: string, gone = false) {
  if (!before && !marked && !after) return <span className="quiet">{nothing}</span>
  return (
    <>
      {before ? <>…{before} </> : null}
      {marked ? <mark className={gone ? "diff-mark diff-mark--gone" : "diff-mark"}>{marked}</mark> : null}
      {after ? <> {after}…</> : null}
    </>
  )
}

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { id } = await params
  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const documentId = decodeURIComponent(id)
  const d = await libraryDetail(ctx.tenant.companyCode, documentId)
  if (!d) notFound()

  // Návrh sa nečíta cez `detailKniznice` — je to dočasná vec editora, nie
  // súčasť dokumentu, a v zozname by nemal čo robiť.
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const raw = (await col.findOne(
    { companyCode: ctx.tenant.companyCode, documentId },
    { projection: { llmDraft: 1, pendingText: 1, aiConversion: 1 } },
  )) as { llmDraft?: { text: string; model: string; mode: string; at: Date }; pendingText?: { text?: string }; aiConversion?: AiConversion | null } | null
  const draft = raw?.llmDraft
  /*
   * Prevod modelom a kontrola slov (ADR-046). Kontrola sa prepočíta, keď sa
   * text od poslednej zmenil — človek po oprave hneď vidí, či nezhoda zmizla.
   */
  const job = raw?.aiConversion ?? null
  const converting = isConverting(job)
  const check = converting ? null : await freshConversionCheck(ctx.tenant.companyCode, documentId)
  const review = reviewDifferences(check?.open ?? [])
  const checkPdfUrl = check ? `/api/library/file/${encodeURIComponent(check.check.pdfFileId)}` : ""
  /* Kotvy riadkov pre „Opraviť v texte" — bez JavaScriptu posunú aspoň k editoru (Q5). */
  const checkLines = [...new Set(review.pages.flatMap(g => g.items.map(i => i.toLine ?? i.line)))]
  /*
   * Uloženie zastavené strážcom zápisu (`markupGuard.ts`, 16. 10. 2026).
   * Zoznam sa počíta znova z uloženého textu, nie z adresy — keby sa koncept
   * medzitým zmenil, ukáže sa to, čo naozaj platí.
   */
  const pending = raw?.pendingText?.text
  const markup = pending ? markupChanges(d.editableText, pending, (d.versions ?? []).map(v => v.markdown ?? "")) : []
  /*
   * Dokument s platným znením sa otvára v režime Markdown. Vizuálny režim
   * pri uložení prepisuje zápis (escapuje hviezdičky, z `***` urobil `*`)
   * a pri platnej norme je každá taká zmena oprava textu (ADR-007).
   */
  const editorMode = d.versions?.some(v => v.isActive) ? "markdown" : "wysiwyg"

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).library.editor
  /*
   * Vľavo je **PDF konceptu**, keď ho koncept má (ADR-011) — to je predpis,
   * ako ho ľudia uvidia, a s ním sa text porovnáva. `originalFile` je od
   * ADR-011 súbor, z ktorého vznikol text — pri `.docx` zdroji by vľavo
   * stála len veta, že sa Word v prehliadači nezobrazí (23. 9. 2026).
   */
  const shown = d.draftPdf ? { id: d.draftPdf.id, name: d.draftPdf.name, isPdf: true }
    : d.originalFile ? { id: d.originalFile.id, name: d.originalFile.name, isPdf: d.originalFile.type === "pdf" }
    : null
  const isPdf = shown?.isPdf ?? false
  /*
   * Prepis skenu posiela modelu **pôvodný súbor**, nie PDF konceptu
   * (`sendToModelAction`). Tlačidlo sa preto riadi pôvodným súborom, nie tým,
   * čo je vľavo — inak sa pri koncepte z Markdownu ukázalo a po kliknutí
   * skončilo chybou „Prepisovať sa dá len PDF" (Skúšobný poriadok, 1. 11. 2026).
   */
  /*
   * Bez kľúča AI nejde ani prevod modelom, ani prepis skenu — namiesto
   * tlačidiel, ktoré by skončili chybou, karta povie, kde sa AI zapína
   * (Ján 3. 11. 2026, keď zmizlo „Prečistiť členenie").
   */
  const aiOn = Boolean((await aiForCompany(ctx.tenant.companyCode)).apiKey)
  const canRewriteScan = aiOn && canRewritePdf(d.originalFile)
  const canConvert = aiOn && d.originalFile?.type === "pdf" && !converting
  const fileUrl = shown ? `/api/library/file/${encodeURIComponent(shown.id)}` : null

  return (
    <AppShell
      language={ctx.person.language}
      title={dictionary(language).library.flow.elsewhereText}
      trail={{ [`/library/${documentId}`]: d.title }}
    >
    <div style={{ maxWidth: 1200, ...tenantStyle(branding) }}>
      <Notice language={language} message={message} error={error === "1"} back={`/library/${encodeURIComponent(documentId)}/text`} />


      <div className="page-head">
        <h1 className="page-title">{d.title}</h1>
      </div>
      <p className="quiet page-lead">{t.intro}</p>

      {d.conversion?.warnings?.length ? (
        <ul className="card" style={{ padding: "12px 16px 12px 34px", margin: "0 0 16px", fontSize: "var(--fs-body)" }}>
          {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      ) : null}

      {converting && job ? (
        <ConversionProgress documentId={documentId} initial={conversionNote(job, language)} refreshLabel={t.convertRefresh} />
      ) : job?.status === "failed" ? (
        <div className="lnote lnote--warn" style={{ margin: "0 0 16px" }}>
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{t.convertFailed(errorText(new AppError(job.error ?? "conversion.failed", ""), language))}</span>
        </div>
      ) : null}

      {check ? (
        <div id="check" style={{ display: "grid", gap: "var(--gap)", margin: "0 0 18px" }}>
          <section className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.checkHeading}</h2>
            <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
              {t.checkSummary(check.check.pdfWords, check.check.sameWords, review.pages.reduce((n, g) => n + g.items.length, 0), review.minor.length)}
            </p>
            {check.open.length ? (
              <div className="lnote lnote--warn">
                <span className="lnote-mark" aria-hidden="true">!</span>
                <span className="lnote-text">{t.checkBlocking}</span>
              </div>
            ) : (
              <div className="lnote" role="status">
                <span className="lnote-mark" aria-hidden="true">✓</span>
                <span className="lnote-text">{t.checkAllConfirmed(check.confirmed.length)}</span>
              </div>
            )}
          </section>
          {/*
            Jeden formulár, tlačidlo nesie odtlačky toho, čo potvrdzuje
            (KNIZ-kontrola-slov Q2): položka, strana, alebo interpunkcia.
            Okienka zmizli — v dlhom zozname sa zaškrtávali naslepo.
          */}
          {check.open.length ? (
            <form action={confirmDifferencesAction} className="check-groups">
              <input type="hidden" name="documentId" value={documentId} />
              {review.pages.map(g => (
                <section key={g.from} className="card check-page">
                  <div className="check-page-head">
                    <h3>{g.from ? t.checkPage(g.from, g.to) : t.checkPageUnknown}</h3>
                    {g.from ? (
                      <a className="button button--quiet button--sm" href={`${checkPdfUrl}#page=${g.from}`} target="_blank" rel="noreferrer">
                        {t.checkOpenPdf(g.from)} ↗
                      </a>
                    ) : null}
                    {g.items.length > 1 ? (
                      <SubmitButton className="button button--quiet button--sm" name="ids" value={g.items.flatMap(i => i.ids).join(" ")}>
                        {t.checkConfirmPage(g.items.length)}
                      </SubmitButton>
                    ) : null}
                  </div>
                  {g.items.map(item => (
                    <div key={item.ids.join(" ")} className="check-item">
                      <div className="check-item-head">
                        <b>{t.checkKind[item.kind]}</b>
                        <span className="quiet">{item.toLine ? t.checkMovedLines(item.line, item.toLine) : t.checkLine(item.line)}</span>
                      </div>
                      <dl className="check-compare">
                        {item.kind !== "image" ? (
                          <>
                            <dt>{t.checkPdf}</dt>
                            <dd>{item.kind === "added" ? excerpt(item.before, "", item.after, t.checkNothing) : excerpt(item.before, item.pdfText, item.after, t.checkNothing)}</dd>
                          </>
                        ) : null}
                        <dt>{t.checkText}</dt>
                        <dd>
                          {item.kind === "missing" ? excerpt(item.before, item.pdfText, item.after, t.checkNothing, true)
                            : item.kind === "moved" ? excerpt(item.movedBefore ?? "", item.mdText, item.movedAfter ?? "", t.checkNothing)
                            : excerpt(item.before, item.mdText, item.after, t.checkNothing)}
                        </dd>
                      </dl>
                      <p className="check-item-note quiet">{t.checkExplain[item.kind]}</p>
                      <div className="check-actions">
                        <SubmitButton className="button button--quiet button--sm" name="ids" value={item.ids.join(" ")}>{t.checkOk}</SubmitButton>
                        <a className="button button--quiet button--sm" href={`#line-${item.toLine ?? item.line}`}>{t.checkFix}</a>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
              {review.minor.length ? (
                <section className="card check-minor">
                  <div>
                    <b>{t.checkMinorHeading(review.minor.length)}</b>
                    <p className="quiet" style={{ margin: "2px 0 0", fontSize: "var(--fs-small)" }}>{t.checkMinorNote}</p>
                  </div>
                  <SubmitButton className="button button--quiet button--sm" name="scope" value="minor">{t.checkConfirmMinor(review.minor.length)}</SubmitButton>
                </section>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {markup.length ? (
        <section id="markup" className="card" style={{ padding: 18, display: "grid", gap: 12, margin: "0 0 18px" }}>
          <div className="lnote lnote--warn">
            <span className="lnote-mark" aria-hidden="true">!</span>
            <div className="lnote-text">
              <strong>{t.markupHeading}</strong><br />
              {t.markupNote(markup.length)}
            </div>
          </div>
          <ul className="markup-list">
            {markup.map(c => (
              <li key={c.line}>
                <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {t.markupLine(c.line + 1)}
                  {c.stars ? <> · <span className="tag">{t.markupStars}</span></> : null}
                </div>
                <div><span className="quiet">{t.markupBefore}: </span><code>{c.before}</code></div>
                <div><span className="quiet">{t.markupAfter}: </span><code>{c.after}</code></div>
              </li>
            ))}
          </ul>
          <form action={saveTextAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="documentId" value={documentId} />
            <SubmitButton className="button" name="markupChoice" value="original">{t.markupKeep}</SubmitButton>
            <SubmitButton className="button button--quiet" name="markupChoice" value="accept">{t.markupAccept}</SubmitButton>
          </form>
        </section>
      ) : null}

      {draft ? (
        <section className="card" style={{ padding: 18, display: "grid", gap: 12, margin: "0 0 18px" }}>
          {/*
            Štítok aj poznámka sa riadia tým, čo návrh naozaj vyrobilo.
            Prečistenie členenia beží na pravidlách; povedať nad ním „návrh
            modelu" by bolo tvrdenie o pôvode textu normy, a to je presne
            ten údaj, ktorý musí sedieť.
          */}
          <div className="audit-head">
            {/* „clean" už nevzniká (3. 11. 2026), ale uložené návrhy ho môžu mať. */}
            <span className="tag">{draft.mode === "clean" ? t.ruleDraft : t.modelDraft}</span>
            <strong>{draft.mode === "rewrite-scan" ? t.modeRewriteScan : draft.mode === "convert" ? t.modeConvert : t.modeClean}</strong>
            <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>
              {t.draftMeta(draft.model, formatDate(draft.at, language), draft.text.length)}
            </span>
          </div>
          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
            {draft.mode === "clean" ? t.ruleNoteBefore : t.draftNoteBefore}
            <strong>{t.draftNoteHighlight}</strong>{t.draftNoteAfter}
          </p>
          <textarea className="field-input editor-text" readOnly rows={14} value={draft.text} />
          <form action={decideOnDraftAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="documentId" value={documentId} />
            <SubmitButton className="button" name="choice" value="accept">{t.useAsDraft}</SubmitButton>
            <SubmitButton className="button button--quiet" name="choice" value="discard">{t.discard}</SubmitButton>
          </form>
        </section>
      ) : null}

      <div className="editor-grid">
        <section className="editor-column">
          <h2 className="field-label" style={{ margin: "0 0 8px" }}>{t.original}</h2>
          {fileUrl ? (
            isPdf ? (
              <object className="editor-preview" data={fileUrl} type="application/pdf">
                <p className="quiet" style={{ fontSize: "var(--fs-body)", padding: 12 }}>
                  {t.pdfNotShown}
                  <a href={fileUrl} target="_blank" rel="noreferrer">{t.openInNewWindow}</a>.
                </p>
              </object>
            ) : (
              <p className="card" style={{ padding: 16, fontSize: "var(--fs-body)" }}>
                {t.fileNotShown(shown?.name ?? "")}
                <a href={fileUrl} target="_blank" rel="noreferrer">{t.download}</a>{t.compareAfterDownload}
              </p>
            )
          ) : (
            <p className="card" style={{ padding: 16, fontSize: "var(--fs-body)" }}>
              {t.noOriginal}
            </p>
          )}
        </section>

        <section className="editor-column">
          <h2 className="field-label" style={{ margin: "0 0 8px" }}>
            {t.text}
            <span className="quiet" style={{ fontWeight: 400 }}>
              {t.switchNoteBefore}<em>{t.switchNoteModes}</em>{t.switchNoteAfter}
            </span>
          </h2>
          <form action={saveTextAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={documentId} />
            {/*
              `key` je odtlačok textu zo servera, nie ozdoba.

              Editor sa vytvára **raz** a ďalšie vykreslenia doň zámerne
              nesiahajú — inak by prepísal text, ktorý medzitým niekto
              napísal. Lenže po prijatí návrhu sa text na serveri zmení
              a obrazovka zostala na starom: ukazovala predošlé znenie
              a skryté pole formulára ho nieslo tiež, takže „Uložiť text"
              by **prijatý návrh ticho vrátil späť**. Nájdené nácvikom
              2026-09-14 hneď po prijatí prečisteného členenia.

              S odtlačkom v `key` sa editor znovu postaví práve vtedy, keď
              sa zmenil text na serveri — a pri obyčajnom prekreslení nie.
            */}
            {checkLines.map(n => <span key={n} id={`line-${n}`} aria-hidden="true" />)}
            <TextEditor
              key={textKey(d.editableText)}
              name="markdown"
              initial={d.editableText}
              mode={editorMode}
            />
            {/* Kým čaká návrh na rozhodnutie, plné je „Použiť ako koncept"
                vyššie; uloženie vlastného textu je vtedy tiché (jedno plné). */}
            <div><SubmitButton className={draft || markup.length ? "button button--quiet" : "button"}>{t.saveText}</SubmitButton></div>
          </form>
        </section>
      </div>

      {!aiOn || canConvert || canRewriteScan ? (
      <section className="card" style={{ padding: 18, display: "grid", gap: 10, marginTop: 18 }}>
        <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.llmHeading}</h2>
        {!aiOn ? (
          <div className="lnote lnote--info lnote--action">
            <span className="lnote-mark" aria-hidden="true">i</span>
            <span className="lnote-text">{isOrgAdmin(ctx.person) ? t.aiOff : t.aiOffAsk}</span>
            {isOrgAdmin(ctx.person) && <Link className="button button--quiet button--sm" href="/organisation/ai">{t.aiOffLink}</Link>}
          </div>
        ) : (
          <>
            <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: 0 }}>
              {t.llmNoteBefore}<strong>{t.llmNoteHighlight}</strong>{t.llmNoteAfter}
            </p>
            <form action={sendToModelAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input type="hidden" name="documentId" value={documentId} />
              {canConvert && (
                <SubmitButton className="button button--quiet" formAction={convertWithModelAction}>
                  {t.convert}
                </SubmitButton>
              )}
              {canRewriteScan && (
                <SubmitButton className="button button--quiet">
                  {t.rewriteScan}
                </SubmitButton>
              )}
            </form>
            {/*
              Čo ktoré tlačidlo pošle modelu, musí byť vidieť **pri nich**,
              nie v návode — pre toho, kto rozhoduje o znení predpisu, je to
              rozdiel, ktorý má poznať pred kliknutím.
            */}
            {canConvert && (
              <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
                {t.convertNote}
              </p>
            )}
            {canRewriteScan && (
              <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>
                {t.rewriteScanNote}
              </p>
            )}
          </>
        )}
      </section>
      ) : null}
    </div>
    </AppShell>
  )
}
