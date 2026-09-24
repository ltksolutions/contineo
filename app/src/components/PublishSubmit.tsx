"use client"

/**
 * PublishSubmit — tlačidlo kroku 3 (ADR-014, D111). Kým je zaškrtnutý prenos
 * pridelení, volá sa „Zverejniť a prideliť"; po odškrtnutí „Zverejniť od …".
 * Polia prenosu sa pri odškrtnutí vypnú, nech sa neodosielajú ani neoverujú.
 *
 * Bez JavaScriptu zostane text podľa predvoleného stavu a formulár funguje:
 * server sa riadi poľom `carryOver`, nie textom tlačidla.
 */

import { useEffect, useRef, useState } from "react"

export default function PublishSubmit({
  withCarryOver,
  labels,
}: {
  /** Ponúka sa prenos pridelení (a je predvolene zaškrtnutý). */
  withCarryOver: boolean
  labels: { publish: string; publishAndAssign: string }
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [on, setOn] = useState(withCarryOver)

  useEffect(() => {
    const form = ref.current?.form
    const box = form?.querySelector<HTMLInputElement>('input[name="carryOver"]')
    if (!form || !box) return
    const sync = () => {
      setOn(box.checked)
      form.querySelectorAll<HTMLElement>("[data-carry-over]").forEach(el => {
        el.hidden = !box.checked
        el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach(i => { i.disabled = !box.checked })
      })
    }
    sync()
    box.addEventListener("change", sync)
    return () => box.removeEventListener("change", sync)
  }, [])

  return (
    <button ref={ref} className="button" type="submit">
      {on ? labels.publishAndAssign : labels.publish}
    </button>
  )
}
