/**
 * Detail dokumentu v knižnici (D53).
 *
 * Dve veci vedľa seba, lebo sú to dve rôzne otázky: **čo je v koncepte**
 * (text, ktorý nikto nepustil von) a **ktoré znenia platia** (história, na
 * ktorú sa viažu potvrdenia). Publikovanie je most medzi nimi a má vlastný
 * formulár — nie tlačidlo, lebo pýta údaje, ktoré nikto iný ako človek nevie.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { publishVersionAction, saveDocumentMetadataAction, assignToFolderAction, reindexDocumentAction, fixVersionAction } from "../actions"
import { allFolders, flattenTree } from "@/lib/folders"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { documentProgress } from "@/lib/libraryProgress"
import AppShell from "@/components/AppShell"
import ApprovalPanel from "@/components/ApprovalPanel"
import { isHr } from "@/lib/hr"
import { roundsByVersion, stateOf } from "@/lib/approvalsDb"
import { textFingerprint } from "@/lib/chunkIdentity"
import { listPeople } from "@/lib/people"

export const dynamic = "force-dynamic"

export default async function DocumentDetailPage({
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

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).library.detail
  const extras = tenantExtras(ctx.tenant)
  const folders = await allFolders(ctx.tenant.companyCode)
  const folderTree = flattenTree(folders)
  const draft = (d.draftMarkdown ?? "").trim()
  // Publikované znenie je pri dokumentoch z importu len vo `versions[]` —
  // porovnávať koncept s prázdnym `markdown` by tvrdilo, že je čo publikovať,
  // aj keď je text ten istý.
  const effective = d.versions.find(v => v.isActive && v.effectiveFrom)

  // Schvaľovanie (ADR-006). Kolá pre celý dokument jedným dotazom — pri
  // desiatich zneniach je rozdiel medzi jedným a desiatimi dotazmi vidieť.
  const rounds = await roundsByVersion(ctx.tenant.companyCode, documentId)
  /*
    Koho možno vybrať za schvaľovateľa. Predkladateľ zo zoznamu vypadáva už
    tu, nie až pri odoslaní: pravidlo „kto text nahral, ho neschvaľuje" (D69)
    stráži server, ale ponúkať voľbu, ktorú vzápätí odmietne, je zlé
    rozhranie. Vyradení ľudia sa neponúkajú — kolo, ktoré na nich čaká, sa
    neuzavrie nikdy.
  */
  const approverChoices = (await listPeople(ctx.tenant.companyCode))
    .filter(p => p.status !== "inactive" && p.email !== ctx.person.email)
    .map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))
  /*
   * Koľko ľudí platné znenie potvrdilo. Jeden dotaz navyše na stránku — je to
   * jeden dokument, nie riadok v zozname, kde by to bol dotaz na každý riadok.
   */
  const progress = await documentProgress(ctx.tenant.companyCode, effective?.versionId)

  /*
   * Kto smie do knižnice, nemusí smieť do výkazu personalistu (D67): kto
   * spravuje obsah, nemá tým pádom právo vidieť, ako si ktorý človek plní
   * povinnosti. Preto sa rola pýta tu a nie je odvodená z toho, že sa
   * stránka vôbec otvorila.
   */
  const canSeeWho = isHr(ctx.person)
  const ts = t.side
  const folderName = d.folderTrail?.length ? d.folderTrail.join(" / ") : ts.unfiled
  const published = ((d.markdown ?? effective?.markdown) ?? "").trim()
  // Koncept, ktorý sa líši od publikovaného znenia, je nedokončená práca —
  // a je to jediný stav, v ktorom má zmysel niečo publikovať.
  const hasChangesToPublish = Boolean(draft) && draft !== published

  /*
   * Schvaľuje sa **koncept**, nie hotové znenie. `versionId` vzniká až vnútri
   * `publish()` ako odtlačok textu (D57), takže pred publikovaním znenie ešte
   * neexistuje a nie je na čom viesť kolo. Odtlačok konceptu sa preto počíta
   * tu — tou istou funkciou, akú použije `publish()`, aby sa kolo a znenie,
   * ktoré z neho vznikne, nemohli rozísť.
   *
   * Dôsledok, ktorý treba povedať nahlas: **každá úprava textu po schválení
   * odtlačok zmení a schválenie prestane platiť.** Presne to žiada D28 —
   * potvrdzuje sa text, ktorý ľudia videli, nie dokument s tým istým názvom.
   */
  const draftVersionId = draft ? textFingerprint(draft) : null
  const draftRounds = draftVersionId ? (rounds.get(draftVersionId) ?? []) : []
  const draftState = stateOf(draftRounds)

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 1180, ...tenantStyle(branding) }}>
      <Notice message={message} error={error === "1"} back={`/library/${encodeURIComponent(documentId)}`} />

      <p style={{ margin: "0 0 12px" }}>
        <Link className="quiet" href="/library" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      {/*
        Hlavička dokumentu. Chips nesú to, čo o dokumente rozhoduje na prvý
        pohľad — stav spracovania a druh; identifikátor a priečinok idú pod
        názov, lebo sa čítajú až vtedy, keď názvy nestačia.
      */}
      <div className="detail-chips">
        <span className="tag">{dictionary(language).library.list.processing[d.processingState] ?? d.processingState}</span>
        {d.category && <span className="tag quiet">{d.category}</span>}
      </div>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="quiet" style={{ fontSize: 14, margin: "0 0 18px" }}>
        {d.documentId}
        {effective && ` · ${effective.label}`}
        {effective?.effectiveFrom && ` · ${formatDate(effective.effectiveFrom, language)}`}
      </p>

      {/*
        Dva stĺpce až od 900 px. Pravý panel je zhrnutie — na telefóne patrí
        pod obsah, nie nad neho: človek prišiel čítať dokument, nie metadáta.
      */}
      <div className="detail-grid">
        <div className="detail-main">

      <details className="card" style={{ padding: 18, margin: "0 0 18px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          {t.documentData}
          <span className="quiet" style={{ fontWeight: 400, fontSize: 13.5 }}>
            {" "}· {d.language} · {d.accessLevel}
            {d.category && ` · ${d.category}`}
            {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
          </span>
        </summary>

        <form action={saveDocumentMetadataAction} style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <input type="hidden" name="documentId" value={d.documentId} />

          <label className="field">
            <span className="field-label">{t.title}</span>
            <input className="field-input" name="title" defaultValue={d.title} required />
            <span className="quiet field-hint">{t.titleNote}</span>
          </label>

          <div className="field">
            <span className="field-label">{t.scope}</span>
            <Select name="scope" options={codelistOptions("scope")} initial={d.scope ?? "company"} fieldLabel={t.scope} />
          </div>

          <div className="field">
            <span className="field-label">{t.accessLevel}</span>
            <Select name="accessLevel" options={codelistOptions("accessLevel")} initial={d.accessLevel ?? "internal"} fieldLabel={t.accessLevel} />
          </div>

          <div className="field">
            <span className="field-label">{t.documentLanguage}</span>
            <Select name="language" options={codelistOptions("language")} initial={d.language ?? "sk"} fieldLabel={t.documentLanguage} />
          </div>

          <div className="field">
            <span className="field-label">{t.category}</span>
            <Select
              name="category"
              options={[{ value: "", label: t.unset }, ...codelistOptions("category", extras)]}
              initial={d.category ?? ""}
              fieldLabel={t.category}
            />
          </div>

          <div className="field">
            <span className="field-label">{t.tags}</span>
            <TagSelect
              name="tags"
              options={codelistOptions("tags", extras).map(v => ({ value: v.value }))}
              selected={d.tags}
              newLabel={t.newTag}
              language={language}
            />
          </div>

          <p className="quiet" style={{ fontSize: 13.5, margin: 0 }}>
            {t.keyNoteBefore}<code>{d.documentId}</code>{t.keyNoteAfter}
          </p>

          <div><button className="button" type="submit">{t.save}</button></div>
        </form>
      </details>

      <form action={assignToFolderAction} className="card tree-form" style={{ padding: 18, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <div className="field" style={{ flex: "1 1 260px", margin: 0 }}>
          <span className="field-label">{t.folder}</span>
          <Select
            name="folderId"
            initial={d.folderId ?? ""}
            fieldLabel={t.folder}
            options={[
              { value: "", label: t.folderUnfiled },
              ...folderTree.map(r => ({
                value: r.folder.id,
                label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
              })),
            ]}
          />
          <span className="quiet field-hint">{t.folderNote}</span>
        </div>
        <button className="button button--quiet" type="submit">{t.assign}</button>
      </form>

      <section className="card" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{t.text}</h2>
          <Link href={`/library/${encodeURIComponent(documentId)}/text`}>{t.openEditor}</Link>
        </div>

        {d.originalFile ? (
          <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
            {t.originalFile}{" "}
            <a href={`/api/library/file/${encodeURIComponent(d.originalFile.id)}`} target="_blank" rel="noreferrer">
              {d.originalFile.name}
            </a>{" "}
            · {t.uploadedBy(d.originalFile.uploadedBy, formatDate(d.originalFile.uploadedAt, language))}
            {d.conversion && ` · ${t.conversionMethod(d.conversion.method)}`}
          </p>
        ) : (
          <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
            {t.noOriginal}
          </p>
        )}

        {d.conversion?.warnings?.length ? (
          <ul className="quiet" style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
            {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : null}

        <p className="quiet" style={{ fontSize: 13.5, margin: 0 }}>
          {hasChangesToPublish
            ? t.draftDiffers
            : draft || published
              ? t.draftSame
              : t.draftEmpty}
        </p>
      </section>

      <section className="card" style={{ padding: 18, display: "grid", gap: 14, margin: "0 0 18px" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.publishHeading}</h2>

        {!hasChangesToPublish ? (
          <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
            {t.nothingToPublish}
          </p>
        ) : (
          <>
            {/*
              Schvaľovací panel **nad** formulárom, nie chybová hláška po
              odoslaní. Kto vypĺňa označenie a dátum platnosti, má vopred
              vidieť, že bez schválenia to neprejde — formulár, ktorý sa dá
              celý vyplniť a až potom odmietne, je stratený čas a vyzerá ako
              porucha, hoci je to pravidlo.
            */}
            <div style={{ display: "grid", gap: 8 }}>
              <h3 className="field-label" style={{ margin: 0 }}>{t.draftApprovalHeading}</h3>
              <ApprovalPanel
                documentId={d.documentId}
                documentTitle={d.title}
                versionId={draftVersionId ?? ""}
                versionLabel={t.approvalDraftLabel}
                effectiveFrom={null}
                state={draftState}
                rounds={draftRounds}
                people={approverChoices}
                language={language}
              />
            </div>

            {draftState !== "approved" ? (
              <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
                {draftState === "in-review" ? t.publishWaitsForApproval : t.publishNeedsApproval}
              </p>
            ) : (
              <>
                <p className="quiet" style={{ fontSize: 14, margin: 0 }}>{t.publishApprovedNote}</p>
              <form action={publishVersionAction} style={{ display: "grid", gap: 14 }}>
                <input type="hidden" name="documentId" value={d.documentId} />

                <label className="field">
                  <span className="field-label">{t.versionLabel}</span>
                  <input className="field-input" name="label" required
                         placeholder={t.versionLabelPlaceholder} />
                  <span className="quiet field-hint">
                    {t.labelNoteBefore}<strong>{t.labelNoteHighlight}</strong>{t.labelNoteAfter}
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">{t.effectiveFrom}</span>
                  <input className="field-input" type="date" name="effectiveFrom" required />
                  <span className="quiet field-hint">{t.effectiveFromNote}</span>
                </label>

                <label className="field">
                  <span className="field-label">{t.effectiveFromSource}</span>
                  <input className="field-input" name="effectiveFromSource"
                         placeholder={t.effectiveFromSourcePlaceholder} />
                  <span className="quiet field-hint">{t.effectiveFromSourceNote}</span>
                </label>

                <label className="field">
                  <span className="field-label">{t.changeNote}</span>
                  <input className="field-input" name="changeNote" placeholder={t.changeNotePlaceholder} />
                </label>

                <div><button className="button" type="submit">{t.publish}</button></div>
              </form>
              </>
            )}
          </>
        )}
      </section>

      <form action={reindexDocumentAction} className="card" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.reindexHeading}</h2>
        <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
          {t.reindexNoteBefore}<strong>{t.reindexNoteHighlight}</strong>{t.reindexNoteAfter}
        </p>
        <div><button className="button button--quiet" type="submit">{t.reindex}</button></div>
      </form>

      <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{t.versionsHeading(d.versions.length)}</h2>

      {d.versions.length === 0 ? (
        <p className="card" style={{ padding: 18, fontSize: 15 }}>
          {t.nothingPublished}
        </p>
      ) : (
        <ul className="audit">
          {d.versions.map(v => (
            <li key={v.versionId} className="card audit-entry">
              <div className="audit-head">
                <strong>{v.label}</strong>
                {v.isActive ? <span className="tag">{t.active}</span> : <span className="tag">{t.archived}</span>}
              </div>
              <div className="quiet audit-who">
                {v.effectiveFrom ? t.effectiveFromOn(formatDate(v.effectiveFrom, language)) : t.noEffectiveDate}
                {v.effectiveTo && ` ${t.effectiveTo(formatDate(v.effectiveTo, language))}`}
                {v.publishedBy && ` · ${v.publishedBy}`}
                {v.publishedAt && ` · ${formatDate(v.publishedAt, language)}`}
              </div>
              {v.effectiveFromSource && (
                <div className="quiet audit-note">{t.dateSource(v.effectiveFromSource)}</div>
              )}
              {v.changeNote && <div className="quiet audit-note">{v.changeNote}</div>}

              <ApprovalPanel
                documentId={d.documentId}
                documentTitle={d.title}
                versionId={v.versionId}
                versionLabel={v.label}
                effectiveFrom={v.effectiveFrom ?? null}
                state={stateOf(rounds.get(v.versionId), v.publishedBefore)}
                rounds={rounds.get(v.versionId) ?? []}
                people={approverChoices}
                language={language}
              />

              {/*
                História opráv. Zapisuje sa od zavedenia `fixVersion()`,
                ukazuje sa až odteraz — dôvod opravy je povinný práve preto,
                aby sa o rok dalo prečítať, či išlo o preklep alebo o zmenu
                povinnosti. Kým ho nemal kto ukázať, bola to polovica veci.
              */}
              {v.fixes && v.fixes.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="quiet" style={{ fontSize: 13, cursor: "pointer" }}>
                    {t.fixHistory(v.fixes.length)}
                  </summary>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                    {/* Najnovšia oprava hore — staršie sa dohľadávajú, novšia zaujíma. */}
                    {[...v.fixes].reverse().map((fix, i) => (
                      <li key={`${v.versionId}-fix-${i}`} style={{ fontSize: 13.5 }}>
                        <div>{fix.reason}</div>
                        <div className="quiet" style={{ fontSize: 12.5 }}>
                          {t.fixLine(fix.by, formatDate(fix.at, language))}
                          {" · "}
                          {t.fixWas(
                            fix.fromLabel,
                            fix.fromEffectiveFrom
                              ? formatDate(fix.fromEffectiveFrom, language)
                              : t.fixNoDate,
                          )}
                          {fix.requiresReacknowledgement && ` · ${t.fixReacknowledged}`}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details style={{ marginTop: 6 }}>
                <summary className="quiet" style={{ fontSize: 13, cursor: "pointer" }}>{t.fix}</summary>
                <form action={fixVersionAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={v.versionId} />

                  <label className="field">
                    <span className="field-label">{t.fixLabel}</span>
                    <input className="field-input" name="label" defaultValue={v.label} />
                  </label>

                  <label className="field">
                    <span className="field-label">{t.effectiveFrom}</span>
                    <input
                      className="field-input"
                      type="date"
                      name="effectiveFrom"
                      defaultValue={v.effectiveFrom ? new Date(v.effectiveFrom).toISOString().slice(0, 10) : ""}
                    />
                    <span className="quiet field-hint">
                      {t.fixEffectiveFromNoteBefore}<strong>{t.fixEffectiveFromNoteHighlight}</strong>{t.fixEffectiveFromNoteAfter}
                    </span>
                  </label>

                  <label className="field">
                    <span className="field-label">{t.effectiveFromSource}</span>
                    <input className="field-input" name="effectiveFromSource" defaultValue={v.effectiveFromSource ?? ""} />
                  </label>

                  <label className="field">
                    <span className="field-label">{t.fixReason}</span>
                    <input className="field-input" name="reason" required
                           placeholder={t.fixReasonPlaceholder} />
                    <span className="quiet field-hint">{t.fixReasonNote}</span>
                  </label>

                  <div className="field">
                    <span className="field-label">{t.onDateChange}</span>
                    <Select
                      name="onDateChange"
                      initial=""
                      fieldLabel={t.onDateChange}
                      options={[
                        { value: "", label: t.onDateChangeAsk },
                        { value: "correction", label: t.onDateChangeCorrection },
                        { value: "reacknowledge", label: t.onDateChangeReacknowledge },
                      ]}
                    />
                  </div>

                  <div><button className="button button--quiet" type="submit">{t.fixSubmit}</button></div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
        </div>

        {/*
          Pravý panel — zhrnutie, nie ovládanie. Meniť sa dá všetko o kúsok
          vyššie vo formulári „Údaje o dokumente"; tu je len to, na čo sa
          človek pri otvorenom dokumente pýta: koľkí to už potvrdili a čo to
          vlastne je.
        */}
        <aside className="detail-side">
          <section className="card detail-card">
            <h2 className="detail-card-title">{ts.progressHeading}</h2>

            {progress.percent === null ? (
              <p className="quiet detail-empty">{ts.progressNobody}</p>
            ) : (
              <>
                <div className="detail-progress-head">
                  <span className="detail-percent">{progress.percent} %</span>
                  <span className="quiet detail-progress-of">
                    {ts.progressOf(progress.acknowledged, progress.assigned)}
                  </span>
                </div>
                {/*
                  Pásik je obrázok toho istého čísla, nie druhý údaj — preto
                  `aria-hidden`: čítačka by inak prečítala percento dvakrát.
                */}
                <div className="detail-bar" aria-hidden="true">
                  <span className="detail-bar-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                {/*
                  Odkaz vidí **len personalista** a mieri na **toto znenie**.
                  Dovtedy robil obe veci zle: viedol na `/hr` (teda na celý
                  výkaz, nie na to, čo štítok sľubuje) a ukazoval sa každému,
                  kto smie do knižnice — vrátane správcu obsahu, ktorý do
                  `/hr` nesmie. Odkaz, ktorý skončí na 404, je horší než
                  žiadny: prezradí, že v systéme niečo je, a zároveň nepustí.
                */}
                {canSeeWho && effective && (
                  <p className="detail-card-link">
                    <Link href={`/hr/overview?view=document&open=${encodeURIComponent(effective.versionId)}`}>
                      {ts.progressWho}
                    </Link>
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card detail-card">
            <h2 className="detail-card-title">{ts.metaHeading}</h2>
            <dl className="detail-meta">
              {([
                [t.category, d.category],
                [t.tags, d.tags.length ? d.tags.join(", ") : ""],
                [t.accessLevel, d.accessLevel],
                [t.documentLanguage, d.language],
                [ts.folder, folderName],
                [ts.identifier, d.documentId],
              ] as [string, string | undefined][]).map(([key, value]) => (
                <div className="detail-meta-row" key={key}>
                  <dt className="quiet detail-meta-key">{key}</dt>
                  <dd className="detail-meta-value">{value || ts.none}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
    </AppShell>
  )
}
