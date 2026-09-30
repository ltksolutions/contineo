/**
 * askHistoryMatch.ts — čisté funkcie histórie otázok (ASK-historia-otazok).
 *
 * Bez databázy, aby sa dali testovať samy: zhoda otázky s tým, čo človek
 * píše, a zlúčenie opakovaných otázok do jedného riadku v plachte.
 */

/** Malé písmená bez diakritiky — „Prestúpiť" nájde aj „prestupit". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Slová hľadania — medzery, interpunkcia a prázdne kúsky preč. */
export function queryWords(q: string): string[] {
  return foldText(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/**
 * Otázka zodpovedá hľadaniu, keď obsahuje **každé** jeho slovo (AND), bez
 * ohľadu na diakritiku a veľkosť písmen. Prázdne hľadanie zodpovedá všetkému.
 */
export function matchesQuery(question: string, q: string): boolean {
  const words = queryWords(q)
  if (!words.length) return true
  const hay = foldText(question)
  return words.every(w => hay.includes(w))
}

/**
 * Tá istá otázka položená viackrát je v plachte **jeden riadok** —
 * najnovší. Ľudia sa pýtajú opakovane na to isté (prestupy, lehoty)
 * a päť rovnakých riadkov by bolo päťkrát to isté.
 */
export function distinctQuestions<T extends { question: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const key = foldText(it.question).replace(/\s+/g, " ").trim()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}
