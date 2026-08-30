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

export const dynamic = "force-dynamic"

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ chyba?: string; title?: string; sectionKey?: string }>
}) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { chyba, title, sectionKey } = await searchParams
  // Ponuka musí obsahovať aj to, čo si organizácia dopísala (D55).
  const doplnky = tenantExtras(ctx.tenant)
  const branding = brandingView(ctx.tenant)
  const { uploadAction: nahraj } = await import("../actions")

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 680, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>← Späť do knižnice</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Nahrať dokument</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px" }}>
        Word, PDF, Excel, Markdown alebo text. Súbor sa uloží tak, ako prišiel —
        prevod je odvodenina a originál musí zostať, aby sa dalo overiť, z čoho text vznikol.
      </p>

      {chyba && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {chyba}
        </p>
      )}

      <form action={nahraj} className="karta" style={{ padding: 20, display: "grid", gap: 16 }} encType="multipart/form-data">
        <label className="pole">
          <span className="pole-popis">Súbor</span>
          <input
            className="pole-vstup"
            type="file"
            name="subor"
            required
            accept=".pdf,.docx,.xlsx,.md,.txt,.csv"
          />
          <span className="tichy pole-napoveda">
            Staré <code>.doc</code> a <code>.xls</code> sa previesť nedajú — ulož ich vo Worde
            alebo Exceli ako novší formát. Skenované PDF bez textu sa dá dať prepísať
            jazykovým modelom až v editore.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Názov</span>
          <input className="pole-vstup" name="title" defaultValue={title ?? ""} required
                 placeholder="Súťažný poriadok futbalu SFZ" />
          <span className="tichy pole-napoveda">
            Objaví sa doslovne v potvrdzovacej formulke, takže nech je to celý úradný názov.
          </span>
        </label>

        <label className="pole">
          <span className="pole-popis">Kľúč dokumentu</span>
          <input className="pole-vstup" name="sectionKey" defaultValue={sectionKey ?? ""} required
                 placeholder="sutazny_poriadok" autoCapitalize="none" autoCorrect="off" />
          <span className="tichy pole-napoveda">
            Malé písmená bez diakritiky a podčiarkovníky. Spolu s kódom organizácie tvorí
            identifikátor (<code>{ctx.tenant.companyCode.toLowerCase()}:kluc</code>).
            <strong> Ten istý kľúč znamená ten istý dokument</strong> — nahratie naň založí
            nové znenie, nie druhý dokument. Existujúce:{" "}
            {CODELISTS.sectionKey.polozky.slice(0, 8).map(p => p.key).join(", ")}.
          </span>
        </label>

        <div className="pole">
          <span className="pole-popis">Pôsobnosť</span>
          <Select meno="scope" volby={codelistOptions("scope")} predvolena="company" popisPola="Pôsobnosť" />
        </div>

        <div className="pole">
          <span className="pole-popis">Prístupnosť</span>
          <Select meno="accessLevel" volby={codelistOptions("accessLevel")} predvolena="internal" popisPola="Prístupnosť" />
          <span className="tichy pole-napoveda">
            <code>internal</code> vidia len ľudia organizácie, <code>public</code> ktokoľvek prihlásený.
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Jazyk dokumentu</span>
          <Select meno="language" volby={codelistOptions("language")} predvolena={ctx.tenant.defaultLanguage ?? "sk"} popisPola="Jazyk dokumentu" />
          <span className="tichy pole-napoveda">
            Jazyk, v ktorom je norma napísaná. Nič neprekladáme — dokument v inom jazyku
            je samostatný dokument.
          </span>
        </div>

        <div className="pole">
          <span className="pole-popis">Druh</span>
          <Select meno="category" volby={[{ hodnota: "", popis: "— neurčené —" }, ...codelistOptions("category", doplnky)]} predvolena="" popisPola="Druh" />
        </div>

        <div className="pole">
          <span className="pole-popis">Značky</span>
          <TagSelect
            meno="tags"
            ponuka={codelistOptions("tags", doplnky).map(v => ({ hodnota: v.hodnota }))}
            vybrane={[]}
            popisNovej="Nová značka"
          />
        </div>

        <div><button className="tlacidlo" type="submit">Nahrať a previesť</button></div>
      </form>
    </div>
  )
}
