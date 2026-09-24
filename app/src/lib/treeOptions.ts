/**
 * Položky výberu zo stromu (oddelenia, priečinky) — názov a **cesta nad ním**
 * („Konferencia › Prezident"), nie odsadenie „— — ". Rám
 * KOMPONENT-vyber-oddelenia, 24. 9. 2026: cesta sa dá prečítať aj v zatvorenom
 * poli a hľadá sa v nej.
 *
 * Vstup je strom rozvinutý do riadkov do hĺbky (`flattenTree()`), teda rodič
 * vždy pred deťmi. Cesta sa skladá zásobníkom podľa `level` — bez druhého
 * prechodu stromom.
 */

export interface TreeRow {
  id: string
  name: string
  /** 1 = koreň. */
  level: number
}

export interface TreeOption {
  value: string
  label: string
  path?: string
  level: number
}

export const PATH_SEPARATOR = " › "

export function treeOptions(rows: TreeRow[]): TreeOption[] {
  const stack: string[] = []
  return rows.map(r => {
    stack.length = Math.max(0, r.level - 1)
    const path = stack.join(PATH_SEPARATOR)
    stack.push(r.name)
    return { value: r.id, label: r.name, level: r.level, ...(path ? { path } : {}) }
  })
}
