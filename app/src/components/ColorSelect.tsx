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
export const PALETTE: { hodnota: string; popis: string }[] = [
  { hodnota: "#232a35", popis: "grafitová (predvolená)" },
  { hodnota: "#1f4ed8", popis: "modrá" },
  { hodnota: "#0e7490", popis: "petrolejová" },
  { hodnota: "#047857", popis: "zelená" },
  { hodnota: "#4d7c0f", popis: "olivová" },
  { hodnota: "#b45309", popis: "jantárová" },
  { hodnota: "#b91c1c", popis: "červená" },
  { hodnota: "#9f1239", popis: "vínová" },
  { hodnota: "#6d28d9", popis: "fialová" },
  { hodnota: "#334155", popis: "bridlicová" },
]

export default function ColorSelect({
  meno: name,
  hodnota: value,
}: {
  meno: string
  hodnota?: string
}) {
  const [color, setColor] = useState((value ?? "").trim())
  const [custom, setCustom] = useState(
    Boolean(color) && !PALETTE.some(p => p.hodnota.toLowerCase() === color.toLowerCase()),
  )

  return (
    <div className="farby">
      <input type="hidden" name={name} value={color} />

      <div className="farby-zoznam">
        {PALETTE.map(p => {
          const isHex = color.toLowerCase() === p.hodnota.toLowerCase()
          return (
            <button
              key={p.hodnota}
              type="button"
              className={`farba${isHex ? " je-zvolena" : ""}`}
              style={{ background: p.hodnota }}
              aria-pressed={isHex}
              aria-label={p.popis}
              title={p.popis}
              onClick={() => { setColor(p.hodnota); setCustom(false) }}
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
