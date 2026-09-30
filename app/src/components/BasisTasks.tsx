/**
 * Karty úlohy zodpovednej osoby: určiť právny základ znenia (ADR-023).
 *
 * Do 30. 9. 2026 boli na čitateľskej karte dokumentu (`/documents/…`), teda
 * tam, kde sa predpis číta a potvrdzuje. Ján rozhodol, že tam nepatria —
 * formulár medzi znením a tlačidlom „Potvrdzujem" mýlil (D151, dodatok
 * k ADR-023). Sú na karte dokumentu v správe (`/library/…`); zodpovedná
 * osoba bez roly správcu obsahu tam vidí **len** tieto karty.
 */

import type { ReactNode } from "react"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { basesOf, legalBasisFields } from "@/lib/versionResponsibility"
import type { DraftBasisTask } from "@/lib/versionResponsibilityDb"
import type { Version } from "@/lib/documents"
import type { legalBasisOptions } from "@/lib/legalBases"
import FormattedText from "@/components/FormattedText"
import LegalBasisForm from "@/components/LegalBasisForm"

type Options = ReturnType<typeof legalBasisOptions>

/**
 * Kým základ nie je určený, je to výrazná úloha s okrajom akcentu; potom sa
 * zbalí do `<details>` so súhrnom — zmena je výnimočná.
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
 * Odkaz na PDF znenia, ku ktorému sa určuje základ. Nie vložené PDF: kariet
 * môže byť viac pod sebou a dva prehliadače nad sebou by sa zamenili.
 */
function BasisPdfLink({ href, name, bytes, label }: { href: string; name: string; bytes?: number; label: string }) {
  const size = !bytes ? "" : bytes >= 1024 * 1024 ? ` · ${(bytes / 1024 / 1024).toFixed(1)} MB` : ` · ${Math.ceil(bytes / 1024)} kB`
  return (
    <p className="basis-task-pdf">
      <a className="button button--quiet" href={href} target="_blank" rel="noreferrer">{label}</a>
      <span className="quiet">{name}{size}</span>
    </p>
  )
}

/** Zverejnené znenie — dnes platné alebo vopred zverejnená novela. */
export function VersionBasisCard({
  documentId, version, upcoming, options, language,
}: {
  documentId: string
  version: Version
  upcoming: boolean
  options: Options
  language: UiLanguage
}) {
  const t = dictionary(language)
  const tr = t.responsibility
  const from = version.effectiveFrom ? formatDate(version.effectiveFrom, language) : ""
  const chosen = version.legalBasisLabel ?? (version.legalBasis ? tr.basisLabel[version.legalBasis] : "")
  return (
    <BasisTask
      done={Boolean(version.legalBasis)}
      heading={upcoming ? tr.pendingTaskHeading(from) : tr.yourTaskHeading}
      note={upcoming ? tr.pendingTaskNote : tr.yourTaskNote}
      summary={upcoming ? tr.pendingBasisSummary(from) : tr.legalBasis}
      chosen={chosen ?? ""}
      reference={version.legalBasisReference ?? null}
    >
      {version.pdf && (
        <BasisPdfLink href={`/api/documents/${encodeURIComponent(documentId)}/pdf?version=${encodeURIComponent(version.versionId)}`}
                      name={version.pdf.name} bytes={version.pdf.bytes} label={t.onboarding.openPdf} />
      )}
      <LegalBasisForm
        documentId={documentId}
        versionId={version.versionId}
        current={version.legalBasis}
        currentKeys={basesOf(version).map(e => e.key ?? "").filter(Boolean)}
        options={options}
        language={language}
        back="library"
      />
    </BasisTask>
  )
}

/** Pripravované znenie pre jeho zodpovednú osobu (ADR-023, D139). */
export function DraftBasisCard({
  task, options, language,
}: {
  task: DraftBasisTask
  options: Options
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
        <BasisPdfLink href={`/api/documents/${encodeURIComponent(task.documentId)}/pdf?draft=1`}
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
        back="library"
      />
    </BasisTask>
  )
}
