"use client"

/**
 * VyberFarby — doplnková farba organizácie zo základnej palety.
 *
 * Dovtedy to bolo textové pole na CSS hodnotu. Dva problémy naraz: kto nevie,
 * čo je `#1f6feb`, nezadá nič, a kto vie, zadá si žltú na bielom pozadí —
 * farba je na tlačidlách a odkazoch, takže zlá voľba znamená nečitateľný
 * portál pre celú organizáciu.
 *
 * Paleta je preto pevná a **každý odtieň je vybraný tak, aby na svetlom aj
 * tmavom pozadí zniesol biely text**. Vlastná hodnota sa dá napísať — ale je
 * to vedomý krok, nie prvé, na čo človek natrafí.
 */

import { useEffect, useRef, useState } from "react"
import { accentVars, ACCENT_VARS } from "./TenantHeader"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/**
 * Odtiene sú tmavšie, než by sa na prvý pohľad chcelo. Je to zámer: farba
 * nesie biely text na tlačidle, takže pri svetlejšom tóne prestane byť
 * čitateľný — a to sa ukáže až na produkcii, u zákazníka.
 */
export const PALETTE: string[] = [
  "#232a35", "#1f4ed8", "#0e7490", "#047857", "#4d7c0f",
  "#b45309", "#b91c1c", "#9f1239", "#6d28d9", "#334155",
]

export default function ColorSelect({
  name,
  value,
  language,
}: {
  name: string
  value?: string
  language?: UiLanguage
}) {
  const t = dictionary(language).colors
  const [color, setColor] = useState((value ?? "").trim())
  const [custom, setCustom] = useState(
    Boolean(color) && !PALETTE.some(p => p.toLowerCase() === color.toLowerCase()),
  )
  const box = useRef<HTMLDivElement>(null)

  /*
   * Živý náhľad: farba sa prepíše v celom rozhraní, nie len v ukážke nižšie.
   * Voľba farby organizácie je jediné nastavenie, ktorého dôsledok nie je
   * z hodnoty vidieť — `#0e7490` nikomu nepovie, ako bude vyzerať hlavička,
   * tlačidlo a odkaz naraz.
   *
   * Kam sa premenné nastavujú: na `<html>` a na **každý predok, ktorý má
   * vlastné inline premenné** — tam ich dáva `tenantStyle()` (`layout.tsx`
   * na `<body>`, obrazovky na svoj obal). Nastaviť len `:root` nestačí:
   * inline štýl na obale má vyššiu prioritu, takže náhľad by sa neprejavil
   * práve v tom obale, v ktorom tento formulár býva.
   */
  useEffect(() => {
    const node = box.current
    if (!node) return

    const targets = new Set<HTMLElement>([document.documentElement])
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.style.getPropertyValue("--accent")) targets.add(el)
    }

    const list = [...targets]
    const before = list.map(el =>
      ACCENT_VARS.map(v => [v, el.style.getPropertyValue(v)] as const),
    )

    const next = accentVars(color)
    for (const el of list) {
      for (const v of ACCENT_VARS) {
        const value = next[v]
        if (value) el.style.setProperty(v, value)
        else el.style.removeProperty(v)
      }
    }

    // Neuložená voľba nesmie prežiť odchod z obrazovky — inak by človek
    // videl farbu, ktorú v databáze nikto nemá, a hádal by, či je uložená.
    return () => {
      list.forEach((el, i) => {
        for (const [v, previous] of before[i]) {
          if (previous) el.style.setProperty(v, previous)
          else el.style.removeProperty(v)
        }
      })
    }
  }, [color])

  return (
    <div className="colors" ref={box}>
      <input type="hidden" name={name} value={color} />

      <div className="colors-list">
        {PALETTE.map(p => {
          const isHex = color.toLowerCase() === p.toLowerCase()
          const label = t.palette[p] ?? p
          return (
            <button
              key={p}
              type="button"
              className={`color${isHex ? " is-selected" : ""}`}
              style={{ background: p, ["--tile" as string]: p }}
              aria-pressed={isHex}
              aria-label={label}
              title={label}
              onClick={() => { setColor(p); setCustom(false) }}
            >
              {/* Krížik je biely, takže je zároveň skúškou čitateľnosti:
                  keby sa na odtieni stratil, stratí sa aj text na tlačidle. */}
              <span aria-hidden="true">{isHex ? "✓" : ""}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="button button--quiet colors-custom"
        onClick={() => setCustom(v => !v)}
      >
        {custom ? t.hideCustom : t.showCustom}
      </button>

      {custom && (
        <input
          className="field-input"
          value={color}
          onChange={e => setColor(e.target.value)}
          placeholder="#1f4ed8"
          autoCapitalize="none"
          autoCorrect="off"
        />
      )}

      {/*
        * Ukážka na troch prvkoch, na ktorých farba naozaj je: primárne
        * tlačidlo (pozadie + biely text), chip filtra (`--accent-soft`)
        * a odkaz (`--accent` ako text). Premenné dostáva vlastným štýlom,
        * takže ukazuje správne aj vtedy, keď živý náhľad vyššie nezaberie.
        */}
      <div className="brand-preview" style={accentVars(color)}>
        <span className="quiet brand-preview-label">{t.previewLabel}</span>
        <div className="brand-preview-row">
          <span className="button brand-preview-button">{t.previewButton}</span>
          <span className="library-chip">
            <span className="library-chip-key">{t.previewChipKey}</span>{t.previewChip}
          </span>
          <span className="brand-preview-link">{t.previewLink}</span>
        </div>
      </div>

      <noscript>
        <input className="field-input" name={name} defaultValue={value ?? ""} placeholder="#1f4ed8" />
      </noscript>
    </div>
  )
}
