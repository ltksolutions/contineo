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
import { allDepartments, flattenTree } from "@/lib/departments"
import { MAX_INTERNAL_NUMBER } from "@/lib/libraryWrite"
import { tenantExtras } from "@/lib/codelistsTenant"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Select from "@/components/Select"
import TagSelect from "@/components/TagSelect"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { error, title, sectionKey, documentKey } = normalizeQuery<{
    error?: string; title?: string; sectionKey?: string; documentKey?: string
  }>(await searchParams)
  // Ponuka musí obsahovať aj to, čo si organizácia dopísala (D55).
  const t = dictionary(ctx.person.language).library.upload
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  // Oddelenia nie sú číselník v repozitári, ale strom v databáze — iný pre
  // každú organizáciu. Preto sa načítavajú, nie importujú.
  const tf = dictionary(ctx.person.language).library.fields
  const departmentRows = flattenTree(await allDepartments(ctx.tenant.companyCode))
  const { uploadAction: upload } = await import("../actions")

  // **Kľúče, ktoré organizácia už má.** Nahratie na obsadený kľúč sa odmietne
  // (D80) — a dozvedieť sa to až po tom, čo človek vyplní formulár a nahrá
  // súbor, je zbytočne neskoro. Zoznam je serverový zámerne: obrazovka nemá
  // vyžadovať JavaScript kvôli nápovede.
  const usedKeys = (await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: ctx.tenant.companyCode }, { projection: { documentKey: 1, sectionKey: 1 } })
    .toArray() as unknown as { documentKey?: string; sectionKey?: string }[])
    .map(d => d.documentKey ?? d.sectionKey ?? "")
    .filter(Boolean)
    .sort()

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/library" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="quiet" style={{ fontSize: 15, margin: "0 0 20px" }}>
        {t.intro}
      </p>

      {error && (
        <p className="card" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {error}
        </p>
      )}

      {/*
        Číslované sekcie, **nie stepper**.

        Návrh má tri kroky (Súbor / Metadáta / Schválenie) a prepínanie medzi
        nimi. Lenže nahratie je jedno odoslanie formulára a **schvaľovací
        krok v systéme neexistuje** — sprievodca s tromi krokmi by sľuboval
        priebeh, ktorý sa nekoná, a tretí krok by nikam neviedol. Číslo pri
        nadpise dá tú istú orientáciu bez toho klamstva; súbor aj metadáta
        vidno naraz, čo je pri jednom odoslaní správne.
      */}
      <form action={upload} className="upload-form" encType="multipart/form-data">
        <section className="card upload-section">
          <h2 className="upload-step"><span className="upload-step-no">1</span>{t.sectionFile}</h2>

          {/*
            Zóna na pretiahnutie je `<label>` okolo `<input type="file">` —
            prehliadač do neho súbor pustí sám, takže drag & drop funguje bez
            jediného riadku skriptu. Vlastná zóna postavená na JavaScripte by
            bez neho nefungovala vôbec.
          */}
          <label className="upload-drop">
            <span className="upload-drop-title">{t.dropHint}</span>
            <span className="quiet upload-drop-note">
              {t.oldFormatsBefore}<code>.doc</code>{t.oldFormatsMiddle}<code>.xls</code>{t.oldFormatsAfter}
            </span>
            <input
              className="upload-file"
              type="file"
              name="file"
              required
              accept=".pdf,.docx,.xlsx,.md,.txt,.csv"
              aria-label={t.file}
            />
          </label>
        </section>

        <section className="card upload-section">
          <h2 className="upload-step"><span className="upload-step-no">2</span>{t.sectionMeta}</h2>
          <div className="upload-grid">

        <label className="field upload-wide">
          <span className="field-label">{t.title}</span>
          <input className="field-input" name="title" defaultValue={title ?? ""} required
                 placeholder={t.titlePlaceholder} />
          <span className="quiet field-hint">
            {t.titleNote}
          </span>
        </label>

        {/*
          Zaradenie a kľúč sú od D80 dve polia, nie jedno. Dovtedy `sectionKey`
          niesol oboje a dôsledok bol ten, že dva rôzne dokumenty s tým istým
          zaradením sa nedali mať — desať zápisníc by potrebovalo desať zaradení.
        */}
        <label className="field upload-wide">
          <span className="field-label">{t.section}</span>
          <input className="field-input" name="sectionKey" defaultValue={sectionKey ?? ""} required
                 placeholder="poriadky" autoCapitalize="none" autoCorrect="off" />
          <span className="quiet field-hint">
            {t.sectionNote}
            {CODELISTS.sectionKey.items.slice(0, 8).map(p => p.key).join(", ")}.
          </span>
        </label>

        <label className="field upload-wide">
          <span className="field-label">{t.key}</span>
          <input className="field-input" name="documentKey" defaultValue={documentKey ?? ""}
                 placeholder="sutazny_poriadok" autoCapitalize="none" autoCorrect="off" />
          <span className="quiet field-hint">
            {t.keyNoteBefore}<code>{ctx.tenant.companyCode.toLowerCase()}:kluc</code>{t.keyNoteAfterCode}
            <strong>{t.keyNoteHighlight}</strong>{t.keyNoteAfter}
          </span>
          {usedKeys.length > 0 && (
            <span className="quiet field-hint">
              {t.keysTaken}{usedKeys.join(", ")}.
            </span>
          )}
        </label>

        <div className="field">
          <span className="field-label">{t.scope}</span>
          <Select name="scope" options={codelistOptions("scope")} initial="company" fieldLabel={t.scope} />
        </div>

        <div className="field">
          <span className="field-label">{t.accessLevel}</span>
          <Select name="accessLevel" options={codelistOptions("accessLevel")} initial="internal" fieldLabel={t.accessLevel} />
          <span className="quiet field-hint">
            <code>internal</code>{t.accessInternalNote}<code>public</code>{t.accessPublicNote}
          </span>
        </div>

        <div className="field">
          <span className="field-label">{t.documentLanguage}</span>
          <Select name="language" options={codelistOptions("language")} initial={ctx.tenant.defaultLanguage ?? "sk"} fieldLabel={t.documentLanguage} />
          <span className="quiet field-hint">
            {t.documentLanguageNote}
          </span>
        </div>

        <div className="field">
          <span className="field-label">{dictionary(ctx.person.language).library.list.category}</span>
          <Select name="category" options={[{ value: "", label: t.unset }, ...codelistOptions("category", extras)]} initial="" fieldLabel={dictionary(ctx.person.language).library.list.category} />
        </div>

        <div className="field">
          <span className="field-label">{tf.ownerDepartment}</span>
          <Select
            name="ownerDepartmentId"
            initial=""
            fieldLabel={tf.ownerDepartment}
            options={[
              { value: "", label: tf.ownerDepartmentNone },
              ...departmentRows.map(r => ({
                value: r.department.id,
                label: `${"— ".repeat(r.level - 1)}${r.department.name}`,
              })),
            ]}
          />
          <span className="quiet field-hint">
            {departmentRows.length === 0 ? tf.ownerDepartmentEmpty : tf.ownerDepartmentNote}
          </span>
        </div>

        <label className="field">
          <span className="field-label">{tf.internalNumber}</span>
          <input className="field-input" name="internalNumber" defaultValue=""
                 maxLength={MAX_INTERNAL_NUMBER}
                 placeholder={tf.internalNumberPlaceholder}
                 autoCapitalize="none" autoCorrect="off" />
          <span className="quiet field-hint">{tf.internalNumberNote}</span>
        </label>

        <div className="field upload-wide">
          <span className="field-label">{t.tags}</span>
          <TagSelect
            name="tags"
            options={codelistOptions("tags", extras).map(v => ({ value: v.value }))}
            selected={[]}
            newLabel={t.newTag}
            language={ctx.person.language}
          />
        </div>

          </div>
        </section>

        <div><button className="button" type="submit">{t.submit}</button></div>
      </form>
    </div>
    </AppShell>
  )
}
