/**
 * clientBoundary.test.ts — server nevolá funkcie z `"use client"` modulov.
 *
 * Zo serverového súboru sa z klientskeho modulu smie brať komponent (ten
 * sa vykreslí ako odkaz na klienta) a typ, nie obyčajná funkcia. Volanie
 * prejde `tsc`, `eslint`, testami aj buildom a padne až pri vykreslení:
 * stránka `/ask/a/[id]` takto hlásila chybu servera (30. 9. 2026,
 * `answerHasCitations` z `Answer.tsx`).
 *
 * Kontrola je statická a hrubá zámerne: pomenovaný import s malým
 * začiatočným písmenom z klientskeho modulu do serverového súboru je
 * podozrivý. Komponenty sa v projekte píšu s veľkým písmenom.
 *
 * Prechádza len `src/app/` — stránky, layouty a routy sa vykresľujú na
 * serveri vždy. Súbor v `lib/` bez `"use client"` môže byť aj čisto
 * klientsky (`peopleSearch.ts` berie `fold` z `MultiSelect` a volajú ho
 * len klientske komponenty), takže tam by kontrola hlásila planý poplach.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"

const SRC = resolve(__dirname, "../src")

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

/** Direktíva musí byť prvým príkazom súboru; stačí pozrieť začiatok. */
const isClient = (source: string) => /^["']use client["']/m.test(source.slice(0, 400))

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2))
    : spec.startsWith(".") ? resolve(dirname(from), spec)
    : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

describe("hranica server/klient", () => {
  it("serverové súbory neberú z klientskych modulov funkcie", () => {
    const problems: string[] = []
    for (const file of files(join(SRC, "app"))) {
      const source = readFileSync(file, "utf8")
      if (isClient(source)) continue
      for (const m of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
        if (m[1]) continue
        const target = resolveImport(file, m[3])
        if (!target || !isClient(readFileSync(target, "utf8"))) continue
        const names = m[2].split(",").map(n => n.trim()).filter(n => n && !n.startsWith("type "))
        for (const name of names) {
          const local = name.split(/\s+as\s+/)[0]
          if (/^[a-z]/.test(local)) problems.push(`${file.slice(SRC.length + 1)}: ${local} z ${m[3]}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
