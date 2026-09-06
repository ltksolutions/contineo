/**
 * GET /hr/overview/csv — výkaz potvrdení ako CSV.
 *
 * Exportuje sa **ten istý zoznam**, z ktorého sa počítajú čísla na obrazovke
 * (`duties()`), nie druhý dotaz s podobnými podmienkami. Výkaz, ktorý sa
 * nezhoduje s obrazovkou, je horší než žiadny — a rozišiel by sa práve pri
 * ďalšej zmene pravidiel, teda vtedy, keď si to nikto nevšimne.
 *
 * Riadok je **jedna povinnosť**: osoba × znenie. Nie zhrnutie — z riadkov sa
 * súčet spraviť dá, zo súčtu riadky nie.
 */

import { hrContext } from "@/lib/hr"
import { duties } from "@/lib/hrReport"
import { toCsv } from "@/lib/csv"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await hrContext()
  // Prístup sa overuje aj tu. To, že sa odkaz na export dá kliknúť len na
  // chránenej stránke, nie je kontrola prístupu — adresa sa dá napísať.
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }

  const language = ctx.person.language
  const t = dictionary(language).hr.report
  const rows = await duties(ctx.person.companyCode)

  const csv = toCsv(rows, [
    { label: "personId", value: d => d.personId },
    { label: "fullName", value: d => d.fullName },
    { label: "email", value: d => d.email },
    { label: "documentId", value: d => d.documentId },
    { label: "documentTitle", value: d => d.documentTitle },
    { label: "versionId", value: d => d.versionId },
    { label: "versionLabel", value: d => d.versionLabel },
    {
      label: "source",
      value: d => d.sources.length === 2 ? t.source.both : t.source[d.sources[0]],
    },
    { label: "tracks", value: d => d.trackTitles.join(", ") },
    // ISO, nie miestny formát: výkaz sa otvára v Exceli aj v skripte a dátum
    // „6. 9. 2026" sa v druhom prípade zoradí abecedne.
    { label: "acknowledgedAt", value: d => d.acknowledgedAt?.toISOString() ?? "" },
    { label: "readingSeconds", value: d => d.readingSeconds ?? "" },
  ])

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="potvrdenia-${ctx.person.companyCode}-${stamp}.csv"`,
      // Výkaz je osobný údaj o konkrétnych ľuďoch — nikde sa neukladá.
      "Cache-Control": "no-store",
    },
  })
}
