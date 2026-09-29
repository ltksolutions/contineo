/**
 * assignSummary.ts — čo je na `/hr/assign` práve vybrané
 * (HR-pridelit-normy-hladanie, body 7 a 8).
 *
 * **Nie je to dopad.** Počet ľudí sa počíta len na serveri po „Skontrolovať
 * dopad" cez `matchesAudience()` (rozhodnutie Jána 2026-09-22). Tu sa len
 * spočítajú vybrané položky a zostaví „podpis" výberu publika, podľa ktorého
 * prehliadač pozná, že sa výber po kontrole zmenil.
 *
 * Rozklad hodnôt je ten istý ako v `audienceFromSelection()` (`assignments.ts`);
 * ten modul sa do prehliadača načítať nedá (siaha na databázu), preto je tu
 * čistá kópia **rozkladu**, nie pravidla príslušnosti — a test stráži, že sa
 * obe zhodujú.
 */

export interface AssignSelection {
  all: boolean
  /** Hodnoty `audience` (`department:…`, `group:…`, `track:…`, `person:…`). */
  audience: string[]
  addresses: string
  documents: string[]
}

export interface SelectionCounts {
  documents: number
  all: boolean
  departments: number
  groups: number
  tracks: number
  people: number
}

/** Publiká ako `druh:hodnota`, bez duplicít — to isté, čo vyrobí server. */
export function audienceKeys(sel: Pick<AssignSelection, "all" | "audience" | "addresses">): string[] {
  if (sel.all) return ["all"]
  const out = new Set<string>()
  for (const raw of sel.audience) {
    const at = raw.indexOf(":")
    if (at === -1) continue
    const kind = raw.slice(0, at)
    const value = raw.slice(at + 1).trim().toLowerCase()
    if (!value) continue
    if (kind === "person" && !value.includes("@")) continue
    if (kind === "group" || kind === "track" || kind === "department" || kind === "person") out.add(`${kind}:${value}`)
  }
  for (const a of sel.addresses.split(/[\n,;]+/)) {
    const email = a.trim().toLowerCase()
    if (email.includes("@")) out.add(`person:${email}`)
  }
  return [...out]
}

/**
 * Podpis výberu publika. Termín, dôvod ani normy doň nepatria — dopad je
 * počet ľudí, a ten závisí len od toho, komu sa prideľuje.
 */
export function audienceSignature(sel: Pick<AssignSelection, "all" | "audience" | "addresses">): string {
  return audienceKeys(sel).sort().join("|")
}

export function selectionCounts(sel: AssignSelection): SelectionCounts {
  const keys = audienceKeys(sel)
  const count = (kind: string) => keys.filter(k => k.startsWith(`${kind}:`)).length
  return {
    documents: new Set(sel.documents).size,
    all: sel.all,
    departments: count("department"),
    groups: count("group"),
    tracks: count("track"),
    people: count("person"),
  }
}

/** Výber z formulára v prehliadači — tie isté mená polí, aké číta server. */
export function selectionFromForm(fd: FormData): AssignSelection {
  const strings = (name: string) => fd.getAll(name).filter((v): v is string => typeof v === "string")
  return {
    all: fd.get("all") === "1",
    audience: strings("audience"),
    addresses: String(fd.get("addresses") ?? ""),
    documents: strings("document"),
  }
}
