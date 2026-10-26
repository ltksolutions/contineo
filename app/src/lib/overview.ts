/**
 * overview.ts — zoznam dokumentov pre čitateľa (Prehľad a Knižnica na čítanie,
 * ADR-041 D270).
 *
 * **Nič sa tu nepočíta druhýkrát.** Povinnosti idú z `pendingForPerson()`,
 * kolá schvaľovania z `roundsWaitingFor()`, dokumenty z `readableDocuments()`
 * a predpisy zo `subscribedActs()` — z tých istých funkcií, ktoré kreslia
 * obrazovky, na ktoré Prehľad odkazuje. Panel, ktorý si svoje položky počíta
 * po svojom, sa raz rozíde s obrazovkou, na ktorú odkazuje.
 *
 * Okná „nové" a „expiruje" sú z `publishedAt` a `effectiveTo` na **znení**,
 * nie z `updatedAt` na dokumente: `updatedAt` sa mení aj pri oprave preklepu
 * v označení a „nové" by potom znamenalo „niekto sa toho dotkol". Dlaždice
 * KPI a panel Novinky, ktoré tieto okná kreslili, zanikli 26. 10. 2026
 * (D271); okná ostali ako chipy pri riadku.
 */

import { dueState } from "./due"
import { matchesQuery } from "./askHistoryMatch"

export const NEW_DAYS = 7
export const EXPIRING_DAYS = 30

/**
 * Jeden riadok zoznamu dokumentov pre čitateľa (ADR-041, D270): dokument
 * knižnice alebo odoberaný predpis z katalógu, bez ohľadu na to, odkiaľ
 * prišiel. Jediné členenie je druh (`category`); predpis má pevne `zakon`.
 */
export interface ReaderDocumentRow {
  key: string
  kind: "document" | "law"
  title: string
  /** Kľúč číselníka `category`; `null` pri dokumente bez druhu. */
  category: string | null
  effectiveFrom: Date
  /**
   * Nové pre čitateľa: zverejnené po `newSince` (jeho predchádzajúce
   * prihlásenie, PREHLAD-ulohy-a-dokumenty Q3), inak za posledných `NEW_DAYS` dní.
   */
  isNew: boolean
  /** Platnosť znenia končí do `EXPIRING_DAYS` dní. */
  expiring: boolean
  href: string
  askHref: string
}

/** Druh predpisu z katalógu v číselníku `category` (ADR-034: Zákon je druh). */
export const LAW_CATEGORY = "zakon"

/**
 * Zlúči platné dokumenty knižnice a odoberané predpisy do jedného zoznamu,
 * najnovšie znenie prvé. Čistá funkcia — Prehľad a Knižnica na čítanie
 * z nej kreslia to isté, len inak zoradené a orezané.
 *
 * `newSince`: od kedy je dokument „nový". `null` = nikdy (človek tu ešte
 * nebol — zvýrazniť mu pri prvom vstupe všetko je šum, rovnako ako `isNewFor()`
 * pri úlohách); bez parametra okno `NEW_DAYS` dní.
 */
export function mergeReaderDocuments(
  docs: { documentId: string; title: string; category: string | null; versionLabel: string; effectiveFrom: Date; effectiveTo: Date | null; publishedAt: Date | null }[],
  acts: { actId: string; title: string; current: { effectiveFrom: Date } | null }[],
  asOf = new Date(),
  newSinceDate?: Date | null,
): ReaderDocumentRow[] {
  const newSince = newSinceDate === undefined
    ? asOf.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000
    : newSinceDate === null ? Infinity : newSinceDate.getTime() + 1
  const expiringUntil = asOf.getTime() + EXPIRING_DAYS * 24 * 60 * 60 * 1000
  const rows: ReaderDocumentRow[] = docs.map(d => ({
    key: `doc:${d.documentId}`,
    kind: "document",
    title: d.title,
    category: d.category,
    effectiveFrom: d.effectiveFrom,
    isNew: Boolean(d.publishedAt && d.publishedAt.getTime() >= newSince && d.publishedAt.getTime() <= asOf.getTime()),
    expiring: Boolean(d.effectiveTo && d.effectiveTo.getTime() > asOf.getTime() && d.effectiveTo.getTime() <= expiringUntil),
    href: `/documents/${encodeURIComponent(d.documentId)}`,
    askHref: `/ask?${new URLSearchParams({ src: "library", doc: d.documentId }).toString()}`,
  }))
  for (const a of acts) {
    // Predpis bez znenia účinného dnes (len vyhlásené na neskôr) sa čitateľovi neponúka — nemal by čo čítať.
    if (!a.current) continue
    rows.push({
      key: `law:${a.actId}`,
      kind: "law",
      title: a.title,
      category: LAW_CATEGORY,
      effectiveFrom: a.current.effectiveFrom,
      isNew: false,
      expiring: false,
      href: `/documents/law/${a.actId}`,
      askHref: `/ask?${new URLSearchParams({ src: "slov-lex" }).toString()}`,
    })
  }
  return rows.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || a.title.localeCompare(b.title, "sk"))
}

/** Skupina úlohy na Prehľade podľa termínu (PREHLAD-ulohy-a-dokumenty). */
export type TaskGroup = "over" | "soon" | "rest"

/**
 * Úlohy v skupinách podľa naliehavosti: po termíne, blíži sa termín,
 * ostatné. V skupine skorší termín prvý, bez termínu na konci; inak ostáva
 * poradie zdroja. Prázdne skupiny sa nevracajú.
 */
export function groupTasks<T extends { due: Date | null }>(items: T[], now: Date): { group: TaskGroup; items: T[] }[] {
  const groupOf = (due: Date | null): TaskGroup => {
    const state = dueState(due, now)
    return state === "over" ? "over" : state === "soon" ? "soon" : "rest"
  }
  const order: TaskGroup[] = ["over", "soon", "rest"]
  return order
    .map(group => ({
      group,
      items: items
        .map((item, i) => ({ item, i }))
        .filter(x => groupOf(x.item.due) === group)
        .sort((a, b) => (a.item.due?.getTime() ?? Infinity) - (b.item.due?.getTime() ?? Infinity) || a.i - b.i)
        .map(x => x.item),
    }))
    .filter(g => g.items.length > 0)
}

/**
 * Hľadanie s rozsahmi (SwiftUI `.searchable` + `.searchScopes`): text hľadá
 * v názve, druh zúži výsledok. Počty pri druhoch sú **po hľadaní** — hovoria,
 * koľko z nájdeného je v ktorom druhu. Druh bez výsledku sa neukazuje, okrem
 * zvoleného: ten ostáva s nulou, aby človek videl, prečo nič nevidí.
 */
export function findReaderDocuments(rows: ReaderDocumentRow[], find: string, kind: string) {
  const q = find.trim()
  const matched = q ? rows.filter(r => matchesQuery(r.title, q)) : rows
  const known = new Set(rows.map(r => r.category).filter((k): k is string => Boolean(k)))
  const activeKind = kind && known.has(kind) ? kind : ""
  const counts = new Map<string, number>()
  for (const r of matched) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
  if (activeKind && !counts.has(activeKind)) counts.set(activeKind, 0)
  const kinds = [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  const shown = activeKind ? matched.filter(r => r.category === activeKind) : matched
  return { query: q, kinds, activeKind, matchedTotal: matched.length, shown }
}
