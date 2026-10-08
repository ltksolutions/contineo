/**
 * valueSelect.ts — výber skupín a značiek (ZAKLAD-vyber-skupin-a-znaciek,
 * 8. 10. 2026). Čisté funkcie bez databázy: zlúčenie zaškrtnutých hodnôt
 * s napísanými novými a varovanie pri podobnom názve.
 *
 * Číselník skupín zámerne nie je (D38) — skupina vznikne tým, že ju niekto
 * dostane. Preklep v novej hodnote by preto potichu založil druhú skupinu
 * („rozhodcova" vedľa „rozhodcovia"), ktorej nikdy nič nepríde.
 */

/** Rozdelí text s hodnotami oddelenými čiarkou, bodkočiarkou alebo riadkom. */
export function splitValues(raw: string): string[] {
  return raw.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

/**
 * Hodnoty z formulára: zaškrtnuté (`name`, môže ich byť viac; starý tvar
 * „a, b" v jednom poli sa tiež rozdelí — formulár otvorený pred nasadením)
 * a nové z poľa `${name}New`.
 */
export function readValues(fd: FormData, name: string): { picked: string[]; fresh: string[]; forced: string[] } {
  const all = (key: string) => fd.getAll(key).filter((v): v is string => typeof v === "string").flatMap(splitValues)
  return { picked: all(name), fresh: all(`${name}New`), forced: all(`${name}Force`) }
}

/** Bez diakritiky a veľkých písmen — „Rozhodcovia" a „rozhodcovia" sú to isté. */
export function foldValue(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = keep
    }
  }
  return row[b.length]
}

/**
 * Existujúca hodnota, na ktorú sa nová podobá, alebo `null`. Podobná =
 * rovnaká bez diakritiky a veľkých písmen, alebo (od dĺžky 5) líši sa
 * o jedno písmeno. Presne tá istá hodnota podobná nie je — to je výber.
 */
export function similarValue(value: string, existing: string[]): string | null {
  const v = foldValue(value)
  if (!v) return null
  for (const e of existing) {
    const f = foldValue(e)
    if (e.trim().toLowerCase() === value.trim().toLowerCase()) return null
    if (f === v) return e
  }
  if (v.length < 5) return null
  for (const e of existing) {
    const f = foldValue(e)
    if (f.length >= 5 && Math.abs(f.length - v.length) <= 1 && levenshtein(f, v) <= 1) return e
  }
  return null
}

/**
 * Rozdelí nové hodnoty na tie, ktoré sa uložia, a podobné, ktoré sa
 * neuložia (Q3). Vynútené (`${name}Force`, „Založiť napriek tomu") sa
 * uložia vždy.
 */
export function splitSimilar(fresh: string[], existing: string[], forced: string[]): { keep: string[]; similar: { value: string; like: string }[] } {
  const keep: string[] = []
  const similar: { value: string; like: string }[] = []
  const force = new Set(forced.map(foldValue))
  for (const v of fresh) {
    const like = force.has(foldValue(v)) ? null : similarValue(v, existing)
    if (like) similar.push({ value: v, like })
    else keep.push(v)
  }
  return { keep, similar }
}
