"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import TenantHeader from "./TenantHeader"
import type { TenantBrandingView } from "./TenantHeader"

/**
 * Formulár prihlásenia e-mailom.
 *
 * Po odoslaní vidí používateľ tú istú hlášku bez ohľadu na to, či je jeho
 * adresa na zozname pozvaných. Rozlišovať by znamenalo, že sa skúšaním
 * adries dá zistiť, kto zo zväzu má prístup — a pri systéme s internými
 * smernicami je to samo osebe citlivý údaj.
 */

const ERRORS: Record<string, string> = {
  AccessDenied:
    "Táto adresa nie je medzi pozvanými. Ak si myslíte, že tam patrí, ozvite sa správcovi.",
  Verification:
    "Odkaz už neplatí — buď vypršal, alebo bol použitý. Vyžiadajte si nový.",
  EmailSignin:
    "E-mail sa nepodarilo odoslať. Skúste to o chvíľu znova.",
  // Konto sa overilo, ale do organizácie nepatrí, alebo je z cudzieho
  // Entra tenanta. Presnejšie sa to povedať nedá — z toho, že „vaša adresa
  // tam je, ale konto nie", by sa dalo zistiť, kto v organizácii je.
  OAuthSignin: "Prihlásenie kontom sa nepodarilo začať. Skúste to znova.",
  OAuthCallback: "Prihlásenie kontom sa nepodarilo dokončiť. Skúste to znova.",
  OAuthAccountNotLinked:
    "Toto konto sa nedá spojiť s vašou adresou. Prihláste sa odkazom v e-maile.",
}

/** Značky poskytovateľov. Kreslené, nie sťahované — e-mail ani portál nemá volať cudzí server. */
function MicrosoftMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.6z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 10z" />
      <path fill="#EA4335" d="M24 10.6c3.2 0 5.4 1.4 6.7 2.6l6.1-6C33 3.7 29 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z" />
    </svg>
  )
}

const MARKS = { microsoft: MicrosoftMark, google: GoogleMark }
const NAMES = { microsoft: "Microsoft", google: "Google" }

export default function SignIn({
  sent: sent,
  error: error,
  branding,
  providers: providers = [],
}: {
  sent: boolean
  error?: string
  branding?: TenantBrandingView
  /**
   * Ktoré kontá má táto organizácia zapnuté (D44). Prichádza zo servera —
   * klient nemá ako vedieť, čie prihlasovacie údaje sú pre túto doménu
   * nastavené, a hádať by znamenalo ponúknuť tlačidlo, ktoré skončí chybou.
   */
  providers?: ("microsoft" | "google")[]
}) {
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(sent)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    try {
      // `callbackUrl` musí byť vyplnené. Bez neho si ho NextAuth vezme
      // z aktuálnej adresy — a tou je práve táto stránka, takže odkaz
      // z e-mailu človeka prihlási a vráti späť na prihlasovací formulár.
      // Vyzerá to, akoby prihlásenie nefungovalo, hoci relácia vznikla.
      await signIn("email", { email: email.trim(), redirect: false, callbackUrl: "/" })
      setDone(true)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="karta" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Pozrite si e-mail</h1>
        <p className="tichy" style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>
          Ak je adresa medzi pozvanými, práve na ňu odišiel prihlasovací odkaz.
          Platí 24 hodín a dá sa použiť raz.
        </p>
        <button
          type="button"
          className="tlacidlo tlacidlo--tiche"
          style={{ marginTop: 20 }}
          onClick={() => setDone(false)}
        >
          Zadať inú adresu
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Hlavička organizácie, nie dodávateľa. Kto sa prihlasuje, aby potvrdil
          smernicu, potrebuje vidieť čí je portál — a značka softvéru mu to
          nepovie. Bez tenanta ostáva pôvodná značka. */}
      {branding ? (
        <TenantHeader branding={branding} size={40} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26 }}>
          <svg width="30" height="30" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="4" />
            <circle cx="13" cy="18" r="2.3" fill="currentColor" />
            <circle cx="23" cy="18" r="2.3" fill="currentColor" />
            <path d="M28 27 L41 41 L29 38 Z" fill="currentColor" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
            Contineo
          </span>
        </div>
      )}

      <h1 style={{ fontSize: 21, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        Prihlásenie
      </h1>
      <p className="tichy" style={{ fontSize: 14.5, lineHeight: 1.65, margin: "0 0 22px" }}>
        Zadajte e-mail, na ktorý ste dostali pozvánku. Pošleme vám odkaz —
        heslo si pamätať nemusíte.
      </p>

      {error && (
        <div
          style={{
            background: "var(--bad-bg)", color: "var(--bad-fg)",
            border: "1px solid var(--line)", borderRadius: 9,
            padding: "11px 14px", fontSize: 14, lineHeight: 1.55,
            marginBottom: 18,
          }}
        >
          {ERRORS[error] ?? "Prihlásenie sa nepodarilo. Skúste to znova."}
        </div>
      )}

      {/* Konto je hore: kto ho má, klikne raz a je dnu — odkaz v e-maile je
          o dva kroky dlhší. Kto ho nemá (rozhodcovia, delegáti), pokračuje
          formulárom pod tým. */}
      {providers.length > 0 && (
        <>
          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {providers.map(p => {
              const Mark = MARKS[p]
              return (
                <button
                  key={p}
                  type="button"
                  className="tlacidlo tlacidlo--tiche"
                  style={{ justifyContent: "center" }}
                  onClick={() => signIn(p === "microsoft" ? "azure-ad" : "google", { callbackUrl: "/" })}
                >
                  <Mark />
                  Prihlásiť sa cez {NAMES[p]}
                </button>
              )
            })}
          </div>

          <div
            aria-hidden="true"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              margin: "0 0 18px", color: "var(--muted)", fontSize: 13,
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            alebo
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
        </>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="meno@futbalsfz.sk"
          style={{
            width: "100%", background: "var(--surface)", color: "var(--ink)",
            border: "1px solid var(--line)", borderRadius: 10,
            padding: "12px 14px", fontSize: 15.5, fontFamily: "inherit",
          }}
        />
        <button type="submit" className="tlacidlo" disabled={sending || !email.trim()}>
          {sending ? "Odosielam…" : "Poslať prihlasovací odkaz"}
        </button>
      </form>
    </div>
  )
}
