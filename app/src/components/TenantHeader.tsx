/**
 * TenantHeader.tsx — čia je táto stránka.
 *
 * Onboarding nie je bežné rozhranie: človek na ňom podpisuje vyhlásenie, že sa
 * s normou oboznámil a zaväzuje sa ju dodržiavať. Musí byť teda na prvý pohľad
 * jasné, **komu** to vyhlasuje. Preto logo a názov organizácie, nie značka
 * dodávateľa softvéru.
 *
 * Hodnoty prichádzajú z kolekcie `tenants` (D29). Keď tenant logo nemá,
 * zostane samotný názov — stránka sa musí dať vykresliť aj bez neho.
 */

import type { CSSProperties } from "react"

/**
 * Len tie polia vzhľadu, ktoré sú obyčajné reťazce.
 *
 * Zámerne **nie celý `Tenant`**: ten nesie `ObjectId` a `Date`, a tie sa cez
 * hranicu do klientskeho komponentu nepreniesú. Užší typ tú chybu nedovolí
 * urobiť namiesto toho, aby sa objavila až za behu.
 */
export interface TenantBrandingView {
  displayName: string
  /**
   * Krátky tvar do lišty: „SFZ" namiesto „Slovenský futbalový zväz".
   *
   * V hlavičke je vedľa neho ešte menu a osobné menu, takže dlhý názov ju
   * buď rozbije, alebo sa musí skracovať tromi bodkami — a „Slovenský
   * futbalo…" nepovie viac než „SFZ", zaberie však štvornásobok. Celý názov
   * zostáva ako `title`, v e-mailoch a na prihlasovacej obrazovke, kde je
   * miesta dosť a človek ho vidí prvýkrát.
   */
  shortName?: string
  logoUrl?: string
  accentColor?: string
}

/**
 * Stmaví farbu o daný podiel. Používa sa na `--accent-strong` (stav po
 * prejdení myšou), aby tenant nemusel zadávať dve farby a nemohol zadať dve,
 * ktoré k sebe nepatria.
 */
function darken(hex: string, amount = 0.16): string {
  const rgb = channels(hex)
  if (!rgb) return hex
  const out = rgb.map(v => Math.max(0, Math.round(v * (1 - amount))))
  return "#" + out.map(v => v.toString(16).padStart(2, "0")).join("")
}

/**
 * Rozloží `#rrggbb` alebo `#rgb` na tri kanály. `null` pri čomkoľvek inom —
 * farba tenanta je uložená v databáze, teda dáta, a tie môžu byť pokazené.
 */
export function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return [r, g, b]
}

/**
 * Farba tenanta s nízkou alfou pre `--accent-soft`.
 *
 * Prečo priehľadnosť a nie predpočítaná svetlá farba: podklad pod chipom
 * a označeným riadkom nie je vždy ten istý (`--surface` v karte, `--bg`
 * v pätičke tabuľky) a v tmavej téme je opačný. Alfa sa prispôsobí sama,
 * napevno namiešaný odtieň by na jednom z tých podkladov zmizol.
 *
 * `undefined` pri nečitateľnej hodnote: premenná sa vtedy vôbec nenastaví
 * a platí predvolená z `globals.css`. Nastaviť ju na pokazený reťazec by
 * znamenalo, že prehliadač zahodí aj tú predvolenú.
 */
export function soft(hex: string, alpha = 0.11): string | undefined {
  const rgb = channels(hex)
  if (!rgb) return undefined
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/**
 * Premenné, ktoré farba organizácie prepisuje. Vymenované zvlášť, aby ich
 * živý náhľad v `ColorSelect.tsx` vedel po sebe uklidiť — bez zoznamu by sa
 * po odchode z obrazovky nedalo povedať, čo nastavil on a čo tam bolo predtým.
 */
export const ACCENT_VARS = ["--accent", "--accent-strong", "--on-accent", "--accent-soft"] as const

/**
 * Farba organizácie rozložená na CSS premenné.
 *
 * Prepisuje sa aj `--on-accent`: v tmavej téme je predvolene tmavý text, ktorý
 * by na sýtej farbe tenanta nebolo vidieť. Kto mení pozadie tlačidla, musí
 * zmeniť aj popredie — inak vznikne tlačidlo, ktoré sa nedá prečítať práve
 * v tej téme, ktorú si človek zapol.
 *
 * Oddelené od `tenantStyle()`, lebo tie isté hodnoty potrebuje aj živý náhľad
 * v nastavení organizácie — ten ich nesype do `style` atribútu, ale nastavuje
 * cez `setProperty()`. Dva výpočty tej istej trojice by sa raz rozišli
 * a náhľad by ukazoval inú farbu, než sa uloží.
 */
export function accentVars(accentColor?: string): Record<string, string> {
  const hex = accentColor?.trim()
  if (!hex) return {}
  const soften = soft(hex)
  return {
    "--accent": hex,
    "--accent-strong": darken(hex),
    "--on-accent": "#ffffff",
    // Bez tohto riadka by chip aktívneho filtra a označený riadok zostali
    // v predvolenej sivej, kým zvyšok rozhrania má farbu organizácie.
    ...(soften ? { "--accent-soft": soften } : {}),
  }
}

/** CSS premenné tenanta pre obal stránky. */
export function tenantStyle(branding?: TenantBrandingView): CSSProperties {
  return accentVars(branding?.accentColor) as CSSProperties
}

export default function TenantHeader({
  branding,
  size = 34,
}: {
  branding?: TenantBrandingView
  size?: number
}) {
  if (!branding) return null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
      {branding.logoUrl && (
        // Obyčajný <img>, nie next/image: logo je SVG s pevným pomerom strán,
        // optimalizácia rastra by mu nedala nič a pridala by závislosť na
        // obrázkovom serveri tam, kde stačí statický súbor.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt=""
          width={size}
          height={size}
          style={{ display: "block", flex: "0 0 auto" }}
        />
      )}
      <span style={{ fontWeight: 700, fontSize: 16.5, letterSpacing: "-0.01em" }}>
        {branding.displayName}
      </span>
    </div>
  )
}
