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
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { recordOpen } from "@/lib/documentOpens"
import { assignedAtByVersion } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { loadDocumentFor, effectiveVersion } from "@/lib/documents"
import { buildStatement, hasAcknowledged } from "@/lib/acknowledgements"
import { dictionary, formatDate } from "@/lib/i18n"
import { acknowledgementDuties } from "@/lib/pending"
import { dueState } from "@/lib/due"
import AcknowledgeButton from "@/components/AcknowledgeButton"
import FormattedText from "@/components/FormattedText"
import ReadingTimer from "@/components/ReadingTimer"
import Notice from "@/components/Notice"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/lib/appNav"
import { acknowledgeAction } from "./actions"

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
  const documentId = decodeURIComponent((await params).documentId)
  const doc = await loadDocumentFor(person, documentId)
  if (!doc) notFound()

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

  const q = await searchParams
  const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const message = text(q.msg)
  const failed = text(q.error) === "1"

  return (
    <AppShell layout={normalizeLayout(text(q.layout))} language={person.language}>
    {/* 760 px zostáva — je to znenie normy na čítanie. Shell dáva navigáciu
        a odsadenie, dĺžku riadka určuje obsah. */}
    <div style={{ maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice
        message={message}
        error={failed}
        back={`/documents/${encodeURIComponent(documentId)}`}
      />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/documents" style={{ fontSize: "var(--fs-body)" }}>← {t.back}</Link>
      </p>

      <h1 className="page-title">{doc.title}</h1>

      {version.ok ? (
        <p className="quiet" style={{ fontSize: "var(--fs-body)", margin: "0 0 28px" }}>
          {t.version(version.version.label, formatDate(version.version.effectiveFrom!, person.language))}
          {/* Po lehote len chip v --bad-bg, nie červená karta: prekročený
              termín potvrdenie nezakazuje a obrazovka sa nemá tváriť, že áno. */}
          {due && (
            <span className={`due-chip due-chip--${dueState(due, now)}`}>
              {tOverview.by(formatDate(due, person.language))}
            </span>
          )}
        </p>
      ) : (
        <p className="card" style={{ padding: 16, margin: "16px 0 0" }}>
          {t.blockedReason[version.reason] ?? version.reason}
        </p>
      )}

      {version.ok && (
        <>
          {/*
            Znenie prešlo prepisom cez model, takže je v markdowne. Vypísať ho
            surovo znamená ukázať človeku „## Článok 3" a hviezdičky — a práve
            tento text má pred potvrdením prečítať. Vykresľuje ho ten istý
            komponent ako odpoveď vyhľadávania.
          */}
          <article className="answer document-sheet" style={{ lineHeight: 1.7 }}>
            <FormattedText text={version.version.markdown ?? doc.markdown ?? ""} />
          </article>

          {/*
            Merač je pod textom, nie nad ním. Hore by z neho bola stopka nad
            hlavou; údaj nemá následok a nemá tak ani vyzerať.
          */}
          <ReadingTimer documentId={doc.documentId} language={person.language} />

          <section className="card acknowledge-card" style={{ padding: 20, marginTop: 32 }}>
            <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 10px" }}>{t.confirmHeading}</h2>

            {/* Presne to znenie, ktoré sa uloží do záznamu. */}
            <p style={{ fontSize: "var(--fs-lead)", lineHeight: 1.65, margin: "0 0 18px" }}>
              {buildStatement(
                doc.title,
                version.version.label,
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
          </section>
        </>
      )}
    </div>
    </AppShell>
  )
}
