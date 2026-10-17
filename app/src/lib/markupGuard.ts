/**
 * markupGuard.ts — zmeny zápisu, ktoré človek nepísal (16. 10. 2026).
 *
 * Vizuálny režim editora (Toast UI) pri uložení text znova poskladá
 * z Markdownu: hviezdičky escapuje (`klub******` → `klub\*\*\*\*\*\*`)
 * a pri Súťažnom poriadku z poznámky `***Uvedie sa…` (č. 3) urobil
 * `*Uvedie sa…` (č. 1) — zmena obsahu, ktorú nikto nevidel.
 *
 * Strážca porovná uložený text s tým, z ktorého editor vyšiel, po riadkoch
 * (`lineEdits`, Myers). Riadok, v ktorom sa nezmenilo ani jedno písmeno,
 * len značky Markdownu a medzery, je **zmena zápisu, nie textu**. Tieto
 * riadky sa pred uložením ukážu a predvolene sa vráti pôvodný zápis;
 * skutočné úpravy človeka sa uložia. Zmena počtu hviezdičiek sa označí
 * zvlášť — tá môže meniť obsah (poznámky pod čiarou).
 *
 * Čisté funkcie, bez databázy.
 */

import { lineEdits } from "./textFix"

export interface MarkupChange {
  /** Index riadku v novom texte (od 0). */
  line: number
  before: string
  after: string
  /** Zmenil sa počet hviezdičiek — môže ísť o obsah (poznámka *, **, ***). */
  stars: boolean
}

/** Text bez značiek Markdownu a bez rozdielov v medzerách — „písmená". */
export function letters(s: string): string {
  return s
    .replace(/\\(?=\S)/g, "")
    .replace(/[*_#`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const stars = (s: string) => (s.match(/\*/g) ?? []).length

/**
 * Riadky zmenené len v zápise. Páruje sa vo vnútri každého úseku zmien:
 * i-ty zmazaný riadok s i-tym pridaným (editor mení riadok na mieste, nie
 * presúva). Pridaný alebo zmazaný riadok bez páru je skutočná úprava.
 */
export function markupChanges(before: string, after: string): MarkupChange[] {
  const a = String(before ?? "").replace(/\r\n?/g, "\n").split("\n")
  const b = String(after ?? "").replace(/\r\n?/g, "\n").split("\n")
  const edits = lineEdits(a, b)
  if (!edits) return []
  const out: MarkupChange[] = []
  let removed: { text: string }[] = []
  let added: { text: string; b: number }[] = []
  const flush = () => {
    const n = Math.min(removed.length, added.length)
    for (let i = 0; i < n; i++) {
      const old = removed[i].text
      const neu = added[i].text
      if (old !== neu && letters(old) === letters(neu) && letters(old) !== "") {
        out.push({ line: added[i].b, before: old, after: neu, stars: stars(old) !== stars(neu) })
      }
    }
    removed = []
    added = []
  }
  for (const e of edits) {
    if (e.kind === "same") { flush(); continue }
    if (e.kind === "removed") removed.push({ text: e.text })
    else added.push({ text: e.text, b: e.b! })
  }
  flush()
  return out
}

/** Nový text s pôvodným zápisom v daných riadkoch; ostatné úpravy ostávajú. */
export function restoreMarkup(after: string, changes: MarkupChange[]): string {
  const lines = String(after ?? "").replace(/\r\n?/g, "\n").split("\n")
  for (const c of changes) if (lines[c.line] === c.after) lines[c.line] = c.before
  return lines.join("\n")
}
