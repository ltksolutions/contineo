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
import { libraryDetail } from "@/lib/libraryRead"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { publishVersionAction, saveDocumentMetadataAction, assignToFolderAction, reindexDocumentAction, fixVersionAction } from "../actions"
import { allFolders, flattenTree } from "@/lib/folders"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

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
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
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
  const extras = tenantExtras(ctx.tenant)
  const folders = await allFolders(ctx.tenant.companyCode)
  const folderTree = flattenTree(folders)
  const draft = (d.draftMarkdown ?? "").trim()
  // Publikované znenie je pri dokumentoch z importu len vo `versions[]` —
  // porovnávať koncept s prázdnym `markdown` by tvrdilo, že je čo publikovať,
  // aj keď je text ten istý.
  const effective = d.versions.find(v => v.isActive && v.effectiveFrom)
  const published = ((d.markdown ?? effective?.markdown) ?? "").trim()
  // Koncept, ktorý sa líši od publikovaného znenia, je nedokončená práca —
  // a je to jediný stav, v ktorom má zmysel niečo publikovať.
  const hasChangesToPublish = Boolean(draft) && draft !== published

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 760, ...tenantStyle(branding) }}>
      <Notice message={message} error={error === "1"} back={`/kniznica/${encodeURIComponent(documentId)}`} />

      <p style={{ margin: "0 0 12px" }}>
        <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 18px" }}>{d.documentId}</p>

      <details className="karta" style={{ padding: 18, margin: "0 0 18px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          {t.documentData}
          <span className="tichy" style={{ fontWeight: 400, fontSize: 13.5 }}>
            {" "}· {d.language} · {d.accessLevel}
            {d.category && ` · ${d.category}`}
            {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
          </span>
        </summary>

        <form action={saveDocumentMetadataAction} style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <input type="hidden" name="documentId" value={d.documentId} />

          <label className="pole">
            <span className="pole-popis">{t.title}</span>
            <input className="pole-vstup" name="title" defaultValue={d.title} required />
            <span className="tichy pole-napoveda">{t.titleNote}</span>
          </label>

          <div className="pole">
            <span className="pole-popis">{t.scope}</span>
            <Select name="scope" options={codelistOptions("scope")} initial={d.scope ?? "company"} fieldLabel={t.scope} />
          </div>

          <div className="pole">
            <span className="pole-popis">{t.accessLevel}</span>
            <Select name="accessLevel" options={codelistOptions("accessLevel")} initial={d.accessLevel ?? "internal"} fieldLabel={t.accessLevel} />
          </div>

          <div className="pole">
            <span className="pole-popis">{t.documentLanguage}</span>
            <Select name="language" options={codelistOptions("language")} initial={d.language ?? "sk"} fieldLabel={t.documentLanguage} />
          </div>

          <div className="pole">
            <span className="pole-popis">{t.category}</span>
            <Select
              name="category"
              options={[{ value: "", label: t.unset }, ...codelistOptions("category", extras)]}
              initial={d.category ?? ""}
              fieldLabel={t.category}
            />
          </div>

          <div className="pole">
            <span className="pole-popis">{t.tags}</span>
            <TagSelect
              name="tags"
              options={codelistOptions("tags", extras).map(v => ({ value: v.value }))}
              selected={d.tags}
              newLabel={t.newTag}
              language={language}
            />
          </div>

          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            {t.keyNoteBefore}<code>{d.documentId}</code>{t.keyNoteAfter}
          </p>

          <div><button className="tlacidlo" type="submit">{t.save}</button></div>
        </form>
      </details>

      <form action={assignToFolderAction} className="karta strom-forma" style={{ padding: 18, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <div className="pole" style={{ flex: "1 1 260px", margin: 0 }}>
          <span className="pole-popis">{t.folder}</span>
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
          <span className="tichy pole-napoveda">{t.folderNote}</span>
        </div>
        <button className="tlacidlo tlacidlo--tiche" type="submit">{t.assign}</button>
      </form>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{t.text}</h2>
          <Link href={`/kniznica/${encodeURIComponent(documentId)}/text`}>{t.openEditor}</Link>
        </div>

        {d.originalFile ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            {t.originalFile}{" "}
            <a href={`/api/kniznica/subor/${encodeURIComponent(d.originalFile.id)}`} target="_blank" rel="noreferrer">
              {d.originalFile.name}
            </a>{" "}
            · {t.uploadedBy(d.originalFile.uploadedBy, formatDate(d.originalFile.uploadedAt, language))}
            {d.conversion && ` · ${t.conversionMethod(d.conversion.method)}`}
          </p>
        ) : (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            {t.noOriginal}
          </p>
        )}

        {d.conversion?.warnings?.length ? (
          <ul className="tichy" style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
            {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : null}

        <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
          {hasChangesToPublish
            ? t.draftDiffers
            : draft || published
              ? t.draftSame
              : t.draftEmpty}
        </p>
      </section>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 14, margin: "0 0 18px" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.publishHeading}</h2>

        {!hasChangesToPublish ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            {t.nothingToPublish}
          </p>
        ) : (
          <form action={publishVersionAction} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="documentId" value={d.documentId} />

            <label className="pole">
              <span className="pole-popis">{t.versionLabel}</span>
              <input className="pole-vstup" name="label" required
                     placeholder={t.versionLabelPlaceholder} />
              <span className="tichy pole-napoveda">
                {t.labelNoteBefore}<strong>{t.labelNoteHighlight}</strong>{t.labelNoteAfter}
              </span>
            </label>

            <label className="pole">
              <span className="pole-popis">{t.effectiveFrom}</span>
              <input className="pole-vstup" type="date" name="effectiveFrom" required />
              <span className="tichy pole-napoveda">{t.effectiveFromNote}</span>
            </label>

            <label className="pole">
              <span className="pole-popis">{t.effectiveFromSource}</span>
              <input className="pole-vstup" name="effectiveFromSource"
                     placeholder={t.effectiveFromSourcePlaceholder} />
              <span className="tichy pole-napoveda">{t.effectiveFromSourceNote}</span>
            </label>

            <label className="pole">
              <span className="pole-popis">{t.changeNote}</span>
              <input className="pole-vstup" name="changeNote" placeholder={t.changeNotePlaceholder} />
            </label>

            <div><button className="tlacidlo" type="submit">{t.publish}</button></div>
          </form>
        )}
      </section>

      <form action={reindexDocumentAction} className="karta" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.reindexHeading}</h2>
        <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
          {t.reindexNoteBefore}<strong>{t.reindexNoteHighlight}</strong>{t.reindexNoteAfter}
        </p>
        <div><button className="tlacidlo tlacidlo--tiche" type="submit">{t.reindex}</button></div>
      </form>

      <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{t.versionsHeading(d.versions.length)}</h2>

      {d.versions.length === 0 ? (
        <p className="karta" style={{ padding: 18, fontSize: 15 }}>
          {t.nothingPublished}
        </p>
      ) : (
        <ul className="audit">
          {d.versions.map(v => (
            <li key={v.versionId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <strong>{v.label}</strong>
                {v.isActive ? <span className="stitok">{t.active}</span> : <span className="stitok">{t.archived}</span>}
              </div>
              <div className="tichy audit-kto">
                {v.effectiveFrom ? t.effectiveFromOn(formatDate(v.effectiveFrom, language)) : t.noEffectiveDate}
                {v.effectiveTo && ` ${t.effectiveTo(formatDate(v.effectiveTo, language))}`}
                {v.publishedBy && ` · ${v.publishedBy}`}
                {v.publishedAt && ` · ${formatDate(v.publishedAt, language)}`}
              </div>
              {v.effectiveFromSource && (
                <div className="tichy audit-poznamka">{t.dateSource(v.effectiveFromSource)}</div>
              )}
              {v.changeNote && <div className="tichy audit-poznamka">{v.changeNote}</div>}

              <details style={{ marginTop: 6 }}>
                <summary className="tichy" style={{ fontSize: 13, cursor: "pointer" }}>{t.fix}</summary>
                <form action={fixVersionAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={v.versionId} />

                  <label className="pole">
                    <span className="pole-popis">{t.fixLabel}</span>
                    <input className="pole-vstup" name="label" defaultValue={v.label} />
                  </label>

                  <label className="pole">
                    <span className="pole-popis">{t.effectiveFrom}</span>
                    <input
                      className="pole-vstup"
                      type="date"
                      name="effectiveFrom"
                      defaultValue={v.effectiveFrom ? new Date(v.effectiveFrom).toISOString().slice(0, 10) : ""}
                    />
                    <span className="tichy pole-napoveda">
                      {t.fixEffectiveFromNoteBefore}<strong>{t.fixEffectiveFromNoteHighlight}</strong>{t.fixEffectiveFromNoteAfter}
                    </span>
                  </label>

                  <label className="pole">
                    <span className="pole-popis">{t.effectiveFromSource}</span>
                    <input className="pole-vstup" name="effectiveFromSource" defaultValue={v.effectiveFromSource ?? ""} />
                  </label>

                  <label className="pole">
                    <span className="pole-popis">{t.fixReason}</span>
                    <input className="pole-vstup" name="reason" required
                           placeholder={t.fixReasonPlaceholder} />
                    <span className="tichy pole-napoveda">{t.fixReasonNote}</span>
                  </label>

                  <div className="pole">
                    <span className="pole-popis">{t.onDateChange}</span>
                    <Select
                      name="onDateChange"
                      initial=""
                      fieldLabel={t.onDateChange}
                      options={[
                        { value: "", label: t.onDateChangeAsk },
                        { value: "correction", label: t.onDateChangeCorrection },
                        { value: "reacknowledge", label: t.onDateChangeReacknowledge },
                      ]}
                    />
                  </div>

                  <div><button className="tlacidlo tlacidlo--tiche" type="submit">{t.fixSubmit}</button></div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
