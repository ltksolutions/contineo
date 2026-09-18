"use client"

/**
 * LiveFilter.tsx — filter, ktorý zabral hneď, ako prestaneš písať.
 *
 * **Prečo vôbec.** Zoznamy sa dovtedy filtrovali odoslaním formulára: napíš,
 * stlač Enter alebo trafíš tlačidlo, počkaj. Pri hľadaní v knižnici alebo
 * v adresári to znamená, že človek nevidí, či sa blíži k tomu, čo hľadá, kým
 * sa nerozhodne odoslať — a keď netrafí, celý kruh znova.
 *
 * **Prečo to nie je filtrovanie v prehliadači.** Zoznam môže byť dlhší než
 * jedna strana a filtre sa skladajú (priečinok, značka, stav). Filtrovanie
 * nad tým, čo je práve vykreslené, by dávalo iné výsledky než odoslaný
 * formulár — dve pravdy o tom istom zozname. Preto sa mení **adresa** a
 * zoznam skladá server, presne ako pri odoslaní; len to za človeka spraví
 * prehliadač sám.
 *
 * **Bez JavaScriptu to zostáva formulárom.** `action` aj `method="get"` sú na
 * mieste a tlačidlo v ňom tiež — keď skript nebeží, funguje pôvodná cesta
 * bez jediného rozdielu. To je dôvod, prečo je tu `<form>` a nie `<div>`
 * s poslucháčmi.
 *
 * **Prečo `replace` a nie `push`.** Každý úder do klávesnice by inak pribudol
 * do histórie prehliadača a tlačidlo Späť by sa prehrýzalo písmenami.
 */

import { useCallback, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FormEvent, ReactNode } from "react"

/** Koľko sa čaká po poslednom údere. Dosť na dopísanie slova, málo na to,
 *  aby to pôsobilo ako zdržanie. */
const DELAY_MS = 250

export default function LiveFilter({
  action,
  className,
  children,
  label,
}: {
  /** Cesta, na ktorú filter mieri — tá istá, akú má formulár v `action`. */
  action: string
  className?: string
  children: ReactNode
  /** Popis pre čítačku obrazovky: čo sa vlastne filtruje. */
  label?: string
}) {
  const form = useRef<HTMLFormElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const [pending, start] = useTransition()

  const submit = useCallback(() => {
    const f = form.current
    if (!f) return
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(f).entries()) {
      // Prázdne pole do adresy nepatrí — inak by v nej po vymazaní hľadania
      // zostalo `?search=` a odkaz by vyzeral ako filter, ktorý nič nefiltruje.
      if (typeof value === "string" && value.trim() !== "") params.set(key, value)
    }
    const query = params.toString()
    start(() => router.replace(query ? `${action}?${query}` : action, { scroll: false }))
  }, [action, router])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(submit, DELAY_MS)
  }, [submit])

  const immediate = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    submit()
  }, [submit])

  /**
   * Písanie sa odkladá, výber nie.
   *
   * V Reacte `onChange` na formulári vyskočí aj pri každom písmene, takže
   * rozlíšiť sa to musí podľa prvku, nie podľa udalosti: rozbaľovací výber
   * a zaškrtávacie pole sú jedno rozhodnutie a čakať po ňom štvrť sekundy
   * vyzerá ako zaseknuté rozhranie.
   */
  function onInput(e: FormEvent<HTMLFormElement>) {
    const el = e.target
    const instant =
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"))
    if (instant) immediate()
    else schedule()
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Enter aj tlačidlo idú tou istou cestou ako písanie — bez preloženia
    // celej stránky, ktoré by zahodilo pozíciu v zozname.
    e.preventDefault()
    immediate()
  }

  return (
    <form
      ref={form}
      className={className}
      action={action}
      method="get"
      onSubmit={onSubmit}
      onInput={onInput}
      aria-label={label}
      aria-busy={pending || undefined}
      data-pending={pending ? "" : undefined}
    >
      {children}
    </form>
  )
}
