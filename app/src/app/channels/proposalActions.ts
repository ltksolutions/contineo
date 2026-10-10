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
import { approveProposal, rejectProposal, mergeProposal, updateProposal, applyReview, dismissReview } from "@/lib/faqProposals"
import { startProposalReview } from "@/lib/complianceCheck"

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
 * Späť na frontu s rovnakým filtrom, témou a stranou, z ktorej kurátor prišiel
 * (`back` vo formulári) — inak by po každom úkone skončil na začiatku zoznamu.
 */
function back(key: string, message: string, error = false, fd?: FormData): never {
  revalidatePath(`/channels/${encodeURIComponent(key)}/proposals`)
  const q = new URLSearchParams(fd ? fieldText(fd, "back") : "")
  for (const k of [...q.keys()]) if (!["view", "topic", "page", "review"].includes(k)) q.delete(k)
  q.set("msg", message)
  if (error) q.set("error", "1")
  const anchor = fd && !error ? fieldText(fd, "anchor") : ""
  redirect(`/channels/${encodeURIComponent(key)}/proposals?${q.toString()}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`)
}

function entryFields(fd: FormData) {
  return {
    question: fieldText(fd, "question"),
    variants: fieldText(fd, "variants").split(/\r?\n/),
    answer: fieldText(fd, "answer"),
    audience: fieldText(fd, "audience").split(","),
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
    await approveProposal(ctx.person.companyCode, key, fieldText(fd, "id"), { documentId: fieldText(fd, "documentId"), ...entryFields(fd) }, ctx.person.email)
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
    await updateProposal(ctx.person.companyCode, key, fieldText(fd, "id"), entryFields(fd), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true, fd)
  }
  back(key, ctx.t.proposalSaved, false, fd)
}

export async function rejectProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await rejectProposal(ctx.person.companyCode, key, fieldText(fd, "id"), ctx.person.email)
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
    // časový limit; prvú dávku vezme cron do 5 minút.
    await startProposalReview(ctx.person.companyCode, key, fd.getAll("documentIds").map(String), fieldText(fd, "topic") || null, ctx.person.email)
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
  back(key, ctx.t.reviewApplied, false, fd)
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
  back(key, ctx.t.reviewDismissed, false, fd)
}
