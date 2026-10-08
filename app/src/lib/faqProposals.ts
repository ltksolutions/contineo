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
}

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
 * návrhy sa ukazujú len na požiadanie (prepínač pohľadu).
 */
export async function listProposals(companyCode: string, channelKey: string, status: ProposalStatus | "decided" = "open"): Promise<FaqProposal[]> {
  const code = requireCompanyCode(companyCode, "listProposals")
  const filter = status === "decided"
    ? { companyCode: code, channelKey, status: { $in: ["approved", "merged", "rejected"] as ProposalStatus[] } }
    : { companyCode: code, channelKey, status }
  return (await proposals())
    .find(filter, { projection: { _id: 0 } })
    .sort(status === "open" ? { threads: -1, lastMonth: -1, question: 1 } : { decidedAt: -1 })
    .limit(500)
    .toArray()
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
 * Schválenie: záznam (s úpravami kurátora) ide do konceptu FAQ dokumentu.
 * Zdroje sa preberú z návrhu; `checkEntry` overí, čo kurátor napísal.
 */
export async function approveProposal(
  companyCode: string, channelKey: string, id: string,
  input: { documentId: string; question?: string; variants?: string[]; answer?: string; audience?: string[] },
  actor: string,
): Promise<string> {
  const code = requireCompanyCode(companyCode, "approveProposal")
  const p = await openProposal(code, channelKey, id)
  const entry: FaqEntryInput = checkEntry({
    question: input.question ?? p.question,
    variants: input.variants ?? p.variants,
    answer: input.answer ?? p.answer,
    audience: input.audience ?? p.audience,
    sources: p.sources.map(s => ({ documentId: s.documentId, articleRef: s.articleRef })),
  })
  // Pôvod do FAQ nejde — maže sa rozhodnutím (odpoveď DPO 5).
  const saved = await saveFaqEntry(code, input.documentId, { ...entry, id: null }, actor)
  await decide(code, channelKey, id, { status: "approved", decidedBy: actor, faqDocumentId: input.documentId, faqEntryId: saved.id, question: entry.question, answer: entry.answer })
  return saved.id
}

/** Zlúčenie: otázka a varianty návrhu sa pridajú k variantom cieľového (otvoreného) návrhu. */
export async function mergeProposal(companyCode: string, channelKey: string, id: string, intoId: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "mergeProposal")
  if (id === intoId) throw new FaqProposalError("proposal.mergeSelf", "Návrh sa nedá zlúčiť sám so sebou.")
  const p = await openProposal(code, channelKey, id)
  const target = await openProposal(code, channelKey, intoId)
  const variants = [...new Set([...target.variants, p.question, ...p.variants].map(v => v.trim()).filter(v => v && v !== target.question))].slice(0, 20)
  await (await proposals()).updateOne(
    { companyCode: code, channelKey, id: intoId, status: "open" },
    { $set: { variants, threads: target.threads + (target.topicKey === p.topicKey ? 0 : p.threads) } },
  )
  await decide(code, channelKey, id, { status: "merged", decidedBy: actor, mergedInto: intoId })
  await writeAudit({ companyCode: code, subject: "document", action: "faq-navrh-zluceny", actor, targetId: intoId, targetLabel: target.question, note: p.question })
}

export async function rejectProposal(companyCode: string, channelKey: string, id: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "rejectProposal")
  const p = await openProposal(code, channelKey, id)
  await decide(code, channelKey, id, { status: "rejected", decidedBy: actor })
  await writeAudit({ companyCode: code, subject: "document", action: "faq-navrh-zamietnuty", actor, targetId: id, targetLabel: p.question })
}
