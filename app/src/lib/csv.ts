/**
 * csv.ts — čítanie a písanie CSV.
 *
 * Zámerne bez knižnice: potrebujeme presne dve veci a obe sa zmestia na
 * stranu. Zato musia zvládnuť to, čo naozaj príde z Excelu — bodkočiarku
 * ako oddeľovač (slovenské a české locale), BOM na začiatku súboru
 * a úvodzovky okolo polí s čiarkou.
 *
 * **Bolo to v `scripts/lib/csv.mjs`.** Presunuté sem, keď import osôb pribudol
 * aj na obrazovku: dva importéry toho istého súboru sú spoľahlivý spôsob, ako
 * jedného dňa naimportovať dva rôzne výsledky. Skript odtiaľ teraz len
 * preberá.
 */

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
  separator?: string
}

/** Uhádne oddeľovač z hlavičky. Excel v SK/CZ locale ukladá bodkočiarkou. */
export function detectSeparator(header: string): string {
  const commas = (header.match(/,/g) ?? []).length
  const semicolons = (header.match(/;/g) ?? []).length
  return semicolons > commas ? ";" : ","
}

/** Rozoberie jeden riadok s ohľadom na úvodzovky a zdvojené `""`. */
export function parseLine(line: string, sep: string): string[] {
  const out: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; continue }
      if (c === '"') { inQuotes = false; continue }
      field += c; continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === sep) { out.push(field); field = ""; continue }
    field += c
  }
  out.push(field)
  return out.map(f => f.trim())
}

/**
 * CSV → pole objektov. Kľúče sú hlavičky **znormalizované**: malé písmená,
 * bez diakritiky a bez medzier — aby `Meno`, `meno` aj `MENO` boli to isté
 * a aby sa hlavička z Excelu nemusela trafiť na znak presne.
 */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "")            // BOM z Excelu
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== "")
  if (lines.length === 0) return { headers: [], rows: [] }

  const sep = detectSeparator(lines[0])
  const headers = parseLine(lines[0], sep).map(normalizeHeader)
  const rows = lines.slice(1).map(line => {
    const cells = parseLine(line, sep)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]))
  })
  return { headers, rows, separator: sep }
}

export function normalizeHeader(h: string): string {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[\s_-]/g, "")
}

export interface CsvColumn<T> {
  label: string
  value: (row: T) => unknown
}

/** Pole objektov → CSV. Oddeľovač bodkočiarka, aby sa Excel v SK locale nepomýlil. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], sep = ";"): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return /["\n\r]|[;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.map(c => escape(c.label)).join(sep)
  const body = rows.map(r => columns.map(c => escape(c.value(r))).join(sep))
  // BOM, inak Excel na Windows zobrazí diakritiku ako paškvil.
  return "﻿" + [head, ...body].join("\r\n") + "\r\n"
}
