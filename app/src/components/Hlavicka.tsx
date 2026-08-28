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
import { signOut } from "next-auth/react"
import { ZnakContineo } from "./ZnakContineo"
import type { TenantBrandingView } from "./TenantHeader"

/**
 * Voľba témy má **tri** stavy, nie dva.
 *
 * „Podľa systému" nie je to isté ako „svetlá": znamená, že sa rozhranie riadi
 * nastavením zariadenia a prepne sa samo, keď si ho človek večer prepne na
 * tmavé. Bez tohto stavu sa raz zvolená téma zasekne a používateľ si musí
 * pamätať, že si ju kedysi nastavil — a diviť sa, prečo mu jediná stránka
 * v prehliadači nesvieti tak ako ostatné.
 */
type Volba = "system" | "light" | "dark"
type Tema = "light" | "dark"

/** Poradie pri klikaní. Systém je prvý, lebo je to predvolený stav. */
const DALSIA: Record<Volba, Volba> = { system: "light", light: "dark", dark: "system" }

const POPIS: Record<Volba, string> = {
  system: "podľa systému",
  light: "svetlá",
  dark: "tmavá",
}

/**
 * Ikona stavu. Tri rôzne tvary, nie jeden meniaci sa — človek má poznať
 * súčasný stav pohľadom, nie odvodením z toho, čo sa stane po kliknutí.
 */
function IkonaTemy({ volba }: { volba: Volba }) {
  const spolocne = {
    width: 17, height: 17, viewBox: "0 0 18 18",
    fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  if (volba === "dark") {
    return (
      <svg {...spolocne}>
        <path d="M15 11.2A6.6 6.6 0 0 1 6.8 3a6.6 6.6 0 1 0 8.2 8.2z" />
      </svg>
    )
  }
  if (volba === "light") {
    return (
      <svg {...spolocne}>
        <circle cx="9" cy="9" r="3.4" />
        <path d="M9 1.4v1.8M9 14.8v1.8M1.4 9h1.8M14.8 9h1.8M3.6 3.6l1.3 1.3M13.1 13.1l1.3 1.3M14.4 3.6l-1.3 1.3M4.9 13.1l-1.3 1.3" />
      </svg>
    )
  }
  // Podľa systému — kruh do polovice vyplnený.
  return (
    <svg {...spolocne}>
      <circle cx="9" cy="9" r="6.6" />
      <path d="M9 2.4a6.6 6.6 0 0 0 0 13.2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * `email` prichádza zo servera, nie z `useSession()`.
 *
 * Dva dôvody. Prvý: neprihlásený človek nemá vidieť menu portálu — stránky
 * sú síce chránené, ale zoznam sekcií mu hovorí o vnútri systému viac, než
 * potrebuje vedieť, a na prihlasovacej stránke ho to zbytočne mätie. Druhý:
 * `useSession()` začína stavom „neviem" a odpoveď dorazí až po ďalšej
 * požiadavke, takže menu by na okamih **bliklo** aj tam, kde byť nemá.
 * Server to vie hneď pri prvom vykreslení.
 */
export default function Hlavicka({
  branding,
  email,
}: {
  branding?: TenantBrandingView
  email?: string
}) {
  const [volba, setVolba] = useState<Volba>("system")
  const cesta = usePathname()

  // Uložená voľba sa načíta raz po pripojení. Neznámu hodnotu (staršie
  // uloženie, ručná úprava) ticho prehliadneme — pri téme nemá zmysel padať.
  useEffect(() => {
    const ulozena = window.localStorage.getItem("contineo-tema")
    if (ulozena === "light" || ulozena === "dark" || ulozena === "system") setVolba(ulozena)
  }, [])

  // Uplatnenie voľby a — pri „podľa systému" — sledovanie zmien systému.
  // Poslucháč je tu preto, že stránka býva otvorená dlho: keď si človek
  // večer prepne zariadenie na tmavý režim, má sa prepnúť aj rozhranie.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    const uplatni = () => {
      const tema: Tema = volba === "system" ? (media?.matches ? "dark" : "light") : volba
      document.documentElement.dataset.theme = tema
    }
    uplatni()
    if (volba !== "system" || !media) return
    media.addEventListener("change", uplatni)
    return () => media.removeEventListener("change", uplatni)
  }, [volba])

  function prepni() {
    const nova = DALSIA[volba]
    setVolba(nova)
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
      <div className="obal hlavicka-riadok">
        {/*
          Hlavička patrí organizácii, nie dodávateľovi. Človek, ktorý tu
          potvrdzuje smernicu svojho zväzu, nemá nad ňou vidieť cudziu značku
          — a už vôbec nie odznak „testovacie rozhranie" nad dokumentom,
          ktorého potvrdenie je záväzné.
        */}
        {/* Značka vedie domov. Je to najstaršia konvencia webu a človek ju
            skúsi aj bez toho, aby mu ju niekto ukázal. */}
        <Link
          href="/"
          aria-label="Domov"
          style={{
            display: "flex", alignItems: "center", gap: 11,
            textDecoration: "none", color: "inherit",
          }}
        >
          {branding ? (
            <>
              {branding.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" width={26} height={26} style={{ display: "block" }} />
              )}
              <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
                {branding.displayName}
              </span>
            </>
          ) : (
            <>
              <ZnakContineo />
              <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
                Contineo
              </span>
              <span
                className="stitok tichy"
                style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}
              >
                Testovacie rozhranie
              </span>
            </>
          )}
        </Link>

        {/* Menu je pre prihlásených. Neprihlásený vidí značku a prepínač
            témy — nič, čím by aj tak nemohol pohnúť. */}
        {email && (
        <nav className="hlavicka-nav">
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
        )}

        {email && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/prihlasenie" })}
            className="tlacidlo tlacidlo--tiche"
            style={{ padding: "6px 12px", fontSize: 13.5 }}
            title={email}
          >
            Odhlásiť
          </button>
        )}

        <button
          onClick={prepni}
          className="tlacidlo tlacidlo--tiche"
          style={{ padding: "7px 9px", display: "inline-flex", alignItems: "center" }}
          // Ikona sama o sebe nepovie, čo znamená. Názov aj `aria-label`
          // preto hovoria súčasný stav **aj** to, čo sa stane po kliknutí.
          aria-label={`Téma ${POPIS[volba]}. Prepnúť na: ${POPIS[DALSIA[volba]]}`}
          title={`Téma ${POPIS[volba]}`}
        >
          <IkonaTemy volba={volba} />
        </button>
      </div>
    </header>
  )
}
