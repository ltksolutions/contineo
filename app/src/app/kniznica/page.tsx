/**
 * Knižnica dokumentov (D53).
 *
 * Doteraz sa normy dostávali dnu **len príkazovým riadkom** — `.md` plus
 * `.meta.json` pripravené vývojárom. Znamenalo to, že zákazník si novelu
 * nevie nahrať sám a pri každej zmene predpisu musí čakať na nás.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { kniznicaContext } from "@/lib/kniznica"
import { zoznamKniznice } from "@/lib/kniznica.citanie"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { formatDate } from "@/lib/i18n"
import Oznam from "@/components/Oznam"

export const dynamic = "force-dynamic"

const STAV_SPRACOVANIA: Record<string, string> = {
  nahrate: "nahraté",
  prevedene: "prevedené, nepublikované",
  zaindexovane: "vo vyhľadávaní",
  zlyhalo: "prevod zlyhal",
}

function velkost(bajtov: number): string {
  return bajtov > 1024 * 1024
    ? `${(bajtov / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bajtov / 1024))} kB`
}

export default async function Kniznica({
  searchParams,
}: {
  searchParams: Promise<{ sprava?: string; chyba?: string; hladat?: string; stav?: string }>
}) {
  const ctx = await kniznicaContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { sprava, chyba, hladat, stav } = await searchParams
  const branding = brandingView(ctx.tenant)
  const jazyk = ctx.person.language
  const riadky = await zoznamKniznice(ctx.tenant.companyCode, { hladat, stav })

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900, ...tenantStyle(branding) }}>
      <Oznam sprava={sprava} chyba={chyba === "1"} spat="/kniznica" />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>Knižnica</h1>
        <Link className="tlacidlo" href="/kniznica/nova">Nahrať dokument</Link>
      </div>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 640 }}>
        Nahratý súbor sa prevedie na text, ktorý si <strong>prečítaš a opravíš</strong> —
        až potom sa publikuje. Prevod z PDF nikdy nie je dokonalý a je to znenie,
        ktoré budú ľudia potvrdzovať.
      </p>

      <form className="audit-filter" method="get">
        <label className="pole" style={{ flex: "1 1 240px", margin: 0 }}>
          <span className="pole-popis">Hľadať</span>
          <input className="pole-vstup" name="hladat" defaultValue={hladat ?? ""} placeholder="názov alebo kľúč" />
        </label>
        <button className="tlacidlo tlacidlo--tiche" type="submit">Hľadať</button>
        {(hladat || stav) && (
          <Link className="tichy" href="/kniznica" style={{ fontSize: 14 }}>zrušiť filter</Link>
        )}
      </form>

      {riadky.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {hladat ? "Nič sa nenašlo." : "Zatiaľ tu nie je nič. Začni nahratím prvého dokumentu."}
        </p>
      ) : (
        <ul className="audit">
          {riadky.map(r => (
            <li key={r.documentId} className="karta audit-zaznam">
              <div className="audit-hlavicka">
                <Link href={`/kniznica/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>
                  {r.title}
                </Link>
                <span className="stitok">{STAV_SPRACOVANIA[r.stavSpracovania] ?? r.stavSpracovania}</span>
                {r.maKoncept && r.stav !== "published" && <span className="stitok">koncept</span>}
              </div>

              <div className="tichy audit-kto">
                {r.documentId}
                {r.povodnySubor && ` · ${r.povodnySubor.nazov} (${velkost(r.povodnySubor.bajtov)})`}
                {r.updatedAt && ` · ${formatDate(r.updatedAt, jazyk)}`}
                {r.updatedBy && ` · ${r.updatedBy}`}
              </div>

              <div className="audit-zmeny">
                <div>
                  <span className="audit-pole">platné znenie</span>
                  <span>{r.platneZnenie}</span>
                  {r.verzii > 0 && <span className="tichy"> · {r.verzii} znení</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
