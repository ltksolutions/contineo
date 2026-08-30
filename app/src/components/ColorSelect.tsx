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

import { useState } from "react"

/**
 * Odtiene sú tmavšie, než by sa na prvý pohľad chcelo. Je to zámer: farba
 * nesie biely text na tlačidle, takže pri svetlejšom tóne prestane byť
 * čitateľný — a to sa ukáže až na produkcii, u zákazníka.
 */
export const PALETTE: { value: string; label: string }[] = [
  { value: "#232a35", label: "grafitová (predvolená)" },
  { value: "#1f4ed8", label: "modrá" },
  { value: "#0e7490", label: "petrolejová" },
  { value: "#047857", label: "zelená" },
  { value: "#4d7c0f", label: "olivová" },
  { value: "#b45309", label: "jantárová" },
  { value: "#b91c1c", label: "červená" },
  { value: "#9f1239", label: "vínová" },
  { value: "#6d28d9", label: "fialová" },
  { value: "#334155", label: "bridlicová" },
]

export default function ColorSelect({
  name: name,
  value: value,
}: {
  name: string
  value?: string
}) {
  const [color, setColor] = useState((value ?? "").trim())
  const [custom, setCustom] = useState(
    Boolean(color) && !PALETTE.some(p => p.value.toLowerCase() === color.toLowerCase()),
  )

  return (
    <div className="farby">
      <input type="hidden" name={name} value={color} />

      <div className="farby-zoznam">
        {PALETTE.map(p => {
          const isHex = color.toLowerCase() === p.value.toLowerCase()
          return (
            <button
              key={p.value}
              type="button"
              className={`farba${isHex ? " je-zvolena" : ""}`}
              style={{ background: p.value }}
              aria-pressed={isHex}
              aria-label={p.label}
              title={p.label}
              onClick={() => { setColor(p.value); setCustom(false) }}
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
        className="tlacidlo tlacidlo--tiche farby-vlastna"
        onClick={() => setCustom(v => !v)}
      >
        {custom ? "Skryť vlastnú hodnotu" : "Zadať vlastnú hodnotu"}
      </button>

      {custom && (
        <input
          className="pole-vstup"
          value={color}
          onChange={e => setColor(e.target.value)}
          placeholder="#1f4ed8"
          autoCapitalize="none"
          autoCorrect="off"
        />
      )}

      <noscript>
        <input className="pole-vstup" name={name} defaultValue={value ?? ""} placeholder="#1f4ed8" />
      </noscript>
    </div>
  )
}
