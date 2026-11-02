"use client"

/**
 * Chyba povinného poľa bez bubliny prehliadača (ZAKLAD-chyba-povinneho-pola,
 * 2. 11. 2026).
 *
 * Bublinu „Vyplňte toto pole" kreslí systém, CSS na ňu nesiaha, v Safari je
 * takmer neviditeľná a ukáže len prvé pole. SwiftUI ju nemá — chyba je
 * červený riadok pod poľom. Ten kreslí CSS (`.field-error`, `:user-invalid`
 * v `globals.css`); tento komponent robí len tri veci, ktoré CSS nevie:
 *
 * 1. potlačí bublinu (`preventDefault` na udalosti `invalid`),
 * 2. dá fokus **prvému** chybnému poľu a dorolú k nemu,
 * 3. zloží vetu do `.form-summary` pri tlačidle („Chýbajú povinné údaje:
 *    Názov, Druh."). Šablóny nesie prvok v `data-one` / `data-many`.
 *
 * **Prečo poslucháč na `document`, nie obal formulárov** — ako
 * `RouteProgress`: formulárov sú desiatky a jeden poslucháč pokryje aj tie,
 * ktoré pribudnú. Udalosť `invalid` nebublá, preto `capture`.
 *
 * Bez JavaScriptu sa nič z toho nedeje a bublina ostáva ako záloha;
 * červený okraj a riadok pod poľom fungujú aj tak (čisté CSS).
 */

import { useEffect } from "react"

/** Popis poľa bez sivého „Povinné" (to je pseudo-prvok, v `textContent` nie je). */
function labelOf(el: Element): string {
  const field = el.closest(".field")
  return field?.querySelector(".field-label")?.textContent?.trim() ?? ""
}

/** Čo dostane fokus — pri `Select` jeho tlačidlo, nie skryté pole. */
function focusTarget(el: Element): HTMLElement | null {
  if (el.classList.contains("select-required")) {
    return el.closest(".select")?.querySelector<HTMLElement>(".select-button") ?? null
  }
  return el as HTMLElement
}

function updateSummary(form: HTMLFormElement) {
  const box = form.querySelector<HTMLElement>(".form-summary")
  if (!box) return
  const names = [...new Set([...form.querySelectorAll(":user-invalid")].map(labelOf).filter(Boolean))]
  if (names.length === 0) { box.textContent = ""; return }
  const template = (names.length === 1 ? box.dataset.one : box.dataset.many) ?? ""
  box.textContent = template.replace("{names}", names.join(", "))
}

export default function RequiredFieldsGuard() {
  useEffect(() => {
    // Formuláre, ktorým už v tomto pokuse o odoslanie fokus dostal prvé pole.
    // `invalid` príde pre každé chybné pole zvlášť, synchrónne za sebou.
    let focused = new WeakSet<HTMLFormElement>()

    const onInvalid = (e: Event) => {
      const el = e.target as HTMLInputElement
      const form = el.form
      if (!form) return
      e.preventDefault()
      if (!focused.has(form)) {
        focused.add(form)
        const target = focusTarget(el)
        target?.focus({ preventScroll: true })
        target?.scrollIntoView({ block: "center", behavior: "smooth" })
        // Po poslednom `invalid` tohto pokusu: súhrn a nový pokus nanovo.
        // `setTimeout`, nie `queueMicrotask` — mikroúlohy bežia aj medzi
        // jednotlivými `invalid` a fokus by skončil na poslednom poli.
        setTimeout(() => { updateSummary(form); focused = new WeakSet() }, 0)
      }
    }
    // Keď človek pole opraví, súhrn sa skráti (alebo zmizne cez CSS).
    const onChange = (e: Event) => {
      const form = (e.target as HTMLElement).closest?.("form")
      if (form?.querySelector(".form-summary")) requestAnimationFrame(() => updateSummary(form))
    }

    document.addEventListener("invalid", onInvalid, true)
    document.addEventListener("input", onChange, true)
    document.addEventListener("change", onChange, true)
    document.addEventListener("click", onChange, true)
    return () => {
      document.removeEventListener("invalid", onInvalid, true)
      document.removeEventListener("input", onChange, true)
      document.removeEventListener("change", onChange, true)
      document.removeEventListener("click", onChange, true)
    }
  }, [])
  return null
}
