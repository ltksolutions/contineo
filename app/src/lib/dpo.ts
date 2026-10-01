/**
 * Zodpovedná osoba (DPO) — rola a výkaz právnych základov (ADR-012, D104).
 *
 * DPO právny základ **kontroluje, neurčuje** (O15/A10): určuje ho zodpovedná
 * osoba za predpis (D91). Výkaz preto nič nemení, len ukazuje, čo platí
 * a čo chýba — raz za štvrťrok aj e-mailom.
 */

import { currentTenant, currentPerson } from "./session"
import { effectiveVersion, type DocumentRecord } from "./documents"
import { basesOf, dominantBasis, type LegalBasis, type LegalBasisEntry } from "./versionResponsibility"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const DPO_ROLE = "dpo"

export function isDpo(person: Pick<Person, "roles"> | null): boolean {
  return Boolean(person?.roles?.includes(DPO_ROLE))
}

export type DpoContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function dpoContext(): Promise<DpoContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť (rovnako ako `hrContext()`).
    console.error("[dpo] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isDpo(person)) return { state: "forbidden" }
  return { state: "ready", person, tenant }
}

/** Čo pri platnom znení chýba alebo nesedí. */
export type BasisProblem = "noBasis" | "outsideCodelist" | "noReference" | "noResponsible" | "inactiveResponsible"

export interface LegalBasisRow {
  documentId: string
  title: string
  versionId: string
  versionLabel: string
  effectiveFrom: Date | null
  /** Rozhodujúci druh (ADR-017, D116 — zákonná povinnosť má prednosť). */
  legalBasis: LegalBasis | null
  /** Všetky druhy, ktoré znenie má (D115) — pre počty v dlaždiciach. */
  categories: LegalBasis[]
  /** Názov položky číselníka, ak je; inak `null`. */
  basisLabel: string | null
  reference: string | null
  responsible: { fullName: string; email: string } | null
  problems: BasisProblem[]
}

/**
 * Výkaz právnych základov — **len platné znenia** (k dnešku). Archívne znenia
 * DPO nekontroluje: nikto ich už nepotvrdzuje, a základ, ktorý mali v čase
 * potvrdenia, nesie každé potvrdenie ako odtlačok.
 *
 * Čistá funkcia; poradie: najprv znenia s problémom, potom podľa názvu.
 */
export function legalBasisReport(
  docs: Pick<DocumentRecord, "documentId" | "title" | "versions">[],
  activePersonIds: Set<string>,
  now: Date = new Date(),
): LegalBasisRow[] {
  const rows: LegalBasisRow[] = []
  for (const d of docs) {
    const r = effectiveVersion(d as DocumentRecord, now)
    if (!r.ok) continue
    const v = r.version as typeof r.version & {
      legalBasis?: LegalBasis | null
      legalBasisKey?: string | null
      legalBasisLabel?: string | null
      legalBasisReference?: string | null
      legalBases?: LegalBasisEntry[] | null
      responsiblePerson?: { personId: string; fullName: string; email: string } | null
    }
    // Každý základ znenia zvlášť (ADR-017): bez kľúča je mimo číselníka,
    // zákonná povinnosť bez odkazu na predpis je nedostatok.
    const bases = basesOf(v)
    const problems: BasisProblem[] = []
    if (bases.length === 0) problems.push("noBasis")
    else {
      if (bases.some(b => !b.key)) problems.push("outsideCodelist")
      if (bases.some(b => b.basis === "legal_obligation" && !b.reference)) problems.push("noReference")
    }
    if (!v.responsiblePerson) problems.push("noResponsible")
    else if (!activePersonIds.has(v.responsiblePerson.personId)) problems.push("inactiveResponsible")

    rows.push({
      documentId: d.documentId,
      title: d.title,
      versionId: v.versionId,
      versionLabel: v.label,
      effectiveFrom: v.effectiveFrom ?? null,
      legalBasis: dominantBasis(bases),
      categories: [...new Set(bases.map(b => b.basis))],
      basisLabel: v.legalBasisLabel ?? null,
      reference: v.legalBasisReference ?? null,
      responsible: v.responsiblePerson
        ? { fullName: v.responsiblePerson.fullName, email: v.responsiblePerson.email }
        : null,
      problems,
    })
  }
  return rows.sort((a, b) =>
    Number(b.problems.length > 0) - Number(a.problems.length > 0) || a.title.localeCompare(b.title, "sk"),
  )
}

/** `2026-Q4` — identita štvrťročného výkazu; druhý e-mail v tom istom kvartáli neodíde. */
export function quarterKey(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`
}

/** Prvý deň kvartálu (1. 1., 1. 4., 1. 7., 1. 10.) — deň, keď cron posiela výkaz. */
export function isQuarterStart(d: Date): boolean {
  return d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0
}

export interface QuarterSummary {
  total: number
  legalObligation: number
  legitimateInterest: number
  withProblems: number
}

export function summarize(rows: LegalBasisRow[]): QuarterSummary {
  return {
    total: rows.length,
    // Predpis s oboma druhmi sa ráta v oboch (ADR-017).
    legalObligation: rows.filter(r => r.categories.includes("legal_obligation")).length,
    legitimateInterest: rows.filter(r => r.categories.includes("legitimate_interest")).length,
    withProblems: rows.filter(r => r.problems.length > 0).length,
  }
}

/* ── Výkaz s hľadaním (DPO-vykaz-hladanie, 1. 10. 2026) ──────────────────
 * Všetko nižšie je čisté: stránka bez skriptu, stav je v adrese (`?q=`,
 * `?state=`, `?basis=`, `?person=`, `?group=`) a filtruje sa na serveri.
 * DPO stále nič nemení — hľadanie a filtre sú len pohľad na ten istý výkaz.
 */

export type DpoStateFilter = "problems" | "ok"
export type DpoBasisFilter = "legalObligation" | "legitimateInterest" | "none"
/** Zoskupenie výkazu. Predvolené je podľa osoby (Q2) — DPO píše ľuďom. */
export type DpoGroup = "person" | "state"

export interface DpoQuery {
  q: string
  state?: DpoStateFilter
  basis?: DpoBasisFilter
  /** E-mail zodpovednej osoby, malými písmenami. */
  person?: string
  group: DpoGroup
}

const STATE_VALUES: readonly DpoStateFilter[] = ["problems", "ok"]
const BASIS_VALUES: readonly DpoBasisFilter[] = ["legalObligation", "legitimateInterest", "none"]

/** Adresa → dopyt. Neznáme hodnoty sa ticho ignorujú — adresa je vstup zvonka. */
export function parseDpoQuery(raw: Partial<Record<"q" | "state" | "basis" | "person" | "group", string>>): DpoQuery {
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
    allowed.includes(v as T) ? (v as T) : undefined
  const person = raw.person?.trim().toLowerCase()
  return {
    q: (raw.q ?? "").trim().slice(0, 200),
    state: pick(raw.state, STATE_VALUES),
    basis: pick(raw.basis, BASIS_VALUES),
    person: person && person.includes("@") ? person : undefined,
    group: raw.group === "state" ? "state" : "person",
  }
}

/** Bez diakritiky a veľkosti písmen — „prestup" nájde „Prestupový". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function terms(q: string): string[] {
  return fold(q).split(/\s+/).filter(Boolean)
}

/**
 * Hľadanie v názve, názve základu, odkaze na predpis a mene zodpovednej
 * osoby. Každé slovo dopytu musí niekde byť (A **a** B, nie alebo).
 */
export function searchLegalBasisRows(rows: LegalBasisRow[], q: string): LegalBasisRow[] {
  const ts = terms(q)
  if (ts.length === 0) return rows
  return rows.filter(r => {
    const hay = fold([r.title, r.basisLabel ?? "", r.reference ?? "", r.responsible?.fullName ?? ""].join(" "))
    return ts.every(t => hay.includes(t))
  })
}

const matchState = (r: LegalBasisRow, s?: DpoStateFilter) =>
  !s || (s === "problems" ? r.problems.length > 0 : r.problems.length === 0)
// Predpis s oboma druhmi patrí do oboch (ADR-017), rovnako ako v `summarize()`.
const matchBasis = (r: LegalBasisRow, b?: DpoBasisFilter) =>
  !b
  || (b === "legalObligation" && r.categories.includes("legal_obligation"))
  || (b === "legitimateInterest" && r.categories.includes("legitimate_interest"))
  || (b === "none" && r.categories.length === 0)
const matchPerson = (r: LegalBasisRow, p?: string) =>
  !p || r.responsible?.email.toLowerCase() === p

/** Výkaz po hľadaní a všetkých troch filtroch — to, čo je vidieť v zozname. */
export function filterLegalBasisRows(rows: LegalBasisRow[], query: DpoQuery): LegalBasisRow[] {
  return searchLegalBasisRows(rows, query.q).filter(r =>
    matchState(r, query.state) && matchBasis(r, query.basis) && matchPerson(r, query.person))
}

export interface DpoFacets {
  state: { all: number; problems: number; ok: number }
  basis: { all: number; legalObligation: number; legitimateInterest: number; none: number }
  person: { all: number; people: { email: string; fullName: string; count: number }[] }
}

/**
 * Počty pri filtroch. Rátajú sa z výsledku hľadania a **každá skupina bez
 * vlastného filtra** (ako facety v knižnici): pri zvolenom „S nedostatkom"
 * má „V poriadku" ukázať, koľko by ich bolo po prepnutí, nie nulu.
 * Čísla stavu a základu sú tie isté ako v `summarize()`, teda v e-maile.
 */
export function dpoFacets(rows: LegalBasisRow[], query: DpoQuery): DpoFacets {
  const found = searchLegalBasisRows(rows, query.q)
  const forState = found.filter(r => matchBasis(r, query.basis) && matchPerson(r, query.person))
  const forBasis = found.filter(r => matchState(r, query.state) && matchPerson(r, query.person))
  const forPerson = found.filter(r => matchState(r, query.state) && matchBasis(r, query.basis))
  const s = summarize(forState)
  const b = summarize(forBasis)

  const people = new Map<string, { email: string; fullName: string; count: number }>()
  for (const r of forPerson) {
    if (!r.responsible) continue
    const key = r.responsible.email.toLowerCase()
    const p = people.get(key) ?? { email: key, fullName: r.responsible.fullName, count: 0 }
    p.count++
    people.set(key, p)
  }
  // Zvolená osoba ostáva v zozname aj s nulou — inak by sa filter nedal zrušiť tam, kde bol zapnutý.
  if (query.person && !people.has(query.person)) {
    const r = rows.find(x => x.responsible?.email.toLowerCase() === query.person)
    people.set(query.person, { email: query.person, fullName: r?.responsible?.fullName ?? query.person, count: 0 })
  }

  return {
    state: { all: s.total, problems: s.withProblems, ok: s.total - s.withProblems },
    basis: {
      all: b.total,
      legalObligation: b.legalObligation,
      legitimateInterest: b.legitimateInterest,
      none: forBasis.filter(r => r.categories.length === 0).length,
    },
    person: {
      all: forPerson.length,
      people: [...people.values()].sort((x, y) => y.count - x.count || x.fullName.localeCompare(y.fullName, "sk")),
    },
  }
}

export interface PersonGroup {
  /** `null` = predpisy bez zodpovednej osoby. */
  person: { fullName: string; email: string } | null
  rows: LegalBasisRow[]
  /** Koľko z nich má nedostatok. */
  bad: number
}

/**
 * Zoskupenie podľa zodpovednej osoby: najprv predpisy bez nej (tie DPO
 * nemá komu napísať, takže sú najnaliehavejšie), potom osoby podľa mena.
 * V osobe najprv s nedostatkom, potom podľa názvu.
 */
export function groupByPerson(rows: LegalBasisRow[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>()
  for (const r of rows) {
    const key = r.responsible ? r.responsible.email.toLowerCase() : ""
    const g = map.get(key) ?? { person: r.responsible, rows: [], bad: 0 }
    g.rows.push(r)
    if (r.problems.length > 0) g.bad++
    map.set(key, g)
  }
  for (const g of map.values()) {
    g.rows.sort((a, b) =>
      Number(b.problems.length > 0) - Number(a.problems.length > 0) || a.title.localeCompare(b.title, "sk"))
  }
  return [...map.values()].sort((a, b) =>
    !a.person ? -1 : !b.person ? 1 : a.person.fullName.localeCompare(b.person.fullName, "sk"))
}

/** Do toľkých predpisov ide zoznam do tela e-mailu; nad tým len počet a odkaz (Q4). */
export const MAIL_LIST_MAX = 25

/**
 * `mailto:` pre zodpovednú osobu so zoznamom predpisov s nedostatkom.
 * Nad `MAIL_LIST_MAX` by adresa prerástla to, čo poštové programy prijmú
 * (okolo 2 000 znakov) — vtedy ide len počet a odkaz na jej výkaz.
 */
export function personMailto(
  group: PersonGroup,
  texts: { subject: string; body: (list: string) => string; bodyLink: (n: number, url: string) => string },
  origin: string,
): string | null {
  if (!group.person || group.bad === 0) return null
  const bad = group.rows.filter(r => r.problems.length > 0)
  const body = bad.length <= MAIL_LIST_MAX
    ? texts.body(bad.map(r => `- ${r.title}`).join("\n"))
    : texts.bodyLink(bad.length, `${origin}/dpo?person=${encodeURIComponent(group.person.email)}`)
  return `mailto:${group.person.email}?subject=${encodeURIComponent(texts.subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Odkaz na výkaz so zmenou dopytu. Nastavené hodnoty sa nesú ďalej,
 * `undefined` hodnotu zruší; predvolené zoskupenie sa do adresy nepíše.
 */
export function dpoHref(query: DpoQuery, patch: Partial<DpoQuery> = {}): string {
  const next = { ...query, ...patch }
  const p = new URLSearchParams()
  if (next.q) p.set("q", next.q)
  if (next.state) p.set("state", next.state)
  if (next.basis) p.set("basis", next.basis)
  if (next.person) p.set("person", next.person)
  if (next.group === "state") p.set("group", "state")
  const s = p.toString()
  return s ? `/dpo?${s}` : "/dpo"
}

export interface Segment { text: string; hit: boolean }

/**
 * Názov rozdelený na kúsky so zhodou a bez nej — pre `<mark>`. Text ostáva
 * text (React ho escapuje), takže `<mark>` sa nikdy neskladá z reťazca.
 * Skladá sa po znakoch, aby pozície v zloženom texte sedeli s pôvodným.
 */
export function highlight(text: string, q: string): Segment[] {
  const ts = terms(q)
  if (ts.length === 0 || !text) return [{ text, hit: false }]
  const chars = Array.from(text)
  let folded = ""
  const origin: number[] = []
  chars.forEach((c, i) => {
    const f = fold(c)
    folded += f
    for (let k = 0; k < f.length; k++) origin.push(i)
  })
  const marked = new Array<boolean>(chars.length).fill(false)
  for (const t of ts) {
    let at = folded.indexOf(t)
    while (at > -1) {
      for (let k = at; k < at + t.length; k++) marked[origin[k]] = true
      at = folded.indexOf(t, at + t.length)
    }
  }
  const out: Segment[] = []
  chars.forEach((c, i) => {
    const last = out[out.length - 1]
    if (last && last.hit === marked[i]) last.text += c
    else out.push({ text: c, hit: marked[i] })
  })
  return out
}
