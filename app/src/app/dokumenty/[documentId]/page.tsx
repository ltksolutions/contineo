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
import { currentPerson } from "@/lib/session"
import { loadDocumentFor, effectiveVersion } from "@/lib/documents"
import { buildStatement, hasAcknowledged } from "@/lib/acknowledgements"
import { dictionary, formatDate } from "@/lib/i18n"
import AcknowledgeButton from "@/components/AcknowledgeButton"

export const dynamic = "force-dynamic"

// `params` je od Next 15 prísľub.
export default async function Dokument({ params }: { params: Promise<{ documentId: string }> }) {
  const person = await currentPerson()
  if (!person) redirect("/prihlasenie")

  const t = dictionary(person.language).onboarding
  const documentId = decodeURIComponent((await params).documentId)
  const doc = await loadDocumentFor(person, documentId)
  if (!doc) notFound()

  const version = effectiveVersion(doc)

  return (
    <div className="obal" style={{ padding: "36px 20px 80px", maxWidth: 760 }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/dokumenty" style={{ fontSize: 14 }}>← {t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{doc.title}</h1>

      {version.ok ? (
        <p className="tichy" style={{ fontSize: 14, margin: "0 0 28px" }}>
          {t.version(version.version.label, formatDate(version.version.effectiveFrom!, person.language))}
        </p>
      ) : (
        <p className="karta" style={{ padding: 16, margin: "16px 0 0" }}>
          {t.blockedReason[version.reason] ?? version.reason}
        </p>
      )}

      {version.ok && (
        <>
          <article className="odpoved" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {version.version.markdown ?? doc.markdown ?? ""}
          </article>

          <section className="karta" style={{ padding: 20, marginTop: 32 }}>
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
              <p className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                {t.confirmed}
              </p>
            ) : (
              <AcknowledgeButton
                documentId={doc.documentId}
                labels={{
                  button: t.confirmButton,
                  pending: t.confirmPending,
                  confirmed: t.confirmed,
                  error: t.error,
                }}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
