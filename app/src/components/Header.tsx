"use client"

/**
 * Hlavička testovacieho rozhrania.
 *
 * Zámerne strohá — jediné, čo je v nej navyše, je prepínač témy. Hodnotiteľ
 * v tomto okne strávi hodiny a čítanie dlhých citácií na svietiacom bielom
 * pozadí je po chvíli únavné.
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ContineoMark } from "./ContineoMark"
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
type ThemeChoice = "system" | "light" | "dark"
type Theme = "light" | "dark"

/** Poradie pri klikaní. Systém je prvý, lebo je to predvolený stav. */
const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" }

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "podľa systému",
  light: "svetlá",
  dark: "tmavá",
}

/**
 * Ikona stavu. Tri rôzne tvary, nie jeden meniaci sa — človek má poznať
 * súčasný stav pohľadom, nie odvodením z toho, čo sa stane po kliknutí.
 */
function ThemeIcon({ choice: choice }: { choice: ThemeChoice }) {
  const shared = {
    width: 17, height: 17, viewBox: "0 0 18 18",
    fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  if (choice === "dark") {
    return (
      <svg {...shared}>
        <path d="M15 11.2A6.6 6.6 0 0 1 6.8 3a6.6 6.6 0 1 0 8.2 8.2z" />
      </svg>
    )
  }
  if (choice === "light") {
    return (
      <svg {...shared}>
        <circle cx="9" cy="9" r="3.4" />
        <path d="M9 1.4v1.8M9 14.8v1.8M1.4 9h1.8M14.8 9h1.8M3.6 3.6l1.3 1.3M13.1 13.1l1.3 1.3M14.4 3.6l-1.3 1.3M4.9 13.1l-1.3 1.3" />
      </svg>
    )
  }
  // Podľa systému — kruh do polovice vyplnený.
  return (
    <svg {...shared}>
      <circle cx="9" cy="9" r="6.6" />
      <path d="M9 2.4a6.6 6.6 0 0 0 0 13.2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Iniciály z mena, a keď meno nie je, z adresy.
 *
 * Fotografia zatiaľ nie je zámerne: Google ju v profile vracia, Microsoft nie
 * — vyžaduje volanie Graphu a oprávnenie navyše od IT zákazníka. Polovica
 * ľudí s fotografiou a polovica bez nej vyzerá horšie než iniciály pre
 * všetkých, a doplniť sa dá kedykoľvek bez prepisovania.
 */
export function initials(name: string | undefined, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1 && words[0].length > 0) return words[0].slice(0, 2).toUpperCase()
  const before = email.split("@")[0] ?? ""
  return (before.slice(0, 2) || "?").toUpperCase()
}

/**
 * Odtieň avatara z adresy.
 *
 * Nie náhoda: ten istý človek má mať vždy tú istú farbu, inak sa avatar pri
 * každom načítaní zmení a prestane byť tým, čím má byť — znakom, ktorý sa dá
 * spoznať bez čítania.
 */
export function avatarShade(email: string): number {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360
  return h
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
export default function Header({
  branding,
  email,
  name: name,
  photo: photo,
  isAdmin: isAdmin,
  isHr: isHr,
  isPeopleAdmin: isPeopleAdmin,
  isContentManager: isContentManager,
}: {
  branding?: TenantBrandingView
  email?: string
  /** Celé meno z `persons`. Chýba u správcu, ktorý prešiel núdzovou brzdou. */
  name?: string
  /** Adresa fotky vrátane verzie. Chýba = ukážu sa iniciály (D52). */
  photo?: string
  /** Vidí správu tenantov (D41 + D42 už overené na serveri). */
  isAdmin?: boolean
  /** Má rolu `hr` vo vlastnej organizácii (D33 už overené na serveri). */
  isHr?: boolean
  /** Má rolu `people-admin` vo vlastnej organizácii (D46). */
  isPeopleAdmin?: boolean
  /** Má rolu `spravca-obsahu` vo vlastnej organizácii (D53). */
  isContentManager?: boolean
}) {
  const [choice, setChoice] = useState<ThemeChoice>("system")
  const [menuOpen, setMenuOpen] = useState(false)
  const [personalOpen, setPersonalOpen] = useState(false)
  const personalWrap = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  const shade = avatarShade(email ?? "")

  const ITEMS = [
    { kam: "/", popis: "Voľné otázky" },
    { kam: "/sada", popis: "Zlatá sada" },
    // Odkaz vidí každý prihlásený; samotná stránka si už poradí — kto nemá
    // čo potvrdzovať, uvidí, že nemá nič. Podmieňovať odkaz by znamenalo
    // ťahať stav trás do hlavičky, teda do každej stránky.
    { kam: "/dokumenty", popis: "Na potvrdenie" },
    // Odkazy sa neukazujú podľa domnienky klienta — príznaky prichádzajú
    // zo servera, kde už prešli všetky podmienky.
    ...(isHr ? [{ kam: "/hr", popis: "Pridelené normy" }] : []),
    ...(isPeopleAdmin ? [{ kam: "/osoby", popis: "Osoby" }] : []),
    ...(isContentManager ? [{ kam: "/kniznica", popis: "Knižnica" }] : []),
  ]

  /**
   * Správcovské odkazy patria pod avatar, nie do lišty.
   *
   * Lišta je navigácia obsahu — to, čo človek otvára denne. Nastavenie
   * organizácie a správa tenantov sú veci, ktoré sa otvárajú raz za mesiac
   * a v lište len zaberali miesto tomu, na čo sa naozaj kliká.
   */
  const ADMIN_ITEMS = [
    ...(isPeopleAdmin ? [{ kam: "/organizacia", popis: "Nastavenie organizácie" }] : []),
    ...(isAdmin ? [{ kam: "/admin", popis: "Správa tenantov" }] : []),
  ]

  // Zmena stránky zatvorí panel. Bez toho zostane otvorený nad novým obsahom
  // a vyzerá to, že sa nič nestalo. Je to práve to zosúladenie s vonkajším
  // stavom (adresa v prehliadači), na ktoré efekt je.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false)
    setPersonalOpen(false)
  }, [pathname])

  // Kliknutie mimo zatvára osobné menu; hamburger je cez celú šírku, ten sa
  // zatvára odkazom alebo ikonou.
  useEffect(() => {
    if (!personalOpen) return
    const outside = (e: MouseEvent) => {
      if (!personalWrap.current?.contains(e.target as Node)) setPersonalOpen(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setPersonalOpen(false) }
    document.addEventListener("mousedown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [personalOpen])

  // Uložená voľba sa načíta raz po pripojení. Neznámu hodnotu (staršie
  // uloženie, ručná úprava) ticho prehliadneme — pri téme nemá zmysel padať.
  useEffect(() => {
    const stored = window.localStorage.getItem("contineo-tema")
    // `setState` v efekte tu nie je nedopatrenie: `localStorage` na serveri
    // neexistuje, takže sa prvé vykreslenie **musí** spraviť bez neho a voľba
    // sa doplní až po pripojení. Čítať ho pri vykresľovaní by znamenalo, že
    // sa server a prehliadač rozídu a React hydratáciu zahodí.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "light" || stored === "dark" || stored === "system") setChoice(stored)
  }, [])

  // Uplatnenie voľby a — pri „podľa systému" — sledovanie zmien systému.
  // Poslucháč je tu preto, že stránka býva otvorená dlho: keď si človek
  // večer prepne zariadenie na tmavý režim, má sa prepnúť aj rozhranie.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    const apply = () => {
      const theme: Theme = choice === "system" ? (media?.matches ? "dark" : "light") : choice
      document.documentElement.dataset.theme = theme
    }
    apply()
    if (choice !== "system" || !media) return
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [choice])

  function toggle() {
    const next = NEXT_THEME[choice]
    setChoice(next)
    window.localStorage.setItem("contineo-tema", next)
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
          className="hlavicka-znacka"
        >
          {branding ? (
            <>
              {branding.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" width={26} height={26} style={{ display: "block" }} />
              )}
              {/* Skratka, keď ju organizácia má. Celý názov zostáva v `title`
                  a na prihlasovacej obrazovke — tam je miesta dosť. */}
              <span className="hlavicka-nazov" title={branding.displayName}>
                {branding.shortName || branding.displayName}
              </span>
            </>
          ) : (
            <>
              <ContineoMark />
              <span className="hlavicka-nazov">Contineo</span>
              {/* Odznak sa na úzkej obrazovke schová — je to poznámka pre nás,
                  nie informácia, kvôli ktorej má názov organizácie zmiznúť. */}
              <span className="stitok tichy hlavicka-odznak">Testovacie rozhranie</span>
            </>
          )}
        </Link>

        {/* Menu je pre prihlásených. Neprihlásený vidí značku a prepínač
            témy — nič, čím by aj tak nemohol pohnúť. */}
        {email && (
          <>
            {/*
              Pod 760 px sa položky schovajú za ikonu. Dovtedy sa lámali do
              druhého riadka a hlavička rástla do výšky — a bude ich pribúdať,
              takže „nejako sa to zmestí" prestane platiť čoraz skôr.
            */}
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche hlavicka-hamburger"
              aria-expanded={menuOpen}
              aria-controls="hlavne-menu"
              aria-label={menuOpen ? "Zavrieť menu" : "Otvoriť menu"}
              onClick={() => setMenuOpen(o => !o)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
                fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                {menuOpen
                  ? <path d="M4 4l10 10M14 4L4 14" />
                  : <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />}
              </svg>
            </button>

            <nav
              id="hlavne-menu"
              className={`hlavicka-nav${menuOpen ? " je-otvorene" : ""}`}
            >
              {ITEMS.map(o => {
                const active = o.kam === "/" ? pathname === "/" : pathname.startsWith(o.kam)
                return (
                  <Link
                    key={o.kam}
                    href={o.kam}
                    className={`hlavicka-odkaz${active ? " je-aktivny" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {o.popis}
                  </Link>
                )
              })}
            </nav>

            {/*
              Osobné menu. Odhlásenie aj téma patria k človeku, nie k obsahu —
              v lište zaberali miesto navigácii a odhlásenie navyše stálo hneď
              vedľa odkazov, na ktoré sa klikne omylom.
            */}
            <div className="osobne" ref={personalWrap}>
              <button
                type="button"
                className="osobne-tlacidlo"
                aria-haspopup="menu"
                aria-expanded={personalOpen}
                aria-label={`Účet ${email}`}
                title={email}
                onClick={() => setPersonalOpen(o => !o)}
              >
                {photo ? (
                  // Fotka z adresára. Keď sa nenačíta, `onError` ju schová
                  // a zostanú iniciály — prázdny štvorec je horší než písmená.
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className="avatar avatar--fotka"
                    src={photo}
                    alt=""
                    aria-hidden="true"
                    width={28}
                    height={28}
                    onError={e => { (e.currentTarget as HTMLImageElement).hidden = true }}
                  />
                ) : null}
                <span
                  className="avatar"
                  aria-hidden="true"
                  style={{
                    background: `hsl(${shade} 42% 88%)`,
                    color: `hsl(${shade} 45% 26%)`,
                    ...(photo ? { display: "none" } : {}),
                  }}
                >
                  {initials(name, email)}
                </span>
              </button>

              {personalOpen && (
                <div className="osobne-panel" role="menu">
                  <div className="osobne-hlava">
                    {name && <div className="osobne-meno">{name}</div>}
                    <div className="tichy osobne-email">{email}</div>
                  </div>

                  {ADMIN_ITEMS.map(o => (
                    <Link
                      key={o.kam}
                      href={o.kam}
                      role="menuitem"
                      className="osobne-polozka"
                      onClick={() => setPersonalOpen(false)}
                    >
                      <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"
                        fill="none" stroke="currentColor" strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="9" r="2.6" />
                        <path d="M9 1.8v1.9M9 14.3v1.9M2.9 9H1M17 9h-1.9M4.7 4.7 3.4 3.4M14.6 14.6l-1.3-1.3M13.3 4.7l1.3-1.3M3.4 14.6l1.3-1.3" />
                      </svg>
                      {o.popis}
                    </Link>
                  ))}

                  {ADMIN_ITEMS.length > 0 && <div className="osobne-ciara" />}

                  <button
                    type="button"
                    role="menuitem"
                    className="osobne-polozka"
                    onClick={toggle}
                  >
                    <ThemeIcon choice={choice} />
                    Téma: {THEME_LABEL[choice]}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="osobne-polozka osobne-polozka--odhlasit"
                    onClick={() => signOut({ callbackUrl: "/prihlasenie" })}
                  >
                    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true"
                      fill="none" stroke="currentColor" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 15H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 3h3M11.5 12 15 9l-3.5-3M15 9H7" />
                    </svg>
                    Odhlásiť
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Neprihlásený nemá osobné menu, ale tému prepnúť môže. */}
        {!email && (
          <button
            onClick={toggle}
            className="tlacidlo tlacidlo--tiche"
            style={{ marginLeft: "auto", padding: "7px 9px", display: "inline-flex", alignItems: "center" }}
            aria-label={`Téma ${THEME_LABEL[choice]}. Prepnúť na: ${THEME_LABEL[NEXT_THEME[choice]]}`}
            title={`Téma ${THEME_LABEL[choice]}`}
          >
            <ThemeIcon choice={choice} />
          </button>
        )}
      </div>
    </header>
  )
}
