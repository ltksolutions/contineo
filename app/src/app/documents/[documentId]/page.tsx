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
 *
 * Čitateľský detail (ADR-041, D272): nad textom je riadok druh · znenie ·
 * platí od, karta údajov (kto zodpovedá, právny základ, kto prijal, autor,
 * nadradené, jazyk, pôvod, moje potvrdenie) a pri viacerých vydaných zneniach
 * karta znení s prepínaním `?version=`. Správcovské pojmy — priečinok,
 * prístup, značky, cudzie potvrdenia — sa tu nekreslia; kto má rolu správcu
 * obsahu, má jeden tichý odkaz do knižnice (D274).
 */

import Link from "next/link"
import type { ReactNode } from "react"
import { initials } from "@/lib/initials"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { recordOpen } from "@/lib/documentOpens"
import { assignedAtByVersion } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { loadDocumentFor, effectiveVersion, readableVersions, versionToRead, versionState } from "@/lib/documents"
import { buildStatement, validAcknowledgements } from "@/lib/acknowledgements"
import { dictionary, formatDate } from "@/lib/i18n"
import { acknowledgementDuties } from "@/lib/pending"
import { dueState } from "@/lib/due"
import { dueText } from "@/lib/dueText"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { isContentManager } from "@/lib/library"
import { documentTitles } from "@/lib/approvalsDb"
import AcknowledgeButton from "@/components/AcknowledgeButton"
import FormattedText from "@/components/FormattedText"
import PdfView from "@/components/PdfView"
import ReadingTimer from "@/components/ReadingTimer"
import Notice from "@/components/Notice"
import AppShell from "@/components/AppShell"
import { acknowledgeAction } from "./actions"
import { responsibleContact } from "@/lib/versionResponsibilityDb"

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

  const d = dictionary(person.language)
  const t = d.onboarding
  const tr = d.responsibility
  const documentId = decodeURIComponent((await params).documentId)
  const doc = await loadDocumentFor(person, documentId)
  /*
    Úloha zodpovednej osoby (určiť právny základ, ADR-023) sem nepatrí — je na
    karte dokumentu v správe (D151). Tu sa predpis len číta a potvrdzuje.
  */
  if (!doc) notFound()

  const q = await searchParams
  const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const message = text(q.msg)
  const failed = text(q.error) === "1"
  const now = new Date()
  const current = effectiveVersion(doc, now)
  /*
    Zobrazené znenie je vyžiadané (`?version=`) alebo platné (D272). Čitateľ
    vidí len vydané znenia; koncept sa vyžiadať nedá. Potvrdzuje sa, meria
    a zapisuje otvorenie **len pri platnom** — staré znenie je na čítanie.
  */
  const shown = versionToRead(doc, text(q.version), now)
  const isCurrent = Boolean(shown && current.ok && shown.versionId === current.version.versionId)
  const readable = readableVersions(doc)

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
  if (shown && isCurrent) {
    const mine = await assignedAtByVersion(person)
    if (mine.has(shown.versionId)) {
      await recordOpen({
        companyCode: person.companyCode,
        personId: person.id,
        documentId: doc.documentId,
        versionId: shown.versionId,
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
  const duties = isCurrent ? await acknowledgementDuties(person) : null
  const duty = duties
    ? [...duties.fromTracks, ...duties.outsideTracks].find(i => i.id === doc.documentId)
    : undefined
  const due = duty?.due ?? null

  /*
    Zodpovedná osoba za znenie (D91) — **dnešný** kontakt, nie odtlačok:
    človek sa má dovolať. Odtlačok z okamihu potvrdenia si nesie záznam.
  */
  const responsible = shown?.responsiblePerson
  const contact = isCurrent ? await responsibleContact(person.companyCode, responsible) : null
  const basisName = (v: { legalBasis?: string; legalBasisLabel?: string }) =>
    v.legalBasisLabel ?? (v.legalBasis ? tr.basisLabel[v.legalBasis] : "")

  /*
    Karta údajov (D272): názvy z číselníkov, nie kľúče; nadradené dokumenty
    menom s odkazom na ich čitateľský detail; moje potvrdenie z reťaze dôkazov
    pre zobrazené znenie. Prázdne pole sa vynechá — „—" by hovorilo, že údaj
    chýba, a čitateľovi na tom nezáleží.
  */
  const extras = tenantExtras(ctx.tenant)
  const codeLabel = (list: string, key: string | null | undefined) =>
    key ? (codelistOptions(list, extras).find(o => o.value === key)?.label ?? key) : ""
  const parentIds = (doc.parentIds ?? []).filter(Boolean)
  const [parentTitles, mine] = await Promise.all([
    parentIds.length ? documentTitles(person.companyCode, parentIds) : new Map<string, string>(),
    shown ? validAcknowledgements({ companyCode: person.companyCode, personId: person.id, versionId: shown.versionId }) : [],
  ])
  const acknowledgedAt = mine[0]?.acknowledgedAt ?? null
  const date = (x: Date) => formatDate(x, person.language)
  const tv = d.library.docView
  const facts: [string, ReactNode][] = shown
    ? ([
        [tr.responsiblePerson, shown.responsiblePerson?.fullName],
        [tr.legalBasis, shown.legalBasis
          ? `${basisName(shown)}${shown.legalBasisReference ? ` · ${shown.legalBasisReference}` : ""}`
          : ""],
        [d.versionMeta.approvedBy, shown.approvedBy
          ? `${shown.approvedBy}${shown.approvedOn ? ` · ${date(shown.approvedOn)}` : ""}`
          : ""],
        [d.versionMeta.author, shown.author],
        [tv.rows.parents, parentIds.length
          ? <span key="parents">{parentIds.map((p, i) => (
              <span key={p}>{i > 0 && ", "}<Link href={`/documents/${encodeURIComponent(p)}`}>{parentTitles.get(p) ?? p}</Link></span>
            ))}</span>
          : ""],
        [tv.rows.language, codeLabel("language", doc.language)],
        [tv.rows.origin, doc.source?.type === "mcp" ? tv.originConnector(doc.source.connectorName) : doc.source?.type === "web" ? tv.originWeb : tv.originManual],
        [t.confirmHeading, acknowledgedAt ? t.confirmedAt(date(acknowledgedAt)) : ""],
      ] as [string, ReactNode][]).filter(([, value]) => Boolean(value))
    : []
  const stateLabel = { now: d.org.law.detail.stateNow, past: d.org.law.detail.statePast, later: d.org.law.detail.stateLater }
  const base = `/documents/${encodeURIComponent(doc.documentId)}`

  return (
    <AppShell language={person.language} title={doc.title}>
    {/* 760 px zostáva — je to znenie normy na čítanie. Shell dáva navigáciu
        a odsadenie, dĺžku riadka určuje obsah. */}
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice
        language={person.language}
        message={message}
        error={failed}
        back={base}
      />


      {/*
        Tiché „Opýtať sa" vpravo: otázka len nad týmto dokumentom (ADR-029
        D269). Jediné plné tlačidlo stránky je „Potvrdzujem" na jej konci.
        Správca obsahu má navyše tichý odkaz do knižnice — jediná správcovská
        vec na čitateľskom detaile (D274).
      */}
      <div className="page-head">
        <h1 className="page-title">{doc.title}</h1>
        <span className="page-head-spacer" />
        {isContentManager(person) && (
          <Link className="button button--quiet" href={`/library/${encodeURIComponent(doc.documentId)}`}>{t.editInLibrary}</Link>
        )}
        <Link className="button button--quiet" href={`/ask?${new URLSearchParams({ src: "library", doc: doc.documentId }).toString()}`}>
          {t.askDocument}
        </Link>
      </div>

      {/*
        Hlavička (ZNENIE-kontakt-a-privacy, bod 1; ADR-041 D272): riadok
        druh · znenie · platí od s termínovým chipom, pod ním karta údajov.
        Druh je prvý — je to jediné delenie, ktoré čitateľ pozná (D270).
      */}
      {shown ? (
        <div className="zn-head">
          <p className="quiet zn-version">
            <span>
              {[codeLabel("category", doc.category), t.version(shown.label, date(shown.effectiveFrom!))].filter(Boolean).join(" · ")}
            </span>
            {/* Po lehote len chip v --bad-bg, nie červená karta: prekročený
                termín potvrdenie nezakazuje a obrazovka sa nemá tváriť, že áno. */}
            {due && (
              <span className={`due-chip due-chip--${dueState(due, now)}`}>
                {dueText(due, now, person.language)}
              </span>
            )}
          </p>
          {facts.length > 0 && (
            <section className="card insp-rows" aria-label={t.factsHeading}>
              {facts.map(([label, value]) => (
                <div className="labeled-row" key={label}>
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      ) : (
        <p className="card" style={{ padding: 16, margin: "16px 0" }}>
          {!current.ok && (t.blockedReason[current.reason] ?? current.reason)}
        </p>
      )}

      {/*
        Znenia (D272): len pri dvoch a viac vydaných; najnovšie prvé, so
        štítkom stavu. Karty s vlastnou akciou majú tlačidlá tiché (R1);
        zobrazené znenie tlačidlo nemá.
      */}
      {shown && readable.length > 1 && (
        <section className="card more" style={{ marginBottom: 24 }}>
          <div className="more-head"><h2>{t.versionsHeading(readable.length)}</h2></div>
          {readable.map(v => {
            const isShown = v.versionId === shown.versionId
            const state = versionState(v, now)
            return (
              <div key={v.versionId} className="more-row" aria-current={isShown ? "true" : undefined}>
                <div className="more-main">
                  {/* Znenie určuje dátum účinnosti, označenie sa neukazuje (ADR-016 D113). */}
                  <b>
                    {v.effectiveTo
                      ? d.org.law.detail.effectiveRange(date(v.effectiveFrom!), date(v.effectiveTo))
                      : d.org.law.current(date(v.effectiveFrom!))}
                    {" "}<span className={state === "now" ? "tag tag--published" : "tag"}>{stateLabel[state]}</span>
                  </b>
                  {v.changeNote && <span>{v.changeNote}</span>}
                </div>
                {isShown
                  ? <span className="quiet" style={{ fontSize: 13 }}>{t.versionShown}</span>
                  : <Link className="button button--quiet" href={`${base}?${new URLSearchParams({ version: v.versionId }).toString()}`}>{t.versionShow}</Link>}
              </div>
            )
          })}
        </section>
      )}

      {shown && !isCurrent && (
        <p className="card" style={{ padding: 16, margin: "0 0 16px" }}>
          {current.ok
            ? <>{t.versionNotCurrent(date(current.version.effectiveFrom!))} <Link href={base}>{t.versionCurrentLink}</Link></>
            : (t.blockedReason[current.reason] ?? current.reason)}
        </p>
      )}

      {shown && (
        <>
          {/*
            Znenie prešlo prepisom cez model, takže je v markdowne. Vypísať ho
            surovo znamená ukázať človeku „## Článok 3" a hviezdičky — a práve
            tento text má pred potvrdením prečítať. Vykresľuje ho ten istý
            komponent ako odpoveď vyhľadávania.
          */}
          {/*
            **Potvrdzuje sa PDF** (ADR-011, D94) — predpis tak, ako vyšiel,
            s prílohami a formulármi. Text na vyhľadávanie sa tu neukazuje ani
            zbalený (rozhodnutie Jána 30. 9. 2026): je to odvodenina a vedľa
            PDF by vyzeral ako druhé znenie toho istého. Znenia spred ADR-011
            PDF nemajú a zostáva im text.
          */}
          {shown.pdf ? (
            <PdfView
              href={`/api/documents/${encodeURIComponent(doc.documentId)}/pdf?version=${encodeURIComponent(shown.versionId)}`}
              name={shown.pdf.name}
              bytes={shown.pdf.bytes}
              labels={{ open: t.openPdf, ...d.common.pdf }}
            />
          ) : (
            <article className="answer document-sheet" style={{ lineHeight: 1.7 }}>
              <FormattedText text={shown.markdown ?? doc.markdown ?? ""} anchors />
            </article>
          )}
        </>
      )}

      {shown && isCurrent && (
        <>
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
              {shown.legalBasis && (
                <dl className="contact-basis">
                  <dt>{tr.legalBasis}</dt>
                  <dd>
                    {basisName(shown)}
                    {shown.legalBasisReference && ` · ${shown.legalBasisReference}`}
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
                shown.effectiveFrom!,
                person.language,
                person.gender,
              )}
            </p>

            {acknowledgedAt ? (
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
                {d.privacy.linkBefore}
                <Link href="/privacy">{d.privacy.link}</Link>
              </span>
            </p>
          </section>
        </>
      )}
    </div>
    </AppShell>
  )
}
