/**
 * GET /hr/evidence/csv — reťaz dôkazov ako CSV.
 *
 * Exportuje sa **ten istý zoznam a s tými istými filtrami**, aký je na
 * obrazovke — nie druhý dotaz s podobnými podmienkami. Výkaz, ktorý sa
 * nezhoduje s obrazovkou, je horší než žiadny.
 *
 * Riadok je **jedna povinnosť**: osoba × znenie. Zo súčtu sa riadky spraviť
 * nedajú, z riadkov súčet áno.
 */

import { hrContext } from "@/lib/hr"
import { evidenceRows } from "@/lib/evidenceDb"
import { toCsv } from "@/lib/csv"
import { dictionary } from "@/lib/i18n"
import type { EvidenceState } from "@/lib/evidence"

export const dynamic = "force-dynamic"

const STATES: EvidenceState[] = ["acknowledged", "opened-not-acknowledged", "not-opened"]

export async function GET(request: Request) {
  const ctx = await hrContext()
  // Prístup sa overuje aj tu: to, že odkaz na export visí na chránenej
  // stránke, nie je kontrola prístupu — adresa sa dá napísať.
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }

  const language = ctx.person.language
  const t = dictionary(language).evidence
  const url = new URL(request.url)
  const wantedState = STATES.includes(url.searchParams.get("state") as EvidenceState)
    ? (url.searchParams.get("state") as EvidenceState)
    : null
  const wantedPerson = (url.searchParams.get("person") ?? "").trim().toLowerCase()

  const rows = (await evidenceRows(ctx.person.companyCode)).filter(r =>
    (!wantedState || r.state === wantedState) &&
    (!wantedPerson ||
      r.duty.fullName.toLowerCase().includes(wantedPerson) ||
      r.duty.email.toLowerCase().includes(wantedPerson)),
  )

  const iso = (d: Date | null) => (d ? d.toISOString() : "")

  const csv = toCsv(rows, [
    { label: "personId", value: r => r.duty.personId },
    { label: "fullName", value: r => r.duty.fullName },
    { label: "email", value: r => r.duty.email },
    { label: "documentId", value: r => r.duty.documentId },
    { label: "documentTitle", value: r => r.duty.documentTitle },
    { label: "versionId", value: r => r.duty.versionId },
    { label: "versionLabel", value: r => r.duty.versionLabel },
    // ISO, nie miestny formát: výkaz sa otvára v Exceli aj v skripte.
    { label: "assignedAt", value: r => iso(r.duty.since) },
    { label: "due", value: r => iso(r.duty.due) },
    { label: "firstOpenedAt", value: r => iso(r.firstOpenedAt) },
    /*
      Čas čítania je v exporte označený ako informatívny **v názve stĺpca**,
      nie v poznámke pod tabuľkou. Kto si CSV otvorí v Exceli, poznámku
      nevidí — a práve tam sa z merania najľahšie stane „dôkaz".
    */
    {
      label: "readingSeconds_informative",
      value: r => (r.duty.readingSeconds === null ? "" : String(r.duty.readingSeconds)),
    },
    { label: "acknowledgedAt", value: r => iso(r.duty.acknowledgedAt) },
    { label: "state", value: r => t.states[r.state] },
  ])

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="retaz-dokazov-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
