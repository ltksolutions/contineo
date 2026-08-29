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
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  const out = rgb.map(v => Math.max(0, Math.round(v * (1 - amount))))
  return "#" + out.map(v => v.toString(16).padStart(2, "0")).join("")
}

/**
 * CSS premenné tenanta pre obal stránky.
 *
 * Prepisuje sa aj `--on-accent`: v tmavej téme je predvolene tmavý text, ktorý
 * by na sýtej farbe tenanta nebolo vidieť. Kto mení pozadie tlačidla, musí
 * zmeniť aj popredie — inak vznikne tlačidlo, ktoré sa nedá prečítať práve
 * v tej téme, ktorú si človek zapol.
 */
export function tenantStyle(branding?: TenantBrandingView): CSSProperties {
  if (!branding?.accentColor) return {}
  return {
    ["--accent" as string]: branding.accentColor,
    ["--accent-strong" as string]: darken(branding.accentColor),
    ["--on-accent" as string]: "#ffffff",
  } as CSSProperties
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
