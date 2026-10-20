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
import { renameRun, startDocumentReview, startHelpdeskReview, decideFinding, applyAcceptedFinding, notifyContentManagers, documentRun, stopRun, archiveRun } from "@/lib/complianceCheck"
import { kick, originFromHeaders } from "@/lib/backgroundKick"
import { parseNextFinding } from "@/lib/complianceView"
import { listChannels } from "@/lib/channels"
import { setLinksFromRun, removeLink, dismissRequest, markRequestStarted } from "@/lib/complianceRequests"

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

/**
 * Každé spustenie ide najprv na rekapituláciu (ADR-036, Ján 20. 10. 2026:
 * „Navrhnúť doplnenie manuálov" spustilo kontrolu hneď a vznikli zbytočné
 * behy). Formulár bez `confirmed` sa nespustí, ale presmeruje na
 * `/library/compliance/confirm` s tým istým zadaním — platí aj pre stránky
 * otvorené pred nasadením.
 */
function toConfirm(fd: FormData, kind: "documents" | "helpdesk"): never {
  const q = new URLSearchParams({ kind })
  for (const key of ["name", "requestId", "channelKey"]) { const v = fieldText(fd, key); if (v) q.set(key, v) }
  for (const key of ["subjectIds", "documentIds"]) for (const v of fd.getAll(key)) if (String(v).trim()) q.append(key, String(v).trim())
  redirect(`${PAGE}/confirm?${q.toString()}`)
}

export async function startDocumentReviewAction(fd: FormData) {
  const ctx = await ready()
  if (fieldText(fd, "confirmed") !== "1") toConfirm(fd, "documents")
  let runId = ""
  try {
    // „Spustiť znova" na detaile posiela ten istý výber aj názov (Q4).
    const run = await startDocumentReview(ctx.person.companyCode, fd.getAll("subjectIds").map(String), fd.getAll("documentIds").map(String), { email: ctx.person.email, personId: ctx.person.id }, new Date(), fieldText(fd, "name"))
    runId = run.runId
    // Spustené z požiadavky na kontrolu (D200) — požiadavka sa uzavrie s odkazom na beh.
    const requestId = fieldText(fd, "requestId")
    if (requestId) await markRequestStarted(ctx.person.companyCode, requestId, run.runId, ctx.person.email)
    const origin = originFromHeaders(await headers())
    after(() => kick(origin, "/api/cron/compliance"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(PAGE, failure(e, ctx.language), true)
  }
  back(`${PAGE}/${runId}`, ctx.t.started)
}

/**
 * Návrhy na doplnenie manuálov z otázok helpdesku kanála (ADR-034, D221).
 * Aj „Spustiť znova" na detaile takého behu prichádza sem.
 */
export async function startHelpdeskReviewAction(fd: FormData) {
  const ctx = await ready()
  if (fieldText(fd, "confirmed") !== "1") toConfirm(fd, "helpdesk")
  let runId = ""
  try {
    const key = fieldText(fd, "channelKey")
    const channel = (await listChannels(ctx.person.companyCode)).find(c => c.key === key)
    if (!channel) throw new AppError("channel.notFound", "Taký kanál tu nie je.")
    const run = await startHelpdeskReview(ctx.person.companyCode, { key: channel.key, name: channel.name }, { email: ctx.person.email, personId: ctx.person.id },
      fieldText(fd, "name") || ctx.t.helpdeskRunName(channel.name))
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
  const { documentId: nextDoc, findingId: nextFinding } = parseNextFinding(fieldText(fd, "next"))
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

/** Premenovanie kontroly na jej detaile (rola `compliance`). */
export async function renameRunAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  const path = `${PAGE}/${encodeURIComponent(runId)}`
  try {
    await renameRun(ctx.person.companyCode, runId, fieldText(fd, "name"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true)
  }
  back(path, ctx.t.renamed)
}

/** Pevné väzby z dobehnutej kontroly (D197): každý kontrolovaný dokument proti jej normám. */
export async function saveLinksAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  const path = `${PAGE}/${encodeURIComponent(runId)}`
  let message = ""
  try {
    const run = await documentRun(ctx.person.companyCode, runId)
    if (!run) throw new AppError("compliance.unknownRun", "Taká kontrola tu nie je.")
    message = ctx.t.linksSaved(await setLinksFromRun(ctx.person.companyCode, run, ctx.person.email))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true)
  }
  back(path, message)
}

export async function removeLinkAction(fd: FormData) {
  const ctx = await ready()
  try {
    await removeLink(ctx.person.companyCode, fieldText(fd, "subjectId"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(PAGE, failure(e, ctx.language), true, "links")
  }
  back(PAGE, ctx.t.linkRemoved, false, "links")
}

/** „Netreba" pri požiadavke na kontrolu (D200) — s dôvodom. */
export async function dismissRequestAction(fd: FormData) {
  const ctx = await ready()
  try {
    await dismissRequest(ctx.person.companyCode, fieldText(fd, "requestId"), fieldText(fd, "reason"), ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(PAGE, failure(e, ctx.language), true, "requests")
  }
  back(PAGE, ctx.t.requestDismissed, false, "requests")
}

/** Zastaví bežiace kolo (ADR-036) — hotové dokumenty ostanú. */
export async function stopRunAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  const path = `${PAGE}/${encodeURIComponent(runId)}`
  try {
    await stopRun(ctx.person.companyCode, runId, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true)
  }
  back(path, ctx.t.stoppedByPerson)
}

/** Zruší kontrolu (ADR-036): zo zoznamu zmizne, záznam ostáva (D24). */
export async function archiveRunAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  try {
    await archiveRun(ctx.person.companyCode, runId, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(`${PAGE}/${encodeURIComponent(runId)}`, failure(e, ctx.language), true)
  }
  back(PAGE, ctx.t.archived)
}
