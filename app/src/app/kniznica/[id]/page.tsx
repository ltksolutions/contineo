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
import { kniznicaContext } from "@/lib/kniznica"
import { detailKniznice } from "@/lib/kniznica.citanie"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import Oznam from "@/components/Oznam"
import { publikujZnenie } from "../akcie"

export const dynamic = "force-dynamic"

export default async function DetailDokumentu({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sprava?: string; chyba?: string }>
}) {
  const ctx = await kniznicaContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { sprava, chyba } = await searchParams
  const documentId = decodeURIComponent(id)
  const d = await detailKniznice(ctx.tenant.companyCode, documentId)
  if (!d) notFound()

  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language
  const koncept = (d.draftMarkdown ?? "").trim()
  const publikovany = (d.markdown ?? "").trim()
  // Koncept, ktorý sa líši od publikovaného znenia, je nedokončená práca —
  // a je to jediný stav, v ktorom má zmysel niečo publikovať.
  const jeCoPublikovat = Boolean(koncept) && koncept !== publikovany

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 760, ...tenantStyle(branding) }}>
      <Oznam sprava={sprava} chyba={chyba === "1"} spat={`/kniznica/${encodeURIComponent(documentId)}`} />

      <p style={{ margin: "0 0 12px" }}>
        <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>← Späť do knižnice</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 18px" }}>
        {d.documentId} · {d.language} · {d.accessLevel}
        {d.category && ` · ${d.category}`}
        {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
      </p>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Text</h2>
          <Link href={`/kniznica/${encodeURIComponent(documentId)}/text`}>otvoriť editor →</Link>
        </div>

        {d.originalFile ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Pôvodný súbor:{" "}
            <a href={`/api/kniznica/subor/${encodeURIComponent(d.originalFile.id)}`} target="_blank" rel="noreferrer">
              {d.originalFile.nazov}
            </a>{" "}
            · nahral {d.originalFile.nahralKto} {formatDate(d.originalFile.nahraneKedy, jazyk)}
            {d.konverzia && ` · prevod: ${d.konverzia.sposob}`}
          </p>
        ) : (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Bez pôvodného súboru — dokument sa sem dostal importom z príkazového riadka.
          </p>
        )}

        {d.konverzia?.upozornenia?.length ? (
          <ul className="tichy" style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
            {d.konverzia.upozornenia.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : null}

        <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
          {jeCoPublikovat
            ? "Koncept sa líši od publikovaného znenia."
            : koncept
              ? "Koncept je zhodný s publikovaným znením."
              : "Koncept je prázdny."}
        </p>
      </section>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 14, margin: "0 0 18px" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Publikovať znenie</h2>

        {!jeCoPublikovat ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Niet čo publikovať — koncept je prázdny alebo zhodný s tým, čo už platí.
          </p>
        ) : (
          <form action={publikujZnenie} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="documentId" value={d.documentId} />

            <label className="pole">
              <span className="pole-popis">Označenie znenia</span>
              <input className="pole-vstup" name="label" required
                     placeholder="úplné znenie z 27. 2. 2026" />
              <span className="tichy pole-napoveda">
                Objaví sa <strong>doslovne v každom zázname o potvrdení</strong>. Napíš to, čo je
                v dokumente — nie vymyslené číslo verzie, ktoré sa o rok nedá s ničím spojiť.
              </span>
            </label>

            <label className="pole">
              <span className="pole-popis">Platné od</span>
              <input className="pole-vstup" type="date" name="effectiveFrom" required />
              <span className="tichy pole-napoveda">
                Povinné. Znenie bez dátumu platnosti sa nedá ani potvrdiť a formulka ho
                obsahuje doslovne.
              </span>
            </label>

            <label className="pole">
              <span className="pole-popis">Odkiaľ je dátum</span>
              <input className="pole-vstup" name="effectiveFromSource"
                     placeholder="čl. 62 ods. 2 — účinnosť dňom schválenia VV SFZ 27. 2. 2026" />
              <span className="tichy pole-napoveda">
                Citácia ustanovenia o účinnosti. Dátum bez pôvodu sa o rok nedá overiť —
                a pritom je v každom zázname o potvrdení.
              </span>
            </label>

            <label className="pole">
              <span className="pole-popis">Čo sa zmenilo</span>
              <input className="pole-vstup" name="changeNote" placeholder="novela čl. 12 a 18" />
            </label>

            <div><button className="tlacidlo" type="submit">Publikovať</button></div>
          </form>
        )}
      </section>

      <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Znenia ({d.versions.length})</h2>

      {d.versions.length === 0 ? (
        <p className="karta" style={{ padding: 18, fontSize: 15 }}>
          Zatiaľ nič nebolo publikované, takže sa nedá ani prideliť na potvrdenie.
        </p>
      ) : (
        <ul className="audit">
          {d.versions.map(v => (
            <li key={v.versionId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <strong>{v.label}</strong>
                {v.isActive ? <span className="stitok">aktívne</span> : <span className="stitok">archivované</span>}
              </div>
              <div className="tichy audit-kto">
                {v.effectiveFrom ? `platné od ${formatDate(v.effectiveFrom, jazyk)}` : "bez dátumu platnosti"}
                {v.effectiveTo && ` do ${formatDate(v.effectiveTo, jazyk)}`}
                {v.publishedBy && ` · ${v.publishedBy}`}
                {v.publishedAt && ` · ${formatDate(v.publishedAt, jazyk)}`}
              </div>
              {v.effectiveFromSource && (
                <div className="tichy audit-poznamka">zdroj dátumu: {v.effectiveFromSource}</div>
              )}
              {v.changeNote && <div className="tichy audit-poznamka">{v.changeNote}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
