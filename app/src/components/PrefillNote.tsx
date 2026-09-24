"use client"

/**
 * Veta o predvyplnení údajov o znení (NAHRAVANIE-pdf-a-udaje-o-zneni, bod 4).
 *
 * Keď je vybraný zdroj dokument Word, veta ho menuje — predvyplnenie ide
 * z tabuľky na jeho prvej strane (ADR-013, D108). Inak všeobecná veta.
 * Počúva zmenu poľa zdroja v tom istom formulári; bez skriptu zostane
 * všeobecná veta.
 */

import { useEffect, useRef, useState } from "react"

export default function PrefillNote({ text, wordText }: { text: string; wordText: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [word, setWord] = useState(false)

  useEffect(() => {
    const form = ref.current?.closest("form")
    if (!form) return
    const onChange = () => {
      const f = form.querySelector<HTMLInputElement>('input[data-upload="source"]')?.files?.[0]
      setWord(Boolean(f && /\.docx?$/i.test(f.name)))
    }
    form.addEventListener("change", onChange)
    return () => form.removeEventListener("change", onChange)
  }, [])

  return <p ref={ref} className="prefill-note" aria-live="polite">{word ? wordText : text}</p>
}
