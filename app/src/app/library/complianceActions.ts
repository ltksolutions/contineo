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
import { complianceContext, complianceViewContext } from "@/lib/complianceAccess"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"
import { startDocumentReview, decideFinding, applyAcceptedFinding, notifyContentManagers, documentRun } from "@/lib/complianceCheck"
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

function back(path: string, message: string, error = false, anchor = "", keep: Record<string, string> = {}): never {
  revalidatePath(PAGE)
  revalidatePath(path)
  const q = new URLSearchParams(Object.entries(keep).filter(([, v]) => v))
  q.set("msg", message)
  if (error) q.set("error", "1")
  redirect(`${path}?${q.toString()}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`)
}

/** Stav obrazovky detailu (KNIZ-kontrola-suladu-detail): vybraný dokument a filter. */
function viewOf(fd: FormData, documentId: string): Record<string, string> {
  const view = fieldText(fd, "view")
  return { doc: documentId, ...(view && view !== "open" ? { view } : {}) }
}

function failure(e: unknown, language: string): string {
  if (!(e instanceof AppError)) console.error("[kontrola-suladu] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function startDocumentReviewAction(fd: FormData) {
  const ctx = await ready()
  let runId = ""
  try {
    // „Spustiť znova" na detaile posiela ten istý výber aj názov (Q4).
    const run = await startDocumentReview(ctx.person.companyCode, fd.getAll("subjectIds").map(String), fd.getAll("documentIds").map(String), { email: ctx.person.email, personId: ctx.person.id }, new Date(), fieldText(fd, "name"))
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
  const keep = viewOf(fd, documentId)
  let message = ""
  try {
    // Kto nemá aj content-admin, koncept nemení — rozhodnutie sa uloží a znenie vloží správca obsahu.
    // Posledná hodnota: bez JavaScriptu editor pošle skryté pole s pôvodným textom
    // aj `<noscript>` pole s úpravou — platí úprava.
    const texts = fd.getAll("text").filter((v): v is string => typeof v === "string")
    const text = texts.length ? texts[texts.length - 1] : ""
    const r = await decideFinding(ctx.person.companyCode, runId, documentId, findingId, decision, fieldText(fd, "reason"), text, ctx.person.email, ctx.canEditDrafts)
    message = decision === "kept" ? ctx.t.savedKept : r.applied === "draft" ? ctx.t.savedDraft : r.applied === "pending" ? ctx.t.savedPending : r.applied === "manual" ? ctx.t.savedManual : ctx.t.saved
    // Bez roly správcu obsahu znenie čaká — dať vedieť tým, ktorí ho zapíšu (D199).
    if (r.applied === "pending") {
      const run = await documentRun(ctx.person.companyCode, runId)
      const title = run?.results?.find(x => x.documentId === documentId)?.title ?? documentId
      await notifyContentManagers(ctx.person.companyCode, runId, documentId, title)
    }
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true, anchor, { ...keep, f: findingId })
  }
  // „Uložiť a ďalší": ďalší nerozhodnutý nález, aj v ďalšom dokumente. Stránka
  // ho poslala ako `dokument:nález`; keď už nie je, ostane sa pri tomto.
  const [nextDoc, nextFinding] = fieldText(fd, "next").split(":")
  if (nextDoc && nextFinding) back(path, message, false, `${nextDoc}-${nextFinding}`, { ...viewOf(fd, nextDoc), f: nextFinding })
  back(path, message, false, anchor, keep)
}

/** Správca obsahu zapíše prijaté znenie do konceptu (D199). */
export async function applyFindingAction(fd: FormData) {
  const ctx = await complianceViewContext()
  if (ctx.state !== "ready" || !ctx.canEditDrafts) redirect("/")
  const t = dictionary(ctx.person.language).library.compliance
  const runId = fieldText(fd, "runId")
  const documentId = fieldText(fd, "documentId")
  const findingId = fieldText(fd, "findingId")
  const path = `${PAGE}/${encodeURIComponent(runId)}`
  const anchor = `${documentId}-${findingId}`
  const keep = viewOf(fd, documentId)
  let message = ""
  try {
    const applied = await applyAcceptedFinding(ctx.person.companyCode, runId, documentId, findingId, ctx.person.email)
    message = applied === "manual" ? t.savedManual : t.savedDraft
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.person.language), true, anchor, keep)
  }
  back(path, message, false, anchor, keep)
}
