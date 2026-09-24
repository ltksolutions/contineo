/**
 * Detail dokumentu v knižnici (D53).
 *
 * Dve veci vedľa seba, lebo sú to dve rôzne otázky: **čo sa pripravuje**
 * (karta postupu znenia v štyroch krokoch, ADR-014) a **ktoré znenia platia**
 * (platné znenie ako súhrn, staršie po riadku — na ne sa viažu potvrdenia).
 * Rám z Claude Design: `docs/design/KNIZNICA-postup-znenia.md`.
 */

import { notFound, redirect } from "next/navigation"
import { treeOptions } from "@/lib/treeOptions"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail, statusTagClass, displayStatus, versionMetaSuggestions, tagOptions } from "@/lib/libraryRead"
import VersionMetaFields from "@/components/VersionMetaFields"
import VersionMetaLine from "@/components/VersionMetaLine"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import Notice from "@/components/Notice"
import {
  publishVersionAction, prepareDraftAction, saveDocumentMetadataAction, reindexDocumentAction,
  fixVersionAction, fixTextAction, revokeVersionAction, cancelApprovalAction,
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
import { textFingerprint } from "@/lib/chunkIdentity"
import { documentDraftIdentity, metaLocked } from "@/lib/versionMeta"
import { versionFlow, lastPreparationRound, previousApproverIds, rejectedBy } from "@/lib/versionFlow"
import FlowSteps from "@/components/FlowSteps"
import ApprovalRounds from "@/components/ApprovalRounds"
import PublishSubmit from "@/components/PublishSubmit"
import MetaFacts from "@/components/MetaFacts"
import { initials } from "@/lib/initials"
import { assignHref } from "@/lib/libraryBulk"
import type { VersionFile } from "@/lib/documents"
import { textDiff, type DiffKind } from "@/lib/textFix"
import { listPeople } from "@/lib/people"
import ResponsiblePicker from "@/components/ResponsiblePicker"
import LegalBasisForm from "@/components/LegalBasisForm"
import { canSetLegalBasis } from "@/lib/versionResponsibility"
import { legalBasisOptions } from "@/lib/legalBases"

export const dynamic = "force-dynamic"

/** Ktorý panel pri znení je otvorený (`?open=…`). Bez JavaScriptu — server ho vykreslí otvorený. */
type Panel = "responsible" | "basis" | "fix" | "history"
const PANELS: Panel[] = ["responsible", "basis", "fix", "history"]

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
  const query = normalizeQuery<{ msg?: string; error?: string; open?: string; version?: string; edit?: string }>(await searchParams)
  const { msg: message, error } = query
  const openPanel = PANELS.includes(query.open as Panel) ? (query.open as Panel) : null
  const editDocument = query.edit === "document"
  const documentId = decodeURIComponent(id)
  const d = await libraryDetail(ctx.tenant.companyCode, documentId)
  if (!d) notFound()

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).library.detail
  const tf = dictionary(language).library.fields
  const tflow = dictionary(language).library.flow
  const extras = tenantExtras(ctx.tenant)
  const folders = await allFolders(ctx.tenant.companyCode)
  const folderTree = flattenTree(folders)
  const departments = await allDepartments(ctx.tenant.companyCode)
  const departmentRows = flattenDepartments(departments)
  const draft = (d.draftMarkdown ?? "").trim()
  const date = (v: Date | string | null | undefined) => (v ? formatDate(new Date(v), language) : "")
  const base = `/library/${encodeURIComponent(documentId)}`
  // Publikované znenie je pri dokumentoch z importu len vo `versions[]` —
  // porovnávať koncept s prázdnym `markdown` by tvrdilo, že je čo publikovať,
  // aj keď je text ten istý.
  const effective = d.versions.find(v => v.isActive && v.effectiveFrom)
  const olderVersions = d.versions.filter(v => v !== effective)

  const tc = dictionary(language).library.carryOver
  /*
   * Publiká, ktoré platné znenie „zdedí" po predošlých (D28). Prázdny zoznam
   * je bežný stav — vtedy sa krok 4 nevykreslí vôbec a obrazovka o ňom mlčí.
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
  const sharedReasonOf = (list: typeof carryOver) =>
    list.length > 0 && list.every(c => c.previousReason === list[0].previousReason) ? list[0].previousReason : ""
  const reasonFor = (label: string, list: typeof carryOver) => {
    const shared = sharedReasonOf(list)
    return label ? `Nové znenie „${label}"${shared ? `, pôvodne: ${shared}` : ""}` : shared
  }

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
  const departmentOf = new Map(people.map(p => [p.email.toLowerCase(), p.department ?? ""]))
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

  /*
   * Schvaľuje sa **koncept**, nie hotové znenie. `versionId` vzniká až vnútri
   * `publish()` ako odtlačok (D57), takže pred publikovaním znenie ešte
   * neexistuje a nie je na čom viesť kolo. Odtlačok konceptu sa preto počíta
   * tu — tou istou funkciou, akú použije `publish()`, aby sa kolo a znenie,
   * ktoré z neho vznikne, nemohli rozísť.
   *
   * Dôsledok, ktorý treba povedať nahlas: **každá úprava textu po schválení
   * odtlačok zmení a schválenie prestane platiť.** Presne to žiada D28 —
   * potvrdzuje sa text, ktorý ľudia videli, nie dokument s tým istým názvom.
   */
  // Identita konceptu = PDF + text + údaje o znení (ADR-011 D96, ADR-013 D107)
  // — na nej beží kolo schvaľovania. Oprava textu (ADR-007) sa ale stráži
  // odtlačkom **len textu**: porovnáva sa s tým, čo bolo v rozdiele na obrazovke.
  const draftVersionId = draft ? documentDraftIdentity({ draftMarkdown: draft, draftPdf: d.draftPdf, draftMeta: d.draftMeta, draftTitle: d.draftTitle }) : null
  const draftTextFingerprint = draft ? textFingerprint(draft) : null
  const draftRounds = draftVersionId ? (rounds.get(draftVersionId) ?? []) : []
  const draftState = stateOf(draftRounds)
  /*
   * Pripravuje sa nové znenie? Koncept s iným textom — alebo s tým istým
   * textom, ale iným PDF (ADR-011): schvaľuje a potvrdzuje sa PDF, takže
   * nové PDF je nové znenie, aj keď sa z neho vytiahol rovnaký text.
   */
  const hasChangesToPublish = Boolean(draft) && (
    draft !== published ||
    Boolean(d.draftPdf && effective && effective.pdf?.id !== d.draftPdf.id &&
      !d.versions.some(v => v.versionId === draftVersionId))
  )
  // Údaje o znení (ADR-013): uložené, návrh z prvej strany a zámok po predložení.
  const tm = dictionary(language).versionMeta
  const metaIsLocked = metaLocked(draftState, Boolean(d.draftMeta))
  // Schválené ešte bez údajov (pred ADR-013): doplniť sa smú, ale zrušia schválenie.
  const metaVoidsApproval = draftState === "approved" && !d.draftMeta
  const metaOptions = await versionMetaSuggestions(ctx.tenant.companyCode)

  /*
   * Postup znenia v štyroch krokoch (ADR-014). Krok sa odvodzuje — z konceptu,
   * z kôl a z pridelení (D27). Posledné kolo prípravy môže byť aj na staršej
   * identite konceptu: po zamietnutí sa zvyčajne vymení PDF a dôvod
   * zamietnutia má zostať vidieť.
   */
  const lastPublishedAt = d.versions.reduce<Date | null>((acc, v) => {
    const at = v.publishedAt ? new Date(v.publishedAt) : null
    return at && (!acc || at > acc) ? at : acc
  }, null)
  const lastRound = lastPreparationRound(rounds.values(), lastPublishedAt)
  const flow = versionFlow({
    preparing: hasChangesToPublish,
    draftState,
    lastRound,
    carryOverCount: carryOver.length,
  })
  const running = draftRounds.find(r => r.outcome === null) ?? null
  const approvedRound = [...draftRounds].reverse().find(r => r.outcome === "approved") ?? null
  // Meno namiesto adresy tam, kde kolo nesie len adresu predkladateľa.
  const nameOf = (email: string) => people.find(p => p.email.toLowerCase() === email.toLowerCase())?.fullName ?? email
  const prefilledApprovers = new Set(previousApproverIds(rounds.values(), approverChoices))
  // Kolá sa číslujú na identite konceptu — po výmene PDF začína znova od 1.
  const nextRound = draftRounds.length + 1
  // Publiká na prenos pri zverejnení (krok 3) — všetko, čo mali doterajšie znenia.
  const draftCarryOver = canAssign && flow?.step === 3 && draftVersionId && effective
    ? await carryOverCandidates(ctx.tenant.companyCode, documentId, draftVersionId)
    : []
  const draftEffectiveFrom = d.draftMeta?.effectiveFrom ?? null
  const labelSuggestion = draftEffectiveFrom ? tflow.labelSuggestion(date(draftEffectiveFrom)) : ""
  const sourceSuggestion = d.draftMeta?.approvedBy
    ? `${d.draftMeta.approvedBy}${d.draftMeta.approvedOn ? `, ${date(d.draftMeta.approvedOn)}` : ""}`
    : ""

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

  /*
   * Odkazy a panely pri znení (bod 3 rámu). Formuláre sa otvárajú až po
   * kliknutí — dovtedy to bolo sedem `<details>` pod sebou. Otvorený panel
   * je v adrese (`?open=`), takže funguje bez JavaScriptu a prežije
   * presmerovanie po uložení.
   */
  type V = (typeof d.versions)[number]
  const panelHref = (v: V, panel: Panel) => {
    const p = new URLSearchParams()
    if (v !== effective) p.set("version", v.versionId)
    if (!(openPanel === panel && (v === effective ? !query.version : query.version === v.versionId))) p.set("open", panel)
    const qs = p.toString()
    return `${base}${qs ? `?${qs}` : ""}#${v === effective ? "current" : `v-${v.versionId}`}`
  }
  const panelOf = (v: V): Panel | null =>
    openPanel && (v === effective ? !query.version : query.version === v.versionId) ? openPanel : null
  const canSetBasis = (v: V) => canSetLegalBasis({
    actorPersonId: ctx.person.id,
    isContentManager: true,
    responsible: v.responsiblePerson,
    responsibleActive: Boolean(v.responsiblePerson && activePersonIds.has(v.responsiblePerson.personId)),
  })

  const versionLinks = (v: V) => (
    <div className="cur-links">
      {v.pdf && <FileLink file={v.pdf} label="PDF" />}
      {([
        ["responsible", tflow.changeResponsible, true],
        ["basis", tflow.changeBasis, canSetBasis(v)],
        ["fix", tflow.fixData, true],
        ["history", tflow.history, true],
      ] as [Panel, string, boolean][]).filter(([, , show]) => show).map(([panel, label]) => (
        <Link key={panel} href={panelHref(v, panel)} aria-current={panelOf(v) === panel ? "true" : undefined}>
          {label}
        </Link>
      ))}
    </div>
  )

  const versionPanel = (v: V) => {
    const panel = panelOf(v)
    if (!panel) return null
    const acks = ackByVersion.get(v.versionId) ?? 0
    return (
      <div className="cur-panel">
        {panel === "responsible" && (
          <form action={setResponsibleAction} style={{ display: "grid", gap: 10 }}>
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
        )}

        {/*
          Právny základ smie v knižnici určiť správca obsahu len ako
          náhradník — keď znenie zodpovednú osobu nemá alebo už nie je
          aktívna — alebo keď je sám zodpovednou osobou. To isté pravidlo
          stráži server; tu sa len neponúka formulár, ktorý by odmietol.
        */}
        {panel === "basis" && canSetBasis(v) && (
          <>
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
          </>
        )}

        {panel === "fix" && (
          <>
            <form action={fixVersionAction} style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="documentId" value={d.documentId} />
              <input type="hidden" name="versionId" value={v.versionId} />

              {/*
                Zamknuté polia sa **neponúkajú**, nie sú len odmietnuté pri
                uložení (D82). Formulár, ktorý dá človeku vyplniť pole
                a potom mu povie, že sa nedá, je horší než formulár, ktorý
                ho nemá — a rovno povie prečo.
              */}
              {acks > 0 ? (
                <p className="detail-block-small">
                  {t.versionLockedBefore}
                  <strong>{t.versionLockedHighlight(acks)}</strong>
                  {t.versionLockedAfter}
                </p>
              ) : (
                <>
                  <label className="field">
                    <span className="field-label">{t.fixLabel}</span>
                    <input className="field-input" name="label" defaultValue={v.label} />
                  </label>

                  {/* Dátum schválený s údajmi o znení sa opraviť nedá (ADR-013). */}
                  {!v.metaApproved && (
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
                  )}
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
              povolené stlačiť, len sľubovalo cestu, ktorú nemá.
            */}
            {canRevoke && acks > 0 && (
              <form action={revokeVersionAction} style={{ display: "grid", gap: 10, marginTop: 4 }}>
                <input type="hidden" name="documentId" value={d.documentId} />
                <input type="hidden" name="versionId" value={v.versionId} />
                <h3 style={{ fontSize: "var(--fs-body)", margin: 0 }}>{t.revokeVersionHeading}</h3>
                <p className="detail-block-small">{t.revokeVersionNote(acks)}</p>
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
          </>
        )}

        {panel === "history" && (
          <>
            <div className="quiet audit-who" style={{ fontSize: "var(--fs-small)" }}>
              {v.effectiveFrom ? t.effectiveFromOn(date(v.effectiveFrom)) : t.noEffectiveDate}
              {v.effectiveTo && ` ${t.effectiveTo(date(v.effectiveTo))}`}
              {v.publishedBy && ` · ${v.publishedBy}`}
              {v.publishedAt && ` · ${date(v.publishedAt)}`}
            </div>
            {v.effectiveFromSource && <div className="quiet audit-note">{t.dateSource(v.effectiveFromSource)}</div>}
            {v.changeNote && <div className="quiet audit-note">{v.changeNote}</div>}
            {v.source && <div className="audit-note" style={{ fontSize: "var(--fs-small)" }}>{t.versionSource} <FileLink file={v.source} download /></div>}

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

            {v.responsibleChanges && v.responsibleChanges.length > 0 && (
              <HistoryList title={tr.responsibleHistory(v.responsibleChanges.length)}>
                {[...v.responsibleChanges].reverse().map((c, i) => (
                  <li key={`${v.versionId}-resp-${i}`}>
                    <div>{c.reason}</div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                      {tr.responsibleChangeLine(c.by, date(c.at), c.from?.fullName ?? "—", c.to.fullName)}
                    </div>
                  </li>
                ))}
              </HistoryList>
            )}

            {v.legalBasisChanges && v.legalBasisChanges.length > 0 && (
              <HistoryList title={tr.basisHistory(v.legalBasisChanges.length)}>
                {[...v.legalBasisChanges].reverse().map((c, i) => (
                  <li key={`${v.versionId}-basis-${i}`}>
                    {c.reason && <div>{c.reason}</div>}
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                      {tr.basisChangeLine(
                        c.by,
                        date(c.at),
                        c.from ? tr.basisLabel[c.from] : tr.basisUnset,
                        `${c.toLabel ?? tr.basisLabel[c.to]}${c.toReference ? ` (${c.toReference})` : ""}`,
                      )}
                    </div>
                  </li>
                ))}
              </HistoryList>
            )}

            {/*
              História opráv. Dôvod opravy je povinný práve preto, aby sa o rok
              dalo prečítať, či išlo o preklep alebo o zmenu povinnosti.
            */}
            {v.fixes && v.fixes.length > 0 && (
              <HistoryList title={t.fixHistory(v.fixes.length)}>
                {[...v.fixes].reverse().map((fix, i) => (
                  <li key={`${v.versionId}-fix-${i}`}>
                    <div>{fix.reason}</div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                      {t.fixLine(fix.by, date(fix.at))}
                      {" · "}
                      {t.fixWas(fix.fromLabel, fix.fromEffectiveFrom ? date(fix.fromEffectiveFrom) : t.fixNoDate)}
                      {fix.requiresReacknowledgement && ` · ${t.fixReacknowledged}`}
                    </div>
                  </li>
                ))}
              </HistoryList>
            )}

            {/*
              História opráv **textu** — iná vec než `fixes` vyššie. Celé
              predchádzajúce znenie je v databáze (`textFixes[].fromMarkdown`).
            */}
            {v.textFixes && v.textFixes.length > 0 && (
              <HistoryList title={t.textFixHistory(v.textFixes.length)}>
                {[...v.textFixes].reverse().map((fix, i) => (
                  <li key={`${v.versionId}-text-${i}`}>
                    <div>{fix.reason}</div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                      {t.textFixLine(fix.by, date(fix.at))}
                    </div>
                  </li>
                ))}
              </HistoryList>
            )}
          </>
        )}
      </div>
    )
  }

  /* ── Karta postupu znenia (body 2, 5–9 rámu) ─────────────────────────── */
  const flowHeading = !flow ? "" : flow.step === 4
    ? tflow.publishedHeading(date(effective?.effectiveFrom))
    : !effective ? tflow.firstVersion
    : draftEffectiveFrom ? tflow.heading(date(draftEffectiveFrom)) : tflow.headingUndated
  const flowStatus = !flow ? "" : flow.step === 1
    ? (flow.rejected ? tflow.statusRejected(date(flow.rejected.closedAt ?? flow.rejected.submittedAt)) : tflow.statusPreparing)
    : flow.step === 2 && running ? tflow.statusInReview(nameOf(running.submittedBy), date(running.submittedAt))
    : flow.step === 3
      ? `${tflow.statusApproved}${approvedRound?.closedAt ? ` · ${date(approvedRound.closedAt)}` : ""}`
    : tflow.statusPublished(date(effective?.publishedAt))
  const decided = running ? running.approvers.filter(a => a.decision === "approved").length : 0
  const flowSubs = !flow ? [] : [
    flow.step === 1 ? tflow.subPrepare : tflow.subPrepareDone,
    flow.step === 1
      ? (flow.rejected ? (rejectedBy(flow.rejected) ? tflow.subRejected(flow.rejected.round) : tflow.subCancelled(flow.rejected.round)) : tflow.subWaitSubmit)
      : flow.step === 2 ? tflow.subInReview(decided, running?.approvers.length ?? 0)
      : tflow.subApproved,
    flow.step === 2 ? tflow.subWaitApproval : flow.step === 4 ? tflow.subPublished : "",
    flow.step === 4 ? tflow.subAssign : "",
  ]
  const nextRows = (
    <div className="flow-next">
      <span className="flow-section-title">{tflow.next}</span>
      {flow && flow.step < 3 && (
        <div className="flow-next-row"><b>3 {tflow.steps[2]}</b><span className="quiet">{tflow.next3}</span></div>
      )}
      <div className="flow-next-row">
        <b>4 {tflow.steps[3]}</b>
        <span className="quiet">{effective ? tflow.next4 : tflow.next4None}</span>
      </div>
    </div>
  )

  const newVersionHref = `${base}/version`
  const newVersionBlocked = hasChangesToPublish

  return (
    <AppShell language={ctx.person.language}>
    <div className="detail-page" style={tenantStyle(branding)}>
      <Notice message={message} error={error === "1"} back={base} />

      {/*
        Úprava dokumentu ako samostatný pohľad (rám KNIZNICA-uprava-dokumentu):
        pri `?edit=document` sa hlavný stĺpec nahradí formulárom — karta
        nového znenia, platné znenie ani Správa sa nekreslia. Úseky ako pri
        nahratí; priečinok je v tom istom formulári (Q2).
      */}
      {editDocument ? (
        <>
          <p className="detail-back">
            <Link className="quiet" href={base}>{tflow.versionPageBack}</Link>
          </p>
          <p className="quiet detail-lead" style={{ margin: 0 }}>{d.title}</p>
          <h1 className="page-title">{tflow.editDocument}</h1>
          <div className="detail-grid">
            <form action={saveDocumentMetadataAction} className="detail-main edit-form" id="document-data">
              <input type="hidden" name="documentId" value={d.documentId} />

              <section className="card upload-section">
                <h2 className="upload-step"><span className="upload-step-no">1</span>{tflow.secBasic}</h2>
                <div className="upload-grid">
                  {/* Názov sa pri zverejnenom znení mení len novým znením (Q3,
                      ADR-015). Hodnota ide skryto, aby ju server dostal nezmenenú. */}
                  <label className="field upload-wide">
                    <span className="field-label">{t.title}</span>
                    {d.versions.length > 0 ? (
                      <>
                        <input type="hidden" name="title" value={d.title} />
                        <input className="field-input" value={d.title} disabled readOnly />
                        <span className="quiet field-hint">
                          {tflow.titleLockedBefore}<Link href={`${base}/version`}>{tflow.titleLockedLink}</Link>{tflow.titleLockedAfter}
                        </span>
                      </>
                    ) : (
                      <>
                        <input className="field-input" name="title" defaultValue={d.title} required />
                        <span className="quiet field-hint">{t.titleNote}</span>
                      </>
                    )}
                  </label>

                  <div className="field">
                    <span className="field-label">{t.category}</span>
                    <Select language={language}
                      name="category"
                      options={[{ value: "", label: t.unset }, ...codelistOptions("category", extras)]}
                      initial={d.category ?? ""}
                      fieldLabel={t.category}
                      searchable
                    />
                  </div>

                  <div className="field">
                    <span className="field-label">{t.accessLevel}</span>
                    <Select language={language} name="accessLevel" options={codelistOptions("accessLevel")} initial={d.accessLevel ?? "internal"} fieldLabel={t.accessLevel} />
                  </div>

                  <div className="field">
                    <span className="field-label">{t.documentLanguage}</span>
                    <Select language={language} name="language" options={codelistOptions("language")} initial={d.language ?? "sk"} fieldLabel={t.documentLanguage} />
                  </div>
                </div>
              </section>

              <section className="card upload-section">
                <h2 className="upload-step">
                  <span className="upload-step-no">2</span>{tflow.secPlacement}
                  <span className="upload-step-opt">{tflow.optional}</span>
                </h2>
                <div className="upload-grid">
                  <div className="field">
                    <span className="field-label">{t.folder}</span>
                    <Select language={language}
                      name="folderId"
                      initial={d.folderId ?? ""}
                      fieldLabel={t.folder}
                      options={[
                        { value: "", label: t.folderUnfiled },
                        ...treeOptions(folderTree.map(r => ({ id: r.folder.id, name: r.folder.name, level: r.level }))),
                      ]}
                    />
                    <span className="quiet field-hint">{t.folderNote}</span>
                  </div>

                  <div className="field">
                    <span className="field-label">{tf.ownerDepartment}</span>
                    <Select language={language}
                      name="ownerDepartmentId"
                      initial={d.ownerDepartmentId ?? ""}
                      fieldLabel={tf.ownerDepartment}
                      options={[
                        { value: "", label: tf.ownerDepartmentNone },
                        ...treeOptions(departmentRows.map(r => ({ id: r.department.id, name: r.department.name, level: r.level }))),
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
                    <span className="field-label">{t.scope}</span>
                    <Select language={language} name="scope" options={codelistOptions("scope")} initial={d.scope ?? "company"} fieldLabel={t.scope} />
                  </div>

                  <div className="field upload-wide">
                    <span className="field-label">{t.tags}</span>
                    <TagSelect
                      name="tags"
                      options={await tagOptions(ctx.tenant.companyCode, extras)}
                      selected={d.tags}
                      newLabel={t.newTag}
                      language={language}
                    />
                  </div>
                </div>
              </section>

              {/* Identifikátor len na čítanie (bod 3). */}
              <p className="detail-block-small">
                {t.keyNoteBefore}<code>{d.documentId}</code>{t.keyNoteAfter}
              </p>

              <div className="set-savebar edit-savebar">
                <button className="button" type="submit">{t.save}</button>
                <Link className="button button--quiet" href={base}>{tflow.cancel}</Link>
                <span className="quiet">{tflow.editSaveNote}</span>
              </div>
            </form>

            {/* Čo sa upravuje inde (bod 5) — na telefóne pod formulárom. */}
            <aside className="detail-side">
              <section className="card detail-card">
                <h2 className="detail-card-title">{tflow.elsewhereHeading}</h2>
                <ul className="edit-elsewhere">
                  <li><Link href={`${base}/version`}>{tflow.elsewhereVersion}</Link></li>
                  <li><Link href={hasChangesToPublish ? `${base}#flow` : `${base}?open=fix#current`}>{tflow.elsewhereMeta}</Link></li>
                  <li><Link href={`${base}?open=responsible#current`}>{tflow.elsewhereResponsible}</Link></li>
                  <li><Link href={`${base}/text`}>{tflow.elsewhereText}</Link></li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      ) : (
      <>
      <p className="detail-back">
        <Link className="quiet" href="/library">{t.back}</Link>
      </p>

      {/*
        Stav dokumentu farebne, tou istou funkciou ako v zozname (DETAIL,
        úloha 2). Bežiace kolo nad konceptom je „na schválenie" (MASTER).
        Technické spracovanie sa ukazuje len keď niečo hovorí: hotový stav
        sa nekreslí, zlyhanie je červené (rovnako ako v zozname).
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
        {` · ${folderName}`}
        {effective?.effectiveFrom && ` · ${t.effectiveFromOn(date(effective.effectiveFrom))}`}
      </p>

      {/*
        Akcie v hlavičke (bod 1 rámu). „Nové znenie" je hlavné tlačidlo, nie
        formulár schovaný v správe. Kým sa jedno znenie pripravuje, je
        neaktívne a `title` povie prečo — súbory sa vtedy vymieňajú v príprave.
      */}
      <div className="detail-actions">
        {effective?.pdf && (
          <a className="button button--quiet" href={`/api/library/file/${encodeURIComponent(effective.pdf.id)}`} target="_blank" rel="noreferrer">
            {tflow.downloadPdf}
          </a>
        )}
        <Link className="button button--quiet" href={`${base}?edit=document`}>{tflow.editDocument}</Link>
        {newVersionBlocked ? (
          <span className="button is-disabled" aria-disabled="true" title={effective ? tflow.newVersionBusy : tflow.newVersionFirst}>
            {tflow.newVersion}
          </span>
        ) : (
          <Link className="button" href={newVersionHref}>{tflow.newVersion}</Link>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-main">

      {flow && (
      <section className="card flow" id="flow">
        <div className="flow-head">
          <h2>{flowHeading}</h2>
          <span className="quiet">{flowStatus}</span>
        </div>
        <FlowSteps states={flow.states} names={tflow.steps} subs={flowSubs} label={tflow.stepOf(flow.step)} />

        {/* ── Krok 1: Príprava ── */}
        {flow.step === 1 && (
          <form action={prepareDraftAction}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <input type="hidden" name="versionLabel" value={t.approvalDraftLabel} />
            {!metaIsLocked && <input type="hidden" name="metaEditable" value="1" />}
            <div className="flow-body">
              {flow.rejected && (
                <div className="flow-reject" role="note">
                  <b>
                    {rejectedBy(flow.rejected)
                      ? tflow.rejectedBy(rejectedBy(flow.rejected)!.fullName, date(rejectedBy(flow.rejected)!.decidedAt), flow.rejected.round)
                      : tflow.cancelled(date(flow.rejected.closedAt ?? flow.rejected.submittedAt), flow.rejected.round)}
                  </b>
                  {rejectedBy(flow.rejected)?.reason
                    ? <q>{rejectedBy(flow.rejected)!.reason}</q>
                    : flow.rejected.note && <q>{flow.rejected.note}</q>}
                </div>
              )}
              <p className="flow-lead">{flow.rejected ? tflow.lead1Rejected : tflow.lead1}</p>

              <div className="flow-check">
                <div className="flow-check-row">
                  <span className={`flow-check-ico ${d.draftPdf ? "is-ok" : "is-todo"}`} aria-hidden="true">{d.draftPdf ? "✓" : "!"}</span>
                  <div className="flow-check-main">
                    {d.draftPdf
                      ? <>{tflow.checkPdf} — <FileLink file={d.draftPdf} /></>
                      : tflow.checkPdfMissing}
                    {d.draftPdf?.bytes ? <div className="flow-check-note">{formatSize(d.draftPdf.bytes)}</div> : null}
                  </div>
                  <Link className="flow-check-act" href={newVersionHref}>{tflow.replace}</Link>
                </div>
                <div className="flow-check-row">
                  <span className={`flow-check-ico ${d.draftSource ? "is-ok" : "is-opt"}`} aria-hidden="true">{d.draftSource ? "✓" : "–"}</span>
                  <div className="flow-check-main">
                    {d.draftSource ? <>{tflow.checkSource} — <FileLink file={d.draftSource} download /></> : tflow.checkSource}
                    <div className="flow-check-note">{d.draftSource ? tflow.checkSourceNote : tflow.checkSourceMissing}</div>
                  </div>
                  <Link className="flow-check-act" href={`${base}/text`}>{tflow.showText}</Link>
                </div>
              </div>

              {/*
                Názov dokumentu (ADR-015, D112): pri platnom znení sa mení len
                novým znením a schvaľuje sa s ním. Predvyplnený z dokumentu;
                rovnaký názov = bez zmeny.
              */}
              {effective && (
                <label className="field">
                  <span className="field-label">{t.title}</span>
                  {!metaIsLocked && <input type="hidden" name="titleEditable" value="1" />}
                  <input className="field-input" name="title" required disabled={metaIsLocked}
                         defaultValue={d.draftTitle ?? d.title} />
                  <span className="quiet field-hint">{tflow.titleNote}</span>
                </label>
              )}

              {/*
                Údaje o znení (ADR-013) — **pred** schvaľovaním, lebo sú jeho
                súčasťou. Zámok stráži server (`saveDraftMeta()`), nielen
                formulár.
              */}
              <div id="version-meta" style={{ display: "grid", gap: 10 }}>
                <h3 className="flow-section-title">{tflow.metaHeading}</h3>
                {metaVoidsApproval && <p className="detail-block-note">{tm.voidsApproval}</p>}
                {metaIsLocked
                  ? <p className="detail-block-note">{tm.locked}</p>
                  : !d.draftMeta?.effectiveFrom && (
                      // Bez uloženého dátumu účinnosti sa nedá predložiť. Návrh
                      // z dokumentu je predvyplnený, uloží sa až tlačidlom (D108).
                      <p className="detail-block-note">
                        {d.draftMetaSuggestion?.effectiveFrom ? tm.suggested : tflow.metaNote}
                      </p>
                    )}
                <VersionMetaFields
                  value={d.draftMeta}
                  suggestion={metaIsLocked ? null : d.draftMetaSuggestion}
                  authors={metaOptions.authors}
                  approvers={metaOptions.approvers}
                  language={language}
                  disabled={metaIsLocked}
                />
              </div>

              {/* Schvaľovatelia predvyplnení z posledného kola (ADR-014, D110). */}
              <fieldset className="hr-group">
                <legend className="field-label">{tflow.approvers}</legend>
                <span className="quiet field-hint">{tflow.approversPrefilled}</span>
                {approverChoices.length === 0 ? (
                  <p className="quiet">{t.approvalNoPeople}</p>
                ) : (
                  <div className="approval-people">
                    {approverChoices.map(p => (
                      <label key={p.id} className="approval-person">
                        <input type="checkbox" name="approver" value={p.id} defaultChecked={prefilledApprovers.has(p.id)} />
                        <span>
                          <span className="approval-person-name">{p.fullName}</span>
                          <span className="quiet approval-person-meta">
                            {p.department ? `${p.department} · ` : ""}{p.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              {/* Zodpovedná osoba už v príprave (ADR-014, D109) — nepovinná tu,
                  povinná pri zverejnení. */}
              <ResponsiblePicker
                people={responsibleChoices}
                language={language}
                initial={d.draftResponsible?.personId}
                required={false}
                note={tflow.responsibleNote}
              />

              <label className="field">
                <span className="field-label">{tflow.note}</span>
                <textarea className="field-input" name="note" rows={2} placeholder={t.approvalNotePlaceholder} />
              </label>
            </div>
            <div className="flow-foot">
              <button className="button" type="submit" name="intent" value="submit">
                {draftRounds.length > 0 ? tflow.resubmit(nextRound) : tflow.submitAndSave}
              </button>
              <button className="button button--quiet" type="submit" name="intent" value="save">{tflow.saveOnly}</button>
            </div>
          </form>
        )}

        {/* ── Krok 2: Schválenie ── */}
        {flow.step === 2 && running && (
          <>
            <div className="flow-body">
              <p className="flow-lead">{tflow.lead2(decided, running.approvers.length)}</p>
              <ul className="flow-approvers">
                {running.approvers.map(a => (
                  <li key={a.email} className="flow-appr">
                    <span className="flow-av" aria-hidden="true">{initials(a.fullName, a.email)}</span>
                    <span className="flow-appr-name">
                      {a.fullName}
                      {departmentOf.get(a.email.toLowerCase()) && (
                        <span className="flow-appr-role">{departmentOf.get(a.email.toLowerCase())}</span>
                      )}
                    </span>
                    <span className={`flow-appr-state${a.decision === "approved" ? " is-ok" : a.decision === "rejected" ? " is-bad" : ""}`}>
                      {a.decision === "approved" && a.decidedAt ? t.approvalApproved(date(a.decidedAt))
                        : a.decision === "rejected" && a.decidedAt ? t.approvalRejected(date(a.decidedAt))
                        : t.approvalWaiting}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="detail-block-small">{tflow.approvalsWhere}</p>

              <h3 className="flow-section-title">
                {tflow.whatIsApproved}
                <span className="flow-lock">🔒 {tflow.locked}</span>
              </h3>
              <div className="flow-check">
                {d.draftPdf && (
                  <div className="flow-check-row">
                    <span className="flow-check-ico is-ok" aria-hidden="true">✓</span>
                    <div className="flow-check-main">
                      <FileLink file={d.draftPdf} />
                      <div className="flow-check-note">PDF{d.draftPdf.bytes ? ` · ${formatSize(d.draftPdf.bytes)}` : ""}</div>
                    </div>
                  </div>
                )}
                <div className="flow-check-row">
                  <span className="flow-check-ico is-ok" aria-hidden="true">✓</span>
                  <div className="flow-check-main">
                    {tflow.searchText}
                    <div className="flow-check-note">{tflow.searchTextNote}</div>
                  </div>
                  <Link className="flow-check-act" href={`${base}/text`}>{tflow.show}</Link>
                </div>
              </div>
              {d.draftTitle && (
                <p className="detail-block-note">{tflow.newTitle(d.draftTitle)}</p>
              )}
              {d.draftMeta && <MetaFacts meta={d.draftMeta} language={language} />}
              {nextRows}
            </div>
            <div className="flow-foot">
              <details>
                <summary className="quiet" style={{ cursor: "pointer" }}>{tflow.withdraw}</summary>
                <form action={cancelApprovalAction} className="approval-form">
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={draftVersionId ?? ""} />
                  <p className="detail-block-small">{tflow.withdrawNote}</p>
                  <label className="field">
                    <span className="field-label">{t.approvalCancelReason}</span>
                    <input className="field-input" name="reason" required />
                  </label>
                  <div><button className="button button--quiet" type="submit">{tflow.withdraw}</button></div>
                </form>
              </details>
            </div>
          </>
        )}

        {/* ── Krok 3: Zverejnenie ── */}
        {flow.step === 3 && (
          <form action={publishVersionAction}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <div className="flow-body">
              <p className="flow-lead">{tflow.lead3}</p>
              {d.draftMeta && <MetaFacts meta={d.draftMeta} language={language} />}

              <label className="field">
                <span className="field-label">{t.versionLabel}</span>
                <input className="field-input" name="label" required defaultValue={labelSuggestion}
                       placeholder={t.versionLabelPlaceholder} />
                <span className="quiet field-hint">{labelSuggestion ? tflow.labelSuggested : <>{t.labelNoteBefore}<strong>{t.labelNoteHighlight}</strong>{t.labelNoteAfter}</>}</span>
              </label>

              {/* Dátum účinnosti je v schválených údajoch o znení (ADR-013)
                  a tu sa už nezadáva. Pole zostáva len pre koncept spred ADR-013. */}
              {!draftEffectiveFrom && (
                <label className="field">
                  <span className="field-label">{t.effectiveFrom}</span>
                  <input className="field-input" type="date" name="effectiveFrom" required />
                  <span className="quiet field-hint">{t.effectiveFromNote}</span>
                </label>
              )}

              <label className="field">
                <span className="field-label">{t.effectiveFromSource}</span>
                <input className="field-input" name="effectiveFromSource" required defaultValue={sourceSuggestion}
                       placeholder={t.effectiveFromSourcePlaceholder} />
                <span className="quiet field-hint">{sourceSuggestion ? tflow.effectiveFromSourceSuggested : t.effectiveFromSourceNote}</span>
              </label>

              <label className="field">
                <span className="field-label">{t.changeNote}</span>
                <input className="field-input" name="changeNote" placeholder={t.changeNotePlaceholder} />
              </label>

              {d.draftResponsible ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <p className="detail-block-note">{tflow.responsibleChosen(d.draftResponsible.fullName)}</p>
                  <details>
                    <summary className="quiet" style={{ cursor: "pointer", fontSize: "var(--fs-small)" }}>{tflow.responsibleChange}</summary>
                    <ResponsiblePicker people={responsibleChoices} language={language} required={false}
                                       exclude={d.draftResponsible.personId} />
                  </details>
                </div>
              ) : (
                <ResponsiblePicker people={responsibleChoices} language={language} />
              )}

              {/* Prenos pridelení ako voľba pri zverejnení (ADR-014, D111). */}
              {draftCarryOver.length > 0 && (
                <div style={{ display: "grid", gap: 12 }}>
                  <label className="approval-person">
                    <input type="checkbox" name="carryOver" value="1" defaultChecked />
                    <span>
                      <span className="approval-person-name">{tflow.carryOver(draftCarryOver.length)}</span>
                      <span className="quiet approval-person-meta">{tflow.carryOverNote}</span>
                    </span>
                  </label>
                  <div data-carry-over style={{ display: "grid", gap: 12 }}>
                    <CarryOverFields
                      candidates={draftCarryOver}
                      reason={reasonFor(labelSuggestion, draftCarryOver)}
                      language={language}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flow-foot">
              <PublishSubmit
                withCarryOver={draftCarryOver.length > 0}
                labels={{
                  publish: draftEffectiveFrom ? tflow.publishFrom(date(draftEffectiveFrom)) : t.publish,
                  publishAndAssign: tflow.publishAndAssign,
                }}
              />
            </div>
          </form>
        )}

        {/* ── Krok 4: Pridelenie ── */}
        {flow.step === 4 && (
          <form action={carryOverAssignmentsAction}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <div className="flow-body">
              <p className="flow-lead">{tflow.lead4} {tc.intro(carryOverVersion?.label ?? d.effectiveLabel)}</p>
              <CarryOverFields
                candidates={carryOver}
                reason={reasonFor(carryOverVersion?.label ?? "", carryOver)}
                language={language}
              />
            </div>
            <div className="flow-foot">
              <button className="button" type="submit">{tflow.assignChosen}</button>
              <Link href={assignHref([d.documentId])}>{tflow.assignElsewhere}</Link>
            </div>
          </form>
        )}

        {flow.step !== 4 && lastRound && (
          <details className="flow-foot" style={{ display: "block" }}>
            <summary className="quiet" style={{ cursor: "pointer" }}>{tflow.approvalHistory}</summary>
            <ApprovalRounds
              versionId={draftVersionId ?? "draft"}
              rounds={[...rounds.values()].flat()
                .filter(r => !lastPublishedAt || new Date(r.submittedAt) > lastPublishedAt)
                .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())}
              language={language}
            />
          </details>
        )}
      </section>
      )}

      {/* ── Platné znenie ako súhrn (bod 3 rámu) ── */}
      {effective ? (
        <section className="card cur" id="current">
          <div className="cur-head">
            <h2>{tflow.currentHeading}</h2>
            {effective.effectiveFrom && <span className="quiet">{tflow.fromDate(date(effective.effectiveFrom))}</span>}
          </div>
          <strong>{effective.label}</strong>
          {/*
            Zodpovedná osoba a právny základ (D91). Chýbajúci údaj sa hovorí
            nahlas, nie mlčí — pri zneniach spred D91 je to bežný stav.
          */}
          <dl className="facts">
            <div>
              <dt>{tr.responsiblePerson}</dt>
              <dd>
                {effective.responsiblePerson
                  ? <>
                      {effective.responsiblePerson.fullName}
                      {!activePersonIds.has(effective.responsiblePerson.personId) && (
                        <> <span className="tag tag--draft">{tr.inactiveResponsible}</span></>
                      )}
                    </>
                  : <span className="tag tag--draft">{tr.noResponsible}</span>}
              </dd>
            </div>
            <div>
              <dt>{tr.legalBasis}</dt>
              <dd>
                {effective.legalBasis
                  ? <>
                      {`${basisName(effective)}${effective.legalBasisReference ? ` · ${effective.legalBasisReference}` : ""}`}
                      {!effective.legalBasisKey && <> <span className="tag tag--draft">{tr.outsideCodelist}</span></>}
                    </>
                  : <span className="tag tag--draft">{tr.basisUnset}</span>}
              </dd>
            </div>
            <div>
              <dt>{tm.approvedBy}</dt>
              <dd>{effective.approvedBy
                ? `${effective.approvedBy}${effective.approvedOn ? ` · ${date(effective.approvedOn)}` : ""}`
                : ts.none}</dd>
            </div>
            <div>
              <dt>{tm.author}</dt>
              <dd>{effective.author || ts.none}</dd>
            </div>
          </dl>
          {versionLinks(effective)}
          {versionPanel(effective)}
        </section>
      ) : d.versions.length === 0 && !flow && (
        <p className="card" style={{ padding: 18, fontSize: "var(--fs-lead)" }}>
          {t.nothingPublished}
        </p>
      )}

      {/* ── Staršie znenia (bod 4 rámu) ── */}
      {(effective || olderVersions.length > 0) && (
        <>
          <h2 className="detail-card-title">{tflow.olderHeading}</h2>
          {olderVersions.length === 0 ? (
            <p className="quiet detail-empty" style={{ margin: "0 0 18px" }}>{tflow.olderNone}</p>
          ) : (
            <ul className="older">
              {olderVersions.map(v => (
                <li key={v.versionId} className="older-row" id={`v-${v.versionId}`}>
                  <strong>{v.label}</strong>
                  <span className="quiet">
                    {v.effectiveFrom ? t.effectiveFromOn(date(v.effectiveFrom)) : t.noEffectiveDate}
                    {v.effectiveTo && ` ${t.effectiveTo(date(v.effectiveTo))}`}
                  </span>
                  <div className="older-panel">
                    <VersionMetaLine author={v.author} approvedBy={v.approvedBy} approvedOn={v.approvedOn} language={language} />
                    {versionLinks(v)}
                    {versionPanel(v)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/*
        Správa — vzácne úkony za jedným nadpisom (DETAIL, úloha 1): údaje
        o dokumente, text a pôvodný súbor, priečinok, oprava textu,
        preindexovanie. Zatvorené je správny predvolený stav; „Upraviť
        dokument" ju otvorí adresou (`?edit=document`), bez JavaScriptu.
      */}
      <details className="detail-tools">
        <summary>{tflow.manage}</summary>
        <div className="detail-tools-body">
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
        </div>

        {/*
          Pravý panel — zhrnutie, nie ovládanie. Údaje o znení a zodpovedná
          osoba sú v karte platného znenia (bod 5 rámu); tu sú potvrdenia
          a údaje o dokumente s odkazom na ich úpravu.
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
                  Odkaz vidí **len personalista** a mieri na **toto znenie** —
                  správca obsahu do `/hr` nesmie a odkaz na 404 je horší než žiadny.
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
            <h2 className="detail-card-title">
              {ts.metaHeading}
              <Link href={`${base}?edit=document`}>{tflow.editDocument}</Link>
            </h2>
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
      </>
      )}
    </div>
    </AppShell>
  )
}


/** Odkaz na súbor v úložisku — PDF sa otvára, zdroj sa sťahuje. */
function FileLink({ file, download = false, label }: { file: VersionFile; download?: boolean; label?: string }) {
  const href = `/api/library/file/${encodeURIComponent(file.id)}${download ? "?download=1" : ""}`
  return (
    <a href={href} target={download ? undefined : "_blank"} rel="noreferrer" download={download ? file.name : undefined}>
      {label ?? file.name}
    </a>
  )
}

/** Veľkosť súboru pre človeka — „1,3 MB". */
function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return mb >= 0.1 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`
}

/** Zbalený zoznam histórie pri znení — zmeny osoby, základu, opravy. */
function HistoryList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details>
      <summary className="quiet" style={{ fontSize: "var(--fs-small)", cursor: "pointer" }}>{title}</summary>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8, fontSize: "var(--fs-small)" }}>
        {children}
      </ul>
    </details>
  )
}

/**
 * Polia prenosu pridelení (D28, D30) — publiká, povinný nový dôvod a termín.
 * Spoločné pre krok 3 (voľba pri zverejnení) aj krok 4 (samostatne).
 * **Termín sa neprenáša** a **e-maily sa neposielajú** — viď `carryOverTo()`.
 */
function CarryOverFields({
  candidates,
  reason,
  language,
}: {
  candidates: Awaited<ReturnType<typeof carryOverCandidates>>
  reason: string
  language: UiLanguage
}) {
  const tc = dictionary(language).library.carryOver
  return (
    <>
      <fieldset className="hr-group" style={{ border: "1px solid var(--line)", margin: 0 }}>
        <legend className="field-label">{tc.audiences}</legend>
        {candidates.map(c => (
          <label key={audienceRef(c.audience)} className="check-row" style={{ display: "block", padding: "6px 0" }}>
            <input type="checkbox" name="audience" value={audienceRef(c.audience)} defaultChecked />
            {" "}
            <span>{tc.previously(audienceLabel(c.audience), c.previousReason)}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field-label">{tc.reason}</span>
        <input className="field-input" name="reason" required defaultValue={reason} />
        <span className="quiet field-hint">{tc.reasonNote}</span>
      </label>

      <fieldset className="hr-group" style={{ border: "1px solid var(--line)", margin: 0 }}>
        <legend className="field-label">{tc.due}</legend>
        <Select language={language}
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
      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>{tc.noEmailNote}</p>
    </>
  )
}
