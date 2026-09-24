/**
 * Nové znenie dokumentu — krok 1 postupu znenia (ADR-014, bod 1 rámu
 * KNIZNICA-postup-znenia).
 *
 * Dovtedy to bol formulár schovaný v „Úpravy a správa" na detaile. Teraz ho
 * otvára hlavné tlačidlo „Nové znenie" v hlavičke detailu a „Vymeniť" v
 * príprave. Metadáta dokumentu sa neposielajú — nové znenie mení súbory
 * a text, nie pôsobnosť ani prístupnosť (D80, `uploadVersionAction`).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail, versionMetaSuggestions } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import AppShell from "@/components/AppShell"
import FlowSteps from "@/components/FlowSteps"
import VersionMetaFields from "@/components/VersionMetaFields"
import UploadFiles from "@/components/UploadFiles"
import UploadSubmit from "@/components/UploadSubmit"
import { MAX_BYTES, MAX_FORM_BYTES, SOURCE_EXTENSIONS } from "@/lib/fileStore"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { uploadVersionAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function NewVersionPage({
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

  const language = ctx.person.language
  const t = dictionary(language).library.detail
  const tu = dictionary(language).library.upload
  const tm = dictionary(language).versionMeta
  const tflow = dictionary(language).library.flow
  const metaOptions = await versionMetaSuggestions(ctx.tenant.companyCode)
  const effective = d.versions.find(v => v.isActive && v.effectiveFrom)
  const base = `/library/${encodeURIComponent(documentId)}`

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(brandingView(ctx.tenant)) }}>
      <Notice message={message} error={error === "1"} back={`${base}/version`} />
      <p className="detail-back">
        <Link className="quiet" href={base}>{tflow.versionPageBack}</Link>
      </p>
      <h1 className="page-title">{tflow.versionPageTitle}</h1>
      <p className="quiet detail-lead">{d.title}</p>

      <FlowSteps
        states={["current", "todo", "todo", "todo"]}
        names={tflow.steps}
        subs={[tflow.subPrepare, "", "", ""]}
        label={tflow.stepOf(1)}
      />

      <form action={uploadVersionAction} className="card detail-block" style={{ marginTop: 18 }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <p className="detail-block-note">{t.newVersionNote}</p>
        {/* Autor a Schválil sa predvyplnia z platného znenia — pri novele
            bývajú rovnaké; dátumy nie, tie sú pri každom znení iné. */}
        <details>
          <summary className="field-label" style={{ cursor: "pointer" }}>{tm.uploadHeading}</summary>
          <p className="quiet field-hint" style={{ margin: "8px 0" }}>{tm.uploadNote}</p>
          <VersionMetaFields
            value={effective ? { author: effective.author ?? null, approvedBy: effective.approvedBy ?? null, approvedOn: null, effectiveFrom: null } : null}
            authors={metaOptions.authors}
            approvers={metaOptions.approvers}
            language={language}
          />
        </details>
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
            change: tu.change,
          }}
        />
        <div className="upload-submit">
          <UploadSubmit labels={{ submit: t.newVersionSubmit, pending: tu.submitPending, pickPdfFirst: tu.pickPdfFirst }} />
        </div>
        <p className="quiet field-hint">{tflow.uploadNext}</p>
      </form>
    </div>
    </AppShell>
  )
}
