"use server"

/**
 * Akcie kontroly súladu dokumentov (ADR-032, D196). Brána je rola
 * `compliance` (`complianceContext()`), organizácia ide z prihlásenia, nie
 * z formulára. Beh sa len založí a hneď po odpovedi ho rozbehne reťaz na
 * pozadí (`lib/backgroundKick.ts`) — akcia by na jeden dokument čakala minúty.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { headers } from "next/headers"
import { complianceContext } from "@/lib/complianceAccess"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"
import { startDocumentReview, decideFinding } from "@/lib/complianceCheck"
import { kick, originFromHeaders } from "@/lib/backgroundKick"

const PAGE = "/library/compliance"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

async function ready() {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, t: dictionary(ctx.person.language).library.compliance, language: ctx.person.language }
}

function back(path: string, message: string, error = false, anchor = ""): never {
  revalidatePath(PAGE)
  revalidatePath(path)
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`${path}?${q.toString()}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`)
}

function failure(e: unknown, language: string): string {
  if (!(e instanceof AppError)) console.error("[kontrola-suladu] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function startDocumentReviewAction(fd: FormData) {
  const ctx = await ready()
  let runId = ""
  try {
    const run = await startDocumentReview(ctx.person.companyCode, fd.getAll("subjectIds").map(String), fd.getAll("documentIds").map(String), { email: ctx.person.email, personId: ctx.person.id })
    runId = run.runId
    const origin = originFromHeaders(await headers())
    after(() => kick(origin, "/api/cron/compliance"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(PAGE, failure(e, ctx.language), true)
  }
  back(`${PAGE}/${runId}`, ctx.t.started)
}

export async function decideFindingAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  const documentId = fieldText(fd, "documentId")
  const findingId = fieldText(fd, "findingId")
  const decision = fieldText(fd, "decision") === "kept" ? "kept" : "accepted"
  const anchor = `${documentId}-${findingId}`
  const path = `${PAGE}/${encodeURIComponent(runId)}`
  let message = ""
  try {
    // Kto nemá aj content-admin, koncept nemení — rozhodnutie sa uloží a znenie vloží správca obsahu.
    const text = typeof fd.get("text") === "string" ? String(fd.get("text")) : ""
    const r = await decideFinding(ctx.person.companyCode, runId, documentId, findingId, decision, fieldText(fd, "reason"), text, ctx.person.email, ctx.canEditDrafts)
    message = decision === "kept" ? ctx.t.savedKept : r.applied === "draft" ? ctx.t.savedDraft : r.applied === "manual" ? ctx.t.savedManual : ctx.t.saved
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true, anchor)
  }
  back(path, message, false, anchor)
}
