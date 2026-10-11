/**
 * faqProposals.ts — fronta kurátora pre návrhy FAQ z histórie schránky
 * (ADR-030, D185).
 *
 * Návrh vzniká v etape `draft` ťažby (`faqHarvest.ts`). Kurátor (správca
 * obsahu) ho schváli — záznam ide do konceptu vybraného FAQ dokumentu
 * a ďalej postupom znenia —, zlúči s iným návrhom alebo zamietne.
 *
 * **Pôvod sa maže pri rozhodnutí** (odpoveď DPO 5, 9. 10. 2026): `origin`
 * s identifikátormi vlákien je len na to, aby si kurátor mohol návrh overiť
 * v schránke. Po rozhodnutí ostane počet vlákien a obdobie.
 *
 * Návrh nie je dôkazný záznam — rozhodnutie sa však nemaže a nemení,
 * len sa zapíše (kto, kedy, čo); audit nesie aj zápis do FAQ.
 */

import { randomBytes } from "node:crypto"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { requireCompanyCode } from "./tenantScope"
import { checkEntry, saveFaqEntry, type FaqEntryInput } from "./faq"
import { writeAudit } from "./audit"
import { DOCUMENTS_COLLECTION } from "./documents"
import type { ProposalReview, ReviewVerdict } from "./complianceCheck"

export class FaqProposalError extends AppError {}

export const PROPOSALS_COLLECTION = "faq_proposals"

export type ProposalStatus = "open" | "approved" | "merged" | "rejected"

export interface ProposalSource {
  documentId: string
  /** Kópia názvu v čase návrhu — kurátor vidí, čo model citoval. */
  title: string
  articleRef: string | null
}

export interface FaqProposal {
  id: string
  companyCode: string
  channelKey: string
  topicKey: string
  topicLabel: string
  question: string
  variants: string[]
  answer: string
  audience: string[]
  sources: ProposalSource[]
  /** Počet vlákien témy v histórii a jej obdobie (YYYY-MM). */
  threads: number
  firstMonth: string | null
  lastMonth: string | null
  flags: { changedOverTime: boolean; normConflict: boolean }
  /** Poznámka modelu pre kurátora: čo sa v čase zmenilo, v čom sa norma rozchádza. */
  note: string
  /** Odkaz do schránky; `null` po rozhodnutí. */
  origin: { threadRefs: string[] } | null
  model: string
  createdAt: Date
  status: ProposalStatus
  decidedAt: Date | null
  decidedBy: string | null
  /** Kam išiel: FAQ dokument a záznam, alebo návrh, do ktorého sa zlúčil. */
  faqDocumentId: string | null
  faqEntryId: string | null
  mergedInto: string | null
  /** Dôvod zamietnutia — pôvod sa maže, dôvod je jediná stopa (KANALY-navrhy-faq-kuracia, Q7). */
  rejectReason?: string | null
  /**
   * Prvé znenie pred akoukoľvek úpravou (revízia podľa manuálov, úprava
   * kurátora). Drží sa, aby kurátor videl, čo navrhol model a čo sa zmenilo;
   * zapisuje sa raz, ďalšie úpravy ho neprepisujú.
   */
  revision?: { at: Date; by: string; previous: ProposalSnapshot } | null
  /** Výsledok poslednej kontroly proti dokumentom (ADR-032 D192); kurátor ho prevezme alebo ponechá pôvodné. */
  review?: ProposalReview | null
  /** Posledná uložená úprava bez schválenia. */
  editedAt?: Date | null
  editedBy?: string | null
}

export type ProposalSnapshot = Pick<FaqProposal, "question" | "variants" | "answer" | "audience" | "sources" | "note">

/** Znenie, s ktorým sa porovnáva: prvé uložené pred úpravami, inak žiadne. */
export function originalOf(p: Pick<FaqProposal, "revision">): ProposalSnapshot | null {
  return p.revision?.previous ?? null
}

/** Značka v poznámke, ktorou revízia označila otázku na rozhodnutie. */
export const DECISION_MARK = "[NA ROZHODNUTIE]"

/**
 * Pohľady fronty (KANALY-navrhy-faq-kuracia, 11. 10. 2026). „Bez zdroja"
 * zaniklo (Q5) — zdroj sa dopĺňa priamo v karte a pri návrhu je štítok.
 */
export type ProposalFilter = "open" | "decision" | "decided" | "all"

export const PROPOSAL_FILTERS: ProposalFilter[] = ["open", "decision", "decided", "all"]

export type NewProposal = Pick<FaqProposal,
  "topicKey" | "topicLabel" | "question" | "variants" | "answer" | "audience" | "sources" |
  "threads" | "firstMonth" | "lastMonth" | "flags" | "note" | "origin" | "model">

async function proposals() {
  return getCollection<FaqProposal>(PROPOSALS_COLLECTION)
}

function newId(): string {
  return `p${randomBytes(6).toString("hex")}`
}

export async function saveProposals(companyCode: string, channelKey: string, list: NewProposal[]): Promise<number> {
  const code = requireCompanyCode(companyCode, "saveProposals")
  if (!list.length) return 0
  const now = new Date()
  await (await proposals()).insertMany(list.map(p => ({
    ...p, id: newId(), companyCode: code, channelKey, createdAt: now, status: "open" as const,
    decidedAt: null, decidedBy: null, faqDocumentId: null, faqEntryId: null, mergedInto: null,
  })))
  return list.length
}

/** Nový beh ťažby zahodí nerozhodnuté návrhy kanála; rozhodnuté ostávajú. */
export async function removeOpenProposals(companyCode: string, channelKey: string): Promise<number> {
  const code = requireCompanyCode(companyCode, "removeOpenProposals")
  const r = await (await proposals()).deleteMany({ companyCode: code, channelKey, status: "open" })
  return r.deletedCount
}

/**
 * Poradie fronty: viac vlákien skôr, pri zhode novšia téma skôr. Rozhodnuté
 * návrhy sa ukazujú len na požiadanie (prepínač pohľadu). `decision` sú
 * otvorené návrhy s poznámkou „[NA ROZHODNUTIE]“, `nosource` otvorené bez
 * navrhnutého zdroja — tie treba pri schválení doplniť alebo overiť.
 */
export async function listProposals(
  companyCode: string, channelKey: string, filter: ProposalFilter | "decided" = "open", topicKey?: string | null,
  reviewVerdict?: ReviewVerdict | null,
): Promise<FaqProposal[]> {
  const code = requireCompanyCode(companyCode, "listProposals")
  const base: Record<string, unknown> = {
    companyCode: code, channelKey, ...(topicKey ? { topicKey } : {}),
    // Výsledok kontroly, o ktorom kurátor ešte nerozhodol (ADR-032).
    ...(reviewVerdict ? { "review.verdict": reviewVerdict, "review.decision": null } : {}),
  }
  const query =
    filter === "decided" ? { ...base, status: { $in: ["approved", "merged", "rejected"] as ProposalStatus[] } }
    : filter === "decision" ? { ...base, status: "open" as const, note: { $regex: DECISION_MARK.replace(/[[\]]/g, "\\$&") } }
    : filter === "all" ? base
    : { ...base, status: "open" as const }
  return (await proposals())
    .find(query, { projection: { _id: 0 } })
    .sort(filter === "decided" ? { decidedAt: -1 } : { threads: -1, lastMonth: -1, question: 1 })
    .limit(500)
    .toArray()
}

/** Počty pre prepínač pohľadu. */
export async function proposalFilterCounts(companyCode: string, channelKey: string, topicKey?: string | null): Promise<Record<ProposalFilter, number>> {
  const code = requireCompanyCode(companyCode, "proposalFilterCounts")
  const col = await proposals()
  const base = { companyCode: code, channelKey, ...(topicKey ? { topicKey } : {}) }
  const [open, decision, decided] = await Promise.all([
    col.countDocuments({ ...base, status: "open" }),
    col.countDocuments({ ...base, status: "open", note: { $regex: DECISION_MARK.replace(/[[\]]/g, "\\$&") } }),
    col.countDocuments({ ...base, status: { $in: ["approved", "merged", "rejected"] } }),
  ])
  return { open, decision, decided, all: open + decided }
}

/**
 * Všetky návrhy kanála naraz (bez pôvodu) — fronta z nich počíta témy,
 * počty, filter a „ďalší nerozhodnutý" (`proposalView.ts`). Kanál ich má
 * desiatky, strop je poistka.
 */
export async function channelProposals(companyCode: string, channelKey: string): Promise<FaqProposal[]> {
  const code = requireCompanyCode(companyCode, "channelProposals")
  return (await proposals())
    .find({ companyCode: code, channelKey }, { projection: { _id: 0, origin: 0 } })
    .sort({ threads: -1, lastMonth: -1, question: 1 })
    .limit(2000)
    .toArray()
}

/**
 * Zdroje z formulára (dokument + článok) s názvom z knižnice — kópia názvu
 * v čase úpravy, ako pri zdrojoch z modelu. Neznámy dokument sa vynechá.
 */
export async function resolveSources(companyCode: string, refs: { documentId: string; articleRef: string | null }[]): Promise<ProposalSource[]> {
  const code = requireCompanyCode(companyCode, "resolveSources")
  const ids = [...new Set(refs.map(r => r.documentId).filter(Boolean))]
  if (!ids.length) return []
  const docs = await (await getCollection<{ documentId: string; title?: string }>(DOCUMENTS_COLLECTION))
    .find({ companyCode: code, documentId: { $in: ids } }, { projection: { _id: 0, documentId: 1, title: 1 } }).toArray()
  const title = new Map(docs.map(d => [d.documentId, String(d.title ?? d.documentId)]))
  const seen = new Set<string>()
  return refs.flatMap(r => {
    const k = `${r.documentId}|${r.articleRef ?? ""}`
    if (!title.has(r.documentId) || seen.has(k)) return []
    seen.add(k)
    return [{ documentId: r.documentId, title: title.get(r.documentId)!, articleRef: r.articleRef?.trim() || null }]
  }).slice(0, 8)
}

/** Témy otvorených návrhov kanála pre filter. */
export async function proposalTopics(companyCode: string, channelKey: string): Promise<{ topicKey: string; topicLabel: string; open: number }[]> {
  const code = requireCompanyCode(companyCode, "proposalTopics")
  const rows = await (await proposals()).aggregate<{ _id: string; label: string; n: number; threads: number }>([
    { $match: { companyCode: code, channelKey, status: "open" } },
    { $group: { _id: "$topicKey", label: { $first: "$topicLabel" }, n: { $sum: 1 }, threads: { $max: "$threads" } } },
    { $sort: { threads: -1 } },
  ]).toArray()
  return rows.map(r => ({ topicKey: r._id, topicLabel: r.label, open: r.n }))
}

export async function proposalCounts(companyCode: string, channelKey: string): Promise<Record<ProposalStatus, number>> {
  const code = requireCompanyCode(companyCode, "proposalCounts")
  const rows = await (await proposals()).aggregate<{ _id: ProposalStatus; n: number }>([
    { $match: { companyCode: code, channelKey } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]).toArray()
  const out: Record<ProposalStatus, number> = { open: 0, approved: 0, merged: 0, rejected: 0 }
  for (const r of rows) out[r._id] = r.n
  return out
}

/** Kanály s otvorenými návrhmi — odkaz pre kurátora z editora FAQ v knižnici. */
export async function openProposalsByChannel(companyCode: string): Promise<{ channelKey: string; open: number }[]> {
  const code = requireCompanyCode(companyCode, "openProposalsByChannel")
  const rows = await (await proposals()).aggregate<{ _id: string; n: number }>([
    { $match: { companyCode: code, status: "open" } },
    { $group: { _id: "$channelKey", n: { $sum: 1 } } },
  ]).toArray()
  return rows.map(r => ({ channelKey: r._id, open: r.n }))
}

export async function proposalById(companyCode: string, channelKey: string, id: string): Promise<FaqProposal | null> {
  const code = requireCompanyCode(companyCode, "proposalById")
  return (await proposals()).findOne({ companyCode: code, channelKey, id }, { projection: { _id: 0 } })
}

async function openProposal(code: string, channelKey: string, id: string): Promise<FaqProposal> {
  const p = await proposalById(code, channelKey, id)
  if (!p) throw new FaqProposalError("proposal.notFound", "Taký návrh tu nie je.")
  if (p.status !== "open") throw new FaqProposalError("proposal.decided", "O návrhu už niekto rozhodol.")
  return p
}

/** Zápis rozhodnutia s podmienkou „ešte otvorený" — dvaja kurátori naraz nerozhodnú dvakrát. */
async function decide(code: string, channelKey: string, id: string, set: Partial<FaqProposal>): Promise<void> {
  const r = await (await proposals()).updateOne(
    { companyCode: code, channelKey, id, status: "open" },
    { $set: { ...set, origin: null, decidedAt: new Date() } },
  )
  if (!r.modifiedCount) throw new FaqProposalError("proposal.decided", "O návrhu už niekto rozhodol.")
}

/**
 * Úprava bez schválenia (10. 10. 2026): kurátor opraví znenie a vráti sa
 * k nemu neskôr. Prvé znenie pred úpravou sa uloží do `revision`, ak tam
 * ešte nie je — porovnanie tak vždy ukazuje návrh modelu.
 */
export async function updateProposal(
  companyCode: string, channelKey: string, id: string,
  input: { question?: string; variants?: string[]; answer?: string; audience?: string[]; sources?: ProposalSource[] },
  actor: string,
  extra: Partial<FaqProposal> = {},
): Promise<void> {
  const code = requireCompanyCode(companyCode, "updateProposal")
  const p = await openProposal(code, channelKey, id)
  const sources = input.sources ?? p.sources
  const entry = checkEntry({
    question: input.question ?? p.question,
    variants: input.variants ?? p.variants,
    answer: input.answer ?? p.answer,
    audience: input.audience ?? p.audience,
    sources: sources.map(s => ({ documentId: s.documentId, articleRef: s.articleRef })),
  })
  const now = new Date()
  const set: Partial<FaqProposal> = {
    question: entry.question, variants: entry.variants, answer: entry.answer, audience: entry.audience,
    sources, editedAt: now, editedBy: actor, ...extra,
  }
  if (!p.revision) {
    set.revision = { at: now, by: actor, previous: { question: p.question, variants: p.variants, answer: p.answer, audience: p.audience, sources: p.sources, note: p.note } }
  }
  const r = await (await proposals()).updateOne({ companyCode: code, channelKey, id, status: "open" }, { $set: set })
  if (!r.modifiedCount) throw new FaqProposalError("proposal.decided", "O návrhu už niekto rozhodol.")
  await writeAudit({ companyCode: code, subject: "document", action: "faq-navrh-upraveny", actor, targetId: id, targetLabel: entry.question })
}

/**
 * Prevzatie výsledku kontroly (ADR-032 D192): navrhnuté znenie a zdroje
 * z citácií nahradia návrh; poznámka kontroly sa pridá k poznámke návrhu.
 * Pôvodné znenie ostáva v `revision` (ak tam ešte nie je, uloží sa teraz).
 */
export async function applyReview(companyCode: string, channelKey: string, id: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "applyReview")
  const p = await openProposal(code, channelKey, id)
  const proposed = p.review?.proposed
  if (!p.review || p.review.decision || !proposed) throw new FaqProposalError("proposal.noReview", "Návrh nemá výsledok kontroly na prevzatie.")
  const note = [p.note, p.review.note ? `Kontrola proti dokumentom (${p.review.at.toISOString().slice(0, 10)}): ${p.review.note}` : ""].filter(Boolean).join("\n\n")
  await updateProposal(code, channelKey, id, {
    question: proposed.question, answer: proposed.answer,
    sources: proposed.sources.length ? proposed.sources : p.sources,
  }, actor, { note, review: { ...p.review, decision: "applied", decidedBy: actor, decidedAt: new Date() } })
}

/** Ponechanie pôvodného znenia — výsledok kontroly sa označí ako odmietnutý a ostane na prečítanie. */
export async function dismissReview(companyCode: string, channelKey: string, id: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "dismissReview")
  const p = await openProposal(code, channelKey, id)
  if (!p.review || p.review.decision) throw new FaqProposalError("proposal.noReview", "Návrh nemá výsledok kontroly na prevzatie.")
  await (await proposals()).updateOne(
    { companyCode: code, channelKey, id, status: "open" },
    { $set: { "review.decision": "dismissed", "review.decidedBy": actor, "review.decidedAt": new Date() } },
  )
  await writeAudit({ companyCode: code, subject: "document", action: "faq-kontrola-odmietnuta", actor, targetId: id, targetLabel: p.question })
}

/**
 * Schválenie: záznam (s úpravami kurátora) ide do konceptu FAQ dokumentu.
 * Zdroje sa preberú z návrhu; `checkEntry` overí, čo kurátor napísal.
 */
export async function approveProposal(
  companyCode: string, channelKey: string, id: string,
  input: { documentId: string; question?: string; variants?: string[]; answer?: string; audience?: string[]; sources?: ProposalSource[] },
  actor: string,
): Promise<string> {
  const code = requireCompanyCode(companyCode, "approveProposal")
  const p = await openProposal(code, channelKey, id)
  // Zdroje upravené v karte (KANALY-navrhy-faq-kuracia), inak tie z návrhu.
  const sources = input.sources ?? p.sources
  const entry: FaqEntryInput = checkEntry({
    question: input.question ?? p.question,
    variants: input.variants ?? p.variants,
    answer: input.answer ?? p.answer,
    audience: input.audience ?? p.audience,
    sources: sources.map(s => ({ documentId: s.documentId, articleRef: s.articleRef })),
  })
  // Pôvod do FAQ nejde — maže sa rozhodnutím (odpoveď DPO 5).
  const saved = await saveFaqEntry(code, input.documentId, { ...entry, id: null }, actor)
  await decide(code, channelKey, id, { status: "approved", decidedBy: actor, faqDocumentId: input.documentId, faqEntryId: saved.id, question: entry.question, answer: entry.answer, sources })
  return saved.id
}

/** Zlúčenie: otázka a varianty návrhu sa pridajú k variantom cieľového (otvoreného) návrhu. */
export async function mergeProposal(companyCode: string, channelKey: string, id: string, intoId: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "mergeProposal")
  if (id === intoId) throw new FaqProposalError("proposal.mergeSelf", "Návrh sa nedá zlúčiť sám so sebou.")
  const p = await openProposal(code, channelKey, id)
  const target = await openProposal(code, channelKey, intoId)
  const variants = [...new Set([...target.variants, p.question, ...p.variants].map(v => v.trim()).filter(v => v && v !== target.question))].slice(0, 20)
  // Odpoveď zlúčeného návrhu sa nesmie stratiť (Ján 10. 10. 2026: „aby
  // nevypadla nejaká dôležitá časť“) — ide do poznámky cieľa, kurátor z nej
  // prevezme, čo v cieľovej odpovedi chýba.
  const carried = `Zo zlúčeného návrhu „${p.question}“: ${p.answer}`
  await (await proposals()).updateOne(
    { companyCode: code, channelKey, id: intoId, status: "open" },
    { $set: {
      variants, threads: target.threads + (target.topicKey === p.topicKey ? 0 : p.threads),
      note: target.note ? `${target.note}\n\n${carried}` : carried,
      sources: [...new Map([...target.sources, ...p.sources].map(x => [`${x.documentId}|${x.articleRef ?? ""}`, x])).values()].slice(0, 8),
    } },
  )
  await decide(code, channelKey, id, { status: "merged", decidedBy: actor, mergedInto: intoId })
  await writeAudit({ companyCode: code, subject: "document", action: "faq-navrh-zluceny", actor, targetId: intoId, targetLabel: target.question, note: p.question })
}

/** Zamietnutie s povinným dôvodom (Q7) — pôvod sa maže, dôvod ostáva v návrhu aj v audite. */
export async function rejectProposal(companyCode: string, channelKey: string, id: string, actor: string, reason: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "rejectProposal")
  const why = reason.replace(/\r\n?/g, "\n").trim().slice(0, 500)
  if (!why) throw new FaqProposalError("proposal.reasonRequired", "Uveďte dôvod zamietnutia.")
  const p = await openProposal(code, channelKey, id)
  await decide(code, channelKey, id, { status: "rejected", decidedBy: actor, rejectReason: why })
  await writeAudit({ companyCode: code, subject: "document", action: "faq-navrh-zamietnuty", actor, targetId: id, targetLabel: p.question, note: why })
}
