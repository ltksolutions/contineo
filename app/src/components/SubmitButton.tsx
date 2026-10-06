"use client"

/**
 * SubmitButton — tlačidlo formulára so stavom počas ukladania.
 *
 * Serverová akcia ukladá a presmeruje späť na tú istú stránku; kým to
 * trvá, tlačidlo vyzeralo rovnako a človek nevedel, či klikol (Ján,
 * 25. 9. 2026). `useFormStatus()` musí byť vnútri `<form>`, preto
 * samostatný komponent — ten istý vzor ako `UploadSubmit`.
 *
 * Bez JavaScriptu je to obyčajné tlačidlo a formulár odošle prehliadač.
 */

import { useFormStatus } from "react-dom"
import type { CSSProperties, ReactNode } from "react"

export default function SubmitButton({
  className = "button",
  children,
  name,
  value,
  style,
  ariaLabel,
  disabled = false,
  pendingLabel,
}: {
  className?: string
  children: ReactNode
  name?: string
  value?: string
  style?: CSSProperties
  ariaLabel?: string
  disabled?: boolean
  /**
   * Text počas ukladania, keď akcia trvá dlhšie (rozosielanie e-mailov).
   * Samotný krúžok pri desiatkach sekúnd nestačí — človek nevie, či sa
   * niečo deje, alebo stránka zamrzla (Ján, 6. 10. 2026, „Pridať na trasu").
   */
  pendingLabel?: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      className={`${className}${pending ? " is-pending" : ""}`}
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      style={style}
    >
      {pending && <span className="button-spinner" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
