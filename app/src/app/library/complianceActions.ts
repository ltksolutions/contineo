"use server"

/**
 * Akcie kontroly súladu dokumentov (ADR-032, D196). Brána je správca obsahu
 * (`libraryContext()`), organizácia ide z prihlásenia, nie z formulára.
 * Beh sa len založí — dokument prechádza viacerými krokmi a spracuje ho
 * cron, akcia by na jeden dokument čakala aj dve minúty.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { libraryContext } from "@/lib/library"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"
import { startDocumentReview, decideFinding } from "@/lib/complianceCheck"

const PAGE = "/library/compliance"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

async function ready() {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, t: dictionary(ctx.person.language).library.compliance, language: ctx.person.language }
}

function back(message: string, error = false, anchor = ""): never {
  revalidatePath(PAGE)
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`${PAGE}?${q.toString()}${anchor && !error ? `#${encodeURIComponent(anchor)}` : ""}`)
}

function failure(e: unknown, language: string): string {
  if (!(e instanceof AppError)) console.error("[kontrola-suladu] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function startDocumentReviewAction(fd: FormData) {
  const ctx = await ready()
  try {
    await startDocumentReview(ctx.person.companyCode, fd.getAll("subjectIds").map(String), fd.getAll("documentIds").map(String), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(failure(e, ctx.language), true)
  }
  back(ctx.t.started)
}

export async function decideFindingAction(fd: FormData) {
  const ctx = await ready()
  const status = fieldText(fd, "status") === "kept" ? "kept" : "fixed"
  const anchor = `${fieldText(fd, "documentId")}-${fieldText(fd, "findingId")}`
  try {
    await decideFinding(ctx.person.companyCode, fieldText(fd, "runId"), fieldText(fd, "documentId"), fieldText(fd, "findingId"), status, fieldText(fd, "reason"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(failure(e, ctx.language), true)
  }
  back(ctx.t.saved, false, anchor)
}
