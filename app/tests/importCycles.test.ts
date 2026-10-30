/**
 * importCycles.test.ts — kruhové importy v `src/lib`.
 *
 * 30. 10. 2026 prešli tsc, eslint, vitest aj build a `/api/rating` v produkcii
 * padal: `evaluation.ts` importoval `people.ts` a ten `EVALUATOR_ROLE`
 * z `evaluation.ts`. V bundli sa konštanta čítala skôr, než bola
 * inicializovaná („Cannot access before initialization"); vitest načíta
 * moduly v inom poradí, takže to nevidel. Tento test kruh nájde v zdrojákoch.
 *
 * Počítajú sa len importy, ktoré ostanú v behu — `import type` a
 * `export type` sa pri preklade zmažú a kruh nerobia.
 */

import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, dirname, resolve, relative } from "node:path"

const SRC = resolve(__dirname, "../src")
const LIB = join(SRC, "lib")

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []
  })
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

function runtimeImports(file: string): string[] {
  const src = readFileSync(file, "utf8")
  const out: string[] = []
  const re = /^\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?["']([^"']+)["']/gm
  for (const m of src.matchAll(re)) {
    if (m[2]) continue
    // `import { type A, type B } from` — samé typy, v behu nič.
    const names = m[3]?.match(/\{([^}]*)\}/)?.[1]
    if (names && !m[3]!.replace(/\{[^}]*\}/, "").replace(/from\s*$/, "").replace(/,/g, "").trim()
      && names.split(",").map(s => s.trim()).filter(Boolean).every(s => s.startsWith("type "))) continue
    const target = resolveImport(file, m[4])
    if (target && target.startsWith(LIB)) out.push(target)
  }
  return out
}

/**
 * Známe kruhy z čias pred týmto testom. Dnes nič nerozbijú — konštanta sa
 * číta až vnútri funkcie, nie pri načítaní modulu —, ale sú to tie isté
 * nášľapné míny. Nový kruh sem nepatrí; zoznam sa má len zmenšovať.
 */
const KNOWN = new Set([
  "acknowledgements.ts → tracks.ts → acknowledgements.ts",
])

describe("src/lib bez kruhových importov", () => {
  it("žiadny modul sa cez iné nevracia sám k sebe", () => {
    const graph = new Map(files(LIB).map(f => [f, runtimeImports(f)]))
    const cycles: string[] = []
    const state = new Map<string, 1 | 2>()
    const stack: string[] = []
    const visit = (f: string) => {
      state.set(f, 1); stack.push(f)
      for (const t of graph.get(f) ?? []) {
        if (state.get(t) === 1) cycles.push([...stack.slice(stack.indexOf(t)), t].map(x => relative(LIB, x)).join(" → "))
        else if (!state.has(t)) visit(t)
      }
      stack.pop(); state.set(f, 2)
    }
    for (const f of graph.keys()) if (!state.has(f)) visit(f)
    expect(cycles.filter(c => !KNOWN.has(c))).toEqual([])
  })
})
