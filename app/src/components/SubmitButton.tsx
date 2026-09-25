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
}: {
  className?: string
  children: ReactNode
  name?: string
  value?: string
  style?: CSSProperties
  ariaLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      className={`${className}${pending ? " is-pending" : ""}`}
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      style={style}
    >
      {pending && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
