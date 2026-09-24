/**
 * Údaje o znení — autor, schválil, dátum schválenia, dátum účinnosti
 * (ADR-013, D106–D108).
 *
 * Čisté funkcie bez databázy: tvar, kontrola, odtlačok do identity konceptu
 * a čítanie návrhu z tabuľky na prvej strane prevedeného `.docx`.
 */

import { draftIdentity } from "./chunkIdentity"

export interface VersionMeta {
  /** Osoba, útvar alebo komisia, ktorá dokument pripravila. */
  author: string | null
  /** Osoba alebo orgán, ktorý dokument schválil — napr. „Výkonný výbor SFZ". */
  approvedBy: string | null
  /** Dátum schválenia orgánom (nie dátum kola v Contineu). */
  approvedOn: Date | null
  /** Dátum účinnosti — to isté ako `Version.effectiveFrom` (D6, D106). */
  effectiveFrom: Date | null
}

export const EMPTY_META: VersionMeta = { author: null, approvedBy: null, approvedOn: null, effectiveFrom: null }

/** Najdlhší text v poli — názov orgánu, nie odsek. */
export const META_TEXT_MAX = 200

const day = (d: Date | null | undefined) =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null

/** Orezaný text; prázdny je `null`. */
function text(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : ""
  return s ? s.slice(0, META_TEXT_MAX) : null
}

/** Údaje z databázy alebo formulára do jedného tvaru. */
export function normalizeMeta(raw: Partial<Record<keyof VersionMeta, unknown>> | null | undefined): VersionMeta {
  const date = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null)
  return {
    author: text(raw?.author),
    approvedBy: text(raw?.approvedBy),
    approvedOn: date(raw?.approvedOn),
    effectiveFrom: date(raw?.effectiveFrom),
  }
}

export function isEmptyMeta(m: VersionMeta): boolean {
  return !m.author && !m.approvedBy && !m.approvedOn && !m.effectiveFrom
}

/**
 * Tvar, ktorý vstupuje do identity konceptu (D107). Dátumy ako deň — čas
 * dňa z formulára nesmie zmeniť odtlačok.
 */
export function metaCanonical(m: VersionMeta): string {
  return JSON.stringify([m.author ?? "", m.approvedBy ?? "", day(m.approvedOn) ?? "", day(m.effectiveFrom) ?? ""])
}

/**
 * Identita konceptu z dokumentu — PDF, text a údaje o znení (ADR-011 D96,
 * ADR-013 D107). **Jediné miesto**, kde sa skladá: stránka, predloženie,
 * zverejnenie aj prístup k PDF musia počítať to isté.
 */
export function documentDraftIdentity(doc: {
  draftMarkdown?: unknown
  draftPdf?: { sha256?: string | null } | null
  draftMeta?: Partial<Record<keyof VersionMeta, unknown>> | null
}): string {
  return draftIdentity(
    String(doc.draftMarkdown ?? ""),
    doc.draftPdf?.sha256 ?? null,
    doc.draftMeta ? metaCanonical(normalizeMeta(doc.draftMeta)) : null,
  )
}

/**
 * Smú sa údaje o znení meniť? (D106)
 *
 * Nie počas kola a nie po schválení **s údajmi**. Koncept schválený ešte
 * bez nich (pred ADR-013) ich doplniť smie — schválenie tým prestane platiť,
 * lebo schválené bolo niečo bez nich (D107).
 */
export function metaLocked(state: string, hasMeta: boolean): boolean {
  return state === "in-review" || (state === "approved" && hasMeta)
}

/** Problém s údajmi pred predložením na schválenie; `null` = v poriadku. */
export type MetaProblem = "meta.effectiveFromRequired"

export function metaProblem(m: VersionMeta | null): MetaProblem | null {
  return m?.effectiveFrom ? null : "meta.effectiveFromRequired"
}

/**
 * Dátum v slovenskom zápise — `07.09.2026`, `7. 9. 2026`, `2026-09-07`.
 * Neplatný deň (31. 2.) je `null`, nie posunutý dátum.
 */
export function parseDate(raw: string): Date | null {
  const s = raw.trim()
  let y: number, m: number, d: number
  const sk = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(s)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (sk) [d, m, y] = [Number(sk[1]), Number(sk[2]), Number(sk[3])]
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null
}

/**
 * Návrh údajov z **tabuľky na prvej strane** prevedeného dokumentu (D108).
 *
 * Predpisy SFZ ju majú v tvare kľúč | hodnota („Schválil | VV SFZ"). Číta sa
 * len z tabuliek pred prvým nadpisom — článok ďalej v texte, ktorý náhodou
 * obsahuje slovo „Schválil", nie je údaj o znení.
 *
 * Výsledok je **návrh**: formulár ním predvyplní prázdne polia a uloží sa až
 * vtedy, keď ho správca potvrdí.
 */
export function suggestMetaFromMarkdown(markdown: string): VersionMeta {
  const head = markdown.split(/\n#{1,6} /)[0] ?? ""
  const out: VersionMeta = { ...EMPTY_META }
  for (const line of head.split("\n")) {
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.replace(/\*\*/g, "").trim())
    if (cells.length < 2 || !line.trim().startsWith("|")) continue
    const key = cells[0].toLowerCase().replace(/\s+/g, " ").replace(/:$/, "")
    const value = cells[1]
    if (!value) continue
    if (!out.approvedOn && /^dátum schválenia|^schválené dňa/.test(key)) out.approvedOn = parseDate(value)
    else if (!out.effectiveFrom && /^dátum účinnosti|^účinnosť|^účinný od|^platnosť od|^platné od/.test(key)) out.effectiveFrom = parseDate(value)
    else if (!out.approvedBy && /^schválil|^schvaľuje|^schválené/.test(key)) out.approvedBy = text(value)
    else if (!out.author && /^autor|^vypracoval|^spracoval|^predkladá|^predkladateľ|^orgán|^gestor/.test(key)) out.author = text(value)
  }
  return out
}
