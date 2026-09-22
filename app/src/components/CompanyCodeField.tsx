"use client"

/**
 * Názov organizácie a kód, ktorý z neho Contineo navrhne (ADR-010,
 * ADMIN.md úloha 1.4).
 *
 * **Návrh, nie automatika.** Na rozdiel od kľúča dokumentu (`KeyPreview`),
 * kde sa kľúč generuje ticho, tu je kód v poli a admin ho môže prepísať:
 * organizácie svoju skratku spravidla už majú (`SFZ`, `StVPS`) a tá má
 * prednosť pred strojovým odvodením. Zakladanie tenantov je zriedkavé a robí
 * ho človek, ktorý skratku pozná.
 *
 * Návrh sa dopĺňa, **kým sa kódu nedotkol človek** — po prvej ručnej úprave
 * mu ho písanie v názve už neprepíše. Kolízia sa porovnáva so zoznamom
 * obsadených kódov načítaným pri otvorení, takže netreba dotaz pri každom
 * údere; poslednou bránou zostáva zápis (`createTenant()`).
 *
 * **Bez JavaScriptu** pole zostane prázdne a povinné — admin kód napíše sám
 * a formulár sa odošle rovnako. Rovnaká výnimka ako v `NAHRAVANIE.md` 4.
 */

import { useState } from "react"
import { suggestCompanyCode, withoutCollision } from "@/lib/slug"

export default function CompanyCodeField({
  usedCodes,
  initialName,
  initialCode,
  labels,
}: {
  usedCodes: string[]
  initialName: string
  initialCode: string
  labels: {
    name: string
    nameNote: string
    code: string
    codeNote: string
    codeNoteHighlight: string
    codeNoteAfter: string
    /** Šablóna s `{code}`, nie funkcia — dôvod v `KeyPreview.tsx`. */
    taken: string
  }
}) {
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState(initialCode)
  const [touched, setTouched] = useState(initialCode.length > 0)

  const onName = (value: string) => {
    setName(value)
    if (!touched) setCode(withoutCollision(suggestCompanyCode(value), usedCodes))
  }

  const taken = Boolean(code) && usedCodes.some(c => c.trim().toUpperCase() === code.toUpperCase())

  return (
    <>
      <label className="field">
        <span className="field-label">{labels.name}</span>
        <input
          className="field-input"
          name="displayName"
          value={name}
          onChange={e => onName(e.target.value)}
          required
        />
        <span className="quiet field-hint">{labels.nameNote}</span>
      </label>

      <label className="field">
        <span className="field-label">{labels.code}</span>
        <input
          className="field-input"
          name="companyCode"
          value={code}
          onChange={e => { setTouched(true); setCode(e.target.value.toUpperCase()) }}
          required
          autoCapitalize="characters"
          autoCorrect="off"
        />
        <span className="quiet field-hint">
          {labels.codeNote}<strong>{labels.codeNoteHighlight}</strong>{labels.codeNoteAfter}
        </span>
        {taken && (
          <span className="key-preview key-preview--taken" aria-live="polite">
            {labels.taken.replace("{code}", code.toUpperCase())}
          </span>
        )}
      </label>
    </>
  )
}
