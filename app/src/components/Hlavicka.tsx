"use client"

/**
 * Hlavička testovacieho rozhrania.
 *
 * Zámerne strohá — jediné, čo je v nej navyše, je prepínač témy. Hodnotiteľ
 * v tomto okne strávi hodiny a čítanie dlhých citácií na svietiacom bielom
 * pozadí je po chvíli únavné.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

type Tema = "light" | "dark"

export default function Hlavicka() {
  const [tema, setTema] = useState<Tema>("light")
  const cesta = usePathname()
  const { data: sedenie } = useSession()

  // Prvé nastavenie podľa systému. Voľbu si držíme v localStorage, aby sa
  // pri každom prekliku nevracala späť.
  useEffect(() => {
    const ulozena = window.localStorage.getItem("contineo-tema") as Tema | null
    const systemova: Tema =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    const zvolena = ulozena ?? systemova
    setTema(zvolena)
    document.documentElement.dataset.theme = zvolena
  }, [])

  function prepni() {
    const nova: Tema = tema === "dark" ? "light" : "dark"
    setTema(nova)
    document.documentElement.dataset.theme = nova
    window.localStorage.setItem("contineo-tema", nova)
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        className="obal"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          height: 60,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="4" />
            <circle cx="13" cy="18" r="2.3" fill="currentColor" />
            <circle cx="23" cy="18" r="2.3" fill="currentColor" />
            <path d="M28 27 L41 41 L29 38 Z" fill="currentColor" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
            Contineo
          </span>
          <span
            className="stitok tichy"
            style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}
          >
            Testovacie rozhranie
          </span>
        </div>

        <nav style={{ display: "flex", gap: 4, marginLeft: "auto", marginRight: 6 }}>
          {[
            { kam: "/", popis: "Voľné otázky" },
            { kam: "/sada", popis: "Zlatá sada" },
            // Odkaz vidí každý prihlásený; samotná stránka si už poradí —
            // kto nemá čo potvrdzovať, uvidí, že nemá nič. Podmieňovať odkaz
            // by znamenalo ťahať stav trás do hlavičky, teda do každej stránky.
            { kam: "/dokumenty", popis: "Na potvrdenie" },
          ].map(o => {
            const aktivna = o.kam === "/" ? cesta === "/" : cesta.startsWith(o.kam)
            return (
              <Link
                key={o.kam}
                href={o.kam}
                style={{
                  textDecoration: "none", fontSize: 14, borderRadius: 8,
                  padding: "6px 12px", fontWeight: aktivna ? 700 : 500,
                  background: aktivna ? "var(--surface-2)" : "transparent",
                  color: aktivna ? "var(--ink)" : "var(--muted)",
                }}
              >
                {o.popis}
              </Link>
            )
          })}
        </nav>

        {sedenie?.user?.email && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/prihlasenie" })}
            className="tlacidlo tlacidlo--tiche"
            style={{ padding: "6px 12px", fontSize: 13.5 }}
            title={sedenie.user.email}
          >
            Odhlásiť
          </button>
        )}

        <button
          onClick={prepni}
          className="tlacidlo tlacidlo--tiche"
          style={{ padding: "6px 12px", fontSize: 13.5 }}
          aria-label={tema === "dark" ? "Prepnúť na svetlú tému" : "Prepnúť na tmavú tému"}
        >
          {tema === "dark" ? "Svetlá" : "Tmavá"}
        </button>
      </div>
    </header>
  )
}
