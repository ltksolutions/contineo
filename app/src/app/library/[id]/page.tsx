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
import { libraryDetail, statusTagClass, displayStatus } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import {
  publishVersionAction, saveDocumentMetadataAction, assignToFolderAction, reindexDocumentAction,
  fixVersionAction, fixTextAction, uploadVersionAction, revokeVersionAction,
  carryOverAssignmentsAction, setResponsibleAction,
} from "../actions"
import { allFolders, flattenTree } from "@/lib/folders"
// Strom oddelení a strom priečinkov majú rovnaké pomenovanie funkcií —
// preto alias. Sú to dve rôzne štruktúry: priečinok je kam dokument
// odložím, oddelenie je kto ho udržiava.
import { allDepartments, flattenTree as flattenDepartments } from "@/lib/departments"
import { MAX_INTERNAL_NUMBER } from "@/lib/libraryWrite"
import { carryOverCandidates, audienceRef, audienceLabel } from "@/lib/assignments"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { documentProgress } from "@/lib/libraryProgress"
import AppShell from "@/components/AppShell"
import ApprovalPanel from "@/components/ApprovalPanel"
import { isHr } from "@/lib/hr"
import { validAcknowledgements } from "@/lib/acknowledgements"
import { roundsByVersion, stateOf } from "@/lib/approvalsDb"
import type { CSSProperties } from "react"
import { textFingerprint, draftIdentity } from "@/lib/chunkIdentity"
import UploadFiles from "@/components/UploadFiles"
import UploadSubmit from "@/components/UploadSubmit"
import { MAX_BYTES, MAX_FORM_BYTES, SOURCE_EXTENSIONS } from "@/lib/fileStore"
import type { VersionFile } from "@/lib/documents"
import { textDiff, type DiffKind } from "@/lib/textFix"
import { listPeople } from "@/lib/people"
import ResponsiblePicker from "@/components/ResponsiblePicker"
import LegalBasisForm from "@/components/LegalBasisForm"
import { canSetLegalBasis } from "@/lib/versionResponsibility"
import { legalBasisOptions } from "@/lib/legalBases"

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
  const tu = dictionary(language).library.upload
  const extras = tenantExtras(ctx.tenant)
  const folders = await allFolders(ctx.tenant.companyCode)
  const folderTree = flattenTree(folders)
  const tf = dictionary(language).library.fields
  const departments = await allDepartments(ctx.tenant.companyCode)
  const departmentRows = flattenDepartments(departments)
  const ownerDepartment = departments.find(o => o.id === d.ownerDepartmentId)
  const draft = (d.draftMarkdown ?? "").trim()
  // Publikované znenie je pri dokumentoch z importu len vo `versions[]` —
  // porovnávať koncept s prázdnym `markdown` by tvrdilo, že je čo publikovať,
  // aj keď je text ten istý.
  const effective = d.versions.find(v => v.isActive && v.effectiveFrom)

  const tc = dictionary(language).library.carryOver
  /*
   * Publiká, ktoré platné znenie „zdedí" po predošlých (D28). Prázdny zoznam
   * je bežný stav — vtedy sa karta nevykreslí vôbec a obrazovka o nej mlčí.
   */
  const canAssign = isHr(ctx.person)
  /*
   * Znenie sa berie z `effectiveVersionId`, **nie z `effective` vyššie**.
   * Tamto je „aktívne a s dátumom", toto je „platí dnes" (`effectiveVersion()`)
   * — a presne to isté pravidlo použije serverová akcia. Keby sa tie dve
   * rozišli, ponuka by sa počítala nad jedným znením a zápis by prebehol nad
   * druhým: zaškrtnuté publikum by sa ticho nepridelilo.
   */
  const carryOver = canAssign
    ? await carryOverCandidates(ctx.tenant.companyCode, documentId, d.effectiveVersionId)
    : []
  const carryOverVersion = d.versions.find(v => v.versionId === d.effectiveVersionId)
  /*
   * Predvyplnený dôvod. Keď všetky publiká prišli z toho istého dôvodu, ponúkne
   * sa aj on — inak len veta o novom znení. Skladať dokopy tri rôzne dôvody by
   * vyrobilo vetu, ktorú nikto nenapísal.
   */
  const sharedReason = carryOver.length > 0 &&
    carryOver.every(c => c.previousReason === carryOver[0].previousReason)
    ? carryOver[0].previousReason
    : ""
  const carryOverReason = carryOverVersion
    ? `Nové znenie „${carryOverVersion.label}"${sharedReason ? `, pôvodne: ${sharedReason}` : ""}`
    : sharedReason

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
  const people = await listPeople(ctx.tenant.companyCode)
  const approverChoices = people
    .filter(p => p.status !== "inactive" && p.email !== ctx.person.email)
    .map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))
  /*
    Zodpovedná osoba za znenie (D91). Na rozdiel od schvaľovateľov sa
    ponúka aj ten, kto znenie zverejňuje — garant predpisu môže byť zároveň
    správca obsahu. Vyradení nie: ľudí by posielalo za niekým, kto v zväze nie je.
  */
  const responsibleChoices = people
    .filter(p => p.status !== "inactive")
    .map(p => ({ id: p.id, fullName: p.fullName, email: p.email, department: p.department }))
  const activePersonIds = new Set(responsibleChoices.map(p => p.id))
  const tr = dictionary(language).responsibility
  const basisOptions = legalBasisOptions(ctx.tenant)
  const basisName = (v: { legalBasis?: string; legalBasisLabel?: string }) =>
    v.legalBasisLabel ?? (v.legalBasis ? tr.basisLabel[v.legalBasis] : "")
  /*
   * Koľko ľudí platné znenie potvrdilo. Jeden dotaz navyše na stránku — je to
   * jeden dokument, nie riadok v zozname, kde by to bol dotaz na každý riadok.
   */
  const progress = await documentProgress(ctx.tenant.companyCode, effective?.versionId)

  /*
   * Koľko platných potvrdení má **každé** znenie, nielen platné (D82).
   * Označenie a dátum sú v podpísanej formulke, takže sa po prvom potvrdení
   * zamykajú — a obrazovka to musí vedieť pri každom znení v zozname, inak by
   * ponúkala polia, ktoré zápis vzápätí odmietne.
   */
  const ackByVersion = new Map<string, number>()
  for (const a of await validAcknowledgements({
    companyCode: ctx.tenant.companyCode,
    versionId: d.versions.map(v => v.versionId),
  })) {
    ackByVersion.set(a.versionId, (ackByVersion.get(a.versionId) ?? 0) + 1)
  }

  /*
   * Kto smie do knižnice, nemusí smieť do výkazu personalistu (D67): kto
   * spravuje obsah, nemá tým pádom právo vidieť, ako si ktorý človek plní
   * povinnosti. Preto sa rola pýta tu a nie je odvodená z toho, že sa
   * stránka vôbec otvorila.
   */
  const canSeeWho = isHr(ctx.person)
  /** Odvolávať potvrdenia smie len personalista (D82, rovnako ako D24). */
  const canRevoke = isHr(ctx.person)
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
  // Identita konceptu = PDF + text (ADR-011, D96) — na nej beží kolo
  // schvaľovania. Oprava textu (ADR-007) sa ale stráži odtlačkom **len
  // textu**: porovnáva sa s tým, čo bolo v rozdiele na obrazovke.
  const draftVersionId = draft ? draftIdentity(draft, d.draftPdf?.sha256) : null
  const draftTextFingerprint = draft ? textFingerprint(draft) : null
  const draftRounds = draftVersionId ? (rounds.get(draftVersionId) ?? []) : []
  const draftState = stateOf(draftRounds)

  /*
   * Stav do hlavičky — **ten istý slovník aj tá istá trieda ako v zozname.**
   *
   * Do 23. 9. 2026 to bola tretia kópia toho istého mapovania a používala
   * facetové reťazce v množnom čísle: detail hovoril „publikované", zoznam
   * „Platný". Dva názvy pre jeden stav na dvoch obrazovkách vedľa seba.
   *
   * Expirovaný sa odvodzuje `displayStatus()` z platného znenia — tá istá
   * funkcia ako v zozname. Dovtedy tu vetva chýbala a expirovaný dokument
   * mal v hlavičke „koncept".
   */
  const tl = dictionary(language).library.list
  const headerStatus = draftState === "in-review"
    ? "in-review"
    : displayStatus(d.status, effective?.effectiveTo)
  const statusPill = (value: string) =>
    value === "published" ? tl.statusLabel.published
    : value === "in-review" ? tl.statusLabel.review
    : value === "expired" ? tl.statusLabel.expired
    : tl.statusLabel.draft

  /*
   * Rozdiel konceptu proti **textu platného znenia** — podklad pre opravu bez
   * novej verzie. Text sa berie v tom istom poradí ako v `fixText()`
   * (znenie, potom dokument); keby si ho obrazovka brala inak, ukázala by
   * rozdiel, ktorý sa neuloží.
   *
   * Počíta sa len vtedy, keď je čo porovnávať — inak je to práca navyše pri
   * každom otvorení detailu.
   *
   * Rozdiel je aj **podmienkou ponuky**: hláška „koncept sa líši“ porovnáva surové
   * reťazce, kým odtlačok (a teda aj oprava) normalizuje konce riadkov a biele
   * miesta (D57). Editor vie text preuložiť tak, že reťazce sa líšia a odtlačok
   * nie — a ponúkať v takom stave tlačidlo, ktoré zápis odmietne, je horšie než
   * neponúknuť nič.
   */
  const effectiveText = ((effective?.markdown ?? d.markdown) ?? "").trim()
  const draftDiff = effective && hasChangesToPublish ? textDiff(effectiveText, draft) : null

  /*
   * Farby rozdielu. Zelená a červená sú len zosilnenie — znamienko `+`/`−` na
   * začiatku riadku nesie tú istú informáciu aj tomu, kto tie dve farby
   * nerozlíši.
   */
  const diffStyle = (kind: DiffKind): CSSProperties =>
    kind === "added"
      ? { background: "rgba(46, 160, 67, 0.16)" }
      : kind === "removed"
        ? { background: "rgba(248, 81, 73, 0.16)" }
        : kind === "gap"
          ? { opacity: 0.55, fontStyle: "italic" }
          : {}

  return (
    <AppShell language={ctx.person.language}>
    <div className="detail-page" style={tenantStyle(branding)}>
      <Notice message={message} error={error === "1"} back={`/library/${encodeURIComponent(documentId)}`} />

      <p className="detail-back">
        <Link className="quiet" href="/library">{t.back}</Link>
      </p>

      {/*
        Hlavička dokumentu. Chips nesú to, čo o dokumente rozhoduje na prvý
        pohľad — stav spracovania a druh; identifikátor a priečinok idú pod
        názov, lebo sa čítajú až vtedy, keď názvy nestačia.
      */}
      {/*
        Stav dokumentu farebne, tou istou funkciou ako v zozname (DETAIL,
        úloha 2) — človek príde z farebného zoznamu a nemá stratiť istotu,
        že je to ten istý stav. Bežiace kolo nad konceptom je „na schválenie"
        (MASTER). Technické spracovanie sa ukazuje len keď niečo hovorí:
        hotový stav sa nekreslí, zlyhanie je červené (rovnako ako v zozname).
      */}
      <div className="detail-chips">
        <span className={statusTagClass(headerStatus)}>{statusPill(headerStatus)}</span>
        {d.processingState !== "indexed" && (
          <span className={d.processingState === "failed" ? "tag tag--expired" : "tag"}>
            {tl.processing[d.processingState] ?? d.processingState}
          </span>
        )}
        {d.category && <span className="tag quiet">{d.category}</span>}
      </div>

      <h1 className="page-title">{d.title}</h1>
      <p className="quiet detail-lead">
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

      {/*
        Úroveň 2 — čo treba teraz (DETAIL, úloha 1). Vždy najviac jedna karta
        a vždy v jednom stave, odvodenom z dokumentu a z bežiaceho kola:
        koncept bez platného znenia → zverejniť znenie; platné znenie a
        pripravený koncept → zverejniť nové znenie (v názve je, ktoré platí,
        aby bolo zrejmé, že karta hovorí o pripravovanom, nie o platnom);
        beží kolo → stav kola, bez tlačidla na predloženie (to stráži
        `ApprovalPanel`); publikované a nič sa nepripravuje → žiadna karta.
      */}
      {hasChangesToPublish && (
      <section className="card detail-block">
        <h2 className="detail-block-title">
          {draftState === "in-review"
            ? t.nowInReview
            : effective
              ? t.nowPublishNew(effective.label)
              : t.publishHeading}
        </h2>
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
              <p className="detail-block-note">
                {draftState === "in-review" ? t.publishWaitsForApproval : t.publishNeedsApproval}
              </p>
            ) : (
              <>
                <p className="detail-block-note">{t.publishApprovedNote}</p>
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
                  <input className="field-input" name="effectiveFromSource" required
                         placeholder={t.effectiveFromSourcePlaceholder} />
                  <span className="quiet field-hint">{t.effectiveFromSourceNote}</span>
                </label>

                <label className="field">
                  <span className="field-label">{t.changeNote}</span>
                  <input className="field-input" name="changeNote" placeholder={t.changeNotePlaceholder} />
                </label>

                <ResponsiblePicker people={responsibleChoices} language={language} />

                <div><button className="button" type="submit">{t.publish}</button></div>
              </form>
              </>
            )}

      </section>
      )}

      {/*
        Úroveň 3 — ostatné akcie za jedným nadpisom (DETAIL, úloha 1).
        Väčšina z nich je vzácna: preindexovanie pri poruche, nové znenie raz
        za rok, oprava textu výnimočne. `<details>`, nie záložky: záložky
        potrebujú klientsky stav alebo adresu, a zatvorený stav je tu správny
        predvolený stav — kto prišiel dokument zverejniť, nechce vidieť
        formulár na preindexovanie. Metadáta sú prvé, lebo sú z tejto skupiny
        najčastejšie.
      */}
      <details className="detail-tools">
        <summary>{t.toolsSummary}</summary>
        <div className="detail-tools-body">
      <details className="card detail-block">
        <summary>
          {t.documentData}
          <span className="quiet" style={{ fontWeight: 400, fontSize: "var(--fs-small)" }}>
            {" "}· {d.language} · {d.accessLevel}
            {d.category && ` · ${d.category}`}
            {d.internalNumber && ` · ${d.internalNumber}`}
            {ownerDepartment && ` · ${ownerDepartment.name}`}
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
            <span className="field-label">{tf.ownerDepartment}</span>
            <Select
              name="ownerDepartmentId"
              initial={d.ownerDepartmentId ?? ""}
              fieldLabel={tf.ownerDepartment}
              options={[
                { value: "", label: tf.ownerDepartmentNone },
                ...departmentRows.map(r => ({
                  value: r.department.id,
                  label: `${"— ".repeat(r.level - 1)}${r.department.name}`,
                })),
              ]}
            />
            <span className="quiet field-hint">
              {departmentRows.length === 0 ? tf.ownerDepartmentEmpty : tf.ownerDepartmentNote}
            </span>
          </div>

          <label className="field">
            <span className="field-label">{tf.internalNumber}</span>
            <input className="field-input" name="internalNumber"
                   defaultValue={d.internalNumber ?? ""}
                   maxLength={MAX_INTERNAL_NUMBER}
                   placeholder={tf.internalNumberPlaceholder}
                   autoCapitalize="none" autoCorrect="off" />
            <span className="quiet field-hint">{tf.internalNumberNote}</span>
          </label>

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

          <p className="detail-block-small">
            {t.keyNoteBefore}<code>{d.documentId}</code>{t.keyNoteAfter}
          </p>

          <div><button className="button" type="submit">{t.save}</button></div>
        </form>
      </details>
      <section className="card detail-block">
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 className="detail-block-title">{t.text}</h2>
          <Link href={`/library/${encodeURIComponent(documentId)}/text`}>{t.openEditor}</Link>
        </div>

        {d.originalFile ? (
          <p className="detail-block-note">
            {t.originalFile}{" "}
            <a href={`/api/library/file/${encodeURIComponent(d.originalFile.id)}`} target="_blank" rel="noreferrer">
              {d.originalFile.name}
            </a>{" "}
            · {t.uploadedBy(d.originalFile.uploadedBy, formatDate(d.originalFile.uploadedAt, language))}
            {d.conversion && ` · ${t.conversionMethod(d.conversion.method)}`}
          </p>
        ) : (
          <p className="detail-block-note">
            {t.noOriginal}
          </p>
        )}
        {/* PDF a zdroj konceptu (ADR-011). PDF je to, čo sa schvaľuje. */}
        {d.draftPdf ? (
          <p className="detail-block-note">
            {t.draftPdf} <FileLink file={d.draftPdf} />
            {d.draftSource && <> · {t.draftSource} <FileLink file={d.draftSource} download /></>}
          </p>
        ) : d.draftMarkdown && (
          <p className="detail-block-note">{t.noDraftPdf}</p>
        )}

        {d.conversion?.warnings?.length ? (
          <ul className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0, paddingLeft: 18 }}>
            {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : null}

        <p className="detail-block-small">
          {hasChangesToPublish
            ? t.draftDiffers
            : draft || published
              ? t.draftSame
              : t.draftEmpty}
        </p>
      </section>
      <form action={assignToFolderAction} className="card detail-block tree-form">
        <input type="hidden" name="documentId" value={d.documentId} />
        <div className="field">
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
      {canAssign && carryOver.length > 0 && (
      <form action={carryOverAssignmentsAction} className="card detail-block">
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 className="detail-block-title">{tc.heading}</h2>
        <p className="detail-block-small">
          {tc.intro(carryOverVersion?.label ?? d.effectiveLabel)}
        </p>

        <fieldset className="hr-group" style={{ border: "1px solid var(--line)", margin: "0 0 14px" }}>
          <legend className="field-label">{tc.audiences}</legend>
          {carryOver.map(c => (
            <label key={audienceRef(c.audience)} className="check-row" style={{ display: "block", padding: "6px 0" }}>
              <input type="checkbox" name="audience" value={audienceRef(c.audience)} defaultChecked />
              {" "}
              <span>{tc.previously(audienceLabel(c.audience), c.previousReason)}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span className="field-label">{tc.reason}</span>
          <input className="field-input" name="reason" required
                 defaultValue={carryOverReason} />
          <span className="quiet field-hint">{tc.reasonNote}</span>
        </label>

        <fieldset className="hr-group" style={{ border: "1px solid var(--line)", margin: "14px 0" }}>
          <legend className="field-label">{tc.due}</legend>
          <Select
            name="dueMode"
            fieldLabel={tc.due}
            initial="none"
            options={[
              { value: "none", label: tc.dueNone },
              { value: "date", label: tc.dueDate },
              { value: "days", label: tc.dueDays },
            ]}
          />
          {/* Obe polia sú v DOM stále — formulár beží bez JavaScriptu, takže
              sa skryť nedajú, a `dueFromFields()` číta len to, ktoré patrí
              k zvolenému režimu. */}
          <div className="due-fields">
            <label className="field">
              <span className="quiet field-label">{tc.dueDate}</span>
              <input className="field-input" type="date" name="dueDate" defaultValue="" />
            </label>
            <label className="field">
              <span className="quiet field-label">{tc.dueDaysUnit}</span>
              <input className="field-input" type="number" min={1} name="dueDays" defaultValue="" />
            </label>
          </div>
          <span className="quiet field-hint">{tc.dueNote}</span>
        </fieldset>

        <div><button className="button" type="submit">{tc.submit}</button></div>
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "10px 0 0" }}>{tc.noEmailNote}</p>
      </form>
      )}
      <form action={uploadVersionAction}
            className="card detail-block">
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 className="detail-block-title">{t.newVersionHeading}</h2>
        <p className="detail-block-note">{t.newVersionNote}</p>
        <UploadFiles
          pdfAccept=".pdf,application/pdf"
          sourceAccept={SOURCE_EXTENSIONS.join(",")}
          maxBytes={MAX_BYTES}
          labels={{
            pdfTitle: tu.pdfTitle,
            pdfNote: tu.pdfNote,
            sourceTitle: tu.sourceTitle,
            sourceNote: `${tu.sourceNote} ${SOURCE_EXTENSIONS.map(e => e.slice(1).toUpperCase()).join(" · ")}`,
            maxSize: tu.maxSize(MAX_BYTES / 1024 / 1024),
            noScriptLimit: tu.noScriptLimit(MAX_FORM_BYTES / 1024 / 1024),
            uploading: tu.uploadingFile,
            failed: tu.uploadFailed,
            tooLarge: tu.fileTooLarge,
            progressTitle: tu.submitPending,
            converting: tu.submitPendingNote,
          }}
        />
        <div>
          <UploadSubmit labels={{ submit: t.newVersionSubmit, pending: tu.submitPending }} />
        </div>
      </form>
            {effective && draftDiff && draftDiff.added + draftDiff.removed > 0 && (
              <details className="card detail-block">
                <summary>{t.textFixHeading}</summary>

                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  <p className="detail-block-note">{t.textFixIntro}</p>

                  <div>
                    <h4 className="field-label" style={{ margin: "0 0 6px" }}>
                      {`${t.textFixDiffHeading} · ${t.textFixDiffStat(draftDiff.added, draftDiff.removed)}`}
                    </h4>
                    {draftDiff.coarse && (
                      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 6px" }}>{t.textFixCoarse}</p>
                    )}
                    {/*
                      Riadky sa zalamujú, nerolujú do strany: na telefóne je
                      vodorovné rolovanie v texte predpisu neprečítateľné.
                    */}
                    <div
                      className="card"
                      style={{
                        padding: 10,
                        maxHeight: 320,
                        overflowY: "auto",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "var(--fs-micro)",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {draftDiff.lines.map((line, i) => (
                        <div key={i} style={diffStyle(line.kind)}>
                          {line.kind === "gap"
                            ? t.textFixGap(Number(line.text))
                            : `${line.kind === "added" ? "+" : line.kind === "removed" ? "−" : "\u00a0"} ${line.text}`}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="detail-block-small">{t.textFixApprovalNote}</p>

                  <form action={fixTextAction} style={{ display: "grid", gap: 12 }}>
                    <input type="hidden" name="documentId" value={d.documentId} />
                    {/*
                      Odtlačok toho, čo je práve na obrazovke. Server overí, že sa
                      koncept medzitým nezmenil — uložiť sa má ten text, ktorého
                      rozdiel si človek pozrel.
                    */}
                    <input type="hidden" name="expectedFingerprint" value={draftTextFingerprint ?? ""} />

                    <label className="field">
                      <span className="field-label">{t.textFixReason}</span>
                      <input className="field-input" name="reason" required
                             placeholder={t.textFixReasonPlaceholder} />
                      <span className="quiet field-hint">{t.textFixReasonNote}</span>
                    </label>

                    <div><button className="button button--quiet" type="submit">{t.textFixSubmit}</button></div>
                  </form>
                </div>
              </details>
            )}
      <form action={reindexDocumentAction} className="card detail-block">
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 className="detail-block-title">{t.reindexHeading}</h2>
        <p className="detail-block-note">
          {t.reindexNoteBefore}<strong>{t.reindexNoteHighlight}</strong>{t.reindexNoteAfter}
        </p>
        <div><button className="button button--quiet" type="submit">{t.reindex}</button></div>
      </form>
        </div>
      </details>

      <h2 className="detail-section-title">{t.versionsHeading(d.versions.length)}</h2>

      {d.versions.length === 0 ? (
        <p className="card" style={{ padding: 18, fontSize: "var(--fs-lead)" }}>
          {t.nothingPublished}
        </p>
      ) : (
        <ul className="audit">
          {d.versions.map(v => (
            <li key={v.versionId} className="card audit-entry">
              <div className="audit-head">
                <strong>{v.label}</strong>
                {v.isActive
                  ? <span className="tag tag--published">{t.active}</span>
                  : <span className="tag tag--archived">{t.archived}</span>}
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
              {/* PDF znenia je dôkaz; zdroj je predloha pre ďalšie znenie (ADR-011). */}
              <div className="audit-note" style={{ fontSize: "var(--fs-small)" }}>
                {v.pdf
                  ? <>{t.versionPdf} <FileLink file={v.pdf} /></>
                  : <span className="quiet">{t.noPdf}</span>}
                {v.source && <><br />{t.versionSource} <FileLink file={v.source} download /></>}
              </div>

              {/*
                Zodpovedná osoba a právny základ (D91). Chýbajúci údaj sa
                hovorí nahlas, nie mlčí — pri zneniach spred D91 je to bežný
                stav a `npm run check` ho vypisuje.
              */}
              <div className="audit-note" style={{ fontSize: "var(--fs-small)" }}>
                <span className="quiet">{tr.responsiblePerson}: </span>
                {v.responsiblePerson
                  ? <>
                      {v.responsiblePerson.fullName}
                      {!activePersonIds.has(v.responsiblePerson.personId) && (
                        <> <span className="tag tag--draft">{tr.inactiveResponsible}</span></>
                      )}
                    </>
                  : <span className="tag tag--draft">{tr.noResponsible}</span>}
              </div>
              <div className="audit-note" style={{ fontSize: "var(--fs-small)" }}>
                <span className="quiet">{tr.legalBasis}: </span>
                {v.legalBasis
                  ? <>
                      {`${basisName(v)}${v.legalBasisReference ? ` · ${v.legalBasisReference}` : ""}`}
                      {!v.legalBasisKey && <> <span className="tag tag--draft">{tr.outsideCodelist}</span></>}
                    </>
                  : <span className="tag tag--draft">{tr.basisUnset}</span>}
              </div>

              {v.responsibleChanges && v.responsibleChanges.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                    {tr.responsibleHistory(v.responsibleChanges.length)}
                  </summary>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                    {[...v.responsibleChanges].reverse().map((c, i) => (
                      <li key={`${v.versionId}-resp-${i}`} style={{ fontSize: "var(--fs-small)" }}>
                        <div>{c.reason}</div>
                        <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                          {tr.responsibleChangeLine(c.by, formatDate(c.at, language), c.from?.fullName ?? "—", c.to.fullName)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {v.legalBasisChanges && v.legalBasisChanges.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                    {tr.basisHistory(v.legalBasisChanges.length)}
                  </summary>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                    {[...v.legalBasisChanges].reverse().map((c, i) => (
                      <li key={`${v.versionId}-basis-${i}`} style={{ fontSize: "var(--fs-small)" }}>
                        {c.reason && <div>{c.reason}</div>}
                        <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                          {tr.basisChangeLine(
                            c.by,
                            formatDate(c.at, language),
                            c.from ? tr.basisLabel[c.from] : tr.basisUnset,
                            `${c.toLabel ?? tr.basisLabel[c.to]}${c.toReference ? ` (${c.toReference})` : ""}`,
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details style={{ marginTop: 6 }}>
                <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                  {v.responsiblePerson ? tr.changeResponsible : tr.setResponsible}
                </summary>
                <form action={setResponsibleAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={v.versionId} />
                  <input type="hidden" name="versionLabel" value={v.label} />
                  <ResponsiblePicker
                    people={responsibleChoices}
                    language={language}
                    exclude={v.responsiblePerson?.personId}
                  />
                  <label className="field">
                    <span className="field-label">{tr.changeReason}</span>
                    <input className="field-input" name="reason" required
                           placeholder={tr.changeReasonPlaceholder} />
                  </label>
                  <div><button className="button button--quiet" type="submit">{tr.saveResponsible}</button></div>
                </form>
              </details>

              {/*
                Právny základ smie v knižnici určiť správca obsahu len ako
                náhradník — keď znenie zodpovednú osobu nemá alebo už nie je
                aktívna — alebo keď je sám zodpovednou osobou. To isté pravidlo
                stráži server; tu sa len neponúka formulár, ktorý by odmietol.
              */}
              {canSetLegalBasis({
                actorPersonId: ctx.person.id,
                isContentManager: true,
                responsible: v.responsiblePerson,
                responsibleActive: Boolean(v.responsiblePerson && activePersonIds.has(v.responsiblePerson.personId)),
              }) && (
                <details style={{ marginTop: 6 }}>
                  <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                    {tr.legalBasis}
                  </summary>
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    <p className="detail-block-small">{tr.basisWho}</p>
                    <LegalBasisForm
                      documentId={d.documentId}
                      versionId={v.versionId}
                      current={v.legalBasis}
                      currentKey={v.legalBasisKey}
                      options={basisOptions}
                      language={language}
                      back="library"
                    />
                  </div>
                </details>
              )}

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
                  <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                    {t.fixHistory(v.fixes.length)}
                  </summary>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                    {/* Najnovšia oprava hore — staršie sa dohľadávajú, novšia zaujíma. */}
                    {[...v.fixes].reverse().map((fix, i) => (
                      <li key={`${v.versionId}-fix-${i}`} style={{ fontSize: "var(--fs-small)" }}>
                        <div>{fix.reason}</div>
                        <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
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

              {/*
                História opráv **textu** — iná vec než `fixes` vyššie. Tie menili
                údaje o znení, tieto samotný text. Celé predchádzajúce znenie je
                v databáze (`textFixes[].fromMarkdown`); tu je vidieť, že sa to
                stalo, kto to bol a prečo.
              */}
              {v.textFixes && v.textFixes.length > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>
                    {t.textFixHistory(v.textFixes.length)}
                  </summary>
                  <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                    {[...v.textFixes].reverse().map((fix, i) => (
                      <li key={`${v.versionId}-text-${i}`} style={{ fontSize: "var(--fs-small)" }}>
                        <div>{fix.reason}</div>
                        <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                          {t.textFixLine(fix.by, formatDate(fix.at, language))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details style={{ marginTop: 6 }}>
                <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>{t.fix}</summary>
                <form action={fixVersionAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={v.versionId} />

                  {/*
                    Zamknuté polia sa **neponúkajú**, nie sú len odmietnuté pri
                    uložení (D82). Formulár, ktorý dá človeku vyplniť pole
                    a potom mu povie, že sa nedá, je horší než formulár, ktorý
                    ho nemá — a rovno povie prečo.
                  */}
                  {(ackByVersion.get(v.versionId) ?? 0) > 0 ? (
                    <p className="detail-block-small">
                      {t.versionLockedBefore}
                      <strong>{t.versionLockedHighlight(ackByVersion.get(v.versionId) ?? 0)}</strong>
                      {t.versionLockedAfter}
                    </p>
                  ) : (
                    <>
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
                    </>
                  )}

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

                  <div><button className="button button--quiet" type="submit">{t.fixSubmit}</button></div>
                </form>

                {/*
                  Odomknutie: hromadné odvolanie potvrdení. Vidí ho len
                  personalista — správcovi obsahu by tlačidlo, ktoré nemá
                  povolené stlačiť, len sľuboval cestu, ktorú nemá.
                */}
                {canRevoke && (ackByVersion.get(v.versionId) ?? 0) > 0 && (
                  <form action={revokeVersionAction} style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    <input type="hidden" name="documentId" value={d.documentId} />
                    <input type="hidden" name="versionId" value={v.versionId} />
                    <h3 style={{ fontSize: "var(--fs-body)", margin: 0 }}>{t.revokeVersionHeading}</h3>
                    <p className="detail-block-small">
                      {t.revokeVersionNote(ackByVersion.get(v.versionId) ?? 0)}
                    </p>
                    <label className="field">
                      <span className="field-label">{t.revokeVersionReason}</span>
                      <input className="field-input" name="reason" required
                             placeholder={t.revokeVersionReasonPlaceholder} />
                    </label>
                    <div>
                      <button className="button button--quiet" type="submit">{t.revokeVersionSubmit}</button>
                    </div>
                  </form>
                )}
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
                [tr.responsiblePerson, effective?.responsiblePerson?.fullName],
                [tr.legalBasis, effective ? basisName(effective) : ""],
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


/** Odkaz na súbor v úložisku — PDF sa otvára, zdroj sa sťahuje. */
function FileLink({ file, download = false }: { file: VersionFile; download?: boolean }) {
  const href = `/api/library/file/${encodeURIComponent(file.id)}${download ? "?download=1" : ""}`
  return (
    <a href={href} target={download ? undefined : "_blank"} rel="noreferrer" download={download ? file.name : undefined}>
      {file.name}
    </a>
  )
}
