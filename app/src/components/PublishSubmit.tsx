"use client"

/**
 * PublishSubmit — tlačidlo kroku 3 (ADR-014, D111). Kým je zaškrtnutý prenos
 * pridelení, volá sa „Zverejniť a prideliť"; po odškrtnutí „Zverejniť od …".
 * Polia prenosu sa pri odškrtnutí vypnú, nech sa neodosielajú ani neoverujú.
 *
 * Bez JavaScriptu zostane text podľa predvoleného stavu a formulár funguje:
 * server sa riadi poľom `carryOver`, nie textom tlačidla.
 *
 * Krúžok a zablokovanie počas zverejnenia dáva `SubmitButton` (stav číta
 * z `FormPendingSignal` vo formulári) — zverejnenie trvá niekoľko sekúnd
 * a tlačidlo predtým vyzeralo, akoby sa nič nedialo (Ján, 27. 10. 2026).
 */

import { useEffect, useState } from "react"
import SubmitButton from "@/components/SubmitButton"

export default function PublishSubmit({
  withCarryOver,
  labels,
  form,
}: {
  /** Ponúka sa prenos pridelení (a je predvolene zaškrtnutý). */
  withCarryOver: boolean
  labels: { publish: string; publishAndAssign: string }
  /** Formulár, ktorý tlačidlo odosiela, keď stojí mimo neho (päta karty postupu). */
  form?: string
}) {
  const [on, setOn] = useState(withCarryOver)

  useEffect(() => {
    const target = form ? document.getElementById(form) : null
    if (!(target instanceof HTMLFormElement)) return
    const box = target.querySelector<HTMLInputElement>('input[name="carryOver"]')
    if (!box) return
    const sync = () => {
      setOn(box.checked)
      target.querySelectorAll<HTMLElement>("[data-carry-over]").forEach(el => {
        el.hidden = !box.checked
        el.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach(i => { i.disabled = !box.checked })
      })
    }
    sync()
    box.addEventListener("change", sync)
    return () => box.removeEventListener("change", sync)
  }, [form])

  return (
    <SubmitButton className="button" form={form}>
      {on ? labels.publishAndAssign : labels.publish}
    </SubmitButton>
  )
}
