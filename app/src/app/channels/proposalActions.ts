"use server"

/**
 * Akcie fronty kurátora (ADR-030, D185). Brána je správca obsahu
 * (`libraryContext()`), organizácia ide z prihlásenia, nie z formulára.
 * Pôvod návrhu sa maže pri každom rozhodnutí (`faqProposals.ts`).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { libraryContext } from "@/lib/library"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"
import { approveProposal, rejectProposal, mergeProposal, updateProposal, applyReview, dismissReview, resolveSources, type ProposalSource } from "@/lib/faqProposals"
import { startProposalReview } from "@/lib/complianceCheck"
import { kick, originFromHeaders } from "@/lib/backgroundKick"
import { after } from "next/server"
import { headers } from "next/headers"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

async function ready() {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, t: dictionary(ctx.person.language).channels, language: ctx.person.language }
}

/**
 * Späť na frontu s rovnakou témou, pohľadom a výsledkom kontroly, z ktorej
 * kurátor prišiel (`back` vo formulári). `stay` nechá otvorený ten istý
 * návrh (uloženie, prevzatie kontroly, chyba); po rozhodnutí sa otvorí
 * ďalší nerozhodnutý — pole `next` = `téma:id` (KANALY-navrhy-faq-kuracia).
 */
function back(key: string, message: string, error = false, fd?: FormData, stay = false): never {
  revalidatePath(`/channels/${encodeURIComponent(key)}/proposals`)
  const q = new URLSearchParams(fd ? fieldText(fd, "back") : "")
  for (const k of [...q.keys()]) if (!["view", "topic", "review"].includes(k)) q.delete(k)
  let anchor = ""
  if (fd && (stay || error)) {
    const id = fieldText(fd, "id")
    if (id) { q.set("p", id); anchor = id }
    if (error && fieldText(fd, "act") === "check") anchor = "check"
    // Chyba v zamietnutí / zlúčení nechá otvorený ten istý formulár.
    const act = fieldText(fd, "act")
    if (error && act) q.set(act === "check" ? "check" : "act", act === "check" ? "1" : act)
  } else if (fd) {
    const [topic, id] = fieldText(fd, "next").split(":")
    if (topic && id) { q.set("topic", topic); q.set("p", id); q.delete("review"); anchor = id }
  }
  q.set("msg", message)
  if (error) q.set("error", "1")
  redirect(`/channels/${encodeURIComponent(key)}/proposals?${q.toString()}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`)
}

/**
 * Pole záznamu z karty: varianty sú zaškrtnuté riadky (odškrtnutý sa
 * zmaže) a nové po riadkoch; zdroje dokument + článok s krížikom.
 */
async function entryFields(fd: FormData, companyCode: string) {
  const kept = fd.getAll("variants").map(v => String(v).trim())
  const added = fieldText(fd, "variantsNew").split(/\r?\n/).map(v => v.trim())
  const docs = fd.getAll("sourceDoc").map(v => String(v).trim())
  const refs = fd.getAll("sourceRef").map(v => String(v).trim())
  const removed = new Set(fd.getAll("sourceRemove").map(v => String(v)))
  const sources: ProposalSource[] | undefined = fd.has("sourcesShown")
    ? await resolveSources(companyCode, docs.map((documentId, i) => ({ documentId, articleRef: refs[i] || null })).filter((s, i) => s.documentId && !removed.has(String(i))))
    : undefined
  return {
    question: fieldText(fd, "question"),
    variants: [...kept, ...added].filter(Boolean),
    answer: fieldText(fd, "answer"),
    audience: fieldText(fd, "audience").split(","),
    ...(sources ? { sources } : {}),
  }
}

function failure(e: unknown, language: string): string {
  if (!(e instanceof AppError)) console.error("[navrhy-faq] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function approveProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await approveProposal(ctx.person.companyCode, key, fieldText(fd, "id"), { documentId: fieldText(fd, "documentId"), ...(await entryFields(fd, ctx.person.companyCode)) }, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  revalidatePath("/library")
  back(key, ctx.t.proposalApproved, false, fd)
}

/** Uloženie úpravy bez schválenia — návrh ostáva vo fronte. */
export async function saveProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await updateProposal(ctx.person.companyCode, key, fieldText(fd, "id"), await entryFields(fd, ctx.person.companyCode), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.proposalSaved, false, fd, true)
}

export async function rejectProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await rejectProposal(ctx.person.companyCode, key, fieldText(fd, "id"), ctx.person.email, fieldText(fd, "reason"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.proposalRejected, false, fd)
}

export async function mergeProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await mergeProposal(ctx.person.companyCode, key, fieldText(fd, "id"), fieldText(fd, "into"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.proposalMerged, false, fd)
}

/** Kontrola otvorených návrhov proti vybraným dokumentom (ADR-032, fáza 1); dávky spracúva cron. */
export async function startReviewAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    // Len založiť — veľký výber noriem má viac krokov na dávku a akcia by nestihla
    // časový limit; prvú dávku hneď po odpovedi spustí reťaz na pozadí.
    // Témy ako zaškrtnuté riadky; „Všetky" alebo žiadna vybraná = všetky otvorené návrhy.
    const topics = fd.getAll("topic").map(String).filter(Boolean)
    await startProposalReview(ctx.person.companyCode, key, fd.getAll("documentIds").map(String), topics.includes("*") ? [] : topics, ctx.person.email)
    const origin = originFromHeaders(await headers())
    after(() => kick(origin, "/api/cron/compliance"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.reviewStarted, false, fd)
}

export async function applyReviewAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await applyReview(ctx.person.companyCode, key, fieldText(fd, "id"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.reviewApplied, false, fd, true)
}

export async function dismissReviewAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await dismissReview(ctx.person.companyCode, key, fieldText(fd, "id"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.reviewDismissed, false, fd, true)
}
