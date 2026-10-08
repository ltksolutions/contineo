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
import { approveProposal, rejectProposal, mergeProposal } from "@/lib/faqProposals"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

async function ready() {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, t: dictionary(ctx.person.language).channels, language: ctx.person.language }
}

function back(key: string, message: string, error = false): never {
  revalidatePath(`/channels/${encodeURIComponent(key)}/proposals`)
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`/channels/${encodeURIComponent(key)}/proposals?${q.toString()}`)
}

function failure(e: unknown, language: string): string {
  if (!(e instanceof AppError)) console.error("[navrhy-faq] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function approveProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await approveProposal(ctx.person.companyCode, key, fieldText(fd, "id"), {
      documentId: fieldText(fd, "documentId"),
      question: fieldText(fd, "question"),
      variants: fieldText(fd, "variants").split(/\r?\n/),
      answer: fieldText(fd, "answer"),
      audience: fieldText(fd, "audience").split(","),
    }, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true)
  }
  revalidatePath("/library")
  back(key, ctx.t.proposalApproved)
}

export async function rejectProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await rejectProposal(ctx.person.companyCode, key, fieldText(fd, "id"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true)
  }
  back(key, ctx.t.proposalRejected)
}

export async function mergeProposalAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await mergeProposal(ctx.person.companyCode, key, fieldText(fd, "id"), fieldText(fd, "into"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, failure(e, ctx.language), true)
  }
  back(key, ctx.t.proposalMerged)
}
