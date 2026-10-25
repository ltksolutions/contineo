/**
 * law.ts — Legislatíva cez MCP server (ADR-038, ADR-039 D259).
 *
 * Katalóg legislatívy je zdieľaný obsah platformy (menovitá výnimka z D90),
 * ale **organizácia cez MCP vidí len predpisy, ktoré odoberá** — rovnako ako
 * zdroj „Legislatíva" na Opýtať sa. Celý katalóg platformy je správa
 * platformy, nie obsah organizácie. Rezidencia, ktorá katalóg nedovoľuje
 * (D257), ho nedovoľuje ani tu.
 *
 * Text je znenie zo Slov-Lexu účinné k danému dňu. Predpis, ktorý má
 * organizácia v knižnici (D260), sa ohlási aj s dokumentom knižnice — ten je
 * schválený a má prednosť pri odpovedi.
 */

import { lawSourceState, listActs, versionsOf, catalogVersion, effectiveVersions, citationUrl, refOfActId, type LawActVersion } from "../lawCatalog"
import { lawDocumentsFor } from "../lawLibraryLink"
import { AppError } from "../appError"

export interface LawActSummary {
  actId: string
  title: string
  kind: string
  number: string
  /** Znenie účinné dnes. */
  current: { timepoint: string; effectiveFrom: string; amendment: string | null } | null
  versionCount: number
  /** Znenia vyhlásené na neskôr. */
  laterCount: number
  /** Dokument knižnice s týmto predpisom (D260), keď ho organizácia má. */
  libraryDocumentId: string | null
  portalUrl: string | null
}

type VersionHead = Omit<LawActVersion, "markdown">

function day(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null
}

/**
 * Ktoré znenie: konkrétna časová verzia, inak účinné k dňu. Čistá funkcia —
 * testuje sa bez databázy. `null`, keď k dňu nič neplatí.
 */
export function pickLawVersion<T extends Pick<VersionHead, "actId" | "timepoint" | "effectiveFrom" | "effectiveTo">>(versions: T[], asOf: Date, timepoint?: string): T | null {
  if (timepoint) return versions.find(v => v.timepoint === timepoint) ?? null
  return effectiveVersions(versions, asOf)[0] ?? null
}

/** Odoberané predpisy organizácie; prázdne, keď zdroj nie je dovolený. */
export async function lawActsFor(companyCode: string, now: Date = new Date()): Promise<{ allowed: boolean; acts: LawActSummary[] }> {
  const state = await lawSourceState(companyCode)
  if (!state.allowed || !state.actIds.length) return { allowed: state.allowed, acts: [] }
  const [acts, inLibrary] = await Promise.all([listActs(now, state.actIds), lawDocumentsFor(companyCode, state.actIds, now)])
  return {
    allowed: true,
    acts: acts.map(a => {
      const ref = refOfActId(a.actId)
      return {
        actId: a.actId, title: a.title, kind: a.kind, number: `${a.number}/${a.year}`,
        current: a.current ? { timepoint: a.current.timepoint, effectiveFrom: day(a.current.effectiveFrom)!, amendment: a.current.amendment } : null,
        versionCount: a.versionCount, laterCount: a.laterCount,
        libraryDocumentId: inLibrary.get(a.actId)?.documentId ?? null,
        portalUrl: a.current ? citationUrl(ref, a.current.timepoint, null) : null,
      }
    }),
  }
}

export interface LawActText {
  actId: string
  title: string
  version: { timepoint: string; effectiveFrom: string; effectiveTo: string | null; amendment: string | null; portalUrl: string; pdfUrl: string }
  versions: { timepoint: string; effectiveFrom: string; effectiveTo: string | null; amendment: string | null }[]
  markdown: string
  libraryDocumentId: string | null
}

/**
 * Text predpisu, ktorý organizácia odoberá. Neodoberaný predpis sa hlási
 * rovnako ako neexistujúci — z MCP sa nemá dať zistiť, čo odoberajú iní.
 */
export async function lawActText(companyCode: string, actId: string, asOf: Date, timepoint?: string): Promise<LawActText | null> {
  const state = await lawSourceState(companyCode)
  if (!state.allowed) throw new AppError("mcp.lawBlocked", "Legislation is not available in this organisation's data residency mode.")
  if (!state.actIds.includes(actId)) return null
  const versions = await versionsOf(actId)
  const head = pickLawVersion(versions, asOf, timepoint)
  if (!head) return null
  const [full, inLibrary] = await Promise.all([catalogVersion(actId, head.timepoint), lawDocumentsFor(companyCode, [actId], asOf)])
  if (!full) return null
  return {
    actId, title: full.title,
    version: {
      timepoint: full.timepoint, effectiveFrom: day(full.effectiveFrom)!, effectiveTo: day(full.effectiveTo),
      amendment: full.amendment, portalUrl: full.portalUrl, pdfUrl: full.pdfUrl,
    },
    versions: versions.map(v => ({ timepoint: v.timepoint, effectiveFrom: day(v.effectiveFrom)!, effectiveTo: day(v.effectiveTo), amendment: v.amendment })),
    markdown: full.markdown,
    libraryDocumentId: inLibrary.get(actId)?.documentId ?? null,
  }
}

/** Markdown s hlavičkou — pre nástroj aj pre zdroj `contineo://law/…`. */
export function lawActMarkdown(t: LawActText): string {
  const v = t.version
  return `# ${t.title}\n\nZnenie účinné od ${v.effectiveFrom}${v.effectiveTo ? ` do ${v.effectiveTo}` : ""}${v.amendment ? ` (novela ${v.amendment})` : ""} · Slov-Lex\n${v.portalUrl}\n\n${t.markdown}`
}
