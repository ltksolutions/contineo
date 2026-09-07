/**
 * Náhľad pred rozposlaním pozvánok.
 *
 * Ten istý vzor ako pri pripomienkach a oznámeniach: najprv je vidieť, komu
 * presne to pôjde, a až potom je tlačidlo.
 *
 * Zoznam je „kto sa ešte ani raz neprihlásil", nie „kto má stav pozvaná".
 * Osoby, ktoré vznikli importom alebo samozaložením cez pracovné konto (D47),
 * majú stav rovno `active`, pozvánku nikdy nedostali — a sú to presne tí,
 * ktorých treba osloviť.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { peopleContext, neverSignedIn } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import Notice from "@/components/Notice"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { sendInvitationsAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function InviteAllPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await peopleContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).people.inviteAll
  const branding = brandingView(ctx.tenant)

  const people = await neverSignedIn(ctx.person.companyCode)

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 720, ...tenantStyle(branding) }}>
      <Notice message={q.msg} error={q.error === "1"} back="/people/invite" />

      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/people" style={{ fontSize: 14 }}>{t.back}</Link>
      </p>

      <h1 style={{ fontSize: 25, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{t.heading}</h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 24px", maxWidth: 620 }}>{t.intro}</p>

      {people.length === 0 ? (
        <p className="karta" style={{ padding: 20 }}>{t.none}</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 8 }}>
            {people.map(p => (
              <li
                key={p.id}
                className="karta"
                style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}
              >
                <strong style={{ fontSize: 15, flex: "1 1 200px" }}>{p.fullName}</strong>
                <span className="tichy" style={{ fontSize: 13.5 }}>{p.email}</span>
              </li>
            ))}
          </ul>

          <p className="tichy" style={{ fontSize: 14, margin: "0 0 14px" }}>{t.preview}</p>

          <form action={sendInvitationsAction}>
            <button className="tlacidlo" type="submit">{t.send(people.length)}</button>
          </form>
        </>
      )}
    </div>
  )
}
