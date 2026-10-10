/**
 * wordDiff.ts — rozdiel dvoch krátkych textov po slovách (fronta kurátora,
 * ADR-030 D185, 10. 10. 2026).
 *
 * `textDiff` (textFix.ts) porovnáva po riadkoch — na znenie predpisu správne,
 * na odpoveď FAQ s tromi odsekmi nie: celý odsek by bol „zmenený“, hoci sa
 * v ňom vymenilo jedno slovo. Tu sa porovnávajú slová a medzery zostávajú
 * súčasťou textu, takže výsledok sa dá vykresliť bez úprav.
 */

export type WordDiffPart = { kind: "same" | "added" | "removed"; text: string }

/** Nad týmto súčinom dĺžok sa nepočíta LCS — ukáže sa celé staré a celé nové. */
const LCS_CELLS = 1_000_000

function tokens(s: string): string[] {
  return s.split(/(\s+)/).filter(t => t !== "")
}

function push(out: WordDiffPart[], kind: WordDiffPart["kind"], text: string) {
  const last = out[out.length - 1]
  if (last && last.kind === kind) last.text += text
  else out.push({ kind, text })
}

export function wordDiff(before: string, after: string): WordDiffPart[] {
  const a = tokens(before)
  const b = tokens(after)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const out: WordDiffPart[] = []
  if (start) push(out, "same", a.slice(0, start).join(""))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  if (midA.length * midB.length > LCS_CELLS) {
    if (midA.length) push(out, "removed", midA.join(""))
    if (midB.length) push(out, "added", midB.join(""))
  } else {
    // LCS po tokenoch; tabuľka od konca, aby sa výsledok dal skladať dopredu.
    const n = midA.length, m = midB.length
    const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      L[i][j] = midA[i] === midB[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
    let i = 0, j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { push(out, "same", midA[i]); i++; j++ }
      else if (L[i + 1][j] >= L[i][j + 1]) { push(out, "removed", midA[i]); i++ }
      else { push(out, "added", midB[j]); j++ }
    }
    while (i < n) push(out, "removed", midA[i++])
    while (j < m) push(out, "added", midB[j++])
  }
  if (endA < a.length) push(out, "same", a.slice(endA).join(""))
  return out
}

export function hasChanges(parts: WordDiffPart[]): boolean {
  return parts.some(p => p.kind !== "same")
}
