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
import { ZnakContineo } from "./ContineoMark"
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
 * Iniciály z mena, a keď meno nie je, z adresy.
 *
 * Fotografia zatiaľ nie je zámerne: Google ju v profile vracia, Microsoft nie
 * — vyžaduje volanie Graphu a oprávnenie navyše od IT zákazníka. Polovica
 * ľudí s fotografiou a polovica bez nej vyzerá horšie než iniciály pre
 * všetkých, a doplniť sa dá kedykoľvek bez prepisovania.
 */
export function iniciely(meno: string | undefined, email: string): string {
  const slova = (meno ?? "").trim().split(/\s+/).filter(Boolean)
  if (slova.length >= 2) return (slova[0][0] + slova[slova.length - 1][0]).toUpperCase()
  if (slova.length === 1 && slova[0].length > 0) return slova[0].slice(0, 2).toUpperCase()
  const pred = email.split("@")[0] ?? ""
  return (pred.slice(0, 2) || "?").toUpperCase()
}

/**
 * Odtieň avatara z adresy.
 *
 * Nie náhoda: ten istý človek má mať vždy tú istú farbu, inak sa avatar pri
 * každom načítaní zmení a prestane byť tým, čím má byť — znakom, ktorý sa dá
 * spoznať bez čítania.
 */
export function odtienAvatara(email: string): number {
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
export default function Hlavicka({
  branding,
  email,
  meno,
  fotka,
  spravca,
  personalista,
  spravcaOsob,
  spravcaObsahu,
}: {
  branding?: TenantBrandingView
  email?: string
  /** Celé meno z `persons`. Chýba u správcu, ktorý prešiel núdzovou brzdou. */
  meno?: string
  /** Adresa fotky vrátane verzie. Chýba = ukážu sa iniciály (D52). */
  fotka?: string
  /** Vidí správu tenantov (D41 + D42 už overené na serveri). */
  spravca?: boolean
  /** Má rolu `hr` vo vlastnej organizácii (D33 už overené na serveri). */
  personalista?: boolean
  /** Má rolu `people-admin` vo vlastnej organizácii (D46). */
  spravcaOsob?: boolean
  /** Má rolu `spravca-obsahu` vo vlastnej organizácii (D53). */
  spravcaObsahu?: boolean
}) {
  const [volba, setVolba] = useState<Volba>("system")
  const [menuOtvorene, setMenuOtvorene] = useState(false)
  const [osobneOtvorene, setOsobneOtvorene] = useState(false)
  const osobneObal = useRef<HTMLDivElement>(null)
  const cesta = usePathname()

  const odtien = odtienAvatara(email ?? "")

  const POLOZKY = [
    { kam: "/", popis: "Voľné otázky" },
    { kam: "/sada", popis: "Zlatá sada" },
    // Odkaz vidí každý prihlásený; samotná stránka si už poradí — kto nemá
    // čo potvrdzovať, uvidí, že nemá nič. Podmieňovať odkaz by znamenalo
    // ťahať stav trás do hlavičky, teda do každej stránky.
    { kam: "/dokumenty", popis: "Na potvrdenie" },
    // Odkazy sa neukazujú podľa domnienky klienta — príznaky prichádzajú
    // zo servera, kde už prešli všetky podmienky.
    ...(personalista ? [{ kam: "/hr", popis: "Pridelené normy" }] : []),
    ...(spravcaOsob ? [{ kam: "/osoby", popis: "Osoby" }] : []),
    ...(spravcaObsahu ? [{ kam: "/kniznica", popis: "Knižnica" }] : []),
  ]

  /**
   * Správcovské odkazy patria pod avatar, nie do lišty.
   *
   * Lišta je navigácia obsahu — to, čo človek otvára denne. Nastavenie
   * organizácie a správa tenantov sú veci, ktoré sa otvárajú raz za mesiac
   * a v lište len zaberali miesto tomu, na čo sa naozaj kliká.
   */
  const SPRAVA = [
    ...(spravcaOsob ? [{ kam: "/organizacia", popis: "Nastavenie organizácie" }] : []),
    ...(spravca ? [{ kam: "/admin", popis: "Správa tenantov" }] : []),
  ]

  // Zmena stránky zatvorí panel. Bez toho zostane otvorený nad novým obsahom
  // a vyzerá to, že sa nič nestalo. Je to práve to zosúladenie s vonkajším
  // stavom (adresa v prehliadači), na ktoré efekt je.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOtvorene(false)
    setOsobneOtvorene(false)
  }, [cesta])

  // Kliknutie mimo zatvára osobné menu; hamburger je cez celú šírku, ten sa
  // zatvára odkazom alebo ikonou.
  useEffect(() => {
    if (!osobneOtvorene) return
    const mimo = (e: MouseEvent) => {
      if (!osobneObal.current?.contains(e.target as Node)) setOsobneOtvorene(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOsobneOtvorene(false) }
    document.addEventListener("mousedown", mimo)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", mimo)
      document.removeEventListener("keydown", escape)
    }
  }, [osobneOtvorene])

  // Uložená voľba sa načíta raz po pripojení. Neznámu hodnotu (staršie
  // uloženie, ručná úprava) ticho prehliadneme — pri téme nemá zmysel padať.
  useEffect(() => {
    const ulozena = window.localStorage.getItem("contineo-tema")
    // `setState` v efekte tu nie je nedopatrenie: `localStorage` na serveri
    // neexistuje, takže sa prvé vykreslenie **musí** spraviť bez neho a voľba
    // sa doplní až po pripojení. Čítať ho pri vykresľovaní by znamenalo, že
    // sa server a prehliadač rozídu a React hydratáciu zahodí.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
              <ZnakContineo />
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
              aria-expanded={menuOtvorene}
              aria-controls="hlavne-menu"
              aria-label={menuOtvorene ? "Zavrieť menu" : "Otvoriť menu"}
              onClick={() => setMenuOtvorene(o => !o)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
                fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                {menuOtvorene
                  ? <path d="M4 4l10 10M14 4L4 14" />
                  : <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />}
              </svg>
            </button>

            <nav
              id="hlavne-menu"
              className={`hlavicka-nav${menuOtvorene ? " je-otvorene" : ""}`}
            >
              {POLOZKY.map(o => {
                const aktivna = o.kam === "/" ? cesta === "/" : cesta.startsWith(o.kam)
                return (
                  <Link
                    key={o.kam}
                    href={o.kam}
                    className={`hlavicka-odkaz${aktivna ? " je-aktivny" : ""}`}
                    onClick={() => setMenuOtvorene(false)}
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
            <div className="osobne" ref={osobneObal}>
              <button
                type="button"
                className="osobne-tlacidlo"
                aria-haspopup="menu"
                aria-expanded={osobneOtvorene}
                aria-label={`Účet ${email}`}
                title={email}
                onClick={() => setOsobneOtvorene(o => !o)}
              >
                {fotka ? (
                  // Fotka z adresára. Keď sa nenačíta, `onError` ju schová
                  // a zostanú iniciály — prázdny štvorec je horší než písmená.
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className="avatar avatar--fotka"
                    src={fotka}
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
                    background: `hsl(${odtien} 42% 88%)`,
                    color: `hsl(${odtien} 45% 26%)`,
                    ...(fotka ? { display: "none" } : {}),
                  }}
                >
                  {iniciely(meno, email)}
                </span>
              </button>

              {osobneOtvorene && (
                <div className="osobne-panel" role="menu">
                  <div className="osobne-hlava">
                    {meno && <div className="osobne-meno">{meno}</div>}
                    <div className="tichy osobne-email">{email}</div>
                  </div>

                  {SPRAVA.map(o => (
                    <Link
                      key={o.kam}
                      href={o.kam}
                      role="menuitem"
                      className="osobne-polozka"
                      onClick={() => setOsobneOtvorene(false)}
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

                  {SPRAVA.length > 0 && <div className="osobne-ciara" />}

                  <button
                    type="button"
                    role="menuitem"
                    className="osobne-polozka"
                    onClick={prepni}
                  >
                    <IkonaTemy volba={volba} />
                    Téma: {POPIS[volba]}
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
            onClick={prepni}
            className="tlacidlo tlacidlo--tiche"
            style={{ marginLeft: "auto", padding: "7px 9px", display: "inline-flex", alignItems: "center" }}
            aria-label={`Téma ${POPIS[volba]}. Prepnúť na: ${POPIS[DALSIA[volba]]}`}
            title={`Téma ${POPIS[volba]}`}
          >
            <IkonaTemy volba={volba} />
          </button>
        )}
      </div>
    </header>
  )
}
