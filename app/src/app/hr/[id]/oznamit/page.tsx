/**
 * Náhľad pred rozposlaním.
 *
 * Prideliť a dať o tom vedieť sú **dve rozhodnutia**, nie jedno. Pridelenie
 * sa dá odvolať; odoslaný e-mail nie. Preto sa najprv ukáže, komu presne
 * a s akým textom to pôjde — a až potom je tlačidlo.
 *
 * Je to ten istý vzor ako pri pokynoch k doménam: nič sa neposiela ako
 * vedľajší účinok inej akcie.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { loadAssignment, nepotvrdili, audienceLabel } from "@/lib/assignments"
import { assignmentEmail } from "@/lib/ecomail"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { requestHostname } from "@/lib/session"
import { formatDate, normalizeLanguage } from "@/lib/i18n"
import { poslatOznamenie } from "../../akcie"

export const dynamic = "force-dynamic"

export default async function Oznamit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chyba?: string }>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { id } = await params
  const { chyba } = await searchParams
  const kod = ctx.person.companyCode

  const pridelenie = await loadAssignment(kod, id)
  if (!pridelenie) notFound()

  const prijemcovia = await nepotvrdili(kod, id)
  const branding = brandingView(ctx.tenant)
  const host = await requestHostname()
  const jazyk = normalizeLanguage(ctx.person.language)

  // Ukazuje sa **presne to znenie**, ktoré sa odošle — zložené tou istou
  // funkciou. Podobný text by sa časom rozišiel so skutočným.
  const ukazka = assignmentEmail(
    `https://${host}/dokumenty/${encodeURIComponent(pridelenie.subject.documentId)}`,
    host,
    {
      title: pridelenie.subject.documentTitle,
      versionLabel: pridelenie.subject.versionLabel,
      effectiveFrom: pridelenie.subject.effectiveFrom
        ? formatDate(pridelenie.subject.effectiveFrom, jazyk)
        : "—",
    },
    pridelenie.reason,
    jazyk,
    branding,
  )

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 720, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href={`/hr/${encodeURIComponent(id)}`} style={{ fontSize: 14 }}>
          ← Späť na detail
        </Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        Dať vedieť e-mailom
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 600 }}>
        Pošle sa <strong>len tým, ktorí ešte nepotvrdili</strong>. Kto to už má
        za sebou, by dostal pripomienku niečoho, čo spravil — a to je presne ten
        druh pošty, po ktorom si ľudia zapnú filter.
      </p>

      {chyba && (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5, color: "var(--warn-fg)" }}>
          {chyba}
        </p>
      )}

      {pridelenie.notified?.length ? (
        <p className="karta" style={{ padding: "12px 16px", margin: "0 0 18px", fontSize: 14.5 }}>
          Naposledy odoslané {formatDate(pridelenie.notified[pridelenie.notified.length - 1].at, jazyk)}
          {" "}({pridelenie.notified[pridelenie.notified.length - 1].count} ľuďom)
          {pridelenie.notified.length > 1 && ` · celkovo ${pridelenie.notified.length}×`}.
        </p>
      ) : null}

      <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>
        Komu ({prijemcovia.length})
      </h2>

      {prijemcovia.length === 0 ? (
        <p className="karta" style={{ padding: 18, fontSize: 15 }}>
          Potvrdili už všetci, ktorých sa {audienceLabel(pridelenie.audience)} týka.
          Nie je komu poslať.
        </p>
      ) : (
        <>
          <ul className="admin-domeny" style={{ marginBottom: 26 }}>
            {prijemcovia.map(o => (
              <li key={o.id} className="karta" style={{ padding: "10px 14px" }}>
                <span style={{ fontWeight: 600 }}>{o.fullName}</span>{" "}
                <span className="tichy" style={{ fontSize: 13.5 }}>{o.email}</span>
              </li>
            ))}
          </ul>

          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Čo im príde</h2>
          <p className="tichy pole-napoveda" style={{ margin: "0 0 10px" }}>
            Predmet: {ukazka.subject} · Každý ho dostane vo svojom jazyku.
          </p>
          <pre
            className="karta"
            style={{
              padding: 18, margin: "0 0 26px", fontSize: 14, lineHeight: 1.6,
              whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit",
            }}
          >
            {ukazka.text}
          </pre>

          <form action={poslatOznamenie}>
            <input type="hidden" name="id" value={id} />
            <button className="tlacidlo" type="submit">
              Odoslať {prijemcovia.length} {prijemcovia.length === 1 ? "e-mail" : prijemcovia.length < 5 ? "e-maily" : "e-mailov"}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
