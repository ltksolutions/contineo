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
import { formatDate } from "@/lib/i18n"
import Notice from "@/components/Notice"
import TextEditor from "@/components/TextEditor"
import { saveTextAction, sendToModelAction, decideOnDraftAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sprava?: string; chyba?: string }>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { sprava, chyba } = await searchParams
  const documentId = decodeURIComponent(id)
  const d = await libraryDetail(ctx.tenant.companyCode, documentId)
  if (!d) notFound()

  // Návrh sa nečíta cez `detailKniznice` — je to dočasná vec editora, nie
  // súčasť dokumentu, a v zozname by nemal čo robiť.
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const surovy = (await col.findOne(
    { companyCode: ctx.tenant.companyCode, documentId },
    { projection: { llmNavrh: 1 } },
  )) as { llmNavrh?: { text: string; model: string; rezim: string; kedy: Date } } | null
  const navrh = surovy?.llmNavrh

  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language
  const jePdf = d.originalFile?.typ === "pdf"
  const odkazNaSubor = d.originalFile
    ? `/api/kniznica/subor/${encodeURIComponent(d.originalFile.id)}`
    : null

  return (
    <div className="obal" style={{ padding: "24px 20px 80px", maxWidth: 1200, ...tenantStyle(branding) }}>
      <Notice sprava={sprava} chyba={chyba === "1"} spat={`/kniznica/${encodeURIComponent(documentId)}/text`} />

      <p style={{ margin: "0 0 10px" }}>
        <Link className="tichy" href={`/kniznica/${encodeURIComponent(documentId)}`} style={{ fontSize: 14 }}>
          ← Späť na dokument
        </Link>
      </p>

      <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 16px" }}>
        Porovnaj text s originálom. Publikovanie je samostatný krok — tu sa nič nepúšťa von.
      </p>

      {d.konverzia?.upozornenia?.length ? (
        <ul className="karta" style={{ padding: "12px 16px 12px 34px", margin: "0 0 16px", fontSize: 14 }}>
          {d.konverzia.upozornenia.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      ) : null}

      {navrh ? (
        <section className="karta" style={{ padding: 18, display: "grid", gap: 12, margin: "0 0 18px" }}>
          <div className="audit-hlavicka">
            <span className="stitok">návrh modelu</span>
            <strong>{navrh.rezim === "prepisat-sken" ? "prepis skenu" : "prečistenie členenia"}</strong>
            <span className="tichy" style={{ fontSize: 13 }}>
              {navrh.model} · {formatDate(navrh.kedy, jazyk)} · {navrh.text.length} znakov
            </span>
          </div>
          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            Model mal zakázané meniť znenie — <strong>over to</strong>. Prijatím sa návrh stane
            konceptom; pôvodný text sa tým prepíše.
          </p>
          <textarea className="pole-vstup editor-text" readOnly rows={14} value={navrh.text} />
          <form action={decideOnDraftAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="documentId" value={documentId} />
            <button className="tlacidlo" type="submit" name="volba" value="prijat">Použiť ako koncept</button>
            <button className="tlacidlo tlacidlo--tiche" type="submit" name="volba" value="zahodit">Zahodiť</button>
          </form>
        </section>
      ) : null}

      <div className="editor-mriezka">
        <section className="editor-stlpec">
          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>Originál</h2>
          {odkazNaSubor ? (
            jePdf ? (
              <object className="editor-nahlad" data={odkazNaSubor} type="application/pdf">
                <p className="tichy" style={{ fontSize: 14, padding: 12 }}>
                  Prehliadač PDF nezobrazí.{" "}
                  <a href={odkazNaSubor} target="_blank" rel="noreferrer">Otvor ho v novom okne</a>.
                </p>
              </object>
            ) : (
              <p className="karta" style={{ padding: 16, fontSize: 14 }}>
                {d.originalFile?.nazov} sa v prehliadači nezobrazí.{" "}
                <a href={odkazNaSubor} target="_blank" rel="noreferrer">Stiahni ho</a> a porovnaj vedľa.
              </p>
            )
          ) : (
            <p className="karta" style={{ padding: 16, fontSize: 14 }}>
              Bez pôvodného súboru — dokument sa sem dostal importom z príkazového riadka,
              takže niet čo porovnávať.
            </p>
          )}
        </section>

        <section className="editor-stlpec">
          <h2 className="pole-popis" style={{ margin: "0 0 8px" }}>
            Text
            <span className="tichy" style={{ fontWeight: 400 }}>
              {" "}— prepínač <em>Markdown / WYSIWYG</em> je dole v editore
            </span>
          </h2>
          <form action={saveTextAction} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="documentId" value={documentId} />
            <TextEditor meno="markdown" pociatocny={d.textNaUpravu} />
            <div><button className="tlacidlo" type="submit">Uložiť text</button></div>
          </form>
        </section>
      </div>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 10, marginTop: 18 }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Pomoc jazykového modelu</h2>
        <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
          Volá sa len takto — kliknutím. Výsledok sa uloží ako <strong>návrh vedľa textu</strong>,
          nie doňho: model má zakázané meniť znenie, ale tichú zmenu v predpise by
          nikto nezachytil, keby sa zapisovala rovno.
        </p>
        <form action={sendToModelAction} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input type="hidden" name="documentId" value={documentId} />
          <button className="tlacidlo tlacidlo--tiche" type="submit" name="rezim" value="precistit">
            Prečistiť členenie
          </button>
          {jePdf && (
            <button className="tlacidlo tlacidlo--tiche" type="submit" name="rezim" value="prepisat-sken">
              Prepísať zo skenu
            </button>
          )}
        </form>
        {jePdf && (
          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            &bdquo;Prepísať zo skenu&ldquo; pošle celé pôvodné PDF modelu. Má zmysel vtedy, keď PDF
            nemá textovú vrstvu alebo je prevod rozsypaný.
          </p>
        )}
      </section>
    </div>
  )
}
