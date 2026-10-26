/**
 * askScopeStore.ts — výber zdrojov obrazovky odpovede pre plachtu v hlavičke
 * (ASK-zdroje-v-plachte, bod 8).
 *
 * „Upraviť otázku" na `/ask` otvorí plachtu `HeaderAsk` v `layout.tsx`, ktorá
 * so stránkou nemá spoločný stav. `Search` sem zapíše aktuálny výber,
 * plachta si ho pri otvorení prečíta. Mimo `/ask` je prázdny → predvolený
 * výber (Q3 A). Nič sa neukladá — žije len v otvorenej karte.
 */

import type { AskScopeDocument } from "./askScope"

/** Výber zdrojov a dokumenty zúženia knižnice (`?doc=`, D269). */
export interface AskScopeState {
  ids: string[]
  documents: AskScopeDocument[]
}

let current: AskScopeState | null = null

export function setAskScope(scope: AskScopeState | null) {
  current = scope ? { ids: [...scope.ids], documents: scope.documents.map(d => ({ ...d })) } : null
}
export function askScope(): AskScopeState | null {
  return current ? { ids: [...current.ids], documents: current.documents.map(d => ({ ...d })) } : null
}
