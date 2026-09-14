/**
 * Editor textu — originál vedľa Markdownu (D53).
 *
 * **Prečo obidve strany naraz:** prevod z PDF je odhad. Rozdiel medzi „vyzerá
 * to dobre" a „je to naozaj to, čo je v norme" sa dá zistiť len porovnaním
 * a človek, ktorý musí prepínať okná, ho neurobí. Na telefóne sa stĺpce
 * poskladajú pod seba — originál je vtedy zbalený, aby sa text dal upravovať.
 *
 * Bez klientskeho stavu: je to formulár, ktorý sa odosiela na server. Návrh
 * modelu je uložený vedľa konceptu, nie v pamäti prehliadača — inak by sa
 * stratil obnovením stránky, presne keď má človek rozhodnúť.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { libraryContext } from "@/lib/library"
import { libraryDetail } from "@/lib/libraryRead"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate, dictionary } from "@/lib/i18n"
import Notice from "@/components/Notice"
import { createHash } from "node:crypto"
import TextEditor from "@/components/TextEditor"
import { saveTextAction, sendToModelAction, decideOnDraftAction } from "../../actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

/**
 * Krátky odtlačok textu — len na rozlíšenie, či sa zmenil.
 *
 * Nie je to bezpečnostná funkcia a nemusí ňou byť: rozhoduje o tom, či sa
 * má znovu postaviť editor, nie o obsahu dokumentu.
 */
function textKey(text: string): string {
  return `${text.length}:${createHash("sha256").update(text).digest("hex").slice(0, 12)}`
}

export default async function EditorPage({
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

  // Návrh sa nečíta cez `detailKniznice` — je to dočasná vec editora, nie
  // súčasť dokumentu, a v zozname by nemal čo robiť.
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const raw = (await col.findOne(
    { companyCode: ctx.tenant.companyCode, documentId },
    { projection: { llmDraft: 1 } },
  )) as { llmDraft?: { text: string; model: string; mode: string; at: Date } } | null
  const draft = raw?.llmDraft

  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).library.editor
  const isPdf = d.originalFile?.type === "pdf"
  const fileUrl = d.originalFile
    ? `/api/library/file/${encodeURIComponent(d.originalFile.id)}`
    : null

  return (
    <AppShell language={ctx.person.language}>
    <div style={{ maxWidth: 1200, ...tenantStyle(branding) }}>
      <Notice message={message} error={error === "1"} back={`/library/${encodeURIComponent(documentId)}/text`} />

      <p style={{ margin: "0 0 10px" }}>
        <Link className="quiet" href={`/library/${encodeURIComponent(documentId)}`} style={{ fontSize: 14 }}>
          {t.back}
        </Link>
      </p>

      <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="quiet" style={{ fontSize: 14, margin: "0 0 16px" }}>
        {t.intro}
      </p>

      {d.conversion?.warnings?.length ? (
        <ul className="card" style={{ padding: "12px 16px 12px 34px", margin: "0 0 16px", fontSize: 14 }}>
          {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      ) : null}

      {draft ? (
        <section className="card" style={{ padding: 18, display: "grid", gap: 12, margin: "0 0 18px" }}>
          {/*
            Štítok aj poznámka sa riadia tým, čo návrh naozaj vyrobilo.
            Prečistenie členenia beží na pravidlách; povedať nad ním „návrh
            modelu" by bolo tvrdenie o pôvode textu normy, a to je presne
            ten údaj, ktorý musí sedieť.
          */}
          <div className="audit-head">
            <span className="tag">{draft.mode === "rewrite-scan" ? t.modelDraft : t.ruleDraft}</span>
            <strong>{draft.mode === "rewrite-scan" ? t.modeRewriteScan : t.modeClean}</strong>
            <span className="quiet" style={{ fontSize: 13 }}>
              {t.draftMeta(draft.model, formatDate(draft.at, language), draft.text.length)}
            </span>
          </div>
          <p className="quiet" style={{ fontSize: 13.5, margin: 0 }}>
            {draft.mode === "rewrite-scan" ? t.draftNoteBefore : t.ruleNoteBefore}
            <strong>{t.draftNoteHighlight}</strong>{t.draftNoteAfter}
          </p>
          <textarea className="field-input editor-text" readOnly rows={14} value={draft.text} />
          <form action={decideOnDraftAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="documentId" value={documentId} />
            <button className="button" type="submit" name="choice" value="accept">{t.useAsDraft}</button>
            <button className="button button--quiet" type="submit" name="choice" value="discard">{t.discard}</button>
          </form>
        </section>
      ) : null}

      <div className="editor-grid">
        <section className="editor-column">
          <h2 className="field-label" style={{ margin: "0 0 8px" }}>{t.original}</h2>
          {fileUrl ? (
            isPdf ? (
              <object className="editor-preview" data={fileUrl} type="application/pdf">
                <p className="quiet" style={{ fontSize: 14, padding: 12 }}>
                  {t.pdfNotShown}
                  <a href={fileUrl} target="_blank" rel="noreferrer">{t.openInNewWindow}</a>.
                </p>
              </object>
            ) : (
              <p className="card" style={{ padding: 16, fontSize: 14 }}>
                {t.fileNotShown(d.originalFile?.name ?? "")}
                <a href={fileUrl} target="_blank" rel="noreferrer">{t.download}</a>{t.compareAfterDownload}
              </p>
            )
          ) : (
            <p className="card" style={{ padding: 16, fontSize: 14 }}>
              {t.noOriginal}
            </p>
          )}
        </section>

        <section className="editor-column">
          <h2 className="field-label" style={{ margin: "0 0 8px" }}>
            {t.text}
            <span className="quiet" style={{ fontWeight: 400 }}>
              {t.switchNoteBefore}<em>{t.switchNoteModes}</em>{t.switchNoteAfter}
            </span>
          </h2>
          <form action={saveTextAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={documentId} />
            {/*
              `key` je odtlačok textu zo servera, nie ozdoba.

              Editor sa vytvára **raz** a ďalšie vykreslenia doň zámerne
              nesiahajú — inak by prepísal text, ktorý medzitým niekto
              napísal. Lenže po prijatí návrhu sa text na serveri zmení
              a obrazovka zostala na starom: ukazovala predošlé znenie
              a skryté pole formulára ho nieslo tiež, takže „Uložiť text"
              by **prijatý návrh ticho vrátil späť**. Nájdené nácvikom
              2026-09-14 hneď po prijatí prečisteného členenia.

              S odtlačkom v `key` sa editor znovu postaví práve vtedy, keď
              sa zmenil text na serveri — a pri obyčajnom prekreslení nie.
            */}
            <TextEditor
              key={textKey(d.editableText)}
              name="markdown"
              initial={d.editableText}
            />
            <div><button className="button" type="submit">{t.saveText}</button></div>
          </form>
        </section>
      </div>

      <section className="card" style={{ padding: 18, display: "grid", gap: 10, marginTop: 18 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>{t.llmHeading}</h2>
        <p className="quiet" style={{ fontSize: 14, margin: 0 }}>
          {t.llmNoteBefore}<strong>{t.llmNoteHighlight}</strong>{t.llmNoteAfter}
        </p>
        <form action={sendToModelAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input type="hidden" name="documentId" value={documentId} />
          <button className="button button--quiet" type="submit" name="mode" value="clean">
            {t.clean}
          </button>
          {isPdf && (
            <button className="button button--quiet" type="submit" name="mode" value="rewrite-scan">
              {t.rewriteScan}
            </button>
          )}
        </form>
        {/*
          Ktoré tlačidlo volá model a ktoré nie, musí byť vidieť **pri nich**,
          nie v návode. Prečistenie beží na pravidlách a nemení slová; prepis
          zo skenu posiela dokument modelu. Pre toho, kto rozhoduje o znení
          predpisu, je to rozdiel, ktorý má poznať pred kliknutím.
        */}
        <p className="quiet" style={{ fontSize: 13.5, margin: 0 }}>
          {t.cleanNote}
        </p>
        {isPdf && (
          <p className="quiet" style={{ fontSize: 13.5, margin: 0 }}>
            {t.rewriteScanNote}
          </p>
        )}
      </section>
    </div>
    </AppShell>
  )
}
