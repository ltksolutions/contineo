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
import { formatDate } from "@/lib/i18n"
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
        <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>← Späť do knižnice</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{d.title}</h1>
      <p className="tichy" style={{ fontSize: 14, margin: "0 0 18px" }}>{d.documentId}</p>

      <details className="karta" style={{ padding: 18, margin: "0 0 18px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Údaje o dokumente
          <span className="tichy" style={{ fontWeight: 400, fontSize: 13.5 }}>
            {" "}· {d.language} · {d.accessLevel}
            {d.category && ` · ${d.category}`}
            {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
          </span>
        </summary>

        <form action={saveDocumentMetadataAction} style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <input type="hidden" name="documentId" value={d.documentId} />

          <label className="pole">
            <span className="pole-popis">Názov</span>
            <input className="pole-vstup" name="title" defaultValue={d.title} required />
            <span className="tichy pole-napoveda">
              Meniť sa dá. Objaví sa v ďalších potvrdeniach; staré záznamy si nesú kópiu
              názvu z času potvrdenia, takže sa spätne nezmenia.
            </span>
          </label>

          <div className="pole">
            <span className="pole-popis">Pôsobnosť</span>
            <Select name="scope" options={codelistOptions("scope")} initial={d.scope ?? "company"} fieldLabel="Pôsobnosť" />
          </div>

          <div className="pole">
            <span className="pole-popis">Prístupnosť</span>
            <Select name="accessLevel" options={codelistOptions("accessLevel")} initial={d.accessLevel ?? "internal"} fieldLabel="Prístupnosť" />
          </div>

          <div className="pole">
            <span className="pole-popis">Jazyk dokumentu</span>
            <Select name="language" options={codelistOptions("language")} initial={d.language ?? "sk"} fieldLabel="Jazyk dokumentu" />
          </div>

          <div className="pole">
            <span className="pole-popis">Druh</span>
            <Select
              name="category"
              options={[{ value: "", label: "— neurčené —" }, ...codelistOptions("category", extras)]}
              initial={d.category ?? ""}
              fieldLabel="Druh"
            />
          </div>

          <div className="pole">
            <span className="pole-popis">Značky</span>
            <TagSelect
              name="tags"
              options={codelistOptions("tags", extras).map(v => ({ value: v.value }))}
              selected={d.tags}
              newLabel="Nová značka"
            />
          </div>

          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            Kľúč <code>{d.documentId}</code> sa meniť nedá — je v úsekoch, v prideleniach
            aj v záznamoch o potvrdení. Zmena by nebola premenovanie, ale druhý dokument,
            ku ktorému by sa história nedostala.
          </p>

          <div><button className="tlacidlo" type="submit">Uložiť údaje</button></div>
        </form>
      </details>

      <form action={assignToFolderAction} className="karta strom-forma" style={{ padding: 18, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <div className="pole" style={{ flex: "1 1 260px", margin: 0 }}>
          <span className="pole-popis">Priečinok</span>
          <Select
            name="folderId"
            initial={d.folderId ?? ""}
            fieldLabel="Priečinok"
            options={[
              { value: "", label: "— nezaradené —" },
              ...folderTree.map(r => ({
                value: r.folder.id,
                label: `${"— ".repeat(r.level - 1)}${r.folder.name}`,
              })),
            ]}
          />
          <span className="tichy pole-napoveda">
            Priečinky sú len zaradenie — súbor ani text sa nikam nepresúva. Filter
            v knižnici nájde dokument aj cez nadriadený priečinok.
          </span>
        </div>
        <button className="tlacidlo tlacidlo--tiche" type="submit">Zaradiť</button>
      </form>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Text</h2>
          <Link href={`/kniznica/${encodeURIComponent(documentId)}/text`}>otvoriť editor →</Link>
        </div>

        {d.originalFile ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Pôvodný súbor:{" "}
            <a href={`/api/kniznica/subor/${encodeURIComponent(d.originalFile.id)}`} target="_blank" rel="noreferrer">
              {d.originalFile.name}
            </a>{" "}
            · nahral {d.originalFile.uploadedBy} {formatDate(d.originalFile.uploadedAt, language)}
            {d.conversion && ` · prevod: ${d.conversion.method}`}
          </p>
        ) : (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Bez pôvodného súboru — dokument sa sem dostal importom z príkazového riadka.
          </p>
        )}

        {d.conversion?.warnings?.length ? (
          <ul className="tichy" style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
            {d.conversion.warnings.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : null}

        <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
          {hasChangesToPublish
            ? "Koncept sa líši od publikovaného znenia."
            : draft || published
              ? "Koncept je zhodný s publikovaným znením."
              : "Koncept je prázdny."}
        </p>
      </section>

      <section className="karta" style={{ padding: 18, display: "grid", gap: 14, margin: "0 0 18px" }}>
        <h2 style={{ fontSize: 17, margin: 0 }}>Publikovať znenie</h2>

        {!hasChangesToPublish ? (
          <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
            Niet čo publikovať — koncept je prázdny alebo zhodný s tým, čo už platí.
          </p>
        ) : (
          <form action={publishVersionAction} style={{ display: "grid", gap: 14 }}>
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

      <form action={reindexDocumentAction} className="karta" style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}>
        <input type="hidden" name="documentId" value={d.documentId} />
        <h2 style={{ fontSize: 17, margin: 0 }}>Preindexovať</h2>
        <p className="tichy" style={{ fontSize: 14, margin: 0 }}>
          Nareže platné znenie znova podľa aktuálneho profilu členenia. <strong>Nevytvorí
          novú verziu</strong> — text sa nemení, takže potvrdenia zostávajú platné a nikomu
          nenaskočí povinnosť potvrdzovať znova. Používa sa po vyladení profilu
          v nastavení organizácie.
        </p>
        <div><button className="tlacidlo tlacidlo--tiche" type="submit">Preindexovať</button></div>
      </form>

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
                {v.effectiveFrom ? `platné od ${formatDate(v.effectiveFrom, language)}` : "bez dátumu platnosti"}
                {v.effectiveTo && ` do ${formatDate(v.effectiveTo, language)}`}
                {v.publishedBy && ` · ${v.publishedBy}`}
                {v.publishedAt && ` · ${formatDate(v.publishedAt, language)}`}
              </div>
              {v.effectiveFromSource && (
                <div className="tichy audit-poznamka">zdroj dátumu: {v.effectiveFromSource}</div>
              )}
              {v.changeNote && <div className="tichy audit-poznamka">{v.changeNote}</div>}

              <details style={{ marginTop: 6 }}>
                <summary className="tichy" style={{ fontSize: 13, cursor: "pointer" }}>opraviť údaje</summary>
                <form action={fixVersionAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <input type="hidden" name="documentId" value={d.documentId} />
                  <input type="hidden" name="versionId" value={v.versionId} />

                  <label className="pole">
                    <span className="pole-popis">Označenie</span>
                    <input className="pole-vstup" name="label" defaultValue={v.label} />
                  </label>

                  <label className="pole">
                    <span className="pole-popis">Platné od</span>
                    <input
                      className="pole-vstup"
                      type="date"
                      name="effectiveFrom"
                      defaultValue={v.effectiveFrom ? new Date(v.effectiveFrom).toISOString().slice(0, 10) : ""}
                    />
                    <span className="tichy pole-napoveda">
                      Dátum je <strong>doslovne</strong> vo formulke, ktorú ľudia podpísali. Ak ho
                      meníš a znenie už niekto potvrdil, budeš musieť rozhodnúť, či ide o opravu
                      zápisu, alebo o zmenu, ktorú treba potvrdiť znova.
                    </span>
                  </label>

                  <label className="pole">
                    <span className="pole-popis">Odkiaľ je dátum</span>
                    <input className="pole-vstup" name="effectiveFromSource" defaultValue={v.effectiveFromSource ?? ""} />
                  </label>

                  <label className="pole">
                    <span className="pole-popis">Dôvod opravy</span>
                    <input className="pole-vstup" name="dovod" required
                           placeholder="preklep v označení; dátum z uznesenia VV SFZ" />
                    <span className="tichy pole-napoveda">
                      Povinný. Bez neho sa o rok nedá zistiť, či išlo o preklep alebo o zmenu povinnosti.
                    </span>
                  </label>

                  <div className="pole">
                    <span className="pole-popis">Ak sa mení dátum a znenie už niekto potvrdil</span>
                    <Select
                      name="priZmeneDatumu"
                      initial=""
                      fieldLabel="Ako naložiť s potvrdeniami"
                      options={[
                        { value: "", label: "— rozhodnem, až keď sa spýta —" },
                        { value: "oprava", label: "oprava zápisu, potvrdenia zostávajú" },
                        { value: "znovaPotvrdit", label: "podstatná zmena, potvrdiť znova" },
                      ]}
                    />
                  </div>

                  <div><button className="tlacidlo tlacidlo--tiche" type="submit">Opraviť</button></div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
