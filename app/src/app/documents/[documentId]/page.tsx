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
import AcknowledgeButton from "@/components/AcknowledgeButton"
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
        <Link className="quiet" href="/documents" style={{ fontSize: 14 }}>← {t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{doc.title}</h1>

      {version.ok ? (
        <p className="quiet" style={{ fontSize: 14, margin: "0 0 28px" }}>
          {t.version(version.version.label, formatDate(version.version.effectiveFrom!, person.language))}
        </p>
      ) : (
        <p className="card" style={{ padding: 16, margin: "16px 0 0" }}>
          {t.blockedReason[version.reason] ?? version.reason}
        </p>
      )}

      {version.ok && (
        <>
          <article className="answer" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {version.version.markdown ?? doc.markdown ?? ""}
          </article>

          {/*
            Merač je pod textom, nie nad ním. Hore by z neho bola stopka nad
            hlavou; údaj nemá následok a nemá tak ani vyzerať.
          */}
          <ReadingTimer documentId={doc.documentId} language={person.language} />

          <section className="card" style={{ padding: 20, marginTop: 32 }}>
            <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{t.confirmHeading}</h2>

            {/* Presne to znenie, ktoré sa uloží do záznamu. */}
            <p style={{ fontSize: 15.5, lineHeight: 1.65, margin: "0 0 18px" }}>
              {buildStatement(
                doc.title,
                version.version.label,
                version.version.effectiveFrom!,
                person.language
              )}
            </p>

            {(await hasAcknowledged(person.id, version.version.versionId)) ? (
              <p className="tag" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                {t.confirmed}
              </p>
            ) : (
              <AcknowledgeButton
                documentId={doc.documentId}
                action={acknowledgeAction}
                labels={{ button: t.confirmButton, pending: t.confirmPending }}
              />
            )}
          </section>
        </>
      )}
    </div>
    </AppShell>
  )
}
