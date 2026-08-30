/**
 * Nahratie dokumentu do knižnice (D53).
 *
 * Metadáta sa **vypĺňajú tu**, nie v `.meta.json` vedľa súboru. Zásada
 * zostáva rovnaká: názov súboru nie je dátový vstup — je to náhodný artefakt.
 * Zmenilo sa len to, kto ich zadáva: dovtedy vývojár v editore, teraz správca
 * obsahu vo formulári, ktorý validuje proti tým istým číselníkom.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { codelistOptions, CODELISTS } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { error, title, sectionKey } = normalizeQuery<{ error?: string; title?: string; sectionKey?: string }>(await searchParams)
  // Ponuka musí obsahovať aj to, čo si organizácia dopísala (D55).
  const t = dictionary(ctx.person.language).library.upload
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  const { uploadAction: upload } = await import("../actions")

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        {t.intro}
      </p>

      {error && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {error}
        </p>
      )}

      <form action={upload} className="karta" style={{ padding: 20, display: "grid", gap: 16 }} encType="multipart/form-data">
        <label className="pole">
          <span className="pole-popis">{t.file}</span>
          <input
            className="pole-vstup"
            type="file"
            name="subor"
            required
            accept=".pdf,.docx,.xlsx,.md,.txt,.csv"
          />
          <span className="tichy pole-napoveda">
            {t.oldFormatsBefore}<code>.doc</code>{t.oldFormatsMiddle}<code>.xls</code>{t.oldFormatsAfter}
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.title}</span>
          <input className="pole-vstup" name="title" defaultValue={title ?? ""} required
                 placeholder={t.titlePlaceholder} />
          <span className="tichy pole-napoveda">
            {t.titleNote}
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">{t.key}</span>
          <input className="pole-vstup" name="sectionKey" defaultValue={sectionKey ?? ""} required
                 placeholder="sutazny_poriadok" autoCapitalize="none" autoCorrect="off" />
          <span className="tichy pole-napoveda">
            {t.keyNoteBefore}<code>{ctx.tenant.companyCode.toLowerCase()}:kluc</code>{t.keyNoteAfterCode}
            <strong>{t.keyNoteHighlight}</strong>{t.keyNoteAfter}
            {CODELISTS.sectionKey.items.slice(0, 8).map(p => p.key).join(", ")}.
          </span>
        </label>

        <div className="pole">
          <span className="pole-popis">{t.scope}</span>
          <Select name="scope" options={codelistOptions("scope")} initial="company" fieldLabel={t.scope} />
        </div>

        <div className="pole">
          <span className="pole-popis">{t.accessLevel}</span>
          <Select name="accessLevel" options={codelistOptions("accessLevel")} initial="internal" fieldLabel={t.accessLevel} />
          <span className="tichy pole-napoveda">
            <code>internal</code>{t.accessInternalNote}<code>public</code>{t.accessPublicNote}
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">{t.documentLanguage}</span>
          <Select name="language" options={codelistOptions("language")} initial={ctx.tenant.defaultLanguage ?? "sk"} fieldLabel={t.documentLanguage} />
          <span className="tichy pole-napoveda">
            {t.documentLanguageNote}
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">{dictionary(ctx.person.language).library.list.category}</span>
          <Select name="category" options={[{ value: "", label: t.unset }, ...codelistOptions("category", extras)]} initial="" fieldLabel={dictionary(ctx.person.language).library.list.category} />
        </div>

        <div className="pole">
          <span className="pole-popis">{t.tags}</span>
          <TagSelect
            name="tags"
            options={codelistOptions("tags", extras).map(v => ({ value: v.value }))}
            selected={[]}
            newLabel={t.newTag}
            language={ctx.person.language}
          />
        </div>

        <div><button className="tlacidlo" type="submit">{t.submit}</button></div>
      </form>
    </div>
  )
}
