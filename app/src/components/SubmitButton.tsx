"use client"

/**
 * SubmitButton — tlačidlo formulára so stavom počas ukladania.
 *
 * Serverová akcia ukladá a presmeruje späť na tú istú stránku; kým to
 * trvá, tlačidlo vyzeralo rovnako a človek nevedel, či klikol (Ján,
 * 25. 9. 2026). `useFormStatus()` musí byť vnútri `<form>`, preto
 * samostatný komponent — ten istý vzor ako `UploadSubmit`.
 *
 * Jednotné správanie všetkých odosielacích tlačidiel (Ján, 6. 10. 2026):
 * kým formulár beží, **všetky** jeho tlačidlá sú zablokované (proti
 * druhému kliknutiu), ale krúžok a `pendingLabel` ukazuje **len to, na
 * ktoré sa kliklo**. Formulár s dvomi tlačidlami („Schváliť" / „Vrátiť",
 * `formAction`) by inak točil obe a nebolo by vidieť, čo sa vlastne robí.
 * Enter v poli je pre prehliadač klik na prvé tlačidlo, takže sa ráta tiež.
 *
 * Bez JavaScriptu je to obyčajné tlačidlo a formulár odošle prehliadač.
 */

import { useState, useSyncExternalStore } from "react"
import { useFormStatus } from "react-dom"
import { isFormPending, subscribeFormPending } from "@/lib/formPending"
import type { CSSProperties, MouseEvent, ReactNode } from "react"

export default function SubmitButton({
  className = "button",
  children,
  name,
  value,
  style,
  ariaLabel,
  title,
  ariaPressed,
  disabled = false,
  pendingLabel,
  formAction,
  form,
}: {
  className?: string
  children: ReactNode
  name?: string
  value?: string
  style?: CSSProperties
  ariaLabel?: string
  title?: string
  /** Prepínač (zapnuté/vypnuté) — čítačka obrazovky ohlási stav. */
  ariaPressed?: boolean
  disabled?: boolean
  /**
   * Text počas ukladania, keď akcia trvá dlhšie (rozosielanie e-mailov).
   * Samotný krúžok pri desiatkach sekúnd nestačí — človek nevie, či sa
   * niečo deje, alebo stránka zamrzla (Ján, 6. 10. 2026, „Pridať na trasu").
   */
  pendingLabel?: ReactNode
  /** Iná serverová akcia než formulárová — druhé tlačidlo v tom istom formulári. */
  formAction?: (formData: FormData) => void | Promise<void>
  /**
   * `id` formulára, ktorému tlačidlo patrí, keď v ňom nestojí (formuláre sa
   * nevnárajú). Stav sa vtedy číta z `FormPendingSignal` v cieľovom formulári.
   */
  form?: string
}) {
  const own = useFormStatus().pending
  const remote = useSyncExternalStore(
    subscribeFormPending,
    () => (form ? isFormPending(form) : false),
    () => false,
  )
  const pending = form ? remote : own
  const [clicked, setClicked] = useState(false)

  // Po skončení sa značka zhodí, aby pri ďalšom odoslaní iným tlačidlom
  // netočilo aj toto. Úprava stavu počas vykresľovania, nie v `useEffect` —
  // tak to pre stav odvodený z predchádzajúcej hodnoty odporúča React.
  const [wasPending, setWasPending] = useState(pending)
  if (pending !== wasPending) {
    setWasPending(pending)
    if (!pending) setClicked(false)
  }

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Formulár, ktorý neprejde kontrolou prehliadača (`required`), sa
    // neodošle — značka by ostala visieť a točilo by pri cudzom odoslaní.
    const target = e.currentTarget.form
    if (!target || target.checkValidity()) setClicked(true)
  }

  const busy = pending && clicked
  return (
    <button
      className={`${className}${busy ? " is-pending" : ""}`}
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      form={form}
      disabled={pending || disabled}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={ariaPressed}
      style={style}
      onClick={onClick}
    >
      {busy && <span className="button-spinner" aria-hidden="true" />}
      {busy && pendingLabel ? pendingLabel : children}
    </button>
  )
}
