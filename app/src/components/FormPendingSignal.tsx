"use client"

/**
 * Hlásič stavu formulára pre tlačidlo, ktoré stojí mimo neho.
 *
 * Tlačidlo s atribútom `form="…"` patrí formuláru inde na stránke —
 * formuláre sa nesmú vnárať (logo v nastaveniach, presun v knižnici,
 * premenovanie tagu). `useFormStatus()` však číta len formulár, v ktorom
 * komponent v Reacte naozaj je, takže `SubmitButton` mimo neho by krúžok
 * neukázal nikdy. Tento komponent sedí **vnútri** cieľového formulára
 * a jeho stav zverejní pod `id` formulára; `SubmitButton form="…"` ho
 * odtiaľ prečíta (Ján, 6. 10. 2026: „všetky tlačidlá jednotne").
 *
 * Nič nevykresľuje. Bez JavaScriptu nerobí nič a formulár odošle prehliadač.
 */

import { useEffect } from "react"
import { useFormStatus } from "react-dom"
import { setFormPending } from "@/lib/formPending"

export default function FormPendingSignal({ form }: { form: string }) {
  const { pending } = useFormStatus()
  useEffect(() => {
    setFormPending(form, pending)
    // Formulár zmizol (napr. po zlúčení tagov) — nesmie po ňom ostať „beží".
    return () => setFormPending(form, false)
  }, [form, pending])
  return null
}
