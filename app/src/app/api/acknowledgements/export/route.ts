/**
 * GET /api/acknowledgements/export — moje potvrdenia ako CSV.
 *
 * **Len vlastné záznamy.** Identifikátor osoby ide z prihlásenia, nie
 * z adresy — parameter, ktorým by sa dalo vypýtať cudzie potvrdenia, tu
 * zámerne nie je (D32).
 *
 * Vo výpise sú aj IP a prehliadač. Sú to osobné údaje a človek má právo
 * vedieť, že sa o ňom ukladajú — schovať ich práve pred ním by bolo naopak.
 * Voči iným sú chránené tým, že tento súbor nikto iný nedostane.
 */

import { onboardingContext } from "@/lib/session"
import { personAcknowledgements } from "@/lib/acknowledgements"
import { toCsv } from "@/lib/csv"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await onboardingContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })

  const person = ctx.person
  const language = person.language
  const mine = dictionary(language).myAcknowledgements
  const t = mine.csv
  const records = await personAcknowledgements(person.id)

  const csv = toCsv(records, [
    { label: t.type, value: r => (r.type === "revocation" ? mine.revoked : mine.acknowledged) },
    { label: t.document, value: r => r.documentTitle },
    { label: t.version, value: r => r.versionLabel },
    { label: t.effectiveFrom, value: r => formatDate(r.effectiveFrom, language) },
    { label: t.acknowledgedAt, value: r => formatDate(r.acknowledgedAt, language) },
    { label: t.track, value: r => r.trackId ?? "" },
    // Doslovné znenie patrí do výpisu — bez neho je to zoznam názvov, nie doklad.
    { label: t.statement, value: r => r.statementText },
    { label: t.reason, value: r => r.reason ?? "" },
    { label: t.ip, value: r => r.ip ?? "" },
    { label: t.browser, value: r => r.userAgent ?? "" },
  ])

  // Názov súboru nesie adresu, nie meno: po stiahnutí do priečinka s inými
  // súbormi má byť poznať, čie to je a z ktorého dňa.
  const day = new Date().toISOString().slice(0, 10)
  const name = `potvrdenia-${person.email.replace(/[^a-z0-9.@-]/gi, "_")}-${day}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      // Doklad o vlastných potvrdeniach sa nemá odkladať v medzipamäti.
      "Cache-Control": "no-store",
    },
  })
}
