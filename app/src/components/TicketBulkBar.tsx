"use client"

/**
 * Lišta hromadných akcií nad zoznamom ticketov (Ján 8. 10. 2026).
 *
 * Výber sú obyčajné zaškrtávacie políčka formulára `ticket-bulk` (atribút
 * `form` na riadkoch), takže akcia funguje aj bez JavaScriptu. Skript len
 * pridá „Vybrať všetky", počet vybraných a vypne tlačidlá, kým nie je nič
 * vybrané — bez neho server prázdny výber zdvorilo odmietne.
 */

import { useEffect, useState, type ReactNode } from "react"

export const TICKET_BULK_FORM = "ticket-bulk"

function boxes(): HTMLInputElement[] {
  // Karty aj tabuľka nesú to isté políčko; viditeľné je jedno z nich (CSS).
  return [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${TICKET_BULK_FORM}"][name="ids"]`)]
    .filter(b => b.offsetParent !== null)
}

export default function TicketBulkBar({ labels, children }: {
  /**
   * `selected` je šablóna s `{n}` (napr. „Vybraté: {n}"), nie funkcia —
   * funkcia sa zo servera do klientskeho komponentu neprenesie.
   */
  labels: { selectAll: string; selected: string; none: string }
  /** Tlačidlá akcií (serverové, `formAction`). */
  children: ReactNode
}) {
  const [count, setCount] = useState<number | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const update = () => {
      const all = boxes()
      setTotal(all.length)
      setCount(all.filter(b => b.checked).length)
    }
    update()
    document.addEventListener("change", update)
    window.addEventListener("resize", update)
    return () => { document.removeEventListener("change", update); window.removeEventListener("resize", update) }
  }, [])

  const allOn = count !== null && total > 0 && count === total
  const toggleAll = () => {
    const next = !allOn
    // Prepnúť aj skryté dvojča (karta ↔ riadok), nech sa po zmene šírky nič nerozíde.
    document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${TICKET_BULK_FORM}"][name="ids"]`).forEach(b => { b.checked = next })
    setCount(next ? total : 0)
  }

  return (
    <div className="ticket-bulk-bar" data-empty={count === 0 ? "" : undefined}>
      {count !== null && (
        <label className="ticket-bulk-all">
          <input type="checkbox" className="ticket-pick" checked={allOn} onChange={toggleAll} />
          <span>{labels.selectAll}</span>
        </label>
      )}
      <span className="quiet ticket-bulk-count" aria-live="polite">
        {count === null ? "" : count === 0 ? labels.none : labels.selected.replace("{n}", String(count))}
      </span>
      <span className="ticket-bulk-actions">
        <fieldset disabled={count === 0} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
          {children}
        </fieldset>
      </span>
    </div>
  )
}
