/**
 * Retencia reťaze dôkazov (ADR-012) — **pravidlá bez databázy**.
 *
 * Kedy sa doklady osoby mažú (D100):
 *
 * | osoba                                   | lehota                                  |
 * |-----------------------------------------|-----------------------------------------|
 * | vyradená, skončenie vzťahu známe        | 3 roky od `endedAt`                     |
 * | vyradená, skončenie chýba               | 3 roky od `deactivatedAt` (poistka 1)   |
 * | vyradená, bez oboch dátumov             | 5 rokov od poslednej udalosti (strop)   |
 * | aktívna alebo pozvaná                   | **nič sa nemaže**                       |
 *
 * Strop sa na aktívne osoby nevzťahuje (Ján, 2026-09-24): aktívnemu človeku by
 * zmiznuté doklady znamenali, že mu predpisy naskočia ako nepotvrdené. Aktívne
 * osoby bez udalosti 5 rokov sa len **ukážu HR** (`isStaleActive`).
 *
 * Čisté funkcie — jediné miesto s netriviálnym pravidlom a jediné, ktoré sa
 * dá otestovať bez clustera (rovnaký prístup ako `effectiveVersion()`).
 */

import type { PersonStatus } from "./persons"

/** O16/B1a — roky od skončenia pomeru alebo vzťahu so zväzom. */
export const RETENTION_YEARS = 3
/** O16/B10a — strop pre vyradené osoby bez dátumu, od poslednej udalosti. */
export const CAP_YEARS = 5
/** Aktívna osoba bez udalosti tak dlho sa ukáže HR na kontrolu (D100). */
export const STALE_ACTIVE_YEARS = 5
/** `retention_log` — dlhšie než najdlhšia plánovaná retencia záloh (D102). */
export const RETENTION_LOG_DAYS = 395

/** Režim dávky (D102). Predvolený je výkaz — mazanie sa zapína vedome. */
export type RetentionMode = "report" | "delete"

export function retentionMode(value: string | undefined): RetentionMode {
  return value?.trim().toLowerCase() === "delete" ? "delete" : "report"
}

export type RetentionBasis = "endedAt" | "deactivatedAt" | "cap"

export interface RetentionInput {
  status: PersonStatus
  endedAt?: Date | null
  deactivatedAt?: Date | null
  /** Posledná udalosť v reťazi: potvrdenie, otvorenie alebo pridelenie osobe. */
  lastEventAt?: Date | null
}

export interface RetentionDecision {
  /** Lehota uplynula — doklady sa majú zmazať. */
  due: boolean
  /** Odkiaľ lehota plynie. `null` pri aktívnej osobe alebo bez akejkoľvek udalosti. */
  basis: RetentionBasis | null
  /** Kedy lehota uplynie (alebo uplynula). */
  dueAt: Date | null
}

/** Pripočíta roky v UTC; 29. február padne na 28. február. */
export function addYears(d: Date, years: number): Date {
  const r = new Date(d.getTime())
  r.setUTCFullYear(r.getUTCFullYear() + years)
  if (r.getUTCMonth() !== d.getUTCMonth()) r.setUTCDate(0)
  return r
}

export function retentionDecision(p: RetentionInput, now: Date): RetentionDecision {
  if (p.status !== "inactive") return { due: false, basis: null, dueAt: null }

  const pick = (): { basis: RetentionBasis; dueAt: Date } | null => {
    if (p.endedAt) return { basis: "endedAt", dueAt: addYears(p.endedAt, RETENTION_YEARS) }
    if (p.deactivatedAt) return { basis: "deactivatedAt", dueAt: addYears(p.deactivatedAt, RETENTION_YEARS) }
    if (p.lastEventAt) return { basis: "cap", dueAt: addYears(p.lastEventAt, CAP_YEARS) }
    return null
  }
  const r = pick()
  if (!r) return { due: false, basis: null, dueAt: null }
  return { due: r.dueAt.getTime() <= now.getTime(), basis: r.basis, dueAt: r.dueAt }
}

/** Aktívna osoba, ktorá 5 rokov nič nepotvrdila, neotvorila ani nedostala. */
export function isStaleActive(p: RetentionInput, now: Date): boolean {
  if (p.status === "inactive" || !p.lastEventAt) return false
  return addYears(p.lastEventAt, STALE_ACTIVE_YEARS).getTime() <= now.getTime()
}
