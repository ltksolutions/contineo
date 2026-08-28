/**
 * Zoznam dokumentov, ktoré má prihlásená osoba potvrdiť.
 *
 * Stav sa **odvodzuje** z potvrdení (D27), nikde sa neukladá — preto je to
 * serverový komponent bez vlastného stavu. Po potvrdení sa stránka jednoducho
 * načíta znova a číslo sa zmení samo.
 */

import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { currentPerson } from "@/lib/session"
import { trackProgress } from "@/lib/tracks"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function Dokumenty() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect("/prihlasenie")

  const person = await currentPerson()
  if (!person) {
    // Prihlásený, ale v `persons` nie je — typicky správca, ktorý prešiel
    // núdzovou brzdou `POVOLENE_EMAILY`. Poslať ho späť na prihlásenie by
    // vyzeralo ako pokazená stránka: je predsa prihlásený.
    return (
      <div className="obal" style={{ padding: "36px 20px 80px", maxWidth: 760 }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Dokumenty na potvrdenie
        </h1>
        <p className="karta" style={{ padding: 20 }}>
          Ste prihlásený ako <strong>{session.user.email}</strong>, ale nie ste vedený
          medzi osobami organizácie — takže vám systém nemá čo priradiť. Ak tu máte
          niečo potvrdzovať, požiadajte HR o zaradenie.
        </p>
      </div>
    )
  }

  const t = dictionary(person.language).onboarding
  const tracks = await trackProgress(person)
  const steps = tracks.flatMap(tr => tr.steps)
  const done = tracks.reduce((a, tr) => a + tr.doneCount, 0)
  const total = tracks.reduce((a, tr) => a + tr.totalCount, 0)

  return (
    <div className="obal" style={{ padding: "36px 20px 80px", maxWidth: 760 }}>
      <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
        {t.listHeading}
      </h1>
      <p className="tichy" style={{ fontSize: 15.5, margin: "0 0 8px" }}>{t.listIntro}</p>

      {total > 0 && (
        <p className="tichy" style={{ fontSize: 14, margin: "0 0 24px" }}>
          {t.progress(done, total)}
        </p>
      )}

      {steps.length === 0 && (
        <p className="karta" style={{ padding: 20 }}>{t.nothingToDo}</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {steps.map(s => (
          <li key={`${s.documentId}-${s.order}`} className="karta" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 16, flex: "1 1 320px" }}>{s.title}</strong>

              {s.blocked ? (
                <span className="stitok" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                  {t.blocked}
                </span>
              ) : s.done ? (
                <span className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                  {t.done}
                </span>
              ) : (
                <span className="stitok">{t.todo}</span>
              )}
            </div>

            <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
              {s.blocked
                ? t.blockedReason[s.blocked] ?? s.blocked
                : t.version(s.versionLabel ?? "", formatDate(s.effectiveFrom!, person.language))}
            </p>

            {!s.blocked && (
              <p style={{ margin: "12px 0 0" }}>
                <Link className="tlacidlo tlacidlo--tiche" href={`/dokumenty/${encodeURIComponent(s.documentId)}`}>
                  {t.open}
                </Link>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
