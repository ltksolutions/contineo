/**
 * askScopeStore.ts — výber zdrojov obrazovky odpovede pre plachtu v hlavičke
 * (ASK-zdroje-v-plachte, bod 8).
 *
 * „Upraviť otázku" na `/ask` otvorí plachtu `HeaderAsk` v `layout.tsx`, ktorá
 * so stránkou nemá spoločný stav. `Search` sem zapíše aktuálny výber,
 * plachta si ho pri otvorení prečíta. Mimo `/ask` je prázdny → predvolený
 * výber (Q3 A). Nič sa neukladá — žije len v otvorenej karte.
 */

let current: string[] | null = null

export function setAskScope(ids: string[] | null) { current = ids ? [...ids] : null }
export function askScope(): string[] | null { return current ? [...current] : null }
