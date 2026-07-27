"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

/**
 * Formulár prihlásenia e-mailom.
 *
 * Po odoslaní vidí používateľ tú istú hlášku bez ohľadu na to, či je jeho
 * adresa na zozname pozvaných. Rozlišovať by znamenalo, že sa skúšaním
 * adries dá zistiť, kto zo zväzu má prístup — a pri systéme s internými
 * smernicami je to samo osebe citlivý údaj.
 */

const CHYBY: Record<string, string> = {
  AccessDenied:
    "Táto adresa nie je medzi pozvanými. Ak si myslíte, že tam patrí, ozvite sa správcovi.",
  Verification:
    "Odkaz už neplatí — buď vypršal, alebo bol použitý. Vyžiadajte si nový.",
  EmailSignin:
    "E-mail sa nepodarilo odoslať. Skúste to o chvíľu znova.",
}

export default function Prihlasenie({
  odoslane,
  chyba,
}: {
  odoslane: boolean
  chyba?: string
}) {
  const [email, setEmail] = useState("")
  const [odosielam, setOdosielam] = useState(false)
  const [hotovo, setHotovo] = useState(odoslane)

  async function odosli(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || odosielam) return
    setOdosielam(true)
    try {
      await signIn("email", { email: email.trim(), redirect: false })
      setHotovo(true)
    } finally {
      setOdosielam(false)
    }
  }

  if (hotovo) {
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
          onClick={() => setHotovo(false)}
        >
          Zadať inú adresu
        </button>
      </div>
    )
  }

  return (
    <div>
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

      <h1 style={{ fontSize: 21, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        Prihlásenie do testovacieho rozhrania
      </h1>
      <p className="tichy" style={{ fontSize: 14.5, lineHeight: 1.65, margin: "0 0 22px" }}>
        Zadajte e-mail, na ktorý ste dostali pozvánku. Pošleme vám odkaz —
        heslo si pamätať nemusíte.
      </p>

      {chyba && (
        <div
          style={{
            background: "var(--bad-bg)", color: "var(--bad-fg)",
            border: "1px solid var(--line)", borderRadius: 9,
            padding: "11px 14px", fontSize: 14, lineHeight: 1.55,
            marginBottom: 18,
          }}
        >
          {CHYBY[chyba] ?? "Prihlásenie sa nepodarilo. Skúste to znova."}
        </div>
      )}

      <form onSubmit={odosli} style={{ display: "grid", gap: 12 }}>
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
        <button type="submit" className="tlacidlo" disabled={odosielam || !email.trim()}>
          {odosielam ? "Odosielam…" : "Poslať prihlasovací odkaz"}
        </button>
      </form>
    </div>
  )
}
