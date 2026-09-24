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
import Notice from "@/components/Notice"
import { MAX_BYTES, MAX_FORM_BYTES, SOURCE_EXTENSIONS } from "@/lib/fileStore"
import UploadFiles from "@/components/UploadFiles"
import KeyPreview from "@/components/KeyPreview"
import VersionMetaFields from "@/components/VersionMetaFields"
import PrefillNote from "@/components/PrefillNote"
import { versionMetaSuggestions, tagOptions } from "@/lib/libraryRead"
import UploadSubmit from "@/components/UploadSubmit"
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

  const { error, title, documentKey } = normalizeQuery<{
    error?: string; title?: string; documentKey?: string
  }>(await searchParams)
  // Ponuka musí obsahovať aj to, čo si organizácia dopísala (D55).
  const t = dictionary(ctx.person.language).library.upload
  const extras = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  // Oddelenia nie sú číselník v repozitári, ale strom v databáze — iný pre
  // každú organizáciu. Preto sa načítavajú, nie importujú.
  const tf = dictionary(ctx.person.language).library.fields
  const tl = dictionary(ctx.person.language).library.list
  const departmentRows = flattenTree(await allDepartments(ctx.tenant.companyCode))
  const { uploadAction: upload } = await import("../actions")
  // Formulár predvyplnený po chybe = súbor treba vybrať znova.
  const retry = Boolean(error || title)
  const tm = dictionary(ctx.person.language).versionMeta
  const metaOptions = await versionMetaSuggestions(ctx.tenant.companyCode)

  // **Kľúče, ktoré organizácia už má.** Nahratie na obsadený kľúč sa odmietne
  // (D80) — a dozvedieť sa to až po tom, čo človek vyplní formulár a nahrá
  // súbor, je zbytočne neskoro. Zoznam je serverový zámerne: obrazovka nemá
  // vyžadovať JavaScript kvôli nápovede.
  const usedKeys = (await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: ctx.tenant.companyCode }, { projection: { documentKey: 1 } })
    .toArray() as unknown as { documentKey?: string }[])
    .map(d => d.documentKey ?? "")
    .filter(Boolean)
    .sort()

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="quiet" href="/library" style={{ fontSize: "var(--fs-body)" }}>{t.back}</Link>
      </p>

      <h1 className="page-title">{t.heading}</h1>
      <p className="quiet page-lead" style={{ margin: "0 0 20px" }}>
        {t.intro}
      </p>

      {/*
        Chyba sa musí dať prežiť (NAHRAVANIE, úloha 1): hláška povie, čo
        presne treba opraviť, a že súbor treba vybrať znova — prehliadač ho
        z bezpečnostných dôvodov neuchová. Ten istý `<Notice>` ako inde
        (červená je chyba, jantárová upozornenie); po zavretí ostane
        formulár predvyplnený z adresy a zóna na súbor zvýraznená.
      */}
      <Notice
        message={error ? `${t.errorBefore}${error} ${t.errorFileAgain}` : undefined}
        error
        back={`/library/new?${new URLSearchParams({
          ...(title ? { title } : {}),
          ...(documentKey ? { documentKey } : {}),
        }).toString()}`}
      />

      {/*
        Číslované sekcie, **nie stepper**.

        Návrh má tri kroky (Súbor / Metadáta / Schválenie) a prepínanie medzi
        nimi. Nahratie je ale **jedno odoslanie formulára**: súbor aj metadáta
        idú naraz a sprievodca by sľuboval priebeh, ktorý sa nekoná.

        **Schvaľovanie medzitým vzniklo** (ADR-006) — pôvodné znenie tohto
        komentára tvrdilo, že „schvaľovací krok v systéme neexistuje", a to
        už nie je pravda. Do tohto formulára ale nepatrí ani tak: schvaľuje
        sa **znenie**, nie nahratý súbor, a deje sa to na detaile dokumentu
        po prečítaní prevedeného textu. Tretí krok by tu stále nikam neviedol,
        len z iného dôvodu než vtedy.
      */}
      <form action={upload} className="upload-form">
        <section className="card upload-section">
          <h2 className="upload-step"><span className="upload-step-no">1</span>{t.sectionFile}</h2>

          <UploadFiles
            highlight={retry}
            pdfAccept=".pdf,application/pdf"
            sourceAccept={SOURCE_EXTENSIONS.join(",")}
            maxBytes={MAX_BYTES}
            labels={{
              pdfTitle: t.pdfTitle,
              pdfNote: t.pdfNote,
              sourceTitle: t.sourceTitle,
              sourceNote: `${t.sourceNote} ${SOURCE_EXTENSIONS.map(e => e.slice(1).toUpperCase()).join(" · ")}`,
              maxSize: t.maxSize(MAX_BYTES / 1024 / 1024),
              noScriptLimit: t.noScriptLimit(MAX_FORM_BYTES / 1024 / 1024),
              uploading: t.uploadingFile,
              failed: t.uploadFailed,
              tooLarge: t.fileTooLarge,
              progressTitle: t.submitPending,
              converting: t.submitPendingNote,
              change: t.change,
            }}
          />
        </section>

        <section className="card upload-section">
          <h2 className="upload-step"><span className="upload-step-no">2</span>{t.sectionMeta}</h2>
          <div className="upload-grid">

        {/*
          Kľúč sa negeneruje ručne (NAHRAVANIE, úloha 4 / ADR-010): pod
          názvom je náhľad výsledného identifikátora, ručný kľúč je vedomý
          krok za `<details>`. Bez skriptu náhľad nie je a kľúč doplní server.
        */}
        <KeyPreview
          prefix={ctx.tenant.companyCode.toLowerCase()}
          usedKeys={usedKeys}
          initialTitle={title ?? ""}
          initialKey={documentKey ?? ""}
          labels={{
            title: t.title,
            titlePlaceholder: t.titlePlaceholder,
            titleNote: t.titleNote,
            preview: t.keyPreview,
            manualSummary: t.keyManualSummary,
            manualLabel: t.key,
            manualNote: t.keyManualNote,
            taken: t.keyTaken,
            keysTaken: t.keysTaken,
          }}
        />

        {/*
          Druh je povinný a medzi hlavnými poľami (NAHRAVANIE, úloha 5 /
          ADR-010): zoskupovanie prebral po Zaradení. Natívny `<select
          required>`, nie komponent Select — ten povinnosť vynútiť nevie
          (skrytý input) a natívne pole ju drží aj bez skriptu. Server ho
          nechá nepovinný: import, seed a staré dokumenty bez Druhu sa
          nerozbijú (rozhodnutie Jána 2026-09-21).
        */}
        <label className="field">
          <span className="field-label">{tl.category}</span>
          <select className="field-input" name="category" required defaultValue="">
            <option value="" disabled>{t.unset}</option>
            {codelistOptions("category", extras).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="quiet field-hint">
            {t.categoryNote}{CODELISTS.category.items.slice(0, 8).map(p => p.key).join(", ")}.
          </span>
        </label>
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

        {/*
          Ďalšie údaje v `<details>` (NAHRAVANIE, úloha 6): na telefóne bol
          stĺpec 11 polí ~1400 px vysoký. Vždy `open` — zbalené nepovinné
          polia na desktope by boli skrytá práca; na telefóne stačí, že sú
          dole. Bez skriptu funguje rovnako.
        */}
        <details className="upload-optional upload-wide" open>
          <summary>{t.moreFields}</summary>
          <div className="upload-grid upload-optional-grid">
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
            options={await tagOptions(ctx.tenant.companyCode, extras)}
            selected={[]}
            newLabel={t.newTag}
            language={ctx.person.language}
          />
        </div>
        <div className="field">
          <span className="field-label">{t.scope}</span>
          <Select name="scope" options={codelistOptions("scope")} initial="company" fieldLabel={t.scope} />
        </div>
          </div>
        </details>

          </div>
        </section>

        {/*
          Údaje o znení (ADR-013). Nepovinné už tu: keď sa nevyplnia,
          predvyplnia sa z prvej strany dokumentu a potvrdia na detaile (D108).
        */}
        <section className="card upload-section">
          <h2 className="upload-step">
            <span className="upload-step-no">3</span>{tm.uploadHeading}
            <span className="upload-step-opt">{t.optional}</span>
          </h2>
          <PrefillNote text={tm.uploadNote} wordText={t.prefillFromWord} />
          <VersionMetaFields
            authors={metaOptions.authors}
            approvers={metaOptions.approvers}
            language={ctx.person.language}
          />
        </section>

        <div className="upload-submit">
          <UploadSubmit labels={{ submit: t.submit, pending: t.submitPending, pickPdfFirst: t.pickPdfFirst }} />
        </div>
      </form>
    </div>
    </AppShell>
  )
}
