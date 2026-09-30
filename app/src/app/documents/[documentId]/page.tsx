/**
 * Dokument na prečítanie a potvrdenie.
 *
 * Dokument sa načítava **pre osobu** (`loadDocumentFor`), nie len podľa
 * identifikátora — inak by sa uhádnutím `documentId` dal otvoriť obsah cudzej
 * organizácie (D32). Neviditeľný dokument sa tvári ako neexistujúci.
 *
 * Znenie formulky sa skladá tu, na serveri, z toho istého zdroja ako pri zápise
 * (`buildStatement`). Človek teda vidí presne to, čo sa mu uloží — a nie podobný
 * text, ktorý by sa časom mohol rozísť s tým skutočným.
 */

import Link from "next/link"
import { basesOf } from "@/lib/versionResponsibility"
import VersionMetaLine from "@/components/VersionMetaLine"
import { initials } from "@/lib/initials"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { recordOpen } from "@/lib/documentOpens"
import { assignedAtByVersion } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { loadDocumentFor, effectiveVersion } from "@/lib/documents"
import { buildStatement, hasAcknowledged } from "@/lib/acknowledgements"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { acknowledgementDuties } from "@/lib/pending"
import { dueState } from "@/lib/due"
import AcknowledgeButton from "@/components/AcknowledgeButton"
import FormattedText from "@/components/FormattedText"
import PdfView from "@/components/PdfView"
import ReadingTimer from "@/components/ReadingTimer"
import Notice from "@/components/Notice"
import AppShell from "@/components/AppShell"
import { acknowledgeAction } from "./actions"
import { responsibleContact, draftBasisTaskFor, type DraftBasisTask } from "@/lib/versionResponsibilityDb"
import { canSetLegalBasis, legalBasisFields } from "@/lib/versionResponsibility"
import type { Version } from "@/lib/documents"
import type { ReactNode } from "react"
import { isContentManager } from "@/lib/library"
import LegalBasisForm from "@/components/LegalBasisForm"
import { legalBasisOptions } from "@/lib/legalBases"

export const dynamic = "force-dynamic"

// `params` aj `searchParams` sú od Next 15 prísľub.
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>
  // Výsledok potvrdenia sa nesie v adrese, nie v stave komponentu: bez
  // skriptu iná cesta nie je a s dvomi cestami by sa hlásenia rozišli.
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  // Osoba mimo tohto tenanta sa nemá dozvedieť ani to, či dokument existuje —
  // rovnaká odpoveď ako pri neviditeľnom dokumente (D32).
  if (ctx.state === "not-in-tenant") notFound()
  const person = ctx.person
  const branding = brandingView(ctx.tenant)

  const t = dictionary(person.language).onboarding
  const tr = dictionary(person.language).responsibility
  const documentId = decodeURIComponent((await params).documentId)
  const doc = await loadDocumentFor(person, documentId)
  /*
    Pripravované znenie pre jeho zodpovednú osobu (ADR-023, D139) — aj pri
    dokumente, ktorý by inak nevidela alebo ktorý ešte nemá zverejnené znenie.
    `draftBasisTaskFor()` vráti úlohu len jej; ostatným sa dokument naďalej
    tvári ako neexistujúci (D32).
  */
  const draftTask = await draftBasisTaskFor(person, documentId)
  if (!doc && !draftTask) notFound()

  const q = await searchParams
  const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const message = text(q.msg)
  const failed = text(q.error) === "1"
  const basisOptionsFor = (show: boolean) => (show ? legalBasisOptions(ctx.tenant) : [])
  const draftCard = draftTask
    ? <DraftBasisCard task={draftTask} options={basisOptionsFor(true)} language={person.language} />
    : null

  if (!doc) {
    // Dokument, ktorý osoba inak nevidí: len úloha ku konceptu, nič na čítanie
    // ani na potvrdenie.
    return (
      <AppShell language={person.language} title={draftTask!.title}>
        <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
          <Notice message={message} error={failed} back={`/documents/${encodeURIComponent(documentId)}`} />
          <h1 className="page-title">{draftTask!.title}</h1>
          {draftCard}
        </div>
      </AppShell>
    )
  }

  const version = effectiveVersion(doc)

  /*
    Prvé otvorenie znenia (ADR-005, D64). **Len tomu, kto povinnosť má** —
    personalista, ktorý si znenie otvorí na kontrolu, sa nezapisuje. Je to
    minimalizácia údajov (O14) a zároveň presne to, čo reťaz potrebuje:
    otázka znie „vedel o tom a nepotvrdil?", nie „kto sa na to pozeral".

    Zapisuje sa **až tu, po kontrole prístupu a po tom, čo je jasné, ktoré
    znenie sa zobrazí** — inak by v zázname mohlo skončiť znenie, ktoré človek
    nikdy nevidel. `recordOpen()` nikdy nevyhadzuje: keď zápis zlyhá, stránka
    sa zobrazí aj tak. Meranie nesmie brániť plneniu povinnosti.
  */
  if (version.ok) {
    const mine = await assignedAtByVersion(person)
    if (mine.has(version.version.versionId)) {
      await recordOpen({
        companyCode: person.companyCode,
        personId: person.id,
        documentId: doc.documentId,
        versionId: version.version.versionId,
      })
    }
  }

  /*
    Termín potvrdenia (ZNENIE, úloha 1) — z toho istého výpočtu, ktorý kreslí
    chip na Prehľade a v zozname (`acknowledgementDuties`), nie z vlastného
    čítania pridelení: pravidlo „pri dvoch prideleniach platí skorší termín"
    má žiť na jednom mieste. Položka existuje len pre nepotvrdenú povinnosť,
    takže po potvrdení chip zmizne sám.
  */
  const duties = version.ok ? await acknowledgementDuties(person) : null
  const duty = duties
    ? [...duties.fromTracks, ...duties.outsideTracks].find(i => i.id === doc.documentId)
    : undefined
  const due = duty?.due ?? null
  const now = new Date()
  const tOverview = dictionary(person.language).overview

  /*
    Zodpovedná osoba za znenie (D91) — **dnešný** kontakt, nie odtlačok:
    človek sa má dovolať. Odtlačok z okamihu potvrdenia si nesie záznam.
  */
  const responsible = version.ok ? version.version.responsiblePerson : undefined
  const contact = await responsibleContact(person.companyCode, responsible)
  /*
    Formulár na právny základ vidí len ten, kto ho smie určiť — to isté
    pravidlo ako v `setVersionLegalBasis()`. Bežný čitateľ ho nevidí vôbec.
  */
  const canSetBasis = version.ok && canSetLegalBasis({
    actorPersonId: person.id,
    isContentManager: isContentManager(person) && person.companyCode === ctx.tenant.companyCode,
    responsible,
    responsibleActive: Boolean(contact?.active),
  })

  const basisName = (v: { legalBasis?: string; legalBasisLabel?: string }) =>
    v.legalBasisLabel ?? (v.legalBasis ? tr.basisLabel[v.legalBasis] : "")

  /*
    Zverejnené znenie, ktoré **ešte nie je účinné** (ADR-023). Upozornenie
    zo zverejnenia posiela zodpovednú osobu sem, no `effectiveVersion()` ho
    do účinnosti nevráti — formulár na základ by sa jej dovtedy neukázal.
    Pravidlo „kto smie" je to isté ako pri platnom znení.
  */
  const pending: Version[] = []
  for (const v of doc.versions ?? []) {
    if (!v.isActive || !(v.effectiveFrom instanceof Date) || v.effectiveFrom.getTime() <= now.getTime()) continue
    const c = await responsibleContact(person.companyCode, v.responsiblePerson)
    if (canSetLegalBasis({
      actorPersonId: person.id,
      isContentManager: isContentManager(person) && person.companyCode === ctx.tenant.companyCode,
      responsible: v.responsiblePerson,
      responsibleActive: Boolean(c?.active),
    })) pending.push(v)
  }
  const basisOptions = basisOptionsFor(canSetBasis || pending.length > 0)

  return (
    <AppShell language={person.language} title={doc.title}>
    {/* 760 px zostáva — je to znenie normy na čítanie. Shell dáva navigáciu
        a odsadenie, dĺžku riadka určuje obsah. */}
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice
        message={message}
        error={failed}
        back={`/documents/${encodeURIComponent(documentId)}`}
      />


      <h1 className="page-title">{doc.title}</h1>

      {/*
        Hlavička znenia (ZNENIE-kontakt-a-privacy, bod 1): riadok verzie
        s termínovým chipom a pod ním údaje o znení (ADR-013) v jednom obale,
        nie zápornými okrajmi.
      */}
      {version.ok ? (
        <div className="zn-head">
          <p className="quiet zn-version">
            <span>{t.version(version.version.label, formatDate(version.version.effectiveFrom!, person.language))}</span>
            {/* Po lehote len chip v --bad-bg, nie červená karta: prekročený
                termín potvrdenie nezakazuje a obrazovka sa nemá tváriť, že áno. */}
            {due && (
              <span className={`due-chip due-chip--${dueState(due, now)}`}>
                {tOverview.by(formatDate(due, person.language))}
              </span>
            )}
          </p>
          <VersionMetaLine author={version.version.author} approvedBy={version.version.approvedBy}
                           approvedOn={version.version.approvedOn} language={person.language} />
        </div>
      ) : (
        // Spodný okraj pre kartu úlohy pod ním (ADR-023); inak za ním nič nie je.
        <p className="card" style={{ padding: 16, margin: "16px 0 24px" }}>
          {t.blockedReason[version.reason] ?? version.reason}
        </p>
      )}

      {/* Znenie zverejnené s budúcou účinnosťou a pripravované znenie (ADR-023). */}
      {pending.map(v => {
        const from = formatDate(v.effectiveFrom!, person.language)
        return (
          <BasisTask
            key={v.versionId}
            done={Boolean(v.legalBasis)}
            heading={tr.pendingTaskHeading(from)}
            note={tr.pendingTaskNote}
            summary={tr.pendingBasisSummary(from)}
            chosen={v.legalBasis ? basisName(v) : ""}
            reference={v.legalBasisReference ?? null}
          >
            {v.pdf && (
              <DraftPdfLink href={`/api/documents/${encodeURIComponent(doc.documentId)}/pdf?version=${encodeURIComponent(v.versionId)}`}
                            name={v.pdf.name} bytes={v.pdf.bytes} label={t.openPdf} />
            )}
            <LegalBasisForm
              documentId={doc.documentId}
              versionId={v.versionId}
              current={v.legalBasis}
              currentKeys={basesOf(v).map(e => e.key ?? "").filter(Boolean)}
              options={basisOptions}
              language={person.language}
              back="document"
            />
          </BasisTask>
        )
      })}
      {draftCard}

      {/*
        Úloha pre zodpovednú osobu: určiť právny základ. Hore, nie pod textom —
        je to dôvod, pre ktorý sem prišla (odkaz zo zvončeka). Keď je základ
        určený, zbalí sa do `<details>`: zmena je výnimočná.
      */}
      {version.ok && canSetBasis && (
        version.version.legalBasis ? (
          <details className="card zn-basis" style={{ padding: 16, margin: "0 0 24px" }}>
            {/* Bod 6: súhrn v bežnej veľkosti, odkaz na zákon na vlastnom riadku. */}
            <summary>
              {tr.legalBasis}: {basisName(version.version)}
              {version.version.legalBasisReference && (
                <span className="zn-basis-ref">{version.version.legalBasisReference}</span>
              )}
            </summary>
            <div style={{ marginTop: 12 }}>
              <LegalBasisForm
                documentId={doc.documentId}
                versionId={version.version.versionId}
                current={version.version.legalBasis}
                currentKeys={basesOf(version.version).map(e => e.key ?? "").filter(Boolean)}
                options={basisOptions}
                language={person.language}
                back="document"
              />
            </div>
          </details>
        ) : (
          // Bod 4: úloha zodpovednej osoby s okrajom akcentu, ako ďalší krok v prehľade.
          <section className="card duty-card is-next" style={{ margin: "0 0 24px" }}>
            <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 6px" }}>{tr.yourTaskHeading}</h2>
            <p className="quiet" style={{ margin: "0 0 12px" }}>{tr.yourTaskNote}</p>
            <LegalBasisForm
              documentId={doc.documentId}
              versionId={version.version.versionId}
              options={basisOptions}
              language={person.language}
              back="document"
            />
          </section>
        )
      )}

      {version.ok && (
        <>
          {/*
            Znenie prešlo prepisom cez model, takže je v markdowne. Vypísať ho
            surovo znamená ukázať človeku „## Článok 3" a hviezdičky — a práve
            tento text má pred potvrdením prečítať. Vykresľuje ho ten istý
            komponent ako odpoveď vyhľadávania.
          */}
          {/*
            **Potvrdzuje sa PDF** (ADR-011, D94) — predpis tak, ako vyšiel,
            s prílohami a formulármi. Text pod ním je odvodenina na
            vyhľadávanie; znenia spred ADR-011 PDF nemajú a zostáva im text.
          */}
          {version.version.pdf ? (
            <>
              <PdfView
                href={`/api/documents/${encodeURIComponent(doc.documentId)}/pdf?version=${encodeURIComponent(version.version.versionId)}`}
                name={version.version.pdf.name}
                bytes={version.version.pdf.bytes}
                labels={{ open: t.openPdf }}
              />
              <details className="document-search-text">
                <summary>{t.searchText}</summary>
                <article className="answer document-sheet" style={{ lineHeight: 1.7 }}>
                  <FormattedText text={version.version.markdown ?? doc.markdown ?? ""} />
                </article>
              </details>
            </>
          ) : (
            <article className="answer document-sheet" style={{ lineHeight: 1.7 }}>
              <FormattedText text={version.version.markdown ?? doc.markdown ?? ""} />
            </article>
          )}

          {/*
            Merač je pod textom, nie nad ním. Hore by z neho bola stopka nad
            hlavou; údaj nemá následok a nemá tak ani vyzerať.
          */}
          <ReadingTimer documentId={doc.documentId} language={person.language} />

          {/*
            Na koho sa obrátiť (D91). Pred potvrdením, nie za ním: otázka
            vzniká pri čítaní, a kto nerozumie, nemá potvrdzovať naslepo.
            Telefón a e-mail sú odkazy — na mobile sa dá rovno zavolať.
          */}
          {/*
            Karta kontaktu (bod 2): iniciály, e-mail a telefón ako rámčeky na
            palec (pod 640 px 44 px), právny základ pod čiarou. Nefunkčný
            kontakt je upozornenie, nie sivá veta — človek sa má dozvedieť,
            že tu odpoveď nedostane.
          */}
          {contact && (
            <section className="card contact">
              {contact.active ? (
                <>
                  <p className="contact-kicker">{tr.contactHeading}</p>
                  <div className="contact-person">
                    <span className="contact-av" aria-hidden="true">{initials(contact.fullName, contact.email)}</span>
                    <div className="contact-main">
                      <div className="contact-name">{contact.fullName}</div>
                      <div className="contact-links">
                        <a className="contact-link" href={`mailto:${contact.email}`}>{contact.email}</a>
                        {contact.mobilePhone && (
                          <a className="contact-link" href={`tel:${contact.mobilePhone.replace(/\s+/g, "")}`}>{contact.mobilePhone}</a>
                        )}
                        <Link className="contact-link contact-link--quiet" href={`/directory?q=${encodeURIComponent(contact.fullName)}`}>
                          {tr.contactProfile}
                        </Link>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="contact-gone" role="status">{tr.contactGone}</p>
              )}
              {version.version.legalBasis && (
                <dl className="contact-basis">
                  <dt>{tr.legalBasis}</dt>
                  <dd>
                    {basisName(version.version)}
                    {version.version.legalBasisReference && ` · ${version.version.legalBasisReference}`}
                  </dd>
                </dl>
              )}
            </section>
          )}

          <section className="card acknowledge-card" style={{ padding: 20, marginTop: 32 }}>
            <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 10px" }}>{t.confirmHeading}</h2>

            {/* Presne to znenie, ktoré sa uloží do záznamu. */}
            <p style={{ fontSize: "var(--fs-lead)", lineHeight: 1.65, margin: "0 0 18px" }}>
              {buildStatement(
                doc.title,
                version.version.effectiveFrom!,
                person.language
              )}
            </p>

            {(await hasAcknowledged(person.companyCode, person.id, version.version.versionId)) ? (
              // Variant zo ZAKLADU, nie inline prepis; a `span`, nie `p` —
              // odstavec s display: inline-flex by čítačka ohlásila ako
              // odstavec, hoci je to štítok (ZNENIE, úloha 2).
              <span className="tag tag--published">{t.confirmed}</span>
            ) : (
              // Pod 640 px pláva ako pás nad spodnou lištou (CSS
              // `.acknowledge-dock`) — potvrdenie je dôvod tejto stránky.
              <div className="acknowledge-dock">
                <AcknowledgeButton
                  documentId={doc.documentId}
                  trackKey={typeof q.track === "string" ? q.track : undefined}
                  action={acknowledgeAction}
                  labels={{ button: t.confirmButton, pending: t.confirmPending }}
                />
              </div>
            )}

            {/* Informovanie (čl. 13, C1) — pri každom potvrdení, nie len raz. */}
            <p className="ack-privacy">
              <span aria-hidden="true">ⓘ</span>
              <span>
                {dictionary(person.language).privacy.linkBefore}
                <Link href="/privacy">{dictionary(person.language).privacy.link}</Link>
              </span>
            </p>
          </section>
        </>
      )}
    </div>
    </AppShell>
  )
}

/**
 * Karta úlohy zodpovednej osoby (ADR-023). Kým základ nie je určený, je to
 * výrazná úloha s okrajom akcentu; potom sa zbalí do `<details>` so súhrnom —
 * rovnako ako karta pri platnom znení vyššie, zmena je výnimočná.
 */
function BasisTask({
  done, heading, note, summary, chosen, reference, children,
}: {
  done: boolean
  heading: string
  note: string
  summary: string
  chosen: string
  reference: string | null
  children: ReactNode
}) {
  if (done) {
    return (
      <details className="card zn-basis" style={{ padding: 16, margin: "0 0 24px" }}>
        <summary>
          {summary}: {chosen}
          {reference && <span className="zn-basis-ref">{reference}</span>}
        </summary>
        <div className="basis-task-body">
          <p className="quiet" style={{ margin: 0 }}>{note}</p>
          {children}
        </div>
      </details>
    )
  }
  return (
    <section className="card duty-card is-next" style={{ margin: "0 0 24px" }}>
      <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 6px" }}>{heading}</h2>
      <div className="basis-task-body">
        <p className="quiet" style={{ margin: 0 }}>{note}</p>
        {children}
      </div>
    </section>
  )
}

/**
 * Odkaz na PDF znenia, ku ktorému sa určuje základ. Nie vložené PDF: pod
 * kartou môže byť platné znenie s vlastným PDF a dva prehliadače nad sebou
 * by sa zamenili. Na telefóne je aj tak len odkaz (`PdfView`).
 */
function DraftPdfLink({ href, name, bytes, label }: { href: string; name: string; bytes?: number; label: string }) {
  const size = !bytes ? "" : bytes >= 1024 * 1024 ? ` · ${(bytes / 1024 / 1024).toFixed(1)} MB` : ` · ${Math.ceil(bytes / 1024)} kB`
  return (
    <p className="basis-task-pdf">
      <a className="button button--quiet" href={href} target="_blank" rel="noreferrer">{label}</a>
      <span className="quiet">{name}{size}</span>
    </p>
  )
}

/** Pripravované znenie pre jeho zodpovednú osobu (ADR-023, D139). */
function DraftBasisCard({
  task, options, language,
}: {
  task: DraftBasisTask
  options: ReturnType<typeof legalBasisOptions>
  language: UiLanguage
}) {
  const t = dictionary(language)
  const tr = t.responsibility
  const chosen = task.legalBasis ? legalBasisFields(task.legalBasis.entries) : null
  return (
    <BasisTask
      done={Boolean(chosen)}
      heading={tr.draftTaskHeading}
      note={tr.draftTaskNote}
      summary={tr.draftBasisSummary}
      chosen={chosen?.legalBasisLabel ?? ""}
      reference={chosen?.legalBasisReference ?? null}
    >
      {(task.effectiveFrom || task.draftTitle) && (
        <ul className="basis-task-facts">
          {task.effectiveFrom && <li>{tr.draftEffective(formatDate(task.effectiveFrom, language))}</li>}
          {task.draftTitle && <li>{tr.draftNewTitle(task.draftTitle)}</li>}
        </ul>
      )}
      {task.draftPdf && (
        <DraftPdfLink href={`/api/documents/${encodeURIComponent(task.documentId)}/pdf?draft=1`}
                      name={task.draftPdf.name} bytes={task.draftPdf.bytes} label={tr.draftOpenPdf} />
      )}
      <details className="document-search-text">
        <summary>{tr.draftText}</summary>
        <article className="answer document-sheet" style={{ lineHeight: 1.7 }}>
          <FormattedText text={task.draftMarkdown} />
        </article>
      </details>
      <LegalBasisForm
        documentId={task.documentId}
        draft
        currentKeys={(task.legalBasis?.entries ?? []).map(e => e.key ?? "").filter(Boolean)}
        options={options}
        language={language}
        back="document"
      />
    </BasisTask>
  )
}
