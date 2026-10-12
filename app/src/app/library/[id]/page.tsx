/**
 * Detail dokumentu v knižnici (D53).
 *
 * Vľavo, čo sa s dokumentom robí: **čo sa pripravuje** (karta postupu znenia
 * v štyroch krokoch, ADR-014), **ktoré znenia platia** (Znenia) a Ďalšie
 * akcie. Vpravo inšpektor so súhrnom: stav, potvrdenia, dokument, text.
 * Rámy z Claude Design: `docs/design/KNIZ-detail-dokumentu.md` (12. 10. 2026),
 * predtým `KNIZNICA-postup-znenia.md`.
 */

import { channelsOfFaq } from "@/lib/channels"
import { notFound, redirect } from "next/navigation"
import { basesOf } from "@/lib/versionResponsibility"
import { treeOptions } from "@/lib/treeOptions"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail, displayStatus, versionMetaSuggestions, tagOptions } from "@/lib/libraryRead"
import VersionMetaFields from "@/components/VersionMetaFields"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import Notice from "@/components/Notice"
import {
  publishVersionAction, prepareDraftAction, saveDocumentMetadataAction, reindexDocumentAction, reindexVersionAction, loadTextForFixAction,
  resyncConnectorDocumentAction,
  fixTextAction, revokeVersionAction, cancelApprovalAction,
  carryOverAssignmentsAction, setResponsibleAction, archiveDocumentAction, restoreDocumentAction, setDraftResponsibleAction,
} from "../actions"
import { cancelInfo, roundEvents, sortTimeline, timelineWorthShowing, TIMELINE_SHOWN, type TimelineEvent } from "@/lib/documentTimeline"
import { allFolders, flattenTree } from "@/lib/folders"
// Strom oddelení a strom priečinkov majú rovnaké pomenovanie funkcií —
// preto alias. Sú to dve rôzne štruktúry: priečinok je kam dokument
// odložím, oddelenie je kto ho udržiava.
import { allDepartments, flattenTree as flattenDepartments } from "@/lib/departments"
import { MAX_INTERNAL_NUMBER } from "@/lib/libraryWrite"
import { carryOverCandidates, audienceRef, audienceLabel } from "@/lib/assignments"
import { codelistOptions, chunkingStrategyFor } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import ValueSelect, { SimilarWarning, withCodelistNote } from "@/components/ValueSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { documentProgress } from "@/lib/libraryProgress"
import AppShell from "@/components/AppShell"
import ApprovalPanel from "@/components/ApprovalPanel"
import { isHr } from "@/lib/hr"
import { validAcknowledgements } from "@/lib/acknowledgements"
import { roundsByVersion, stateOf } from "@/lib/approvalsDb"
import { Fragment, type CSSProperties, type ReactNode } from "react"
import { textFingerprint } from "@/lib/chunkIdentity"
import { documentDraftIdentity, metaLocked } from "@/lib/versionMeta"
import { versionFlow, lastPreparationRound, previousApproverIds, rejectedBy } from "@/lib/versionFlow"
import FlowSteps from "@/components/FlowSteps"
import PublishSubmit from "@/components/PublishSubmit"
import { autoVersionLabel } from "@/lib/versionLabel"
import { assignHref } from "@/lib/libraryBulk"
import type { VersionFile } from "@/lib/documents"
import { textDiff, fixableVersions, closestVersion, draftIsFree, type DiffKind } from "@/lib/textFix"
import { listPeople } from "@/lib/people"
import ResponsiblePicker from "@/components/ResponsiblePicker"
import PeopleSearch from "@/components/PeopleSearch"
import LegalBasisForm from "@/components/LegalBasisForm"
import { canSetLegalBasis, legalBasisFields, versionBasisTasks } from "@/lib/versionResponsibility"
import { legalBasisOptions } from "@/lib/legalBases"
import { VersionBasisCard, DraftBasisCard } from "@/components/BasisTasks"
import { onboardingContext } from "@/lib/session"
import { loadDocumentFor, effectiveVersion } from "@/lib/documents"
import { archiveState, type ArchiveEntry } from "@/lib/documentArchiveState"
import { draftBasisTaskFor } from "@/lib/versionResponsibilityDb"
import SubmitButton from "@/components/SubmitButton"
import Icon from "@/components/Icon"

export const dynamic = "force-dynamic"

/** Ktorý panel pri znení je otvorený (`?open=…`). Bez JavaScriptu — server ho vykreslí otvorený. */
type Panel = "responsible" | "basis" | "revoke" | "fixText" | "reindex" | "history"
const PANELS: Panel[] = ["responsible", "basis", "revoke", "fixText", "reindex", "history"]

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  const { id } = await params
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    /*
     * Bez roly správy obsahu: na čitateľský detail. Ten dokument načíta
     * pre osobu (`loadDocumentFor`) a na cudzí či neexistujúci odpovie 404
     * (SHELL-menu-v-hlavicke — Knižnica pre každého).
     */
    if (ctx.state === "forbidden") {
      // Zodpovedná osoba bez roly správcu obsahu: len jej úloha (D151).
      const page = await responsibleBasisPage(decodeURIComponent(id), await searchParams)
      if (page) return page
      redirect(`/documents/${encodeURIComponent(decodeURIComponent(id))}`)
    }
    notFound()
  }

  const query = normalizeQuery<{ msg?: string; error?: string; open?: string; version?: string; edit?: string; older?: string; fixTarget?: string; similar?: string; like?: string; pick?: string; archive?: string; withdraw?: string; history?: string }>(await searchParams)
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
  const tci = dictionary(language).library.connectorImport
  const tv = dictionary(language).library.docView
  const extras = tenantExtras(ctx.tenant)
  // Značky s počtami len pre úpravu dokumentu — inde sa nekreslia.
  const tagChoices = editDocument ? await tagOptions(ctx.tenant.companyCode, extras) : []
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
  /*
   * **Dve rôzne „platné" znenia** (ADR-023 D143, ADR-024). Kým sa novela
   * nezverejnila vopred, boli to to isté znenie; odvtedy nie:
   *
   *   - `latest` — naposledy zverejnené (`isActive`). Z neho vychádza postup
   *     nového znenia a oprava textu (`fixText()` ho tak berie aj na serveri);
   *   - `current` — platí dnes (`effectiveVersion()`), to isté, čo vidí
   *     čitateľ, potvrdzuje sa a z čoho odpovedá asistent. Karta ho ukazuje
   *     ako „Platné znenie".
   *
   * Dovtedy karta ukazovala `latest` ako platné — pri novele vopred teda
   * budúce znenie a dnes platné zaradila medzi staršie s vetou „Ľudia ich
   * už nevidia" (zistené na `sfz:test_znenia` 29. 9. 2026).
   */
  const latest = d.versions.find(v => v.isActive && v.effectiveFrom)
  const current = d.versions.find(v => v.versionId === d.effectiveVersionId)
  /**
   * Zverejnená novela, ktorá ešte neplatí. Bez porovnania s časom: naposledy
   * zverejnené znenie, ktoré dnes neplatí, je vždy novela vopred — keby už
   * platilo, `effectiveVersion()` by ho vybral ako platné. Výnimka je
   * dokument, ktorému platnosť skončila (`effectiveTo` v minulosti, stav
   * „expirovaný") — to znenie patrí medzi staršie, nie medzi pripravované.
   */
  const upcoming = latest && latest !== current && !latest.effectiveTo ? latest : undefined
  const olderVersions = d.versions.filter(v => v !== current && v !== upcoming)
  /** Súbory v hlavičke: dnes platné, a kým žiadne neplatí, pripravované. */
  const shown = current ?? latest
  /** Znenia, ktorých text sa smie opraviť — platné a pripravované (D78, D150). */
  const fixable = fixableVersions(d.versions, d.effectiveVersionId)

  const tc = dictionary(language).library.carryOver
  /*
   * Publiká, ktoré platné znenie „zdedí" po predošlých (D28). Prázdny zoznam
   * je bežný stav — vtedy sa krok 4 nevykreslí vôbec a obrazovka o ňom mlčí.
   */
  const canAssign = isHr(ctx.person)
  /*
   * Znenie sa berie z `effectiveVersionId`, **nie z `latest` vyššie**.
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
  // Potvrdenia znenia, ktoré platí dnes — to ľudia potvrdzujú (D28).
  const progress = await documentProgress(ctx.tenant.companyCode, current?.versionId)

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
  const published = ((d.markdown ?? latest?.markdown) ?? "").trim()

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
    // Koncept zhodný s textom niektorého zverejneného znenia nie je príprava
    // nového — to je stav hneď po „Opraviť text" pri znení (fáza 3).
    (draft !== published && !draftIsFree(draft, [...d.versions, { versionId: "", markdown: published }])) ||
    Boolean(d.draftPdf && latest && latest.pdf?.id !== d.draftPdf.id &&
      !d.versions.some(v => v.versionId === draftVersionId))
  )
  // Údaje o znení (ADR-013): uložené, návrh z prvej strany a zámok po predložení.
  const tm = dictionary(language).versionMeta
  // Znenie bez orgánu (manuály, smernice) schválilo len kolo v Contineo —
  // ukáže sa to namiesto pomlčky. Odvodené z kola, neukladá sa (D27).
  const approvedInContineo = (versionId: string): string | null => {
    const r = [...(rounds.get(versionId) ?? [])].reverse().find(x => x.outcome === "approved")
    if (!r) return null
    return tm.approvedInContineo(r.approvers.map(a => a.fullName).join(", "), date(r.closedAt ?? r.submittedAt))
  }
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
  /*
    Archivácia (ADR-025, D156). Stav sa odvodzuje zo záznamu pri poslednom
    zverejnenom znení; prečo sa archivovať nedá, povie karta vopred — server
    to aj tak overí znova (`archiveProblem()`).
  */
  const archive = archiveState(d as unknown as Parameters<typeof archiveState>[0])
  const archiveBlocked: string | null = archive.archived ? null
    : !current ? "no-current"
    : upcoming ? "upcoming"
    : hasChangesToPublish ? "draft"
    : running ? "round-open"
    : null
  // Potvrdenie archivácie sa otvorí adresou (KNIZNICA-akcie-dokumentu, 8. 10. 2026).
  const archiving = query.archive === "1"
  const approvedRound = [...draftRounds].reverse().find(r => r.outcome === "approved") ?? null
  // Meno namiesto adresy tam, kde kolo nesie len adresu predkladateľa.
  const nameOf = (email: string) => people.find(p => p.email.toLowerCase() === email.toLowerCase())?.fullName ?? email
  const prefilledApprovers = new Set(previousApproverIds(rounds.values(), approverChoices))
  // Kolá sa číslujú na identite konceptu — po výmene PDF začína znova od 1.
  const nextRound = draftRounds.length + 1
  // Publiká na prenos pri zverejnení (krok 3) — všetko, čo mali doterajšie znenia.
  const draftCarryOver = canAssign && flow?.step === 3 && draftVersionId && latest
    ? await carryOverCandidates(ctx.tenant.companyCode, documentId, draftVersionId)
    : []
  const draftEffectiveFrom = d.draftMeta?.effectiveFrom ?? null
  // Označenie, aké dostane znenie pri zverejnení (ADR-016, D113) — tou istou funkciou ako `publish()`.
  const labelSuggestion = draftEffectiveFrom
    ? autoVersionLabel(new Date(draftEffectiveFrom), d.language, d.versions.map(v => v.label))
    : ""

  /*
   * Expirovaný sa odvodzuje `displayStatus()` z platného znenia — tá istá
   * funkcia ako v zozname. Štítok v hlavičke z neho skladá `stateKey` nižšie
   * (KNIZ-detail-dokumentu, Q6).
   */
  const headerStatus = draftState === "in-review"
    ? "in-review"
    : displayStatus(d.status, (current ?? latest)?.effectiveTo)

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
  /*
   * **Ktoré znenie sa opravuje** (fáza 3, D150). Opraviť sa dá platné
   * a zverejnená novela, ktorá ešte neplatí; cieľ je to, ktorého text je
   * konceptu najbližší — po „Opraviť text" pri znení vždy ono. `?fixTarget=`
   * ho prepne na druhé. Dovtedy to bolo vždy naposledy zverejnené — pri
   * novele vopred teda budúce, aj keď sa opravovalo platné.
   */
  const fixTarget = fixable.find(v => v.versionId === query.fixTarget)
    ?? (draft ? closestVersion(draft, fixable) : undefined)
  const fixOther = fixable.find(v => v !== fixTarget)
  const effectiveText = ((fixTarget?.markdown ?? (fixTarget === latest ? d.markdown : "")) ?? "").trim()
  const draftDiff = fixTarget && hasChangesToPublish ? textDiff(effectiveText, draft) : null

  /*
   * Farby rozdielu. Zelená a červená sú len zosilnenie — znamienko `+`/`−` na
   * začiatku riadku nesie tú istú informáciu aj tomu, kto tie dve farby
   * nerozlíši.
   */
  const diffStyle = (kind: DiffKind): CSSProperties =>
    kind === "added"
      // Tokeny stavu, nie natvrdo farby — v tmavej téme sa prepnú samy.
      ? { background: "var(--ok-bg)" }
      : kind === "removed"
        ? { background: "var(--bad-bg)" }
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
    if (v !== current) p.set("version", v.versionId)
    if (v !== current && query.older === "all") p.set("older", "all")
    if (!(openPanel === panel && (v === current ? !query.version : query.version === v.versionId))) p.set("open", panel)
    const qs = p.toString()
    return `${base}${qs ? `?${qs}` : ""}#${v === current ? "current" : `v-${v.versionId}`}`
  }
  const panelOf = (v: V): Panel | null =>
    openPanel && (v === current ? !query.version : query.version === v.versionId) ? openPanel : null
  const canSetBasis = (v: V) => canSetLegalBasis({
    actorPersonId: ctx.person.id,
    isContentManager: true,
    responsible: v.responsiblePerson,
    responsibleActive: Boolean(v.responsiblePerson && activePersonIds.has(v.responsiblePerson.personId)),
  })

  /*
   * Právny základ pripravovaného znenia (ADR-023, D139). Správca obsahu ho
   * v knižnici smie určiť len ako náhradník — keď príprava zodpovednú osobu
   * nemá alebo odišla — alebo keď je sám tou osobou. To isté pravidlo stráži
   * `setDraftLegalBasis()`; tu sa len neponúka formulár, ktorý by odmietol.
   */
  const draftResponsibleActive = Boolean(d.draftResponsible && activePersonIds.has(d.draftResponsible.personId))
  const canSetDraftBasis = canSetLegalBasis({
    actorPersonId: ctx.person.id,
    isContentManager: true,
    responsible: d.draftResponsible,
    responsibleActive: draftResponsibleActive,
  })
  const draftBasisLabel = d.draftLegalBasis ? legalBasisFields(d.draftLegalBasis.entries).legalBasisLabel : null

  const panelLabel: Record<Panel, string> = {
    responsible: tflow.changeResponsible,
    basis: tflow.changeBasis,
    revoke: t.revokeVersionHeading,
    fixText: t.textFixPanel,
    reindex: t.reindexVersionHeading,
    history: tflow.history,
  }
  /** Úkony pri znení — tie isté pre kartu platného znenia aj ponuku ⋯ staršieho. */
  const versionPanels = (v: V): Panel[] => ([
    ["responsible", true],
    ["basis", canSetBasis(v)],
    // „Opraviť údaje" zrušené (ADR-016): označenie sa skladá samo, dátum je
    // schválený s údajmi o znení. Ostáva odvolanie potvrdení personalistom.
    ["revoke", canRevoke && (ackByVersion.get(v.versionId) ?? 0) > 0],
    // Každé znenie, aj staršie: asistent hľadá aj v nich (ADR-024), takže
    // po oprave chunkera majú dostať nové členenie. Text sa nemení.
    // Len platné a pripravované znenie (D78, D150) — staršie je doklad.
    ["fixText", fixable.includes(v)],
    ["reindex", true],
    ["history", true],
  ] as [Panel, boolean][]).filter(([, show]) => show).map(([panel]) => panel)
  const panelLink = (v: V, panel: Panel) => (
    <Link key={panel} href={panelHref(v, panel)} aria-current={panelOf(v) === panel ? "true" : undefined}>
      {panelLabel[panel]}
    </Link>
  )


  /*
   * Staršie znenia (DETAIL-starsie-znenia). Viditeľné je len PDF — to sa pri
   * starom znení robí najčastejšie; zriedkavé úkony sú v ⋯ ako `<details>`,
   * takže ponuka funguje bez JavaScriptu. Zoznam ukáže tri najnovšie, zvyšok
   * za odkazom `?older=all` — a rozbalí sa sám, keď je panel otvorený na
   * znení, ktoré by inak bolo skryté (prišiel sem odkaz alebo presmerovanie
   * po uložení a človek má vidieť, čo robí).
   */
  const OLDER_SHOWN = 3
  const olderAll = query.older === "all"
    || olderVersions.slice(OLDER_SHOWN).some(v => v.versionId === query.version)
  const olderShown = olderAll ? olderVersions : olderVersions.slice(0, OLDER_SHOWN)
  const olderClose = (v: V) => `${base}${query.older === "all" ? "?older=all" : ""}#v-${v.versionId}`
  const olderWho = (v: V) => (v.responsiblePerson
    ? <>
        {v.responsiblePerson.fullName}
        {!activePersonIds.has(v.responsiblePerson.personId) && (
          <> <span className="tag tag--draft">{tflow.older.responsibleInactive}</span></>
        )}
      </>
    : <span className="tag tag--draft">{tflow.older.responsibleMissing}</span>)
  const olderBasis = (v: V) => (v.legalBasis
    ? basisName(v)
    : <span className="tag tag--draft">{tflow.older.basisMissing}</span>)

  /*
   * Rozpracovaná oprava textu (ADR-007, D150) pri znení, ktorého sa týka —
   * nie v Ďalších akciách (Q8). Zbalená je jeden riadok s odkazom (dovtedy
   * `<details>`); rozdiel a formulár sa otvoria cez „Opraviť text" alebo
   * `?fixTarget=` — inak by pri každom novom znení zaberali pol obrazovky.
   */
  const fixBlock = (v: V) => {
    if (fixTarget !== v || !draftDiff || draftDiff.added + draftDiff.removed === 0) return null
    if (panelOf(v) !== "fixText" && !query.fixTarget) {
      return (
        <p className="cur-panel doc-fix-line" id="fix">
          <span><b>{t.textFixHeading}</b> · {t.textFixTarget(fixTarget.label)}</span>
          <Link className="button button--quiet button--sm" href={`${base}?fixTarget=${encodeURIComponent(v.versionId)}#fix`}>{t.textFixPanel}</Link>
        </p>
      )
    }
    return (
      <div className="cur-panel doc-fix" id="fix">
        <h4 className="flow-section-title">{t.textFixHeading}</h4>
        <p className="detail-block-note">{t.textFixIntro}</p>
        <p className="detail-block-small">
          <strong>{t.textFixTarget(fixTarget.label)}</strong>
          {fixOther && (
            <> · <Link href={`${base}?fixTarget=${encodeURIComponent(fixOther.versionId)}#fix`}>{t.textFixOther(fixOther.label)}</Link></>
          )}
        </p>
        <div>
          <h5 className="field-label doc-diff-head">
            {`${t.textFixDiffHeading} · ${t.textFixDiffStat(draftDiff.added, draftDiff.removed)}`}
          </h5>
          {draftDiff.coarse && <p className="quiet doc-diff-note">{t.textFixCoarse}</p>}
          {/* Riadky sa zalamujú, nerolujú do strany — na telefóne by text predpisu bol neprečítateľný. */}
          <div className="card doc-diff">
            {draftDiff.lines.map((line, i) => (
              <div key={i} style={diffStyle(line.kind)}>
                {line.kind === "gap"
                  ? t.textFixGap(Number(line.text))
                  : `${line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "} ${line.text}`}
              </div>
            ))}
          </div>
        </div>
        <p className="detail-block-small">{t.textFixApprovalNote}</p>
        <form action={fixTextAction} className="doc-fix-form">
          <input type="hidden" name="documentId" value={d.documentId} />
          {/* Odtlačok toho, čo je na obrazovke — server overí, že sa koncept medzitým nezmenil. */}
          <input type="hidden" name="expectedFingerprint" value={draftTextFingerprint ?? ""} />
          <input type="hidden" name="versionId" value={fixTarget.versionId} />
          <label className="field">
            <span className="field-label">{t.textFixReason}</span>
            <input className="field-input" name="reason" required placeholder={t.textFixReasonPlaceholder} />
            <span className="quiet field-hint">{t.textFixReasonNote}</span>
          </label>
          <div><SubmitButton className="button button--quiet">{t.textFixSubmit}</SubmitButton></div>
        </form>
      </div>
    )
  }

  /* ── Časový rad (Q5) ────────────────────────────────────────────────── */
  const eventText = (e: TimelineEvent): string => {
    const who = nameOf(e.who)
    const round = e.round ?? 0
    switch (e.kind) {
      case "submitted": return tv.ev.submitted(round, who)
      case "approved": return tv.ev.approved(who, round)
      case "rejected": return tv.ev.rejected(who, round)
      case "cancelled": return tv.ev.cancelled(round, who)
      case "published": return tv.ev.published(who)
      case "responsible": {
        const [from, to] = (e.detail ?? " → ").split(" → ")
        return tv.ev.responsible(from || "—", to || "—", who)
      }
      case "basis": return tv.ev.basis(e.detail ?? "—", who)
      case "fix": return tv.ev.fix(who)
      case "textFix": return tv.ev.textFix(who)
      case "archived": return tv.ev.archived(who)
    }
  }
  const timeline = (events: TimelineEvent[], all: boolean, allHref: string, lessHref: string) => (
    <>
      <ol className="tl">
        {(all ? events : events.slice(0, TIMELINE_SHOWN)).map((e, i) => (
          <li key={`${e.kind}-${e.at.getTime()}-${i}`} className={`tl-item is-${e.kind}`}>
            <span className="tl-dot" aria-hidden="true" />
            <div className="tl-main">
              <span>{eventText(e)}</span>
              {e.reason && <q className="quote">{e.reason}</q>}
            </div>
            <time dateTime={e.at.toISOString()}>{date(e.at)}</time>
          </li>
        ))}
      </ol>
      {events.length > TIMELINE_SHOWN && (
        all
          ? <Link className="tl-more" href={lessHref}>{tv.historyLess}</Link>
          : <Link className="tl-more" href={allHref}>{tv.historyAll(events.length)}</Link>
      )}
    </>
  )
  /** Udalosti znenia pre panel História — namiesto troch rozbaľovačiek. */
  const versionEvents = (v: V): TimelineEvent[] => sortTimeline([
    ...(rounds.get(v.versionId) ?? []).flatMap(roundEvents),
    ...(v.publishedAt ? [{ kind: "published" as const, at: new Date(v.publishedAt), who: v.publishedBy ?? "—" }] : []),
    ...(v.responsibleChanges ?? []).map(c => ({
      kind: "responsible" as const, at: new Date(c.at), who: c.by,
      detail: `${c.from?.fullName ?? "—"} → ${c.to.fullName}`, reason: c.reason,
    })),
    ...(v.legalBasisChanges ?? []).map(c => ({
      kind: "basis" as const, at: new Date(c.at), who: c.by,
      detail: `${c.toLabel ?? tr.basisLabel[c.to]}${c.toReference ? ` (${c.toReference})` : ""}${c.inPreparation ? ` · ${tr.basisInPreparation}` : ""}`,
      reason: c.reason,
    })),
    ...(v.fixes ?? []).map(f => ({ kind: "fix" as const, at: new Date(f.at), who: f.by, reason: f.reason })),
    ...(v.textFixes ?? []).map(f => ({ kind: "textFix" as const, at: new Date(f.at), who: f.by, reason: f.reason })),
  ])

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
            <div><SubmitButton className="button button--quiet">{tr.saveResponsible}</SubmitButton></div>
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
              currentKeys={basesOf(v).map(e => e.key ?? "").filter(Boolean)}
              options={basisOptions}
              language={language}
              back="library"
            />
          </>
        )}

        {/*
          Odvolanie potvrdení (D82): vidí ho len personalista a len pri znení,
          ktoré niekto potvrdil. Všetci pridelení ho potom potvrdia znova.
        */}
        {panel === "revoke" && canRevoke && acks > 0 && (
          <form action={revokeVersionAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <input type="hidden" name="versionId" value={v.versionId} />
            <p className="detail-block-small">{t.revokeVersionNote(acks)}</p>
            <label className="field">
              <span className="field-label">{t.revokeVersionReason}</span>
              <input className="field-input" name="reason" required
                     placeholder={t.revokeVersionReasonPlaceholder} />
            </label>
            <div>
              <SubmitButton className="button button--quiet">{t.revokeVersionSubmit}</SubmitButton>
            </div>
          </form>
        )}

        {panel === "fixText" && fixable.includes(v) && (
          <form action={loadTextForFixAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <input type="hidden" name="versionId" value={v.versionId} />
            <p className="detail-block-small">{t.textFixPanelNote}</p>
            <div><SubmitButton className="button button--quiet">{t.textFixLoad}</SubmitButton></div>
          </form>
        )}

        {panel === "reindex" && (
          <form action={reindexVersionAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <input type="hidden" name="versionId" value={v.versionId} />
            <p className="detail-block-small">{t.reindexVersionNote}</p>
            <div><SubmitButton className="button button--quiet">{t.reindexVersion}</SubmitButton></div>
          </form>
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

            {/* Zmeny osoby a základu, opravy údajov a textu — jeden časový rad (Q5). */}
            {timeline(versionEvents(v), true, "", "")}
          </>
        )}
      </div>
    )
  }

  /*
   * Znenie v sekcii Znenia (KNIZ-detail-dokumentu, 12. 10. 2026, Q7) —
   * platné a novela vopred rozbalené. Bežné úkony sú tiché tlačidlá, zriedkavé
   * a s následkom (odvolať potvrdenia, preindexovať) v ponuke •••. Panely sa
   * otvárajú pod znením cez `?open=` ako doteraz.
   */
  const versionBlock = (v: V, id: string, tagText: string, tagClass: string) => {
    const panels = versionPanels(v)
    const rare = panels.filter(p => p === "revoke" || p === "reindex")
    const common = panels.filter(p => p !== "revoke" && p !== "reindex")
    const buttonLabel: Record<Panel, string> = {
      responsible: tv.chk.responsible,
      basis: tv.chk.basis,
      revoke: tv.revokeItem,
      fixText: t.textFixPanel,
      reindex: tv.reindexItem,
      history: tflow.history,
    }
    const acks = ackByVersion.get(v.versionId) ?? 0
    const acksValue = v === current
      ? (progress.percent === null ? tv.acksNone : tv.acksValue(progress.acknowledged, progress.assigned, progress.percent))
      : (acks ? tflow.older.ackCount(acks) : tv.acksNone)
    return (
      <div className={`vcur${panelOf(v) ? " is-open" : ""}`} id={id}>
        <div className="vcur-head">
          <h3>{v.label}</h3>
          <span className={tagClass}>{tagText}</span>
          {rare.length > 0 && (
            <details className="more vcur-more">
              <summary aria-label={tv.more} title={tv.more}><span aria-hidden="true">•••</span></summary>
              <div className="more-menu more-menu--notes">
                {rare.map(p => (
                  <Link key={p} href={panelHref(v, p)} aria-current={panelOf(v) === p ? "true" : undefined}>
                    {buttonLabel[p]}
                    <small>{p === "revoke" ? tv.revokeNote : tv.reindexNote}</small>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>
        {/* Zodpovedná osoba a právny základ (D91) — chýbajúci údaj sa hovorí nahlas. */}
        <div className="vcur-rows">
          <div className="labeled-row">
            <span>{tr.responsiblePerson}</span>
            <span>
              {v.responsiblePerson
                ? <>
                    {v.responsiblePerson.fullName}
                    {!activePersonIds.has(v.responsiblePerson.personId) && (
                      <> <span className="tag tag--draft">{tr.inactiveResponsible}</span></>
                    )}
                  </>
                : <span className="tag tag--draft">{tr.noResponsible}</span>}
            </span>
          </div>
          <div className="labeled-row">
            <span>{tr.legalBasis}</span>
            <span>
              {v.legalBasis
                ? <>
                    {`${basisName(v)}${v.legalBasisReference ? ` · ${v.legalBasisReference}` : ""}`}
                    {!v.legalBasisKey && <> <span className="tag tag--draft">{tr.outsideCodelist}</span></>}
                  </>
                : <span className="tag tag--draft">{tr.basisUnset}</span>}
            </span>
          </div>
          <div className="labeled-row">
            <span>{tm.approvedBy}</span>
            <span>{v.approvedBy
              ? `${v.approvedBy}${v.approvedOn ? ` · ${date(v.approvedOn)}` : ""}`
              : approvedInContineo(v.versionId) ?? ts.none}</span>
          </div>
          <div className="labeled-row">
            <span>{tm.author}</span>
            <span>{v.author || ts.none}</span>
          </div>
          <div className="labeled-row">
            <span>{tv.acksRow}</span>
            <span>{acksValue}</span>
          </div>
        </div>
        <div className="vcur-acts">
          {v.pdf && <FileLink file={v.pdf} label="PDF" className="button button--quiet button--sm" />}
          {common.map(p => (
            <Link key={p} className="button button--quiet button--sm" href={panelHref(v, p)}
                  aria-current={panelOf(v) === p ? "true" : undefined}>
              {buttonLabel[p]}
            </Link>
          ))}
        </div>
        {versionPanel(v)}
        {fixBlock(v)}
      </div>
    )
  }


  /* ── Karta postupu znenia (body 2, 5–9 rámu) ─────────────────────────── */
  const flowHeading = !flow ? "" : flow.step === 4
    ? tflow.publishedHeading(date(latest?.effectiveFrom))
    : !latest ? tflow.firstVersion
    : draftEffectiveFrom ? tflow.heading(date(draftEffectiveFrom)) : tflow.headingUndated
  const flowStatus = !flow ? "" : flow.step === 1
    ? (flow.rejected ? tflow.statusRejected(date(flow.rejected.closedAt ?? flow.rejected.submittedAt))
      : flow.cancelled ? tflow.statusCancelled(date(flow.cancelled.closedAt ?? flow.cancelled.submittedAt))
      : tflow.statusPreparing)
    : flow.step === 2 && running ? tflow.statusInReview(nameOf(running.submittedBy), date(running.submittedAt))
    : flow.step === 3
      ? `${tflow.statusApproved}${approvedRound?.closedAt ? ` · ${date(approvedRound.closedAt)}` : ""}`
    : tflow.statusPublished(date(latest?.publishedAt))
  const decided = running ? running.approvers.filter(a => a.decision === "approved").length : 0
  const flowSubs = !flow ? [] : [
    flow.step === 1 ? tflow.subPrepare : tflow.subPrepareDone,
    flow.step === 1
      ? (flow.rejected ? tflow.subRejected(flow.rejected.round)
        : flow.cancelled ? tflow.subCancelled(flow.cancelled.round)
        : tflow.subWaitSubmit)
      : flow.step === 2 ? tflow.subInReview(decided, running?.approvers.length ?? 0)
      : tflow.subApproved,
    flow.step === 2 ? tflow.subWaitApproval : flow.step === 4 ? tflow.subPublished : "",
    flow.step === 4 ? tflow.subAssign : "",
  ]
  const newVersionHref = `${base}/version`
  /*
   * FAQ (ADR-028, D164) nemá čo nahrávať: nové znenie vzniká úpravou záznamov,
   * ktoré zložia PDF aj text. Hlavné tlačidlo preto vedie do editora
   * záznamov a je dostupné vždy — aj počas prípravy, lebo úprava konceptu
   * **je** príprava.
   */
  const isFaq = chunkingStrategyFor(d.category) === "entries"
  // FAQ patrí ku kanálu (ADR-028, D201) — poznámka, ku ktorému.
  const faqChannels = isFaq ? await channelsOfFaq(ctx.tenant.companyCode, d.documentId) : []
  const tfaq = dictionary(language).library.faq

  /* ── KNIZ-detail-dokumentu (12. 10. 2026): hlavička, Stav, kontrolný zoznam ── */
  const flowOpen = query.open === "draftBasis" || query.open === "draftResponsible" ? query.open : null
  const withdrawing = query.withdraw === "1" && Boolean(running)
  const historyAll = query.history === "all"
  const pendingNames = running ? running.approvers.filter(a => !a.decision).map(a => a.fullName).join(", ") : ""

  /** Názov položky číselníka namiesto kódu (`manual` → „Manuál"). */
  const codeLabel = (list: string, key: string | null | undefined) =>
    key ? (codelistOptions(list, extras).find(o => o.value === key)?.label ?? key) : ""

  /*
   * Jeden štítok stavu dokumentu (Q6). Kým niečo platí, hovorí o platnom;
   * prvé znenie hovorí o príprave. Archivácia má prednosť — to je to,
   * čo človek o predpise potrebuje vedieť ako prvé.
   */
  type StateKey = keyof typeof tv.state
  const stateKey: StateKey = archive.archived ? (archive.inEffect ? "archived" : "archiving")
    : (current ?? latest) ? (headerStatus === "expired" ? "expired" : "published")
    : draftState === "in-review" ? "inReview"
    : draftState === "approved" ? "approved"
    : "draft"
  const stateClass: Record<StateKey, string> = {
    draft: "tag tag--draft",
    inReview: "tag tag--review",
    approved: "tag tag--published",
    published: "tag tag--published",
    archiving: "tag tag--warn",
    archived: "tag tag--archived",
    expired: "tag tag--expired",
  }
  const archiveTo = archive.archived ? new Date(archive.entry.effectiveTo) : null
  const metaParts = [
    codeLabel("category", d.category),
    folderName,
    archive.archived && archive.inEffect && archiveTo ? tv.invalidFrom(date(archiveTo))
      : current?.effectiveFrom ? t.effectiveFromOn(date(current.effectiveFrom))
      : draftEffectiveFrom ? tv.proposedFrom(date(draftEffectiveFrom))
      : "",
    d.source?.type === "mcp" ? tv.fromConnector(d.source.connectorName) : "",
  ].filter(Boolean)

  /*
   * Stav jednou vetou — kto je na ťahu (inšpektor). Stránku vidí len správca
   * obsahu, takže príprava a zverejnenie sú „na ťahu ste vy"; čitateľa
   * nikdy neoslovuje menom v tretej osobe.
   */
  const statusLine: { title: string; detail: string } = (() => {
    if (archive.archived && archiveTo) {
      const title = archive.inEffect
        ? tv.st.archivedFrom(date(archiveTo))
        : tv.st.validUntil(date(new Date(archiveTo.getTime() - 86_400_000)))
      return { title, detail: flow && flow.step < 4 ? tv.stDetail.archivedPrep : (archive.entry as ArchiveEntry).reason }
    }
    if (flow?.step === 1) {
      return {
        title: latest ? tv.st.newPrep : tv.st.firstPrep,
        detail: flow.rejected ? tv.stDetail.rejected(flow.rejected.round, date(flow.rejected.closedAt ?? flow.rejected.submittedAt))
          : flow.cancelled ? tv.stDetail.cancelled(flow.cancelled.round, date(flow.cancelled.closedAt ?? flow.cancelled.submittedAt))
          : current?.effectiveFrom ? tv.stDetail.current(date(current.effectiveFrom)) : "",
      }
    }
    if (flow?.step === 2 && running) {
      return { title: tv.st.waitingFor(pendingNames || "—"), detail: tv.stDetail.round(running.round, date(running.submittedAt)) }
    }
    if (flow?.step === 3) {
      return {
        title: tv.st.approvedYou,
        detail: approvedRound ? tv.stDetail.approved(approvedRound.round, date(approvedRound.closedAt ?? approvedRound.submittedAt)) : "",
      }
    }
    if (flow?.step === 4) return { title: tv.st.assign, detail: latest?.effectiveFrom ? tv.st.validFrom(date(latest.effectiveFrom)) : "" }
    const live = current ?? upcoming
    if (live?.effectiveFrom) {
      return {
        title: tv.st.validFrom(date(live.effectiveFrom)),
        detail: [
          upcoming && current ? tv.stDetail.upcoming(date(upcoming.effectiveFrom)) : tv.stDetail.nothingPrepared,
          live.responsiblePerson ? tv.stDetail.responsible(live.responsiblePerson.fullName) : "",
        ].filter(Boolean).join(" · "),
      }
    }
    return { title: tv.st.nothing, detail: "" }
  })()

  /*
   * Pred zverejnením (Q2, Q4): štyri riadky, vždy rovnaké. Právny základ
   * určuje zodpovedná osoba alebo správca obsahu (D155) — `canSetLegalBasis()`
   * rozhoduje o „Určiť"; formulár sa otvorí v karte (`?open=draftBasis`).
   */
  type CheckState = "ok" | "wait" | "todo" | "off" | "bad"
  interface Check {
    key: string
    title: string
    state: CheckState
    sub?: string
    note?: string
    tag?: string
    action?: { href: string; label: string }
    panel?: ReactNode
  }
  const readerIsResponsible = Boolean(d.draftResponsible && d.draftResponsible.personId === ctx.person.id && draftResponsibleActive)
  const checks: Check[] = !flow || flow.step === 4 ? [] : [
    flow.step >= 3
      ? { key: "approval", title: tv.chk.approval, state: "ok",
          sub: approvedRound ? tv.chk.approvalDone(approvedRound.round, date(approvedRound.closedAt ?? approvedRound.submittedAt)) : undefined }
      : flow.step === 2 && running
        ? { key: "approval", title: tv.chk.approval, state: "wait",
            sub: tv.chk.approvalWaiting(decided, running.approvers.length, pendingNames || "—") }
        : { key: "approval", title: tv.chk.approval, state: "off",
            sub: draftRounds.length > 0 || flow.rejected ? tv.chk.approvalNoneRound(nextRound) : tv.chk.approvalNone },
    {
      key: "responsible",
      title: tv.chk.responsible,
      state: d.draftResponsible ? "ok" : "todo",
      sub: d.draftResponsible
        ? `${d.draftResponsible.fullName}${readerIsResponsible ? ` ${tv.chk.you}` : ""}`
        : tv.chk.responsibleNone,
      // V kroku 1 je výber priamo vo formulári, v kroku 3 je „Zmeniť" v päte.
      action: flow.step === 2
        ? { href: `${base}?open=draftResponsible#chk-responsible`, label: d.draftResponsible ? tv.change : tv.set }
        : undefined,
      panel: flowOpen === "draftResponsible" && flow.step >= 2 ? (
        <form action={setDraftResponsibleAction} className="chk-form">
          <input type="hidden" name="documentId" value={d.documentId} />
          <ResponsiblePicker people={responsibleChoices} language={language} exclude={d.draftResponsible?.personId} />
          <div className="more-acts">
            <SubmitButton className="button button--quiet">{tv.saveResponsible}</SubmitButton>
            <Link href={`${base}#chk-responsible`}>{tv.close}</Link>
          </div>
        </form>
      ) : undefined,
    },
    {
      key: "basis",
      title: tv.chk.basis,
      state: d.draftLegalBasis ? "ok" : "todo",
      tag: d.draftLegalBasis ? undefined : tv.chk.basisUnset,
      sub: d.draftLegalBasis && draftBasisLabel
        ? `${draftBasisLabel} · ${tv.chk.basisSetBy(nameOf(d.draftLegalBasis.by), date(d.draftLegalBasis.at))}`
        : readerIsResponsible ? tv.chk.basisByYou
        : !d.draftResponsible ? tv.chk.basisNoResponsible
        : !draftResponsibleActive ? tv.chk.basisGone
        : tv.chk.basisByOther(d.draftResponsible.fullName),
      note: tv.chk.basisNotApproval,
      action: canSetDraftBasis && d.draftMarkdown
        ? { href: `${base}?open=draftBasis#chk-basis`, label: d.draftLegalBasis ? tv.change : tv.set }
        : undefined,
      panel: flowOpen === "draftBasis" && canSetDraftBasis && d.draftMarkdown ? (
        <div className="chk-form">
          <LegalBasisForm
            documentId={d.documentId}
            draft
            quiet
            currentKeys={(d.draftLegalBasis?.entries ?? []).map(e => e.key ?? "").filter(Boolean)}
            options={basisOptions}
            language={language}
            back="library"
          />
          <Link href={`${base}#chk-basis`}>{tv.close}</Link>
        </div>
      ) : undefined,
    },
    {
      key: "effective",
      title: tv.chk.effective,
      state: draftEffectiveFrom ? "ok" : "todo",
      sub: draftEffectiveFrom ? tv.chk.effectiveMeta(date(draftEffectiveFrom)) : tv.chk.effectiveMissing,
    },
  ]

  /* História karty postupu: kolá od posledného zverejnenia, základ v príprave, archivácia. */
  const flowEvents: TimelineEvent[] = sortTimeline([
    ...[...rounds.values()].flat()
      .filter(r => !lastPublishedAt || new Date(r.submittedAt) > lastPublishedAt)
      .flatMap(roundEvents),
    ...(d.draftLegalBasis && draftBasisLabel
      ? [{ kind: "basis" as const, at: new Date(d.draftLegalBasis.at), who: d.draftLegalBasis.by, detail: draftBasisLabel }]
      : []),
    ...(archive.archived ? [{
      kind: "archived" as const, at: new Date(archive.entry.at), who: archive.entry.by,
      reason: (archive.entry as ArchiveEntry).reason,
    }] : []),
  ])
  const flowTimelineShown = Boolean(flow && flow.step !== 4 && timelineWorthShowing(flowEvents))

  /* Inšpektor: údaje o dokumente a súbory. */
  const docRows: [string, ReactNode][] = [
    [tv.rows.category, codeLabel("category", d.category)],
    [tv.rows.folder, folderName],
    [tv.rows.tags, d.tags.map(tag => codeLabel("tags", tag)).join(", ")],
    [tv.rows.access, codeLabel("accessLevel", d.accessLevel)],
    [tv.rows.language, codeLabel("language", d.language)],
    [tv.rows.origin, d.source?.type === "mcp" ? tv.originConnector(d.source.connectorName) : tv.originManual],
    [tv.rows.identifier, <code key="id">{d.documentId}</code>],
  ]
  const textRows: { label: string; file: VersionFile; download?: boolean; note?: string }[] = [
    ...(hasChangesToPublish && d.draftPdf ? [{ label: tv.files.draftPdf, file: d.draftPdf, note: tv.draftPdfNote }] : []),
    ...(hasChangesToPublish && d.draftSource ? [{ label: tv.files.draftSource, file: d.draftSource, download: true }] : []),
    ...(shown?.pdf ? [{ label: tv.files.pdf, file: shown.pdf }] : []),
    ...(shown?.source ? [{ label: tv.files.source, file: shown.source, download: true, note: tv.sourceNote }] : []),
    ...(d.originalFile ? [{
      label: tv.files.original,
      file: d.originalFile as unknown as VersionFile,
      note: tv.uploaded(nameOf(d.originalFile.uploadedBy), formatDate(d.originalFile.uploadedAt, language)),
    }] : []),
  ]

  return (
    // Úprava má vlastnú adresu a cesta ju pomenuje (DESIGN_ODCHYLKY R4).
    <AppShell language={ctx.person.language} title={editDocument ? tflow.editDocument : d.title}
              trail={editDocument ? { [base]: d.title } : undefined}>
    <div className="detail-page" style={tenantStyle(branding)}>
      <Notice language={language} message={message} error={error === "1"} back={base} />
      {editDocument && faqChannels.length > 0 && (
        <p className="quiet" style={{ margin: "0 0 12px" }}>
          {dictionary(language).channels.faqBelongsTo(faqChannels.map(ch => ch.name).join(", "))}{" "}
          {faqChannels.map(ch => <Link key={ch.key} href={`/channels/${encodeURIComponent(ch.key)}/faq`}>{ch.name}</Link>)}
        </p>
      )}

      {/*
        Úprava dokumentu ako samostatný pohľad (rám KNIZNICA-uprava-dokumentu):
        na `/library/[id]/edit` sa hlavný stĺpec nahradí formulárom — karta
        nového znenia, platné znenie ani Správa sa nekreslia. Úseky ako pri
        nahratí; priečinok je v tom istom formulári (Q2).
      */}
      {editDocument ? (
        <>
          <p className="quiet detail-lead" style={{ margin: 0 }}>{d.title}</p>
          <h1 className="page-title">{tflow.editDocument}</h1>
          <div className="detail-grid">
            <form action={saveDocumentMetadataAction} className="detail-main edit-form" id="document-data">
              <input type="hidden" name="documentId" value={d.documentId} />

              <section className="form-group form-group--lg">
                <h2 className="form-group-head form-group-head--step"><span className="assign-step" aria-hidden="true">1</span>{tflow.secBasic}</h2>
              <div className="card form-group-body">
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
              </div>
              </section>

              <section className="form-group form-group--lg">
                <h2 className="form-group-head form-group-head--step">
                  <span className="assign-step" aria-hidden="true">2</span>{tflow.secPlacement}
                  <span className="upload-step-opt">{tflow.optional}</span>
                </h2>
              <div className="card form-group-body">
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

                  {/* Značky ako riadky s kruhom a pole novej značky (ZAKLAD-vyber-skupin-
                      a-znaciek, 8. 10. 2026). Podobnú novú server nezaloží
                      a vráti `?similar=&like=` (Q3). */}
                  <div className="upload-wide" id="tags">
                    <ValueSelect
                      kind="tags"
                      name="tags"
                      legend={t.tags}
                      options={withCodelistNote(tagChoices, language)}
                      selected={query.pick === "like" && query.like ? [...d.tags, query.like] : d.tags}
                      prefillNew={query.pick === "new" ? query.similar : undefined}
                      forced={query.pick === "new" ? query.similar : undefined}
                      language={language}
                      warning={query.pick ? undefined : (
                        <SimilarWarning href={`/library/${encodeURIComponent(d.documentId)}/edit`} anchor="tags" kind="tags" language={language}
                                        similar={query.similar} like={query.like} likeLabel={tagChoices.find(o => o.value === query.like)?.label} />
                      )}
                    />
                  </div>
                </div>
              </div>
              </section>

              {/* Identifikátor len na čítanie (bod 3). */}
              <p className="detail-block-small">
                {t.keyNoteBefore}<code>{d.documentId}</code>{t.keyNoteAfter}
              </p>

              <div className="set-savebar edit-savebar">
                <SubmitButton className="button">{t.save}</SubmitButton>
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
                  <li><Link href={hasChangesToPublish ? `${base}#flow` : `${base}?open=history#current`}>{tflow.elsewhereMeta}</Link></li>
                  <li><Link href={`${base}?open=responsible#current`}>{tflow.elsewhereResponsible}</Link></li>
                  <li><Link href={`${base}/text`}>{tflow.elsewhereText}</Link></li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      ) : (
      <>
      {/*
        Hlavička (KNIZ-detail-dokumentu, 12. 10. 2026, Q6): názov a **jeden**
        štítok stavu. Pod ním drobne druh, priečinok, účinnosť a identifikátor.
        Štítok spracovania len počas behu alebo pri chybe — „prevedené,
        nepublikované" správcovi nepovie nič, čo by mal urobiť.
      */}
      <div className="page-head doc-head">
        <div className="page-head-main">
          <h1 className="page-title">
            {d.title}{" "}
            <span className={stateClass[stateKey]}>{tv.state[stateKey]}</span>
            {d.processingState === "uploaded" && <> <span className="tag tag--review">{tv.processingRunning}</span></>}
            {d.processingState === "failed" && <> <span className="tag tag--error">{tv.processingFailed}</span></>}
          </h1>
          <p className="page-lead doc-headline">
            {metaParts.map((part, i) => <span key={i}>{part}</span>)}
            <code>{d.documentId}</code>
          </p>
        </div>
        <div className="page-tools">
          {/* Upraviteľný zdroj platného znenia (.docx a pod.) — predloha pre ďalšie znenie (ADR-011).
              Ponuka len pri dvoch súboroch; pri jedinom priamy odkaz (KNIZNICA-akcie-dokumentu Q1, KNIZ Q9). */}
          {shown?.pdf && shown.source ? (
            <details className="mc-menu doc-menu">
              <summary className="button button--quiet doc-tool" aria-label={tflow.download} title={tflow.download}>
                <Icon name="download" size={18} /><span className="doc-tool-text">{tflow.download} <span aria-hidden="true">▾</span></span>
              </summary>
              <div className="mc-menu-list">
                <a href={`/api/library/file/${encodeURIComponent(shown.pdf.id)}`} target="_blank" rel="noreferrer">
                  {tflow.downloadPdfItem}
                  <small>{[shown.label, shown.pdf.bytes ? formatSize(shown.pdf.bytes) : ""].filter(Boolean).join(" · ")}</small>
                </a>
                <a href={`/api/library/file/${encodeURIComponent(shown.source.id)}?download=1`} download={shown.source.name}>
                  {tflow.downloadSourceItem}
                  <small>{[fileExtension(shown.source.name), shown.source.bytes ? formatSize(shown.source.bytes) : ""].filter(Boolean).join(" · ")}</small>
                </a>
              </div>
            </details>
          ) : shown?.pdf ? (
            <a className="button button--quiet doc-tool" href={`/api/library/file/${encodeURIComponent(shown.pdf.id)}`}
               target="_blank" rel="noreferrer" aria-label={tflow.downloadPdf} title={tflow.downloadPdf}>
              <Icon name="download" size={18} /><span className="doc-tool-text">{tflow.downloadPdf}</span>
            </a>
          ) : null}
          <Link className="button button--quiet doc-tool" href={`${base}/edit`} aria-label={tflow.editDocument} title={tflow.editDocument}>
            <Icon name="edit" size={18} /><span className="doc-tool-text">{tflow.editDocument}</span>
          </Link>
          {/*
            Hlavná akcia podľa kroku (Q6), posledná ako v `toolbar`. Kým sa
            znenie pripravuje, nové sa začať nedá — namiesto zošedeného
            tlačidla je tichý odkaz na kartu postupu, kde je ďalší krok; plné
            tlačidlo kroku je tam (R2). FAQ (ADR-028) má editor záznamov,
            dostupný vždy. Archivovaný predpis nové znenie mať smie (ADR-025).
          */}
          {isFaq ? (
            <Link className="button doc-primary" href={`${base}/faq`}>{tfaq.editEntries}</Link>
          ) : flow?.step === 1 ? (
            <Link className="button button--quiet doc-primary" href="#flow">{tflow.continuePrep}</Link>
          ) : flow?.step === 2 ? (
            <Link className="button button--quiet doc-primary" href="#flow">{tv.statusLink}</Link>
          ) : flow?.step === 3 ? (
            <Link className="button button--quiet doc-primary" href="#flow">{tv.publishLink}</Link>
          ) : (
            <Link className={flow?.step === 4 ? "button button--quiet doc-primary" : "button doc-primary"} href={newVersionHref}>
              {latest ? tflow.newVersion : tflow.uploadFirst}
            </Link>
          )}
        </div>
      </div>

      {/* Zlyhané spracovanie — hláška s tichým úkonom (tabuľka „Ostatné stavy"). */}
      {d.processingState === "failed" && (
        <div className="lnote lnote--bad doc-failed" role="note">
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{tv.processingFailedNote}</span>
          <form action={reindexDocumentAction}>
            <input type="hidden" name="documentId" value={d.documentId} />
            <SubmitButton className="button button--quiet button--sm">{tv.processAgain}</SubmitButton>
          </form>
        </div>
      )}

      {/*
        Úloha zodpovednej osoby zverejneného znenia, ktorá základ ešte neurčila
        (ADR-023, D151). Hore, lebo sem ju posiela zvonček.
      */}
      {versionBasisTasks(ctx.person.id, d.versions, d.effectiveVersionId ?? null)
        .filter(task => !task.version.legalBasis)
        .map(task => (
          <VersionBasisCard key={task.version.versionId} documentId={d.documentId} version={task.version}
                            upcoming={task.upcoming} options={basisOptions} language={language} quiet />
        ))}

      {/*
        Jedna stránka a inšpektor (Q1, SwiftUI `.inspector`): vľavo, čo sa
        s dokumentom robí; vpravo od 1024 px súhrn, ktorý sa nemení. Pod
        1024 px je Stav hneď pod hlavičkou a zvyšok inšpektora dole — poradie
        určuje `grid-template-areas`, nie poradie v kóde.
      */}
      <div className="doc-grid">
        <section className="card doc-stat" aria-labelledby="doc-stat-title">
          <h2 className="insp-title" id="doc-stat-title">{tv.stateHeading}</h2>
          <b>{statusLine.title}</b>
          {statusLine.detail && <span>{statusLine.detail}</span>}
          {faqChannels.length > 0 && (
            <span>
              {dictionary(language).channels.faqBelongsTo(faqChannels.map(ch => ch.name).join(", "))}{" "}
              {faqChannels.map(ch => <Link key={ch.key} href={`/channels/${encodeURIComponent(ch.key)}/faq`}>{ch.name}</Link>)}
            </span>
          )}
        </section>

        <div className="doc-main">

      {flow && (
      <section className="card flow" id="flow">
        <div className="flow-head">
          <h2>{flowHeading}</h2>
          <span className="quiet">{flowStatus}</span>
        </div>
        <FlowSteps states={flow.states} names={tflow.steps} subs={flowSubs} label={tflow.stepOf(flow.step)} />

        {/* Pás zamietnutého kola — kto, kedy, dôvod a čo ďalej. */}
        {flow.step === 1 && flow.rejected && (
          <div className="flow-body flow-band">
            <div className="lnote lnote--bad" role="note">
              <span className="lnote-mark" aria-hidden="true">✕</span>
              <div className="lnote-text doc-band-text">
                <b>
                  {rejectedBy(flow.rejected)
                    ? tflow.rejectedBy(rejectedBy(flow.rejected)!.fullName, date(rejectedBy(flow.rejected)!.decidedAt), flow.rejected.round)
                    : tflow.cancelled(date(flow.rejected.closedAt ?? flow.rejected.submittedAt), flow.rejected.round)}
                </b>
                {rejectedBy(flow.rejected)?.reason && <q className="quote">{rejectedBy(flow.rejected)!.reason}</q>}
                <span>{tv.rejectedNext(nextRound)}</span>
              </div>
            </div>
          </div>
        )}
        {/* Zrušené kolo je sivé, nie červené: nikto nič nevytkol (ADR-006, dodatok 12. 10. 2026). */}
        {flow.step === 1 && flow.cancelled && (
          <div className="flow-body flow-band">
            <div className="lnote lnote--info" role="note">
              <span className="lnote-mark" aria-hidden="true">–</span>
              <div className="lnote-text doc-band-text">
                <b>{tflow.cancelled(date(flow.cancelled.closedAt ?? flow.cancelled.submittedAt), flow.cancelled.round)}</b>
                {cancelInfo(flow.cancelled.note).reason && <q className="quote">{cancelInfo(flow.cancelled.note).reason}</q>}
              </div>
            </div>
          </div>
        )}

        {/* ── Teraz: telo kroku (Q2) ── */}
        <div className="flow-body">
          <h3 className="flow-sec-title">
            {tv.now}{" "}
            <span className="quiet">
              {flow.step === 2 && running ? `${tflow.steps[1]} · ${tv.roundOf(running.round, decided, running.approvers.length)}` : tflow.steps[flow.step - 1]}
            </span>
          </h3>

          {/* Krok 1 — formulár prípravy. Tlačidlá sú v päte karty (`form="flow-step"`),
              aby „Pred zverejnením" mohlo stáť medzi nimi bez vnorených formulárov. */}
          {flow.step === 1 && (
            <form action={prepareDraftAction} id="flow-step" className="flow-form">
              <input type="hidden" name="documentId" value={d.documentId} />
              <input type="hidden" name="versionLabel" value={t.approvalDraftLabel} />
              {!metaIsLocked && <input type="hidden" name="metaEditable" value="1" />}
              <p className="flow-lead">{flow.rejected ? tflow.lead1Rejected : flow.cancelled ? tflow.lead1Cancelled : tflow.lead1}</p>

              <div className="flow-check">
                <div className="flow-check-row">
                  <span className={`flow-check-ico ${d.draftPdf ? "is-ok" : "is-todo"}`} aria-hidden="true">{d.draftPdf ? "✓" : "!"}</span>
                  <div className="flow-check-main">
                    {d.draftPdf
                      ? <>{tflow.checkPdf} — <FileLink file={d.draftPdf} /></>
                      : tflow.checkPdfMissing}
                    {d.draftPdf?.bytes ? <div className="flow-check-note">{formatSize(d.draftPdf.bytes)}</div> : null}
                  </div>
                  <Link className="button button--quiet button--sm" href={newVersionHref}>{tflow.replace}</Link>
                </div>
                <div className="flow-check-row">
                  <span className={`flow-check-ico ${d.draftSource ? "is-ok" : "is-opt"}`} aria-hidden="true">{d.draftSource ? "✓" : "–"}</span>
                  <div className="flow-check-main">
                    {d.draftSource ? <>{tflow.checkSource} — <FileLink file={d.draftSource} download /></> : tflow.checkSource}
                    <div className="flow-check-note">{d.draftSource ? tflow.checkSourceNote : tflow.checkSourceMissing}</div>
                  </div>
                  <Link className="button button--quiet button--sm" href={`${base}/text`}>{tflow.showText}</Link>
                </div>
              </div>

              {/* Názov dokumentu (ADR-015, D112): pri platnom znení sa mení len novým znením. */}
              {latest && (
                <label className="field">
                  <span className="field-label">{t.title}</span>
                  {!metaIsLocked && <input type="hidden" name="titleEditable" value="1" />}
                  <input className="field-input" name="title" required disabled={metaIsLocked}
                         defaultValue={d.draftTitle ?? d.title} />
                  <span className="quiet field-hint">{tflow.titleNote}</span>
                </label>
              )}

              {/* Údaje o znení (ADR-013) — pred schvaľovaním, lebo sú jeho súčasťou. */}
              <div id="version-meta" style={{ display: "grid", gap: 10 }}>
                <h4 className="flow-section-title">{tflow.metaHeading}</h4>
                {metaVoidsApproval && <p className="detail-block-note">{tm.voidsApproval}</p>}
                {metaIsLocked
                  ? <p className="detail-block-note">{tm.locked}</p>
                  : !d.draftMeta?.effectiveFrom && (
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
                  requireEffectiveFrom
                />
              </div>

              {/* Schvaľovatelia predvyplnení z posledného kola (ADR-014, D110). */}
              <fieldset className="form-group form-group--required">
                <legend className="form-group-head">{draftRounds.length > 0 || flow.rejected ? tv.approversRound(nextRound) : tflow.approvers}</legend>
                <div className="card form-group-body form-group-body--rows">
                {approverChoices.length === 0 ? (
                  <p className="quiet">{t.approvalNoPeople}</p>
                ) : (
                  <PeopleSearch
                    people={approverChoices}
                    name="approver"
                    language={language}
                    multiple
                    defaultSelected={approverChoices.filter(p => prefilledApprovers.has(p.id)).map(p => p.id)}
                    listLabel={tflow.approvers}
                    missing="approvers"
                  />
                )}
                </div>
                <p className="form-group-foot quiet">{tflow.approversPrefilled}</p>
              </fieldset>

              {/* Zodpovedná osoba už v príprave (ADR-014, D109) — nepovinná tu, povinná pri zverejnení. */}
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
            </form>
          )}

          {/* Krok 2 — schvaľovatelia so stavom a jeden riadok zámku. „Čo sa
              schvaľuje" a „Potom" sa rušia: to isté hovorí krokovník (Q2). */}
          {flow.step === 2 && running && (
            <>
              <ul className="chk-list">
                {running.approvers.map(a => {
                  const state = a.decision === "approved" ? "ok" : a.decision === "rejected" ? "bad" : "wait"
                  return (
                    <li key={a.email} className="chk">
                      <span className={`chk-ico is-${state}`} aria-hidden="true">{state === "ok" ? "✓" : state === "bad" ? "✕" : "◷"}</span>
                      <span className="chk-main">
                        <b>{a.fullName}</b>
                        <small>
                          {[departmentOf.get(a.email.toLowerCase()),
                            a.decision === "approved" && a.decidedAt ? t.approvalApproved(date(a.decidedAt))
                              : a.decision === "rejected" && a.decidedAt ? t.approvalRejected(date(a.decidedAt))
                              : t.approvalWaiting].filter(Boolean).join(" · ")}
                        </small>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="flow-locked"><span aria-hidden="true">🔒</span> <b>{tv.lockedLine}</b> <span className="quiet">{tv.lockedNote}</span></p>
              {d.draftTitle && <p className="detail-block-note">{tflow.newTitle(d.draftTitle)}</p>}
              <p className="detail-block-small">{tflow.approvalsWhere}</p>
            </>
          )}

          {/* Krok 3 — zverejnenie. Tlačidlo v päte karty (`form="flow-step"`). */}
          {flow.step === 3 && (
            <form action={publishVersionAction} id="flow-step" className="flow-form">
              <input type="hidden" name="documentId" value={d.documentId} />
              <p className="flow-lead">{tflow.lead3}</p>

              {/* Dátum účinnosti je v schválených údajoch o znení (ADR-013).
                  Pole zostáva len pre koncept spred ADR-013. */}
              {!draftEffectiveFrom && (
                <label className="field">
                  <span className="field-label">{t.effectiveFrom}</span>
                  <input className="field-input" type="date" name="effectiveFrom" required />
                  <span className="quiet field-hint">{t.effectiveFromNote}</span>
                </label>
              )}

              <label className="field">
                <span className="field-label">{t.changeNote}</span>
                <input className="field-input" name="changeNote" placeholder={t.changeNotePlaceholder} />
              </label>

              {/* Bez zodpovednej osoby sa zverejniť nedá — výber priamo vo formulári. */}
              {!d.draftResponsible && <ResponsiblePicker people={responsibleChoices} language={language} />}

              {/* Prenos pridelení ako voľba pri zverejnení (ADR-014, D111). */}
              {draftCarryOver.length > 0 && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div className="card form-group-body form-group-body--rows">
                    <div className="form-list">
                      <label className="form-row">
                        <input type="checkbox" role="switch" className="toggle" name="carryOver" value="1" defaultChecked />
                        <span className="form-row-main">
                          <span>{tflow.carryOver(draftCarryOver.length)}</span>
                          <span className="form-row-sub">{tflow.carryOverNote}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div data-carry-over style={{ display: "grid", gap: 12 }}>
                    <CarryOverFields
                      candidates={draftCarryOver}
                      reason={reasonFor(labelSuggestion, draftCarryOver)}
                      language={language}
                    />
                  </div>
                </div>
              )}
            </form>
          )}

          {/* Krok 4 — prenos pridelení samostatne. */}
          {flow.step === 4 && (
            <form action={carryOverAssignmentsAction} id="flow-step" className="flow-form">
              <input type="hidden" name="documentId" value={d.documentId} />
              <p className="flow-lead">{tflow.lead4} {tc.intro(carryOverVersion?.label ?? d.effectiveLabel)}</p>
              <CarryOverFields
                candidates={carryOver}
                reason={reasonFor(carryOverVersion?.label ?? "", carryOver)}
                language={language}
              />
            </form>
          )}
        </div>

        {/*
          Pred zverejnením (Q2): štyri veci, ktoré musia sedieť, vždy na tom
          istom mieste. Nevyriešený alebo meniteľný riadok má tiché tlačidlo
          44 px. Formuláre panelov sú súrodenci formulára kroku, nie jeho
          deti — preto tlačidlá kroku nesú `form="flow-step"`.
        */}
        {flow.step !== 4 && (
          <div className="flow-body" id="before-publish">
            <h3 className="flow-sec-title">
              {tv.beforePublish} <span className="quiet">{tv.doneOf(checks.filter(c => c.state === "ok").length, checks.length)}</span>
            </h3>
            <ul className="chk-list">
              {checks.map(c => (
                <li key={c.key} className={`chk${c.panel ? " is-open" : ""}`} id={`chk-${c.key}`}>
                  <span className={`chk-ico is-${c.state}`} aria-hidden="true">
                    {c.state === "ok" ? "✓" : c.state === "wait" ? "◷" : c.state === "todo" ? "!" : c.state === "bad" ? "✕" : ""}
                  </span>
                  <span className="chk-main">
                    <b>{c.title}{c.tag && <> <span className="tag tag--draft">{c.tag}</span></>}</b>
                    {c.sub && <small>{c.sub}</small>}
                    {c.note && <small>{c.note}</small>}
                  </span>
                  {c.action && !c.panel && (
                    <Link className="button button--quiet chk-act" href={c.action.href}>{c.action.label}</Link>
                  )}
                  {c.panel && <div className="chk-panel">{c.panel}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Päta: plné tlačidlo kroku (R2) a tiché úkony kroku ako tlačidlá, nie rozbaľovačky. */}
        {flow.step === 1 && (
          <div className="flow-foot">
            <SubmitButton className="button" name="intent" value="submit" form="flow-step">
              {draftRounds.length > 0 ? tflow.resubmit(nextRound) : tflow.submitAndSave}
            </SubmitButton>
            <SubmitButton className="button button--quiet" name="intent" value="save" form="flow-step">{tflow.saveOnly}</SubmitButton>
          </div>
        )}
        {flow.step === 2 && running && (
          withdrawing ? (
            /* Stiahnuť kolo (Q3, `confirmationDialog`): potvrdenie v adrese, povinný dôvod. */
            <form action={cancelApprovalAction} className="more-confirm flow-confirm" id="withdraw">
              <input type="hidden" name="documentId" value={d.documentId} />
              <input type="hidden" name="versionId" value={draftVersionId ?? ""} />
              <h3>{tv.withdrawTitle(running.round)}</h3>
              <ul className="flow-effects">
                <li>{tv.withdrawBack}</li>
                {pendingNames && <li>{tv.withdrawTasks(pendingNames)}</li>}
                <li>{tv.withdrawCancelled}</li>
              </ul>
              <label className="field">
                <span className="field-label">{tv.withdrawReason}</span>
                <textarea className="field-input" name="reason" rows={2} required placeholder={tv.withdrawReasonHint} />
              </label>
              <div className="more-acts">
                <SubmitButton className="button button--danger">{tflow.withdraw}</SubmitButton>
                <Link className="button button--quiet" href={`${base}#flow`}>{tv.close}</Link>
              </div>
            </form>
          ) : (
            <div className="flow-foot">
              <Link className="button button--quiet" href={`${base}?withdraw=1#withdraw`}>{tv.withdrawOpen}</Link>
              <span className="quiet">{tv.withdrawHint}</span>
            </div>
          )
        )}
        {flow.step === 3 && (
          <div className="flow-foot">
            <PublishSubmit
              form="flow-step"
              withCarryOver={draftCarryOver.length > 0}
              labels={{
                publish: draftEffectiveFrom ? tflow.publishFrom(date(draftEffectiveFrom)) : t.publish,
                publishAndAssign: tflow.publishAndAssign,
              }}
            />
            {d.draftResponsible && flowOpen !== "draftResponsible" && (
              <Link className="button button--quiet" href={`${base}?open=draftResponsible#chk-responsible`}>{tv.changeResponsible}</Link>
            )}
          </div>
        )}
        {flow.step === 4 && (
          <div className="flow-foot">
            <SubmitButton className="button" form="flow-step">{tflow.assignChosen}</SubmitButton>
            <Link href={assignHref([d.documentId])}>{tflow.assignElsewhere}</Link>
          </div>
        )}

        {/* História ako časový rad (Q5) — vždy viditeľná, posledných päť. */}
        {flowTimelineShown && (
          <div className="flow-body flow-history" id="history">
            <h3 className="flow-sec-title">{tv.history}</h3>
            {timeline(flowEvents, historyAll, `${base}?history=all#history`, `${base}#history`)}
          </div>
        )}
      </section>
      )}

      {/* ── Znenia (Q7, SwiftUI `List`): novela vopred, platné rozbalené, staršie po riadku ── */}
      {(current || upcoming || olderVersions.length > 0) ? (
        <section className="card versions" id="versions">
          <div className="versions-head">
            <h2>{tv.versions}</h2>
            <span className="quiet">{d.versions.length}</span>
          </div>
          {upcoming && versionBlock(upcoming, `v-${upcoming.versionId}`, tv.validTag(date(upcoming.effectiveFrom)), "tag tag--review")}
          {current && versionBlock(current, "current", tv.current, "tag tag--published")}
          {olderVersions.length > 0 && (
            <div className="older" id="older">
              <ul className="older-list">
                {olderShown.map(v => {
                  const panel = panelOf(v)
                  const acks = ackByVersion.get(v.versionId) ?? 0
                  const from = v.effectiveFrom ? date(v.effectiveFrom) : t.noEffectiveDate
                  return (
                    <li key={v.versionId} className={`older-row${panel ? " is-open" : ""}`} id={`v-${v.versionId}`}>
                      <div className="o-dates">
                        {v.effectiveTo ? tflow.older.range(from, date(v.effectiveTo)) : from}
                        {v.publishedAt && <small>{tflow.older.published(date(v.publishedAt))}</small>}
                      </div>
                      <div className="o-main">
                        <div className="o-label">{v.label}</div>
                        {v.changeNote && <div className="o-change">{v.changeNote}</div>}
                        <div className="o-who-inline">
                          {olderWho(v)} · {olderBasis(v)}
                          <span className="o-acks-inline"> · {acks ? tflow.older.ackCount(acks) : tflow.older.noAcks}</span>
                        </div>
                      </div>
                      <div className="o-who">{olderWho(v)}<small>{olderBasis(v)}</small></div>
                      <div className="o-acks">{acks || "—"}<small>{tflow.older.acks}</small></div>
                      <div className="o-actions">
                        {v.pdf && <FileLink file={v.pdf} label="PDF" className="o-pdf" />}
                        <details className="more">
                          <summary aria-label={tflow.older.more} title={tflow.older.more}>
                            <span aria-hidden="true">•••</span>
                          </summary>
                          <div className="more-menu">
                            {versionPanels(v).map(p => (
                              <Fragment key={p}>
                                {p === "history" && <hr />}
                                {panelLink(v, p)}
                              </Fragment>
                            ))}
                          </div>
                        </details>
                      </div>
                      {panel && (
                        <div className="older-panel">
                          <div className="older-panel-head">
                            <strong>{panelLabel[panel]}</strong>
                            <span className="quiet">{v.label}</span>
                            <Link href={olderClose(v)}>{tflow.older.close}</Link>
                          </div>
                          {versionPanel(v)}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {!olderAll && olderVersions.length > OLDER_SHOWN && (
                <div className="older-more">
                  <Link href={`${base}?older=all#older`}>{tflow.older.showAll(olderVersions.length)}</Link>
                </div>
              )}
            </div>
          )}
        </section>
      ) : !flow && (
        <p className="card" style={{ padding: 18, fontSize: "var(--fs-lead)", margin: 0 }}>
          {t.nothingPublished}
        </p>
      )}

      {/*
        Ďalšie akcie (Q8) — len úkony nad celým dokumentom, jedna veta
        a tiché tlačidlo. Súbory sú v inšpektore, „Opraviť text" pri znení.
        Archivácia je jediná `.button--danger` a jej formulár sa otvorí až
        adresou `?archive=1` (ADR-025, D156).
      */}
      <section className="card more doc-more" id="more">
        <div className="more-head"><h2>{dictionary(language).common.moreActions}</h2></div>

        <form action={reindexDocumentAction} className="more-row">
          <input type="hidden" name="documentId" value={d.documentId} />
          <div className="more-main">
            <b>{t.reindexHeading}</b>
            <span>{tv.reindexAllNote}</span>
          </div>
          <SubmitButton className="button button--quiet">{tv.reindexShort}</SubmitButton>
        </form>

        {/* Pôvod z MCP konektora (ADR-029, použitie B): kontrola zmien v zdroji. */}
        {d.source && d.source.type === "mcp" && (
          <form action={resyncConnectorDocumentAction} className="more-row" id="source">
            <input type="hidden" name="documentId" value={d.documentId} />
            <div className="more-main">
              <b>{tci.resync}</b>
              <span>{tci.sourceLine(d.source.connectorName, d.source.group, formatDate(new Date(d.source.fetchedAt), language))}</span>
              <span><code>{d.source.externalId}</code></span>
            </div>
            <SubmitButton className="button button--quiet">{tci.resync}</SubmitButton>
          </form>
        )}

        {/* Archivovaný predpis: obnovenie je tiché a vratné, bez potvrdenia (ADR-025). */}
        {archive.archived && (
          <form action={restoreDocumentAction} className="more-row" id="archive">
            <input type="hidden" name="documentId" value={d.documentId} />
            <div className="more-main">
              <b>{tflow.archive.restore}</b>
              <span>{(archive.entry as ArchiveEntry).reason}</span>
              <span>{tv.restoreNote}</span>
            </div>
            <SubmitButton className="button button--quiet" title={tflow.archive.restoreHint}>{tflow.archive.restore}</SubmitButton>
          </form>
        )}

        {/* Keď sa archivovať nedá, riadok povie prečo namiesto zošedeného tlačidla. */}
        {!archive.archived && (d.versions.length > 0 || flow) && (
          <>
            <div className="more-row" id="archive-form">
              <div className="more-main">
                <b>{tflow.archive.heading}</b>
                <span>
                  {archiveBlocked
                    ? `${tflow.archive.blocked} ${errorText(new AppError(`archive.${archiveBlocked}`, archiveBlocked), language)}`
                    : tflow.archive.intro}
                </span>
              </div>
              {!archiveBlocked && !archiving && (
                <Link className="button button--danger" href={`${base}?archive=1#archive-form`}>{tflow.archive.open}</Link>
              )}
            </div>
            {!archiveBlocked && archiving && (
              <form action={archiveDocumentAction} className="more-confirm doc-archive-confirm">
                <input type="hidden" name="documentId" value={d.documentId} />
                <h3>{tflow.archive.confirmHeading(d.title)}</h3>
                <label className="field">
                  <span className="field-label">{tflow.archive.until}</span>
                  <input className="field-input field-input--date" type="date" name="until" required
                         defaultValue={new Date().toISOString().slice(0, 10)} />
                  <span className="quiet field-hint">{tflow.archive.untilHint}</span>
                </label>
                <label className="field">
                  <span className="field-label">{tflow.archive.reason}</span>
                  <textarea className="field-input" name="reason" rows={2} required maxLength={500} placeholder={tflow.archive.reasonHint} />
                </label>
                <div className="more-acts">
                  <SubmitButton className="button button--danger">{tflow.archive.submit}</SubmitButton>
                  <Link className="button button--quiet" href={`${base}#more`}>{tflow.cancel}</Link>
                </div>
              </form>
            )}
          </>
        )}
      </section>
        </div>

        {/*
          Inšpektor — súhrn, nie ovládanie (Q1). Potvrdenia, údaje o dokumente
          (názvy z číselníkov, nie kódy) a súbory s textom. Úprava dokumentu
          je len v hlavičke.
        */}
        <aside className="doc-insp">
          <section className="insp-sec" aria-labelledby="insp-acks">
            <h2 className="insp-title" id="insp-acks">{ts.progressHeading}</h2>
            <div className="card insp-card">
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
                  {/* Pásik je obrázok toho istého čísla — `aria-hidden`, aby ho čítačka nečítala dvakrát. */}
                  <div className="detail-bar" aria-hidden="true">
                    <span className="detail-bar-fill" style={{ width: `${progress.percent}%` }} />
                  </div>
                  {/* Len personalista (D67) — správca obsahu do `/hr` nesmie. */}
                  {canSeeWho && current && (
                    <p className="detail-card-link">
                      <Link href={`/hr/overview?view=document&open=${encodeURIComponent(current.versionId)}`}>
                        {ts.progressWho}
                      </Link>
                    </p>
                  )}
                </>
              )}
              {canSeeWho && current && (
                <p className="detail-card-link">
                  <Link href={`/hr/assign?document=${encodeURIComponent(d.documentId)}`}>{ts.progressAssign}</Link>
                </p>
              )}
            </div>
          </section>

          <section className="insp-sec" aria-labelledby="insp-doc">
            <h2 className="insp-title" id="insp-doc">{tv.docHeading}</h2>
            <div className="card insp-rows">
              {docRows.map(([label, value]) => (
                <div className="labeled-row" key={label}>
                  <span>{label}</span>
                  <span>{value || ts.none}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="insp-sec" aria-labelledby="insp-text">
            <h2 className="insp-title" id="insp-text">{tv.textHeading}</h2>
            <div className="card insp-rows">
              {textRows.length === 0 && <p className="quiet insp-empty">{tv.noFiles}</p>}
              {textRows.map(row => (
                <div className="labeled-row" key={row.label}>
                  <span>{row.label}</span>
                  <span>
                    <FileLink file={row.file} download={row.download} />
                    {row.note && <small className="insp-note">{row.note}</small>}
                  </span>
                </div>
              ))}
              {d.conversion?.warnings?.length ? (
                <ul className="doc-warnings insp-warnings">
                  {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              ) : null}
              <div className="insp-foot">
                {isFaq
                  ? <Link className="button button--quiet button--sm" href={`${base}/faq`}>{tv.faqEntries}</Link>
                  : <Link className="button button--quiet button--sm" href={`${base}/text`}>{tv.editor}</Link>}
                <Link className="button button--quiet button--sm" href={`${base}/chunks`}>{tv.chunks}</Link>
              </div>
            </div>
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
function FileLink({ file, download = false, label, className }: { file: VersionFile; download?: boolean; label?: string; className?: string }) {
  const href = `/api/library/file/${encodeURIComponent(file.id)}${download ? "?download=1" : ""}`
  return (
    <a className={className} href={href} target={download ? undefined : "_blank"} rel="noreferrer" download={download ? file.name : undefined}>
      {label ?? file.name}
    </a>
  )
}

/** Veľkosť súboru pre človeka — „1,3 MB". */
/** Typ súboru z názvu pre ponuku Stiahnuť („DOCX"); bez prípony nič. */
function fileExtension(name: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name)
  return m ? m[1].toUpperCase() : ""
}

function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return mb >= 0.1 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`
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
      <fieldset className="form-group">
        <legend className="form-group-head">{tc.audiences}</legend>
        <div className="card form-group-body form-group-body--rows">
        <div className="form-list">
        {candidates.map(c => (
          <label key={audienceRef(c.audience)} className="form-row select-row">
            <input type="checkbox" name="audience" value={audienceRef(c.audience)} defaultChecked />
            <span className="form-row-main">{tc.previously(audienceLabel(c.audience), c.previousReason)}</span>
          </label>
        ))}
        </div>
        </div>
      </fieldset>

      <label className="field">
        <span className="field-label">{tc.reason}</span>
        <input className="field-input" name="reason" required defaultValue={reason} />
        <span className="quiet field-hint">{tc.reasonNote}</span>
      </label>

      <fieldset className="form-group">
        <legend className="form-group-head">{tc.due}</legend>
        {/* Tri voľby s fajkou vpravo, pole pod svojou voľbou — ten istý
            tvar ako na /hr/assign (ZAKLAD-vyber-a-prepinace). Meno `dueMode`
            a hodnoty none/date/days ako predtým výber zo zoznamu. Pole
            nezvolenej voľby skrýva len CSS, hodnota ostáva v DOM;
            `dueFromFields()` číta len to, ktoré patrí k zvolenému režimu. */}
        <div className="card form-group-body form-group-body--rows">
        <div className="form-list">
          <label className="form-row choice-row">
            <input type="radio" name="dueMode" value="none" defaultChecked />
            <span className="form-row-main">{tc.dueNone}</span>
          </label>
          <label className="form-row choice-row">
            <input type="radio" name="dueMode" value="date" />
            <span className="form-row-main">{tc.dueDate}</span>
          </label>
          <div className="choice-field">
            <input className="field-input" type="date" name="dueDate" defaultValue="" aria-label={tc.dueDate} />
          </div>
          <label className="form-row choice-row">
            <input type="radio" name="dueMode" value="days" />
            <span className="form-row-main">{tc.dueDays}</span>
          </label>
          <div className="choice-field">
            <input className="field-input" type="number" min={1} name="dueDays" defaultValue="" aria-label={tc.dueDaysUnit}
                   placeholder={tc.dueDaysUnit} />
          </div>
        </div>
        </div>
        <p className="form-group-foot quiet">{tc.dueNote}</p>
      </fieldset>
      <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0 }}>{tc.noEmailNote}</p>
    </>
  )
}

/**
 * Karta dokumentu pre **zodpovednú osobu bez roly správcu obsahu** (D151).
 *
 * Úloha určiť právny základ bola do 30. 9. 2026 na čitateľskej karte, lebo
 * sem nesmela. Teraz sem smie — ale vidí len svoje karty úlohy, nič z práce
 * správcu obsahu. Kto smie zapisovať, rozhodujú aj tak `setVersionLegalBasis()`
 * a `setDraftLegalBasis()` proti uloženému zneniu; táto stránka len neukáže
 * nič, čo by odmietli.
 *
 * `null`, keď osoba pri dokumente žiadnu úlohu nemá — volajúci ju potom pošle
 * na čitateľskú kartu ako doteraz.
 */
async function responsibleBasisPage(documentId: string, raw: RawQuery) {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") return null
  const person = ctx.person
  const [doc, draftTask] = await Promise.all([
    loadDocumentFor(person, documentId),
    draftBasisTaskFor(person, documentId),
  ])
  const effective = doc ? effectiveVersion(doc) : null
  const tasks = doc
    ? versionBasisTasks(person.id, doc.versions ?? [], effective?.ok ? effective.version.versionId : null)
    : []
  if (tasks.length === 0 && !draftTask) return null

  const query = normalizeQuery<{ msg?: string; error?: string }>(raw)
  const language = person.language
  const tr = dictionary(language).responsibility
  const options = legalBasisOptions(ctx.tenant)
  const title = doc?.title ?? draftTask!.title
  const many = tasks.length + (draftTask ? 1 : 0) > 1
  return (
    <AppShell language={language} title={title}>
      {/* KNIZNICA-akcie-dokumentu (8. 10. 2026): `.page-head` a `.page-narrow`
          namiesto inline šírky. Pri viacerých kartách tiché uloženie (R1, Q4). */}
      <div className="page-narrow" style={tenantStyle(brandingView(ctx.tenant))}>
        <Notice language={language} message={query.msg} error={query.error === "1"} back={`/library/${encodeURIComponent(documentId)}`} />
        <div className="page-head">
          <div className="page-head-main">
            <h1 className="page-title">{title}</h1>
            <p className="page-lead doc-lead">
              <span>{tr.basisPageLead}</span>
              {doc && <Link href={`/documents/${encodeURIComponent(documentId)}`}>{tr.basisPageRead}</Link>}
            </p>
          </div>
        </div>
        {tasks.map(task => (
          <VersionBasisCard key={task.version.versionId} documentId={documentId} version={task.version}
                            upcoming={task.upcoming} options={options} language={language} quiet={many} />
        ))}
        {draftTask && <DraftBasisCard task={draftTask} options={options} language={language} quiet={many} />}
      </div>
    </AppShell>
  )
}
