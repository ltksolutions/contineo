/**
 * Ktoré formuláre práve odosielajú — pre tlačidlá mimo svojho formulára
 * (`FormPendingSignal` zapisuje, `SubmitButton form="…"` číta).
 *
 * Obyčajná mapa v module prehliadača, nie React kontext: tlačidlo a formulár
 * sú v rôznych vetvách stromu a spoločného predka s kontextom nemajú.
 * Na serveri sa nikdy nič nezapíše (efekty tam nebežia), takže stav medzi
 * požiadavkami nezdieľa.
 */

const pending = new Map<string, boolean>()
const listeners = new Set<() => void>()

export function setFormPending(form: string, value: boolean): void {
  if ((pending.get(form) ?? false) === value) return
  if (value) pending.set(form, true)
  else pending.delete(form)
  for (const l of listeners) l()
}

export function isFormPending(form: string): boolean {
  return pending.get(form) ?? false
}

export function subscribeFormPending(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
