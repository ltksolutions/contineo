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
import { decideFinding, applyAcceptedFinding, notifyContentManagers, documentRun, stopRun } from "@/lib/complianceCheck"
import { kick, originFromHeaders } from "@/lib/backgroundKick"
import { parseNextFinding } from "@/lib/complianceView"
import { listChannels } from "@/lib/channels"
import { dismissRequest, markRequestStarted, requestById } from "@/lib/complianceRequests"
import { createCheck, startCheckRound, renameCheck, archiveCheck, roundsOf } from "@/lib/complianceChecks"

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
  for (const key of ["name", "requestId", "channelKey", "checkId"]) { const v = fieldText(fd, key); if (v) q.set(key === "checkId" ? "check" : key, v) }
  for (const key of ["subjectIds", "documentIds"]) for (const v of fd.getAll(key)) if (String(v).trim()) q.append(key, String(v).trim())
  redirect(`${PAGE}/confirm?${q.toString()}`)
}

/**
 * Adresa behu: kolo kontroly je na adrese kontroly (ADR-036, D239), beh
 * spred D239 na svojej. Rozhoduje sa len v poslednom kole, takže kolo sa do
 * adresy nedáva.
 */
async function runPath(companyCode: string, runId: string): Promise<string> {
  const run = await documentRun(companyCode, runId)
  return `${PAGE}/${encodeURIComponent(run?.checkId ?? runId)}`
}

/**
 * Spustenie kola po rekapitulácii (ADR-036). S `checkId` je to ďalšie kolo
 * existujúcej kontroly (aj z požiadavky na kontrolu, Q2), bez neho nová
 * kontrola a jej prvé kolo.
 */
async function startRound(fd: FormData, kind: "documents" | "helpdesk") {
  const ctx = await ready()
  if (fieldText(fd, "confirmed") !== "1") toConfirm(fd, kind)
  let checkId = fieldText(fd, "checkId")
  let runId = ""
  try {
    const starter = { email: ctx.person.email, personId: ctx.person.id }
    const requestId = fieldText(fd, "requestId")
    const request = requestId ? await requestById(ctx.person.companyCode, requestId) : null
    if (!checkId) {
      let channel: { key: string; name: string } | null = null
      if (kind === "helpdesk") {
        const key = fieldText(fd, "channelKey")
        const found = (await listChannels(ctx.person.companyCode)).find(c => c.key === key)
        if (!found) throw new AppError("channel.notFound", "Taký kanál tu nie je.")
        channel = { key: found.key, name: found.name }
      }
      const check = await createCheck(ctx.person.companyCode, {
        kind, channel,
        name: fieldText(fd, "name") || (channel ? ctx.t.helpdeskRunName(channel.name) : ""),
        subjectIds: kind === "helpdesk" ? [] : fd.getAll("subjectIds").map(String),
        referenceIds: kind === "helpdesk" ? [] : fd.getAll("documentIds").map(String),
      }, ctx.person.email)
      checkId = check.checkId
      try {
        runId = (await startCheckRound(ctx.person.companyCode, checkId, starter)).runId
      } catch (e) {
        // Prvé kolo sa nespustilo — prázdna kontrola v zozname by mýlila.
        await archiveCheck(ctx.person.companyCode, checkId, ctx.person.email, "Prvé kolo sa nespustilo.").catch(() => {})
        throw e
      }
    } else {
      // Požiadavka nesie normy aj s novým znením (D200) — majú prednosť pred uloženými.
      runId = (await startCheckRound(ctx.person.companyCode, checkId, starter, { referenceIds: request?.referenceIds ?? fd.getAll("documentIds").map(String) })).runId
    }
    // Spustené z požiadavky na kontrolu (D200) — požiadavka sa uzavrie s odkazom na kolo.
    if (requestId) await markRequestStarted(ctx.person.companyCode, requestId, runId, ctx.person.email)
    const origin = originFromHeaders(await headers())
    after(() => kick(origin, "/api/cron/compliance"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(checkId ? `${PAGE}/${encodeURIComponent(checkId)}` : PAGE, failure(e, ctx.language), true)
  }
  back(`${PAGE}/${encodeURIComponent(checkId)}`, ctx.t.started)
}

export async function startDocumentReviewAction(fd: FormData) {
  await startRound(fd, "documents")
}

/** Návrhy na doplnenie manuálov z otázok helpdesku kanála (ADR-034, D221) — druh kontroly. */
export async function startHelpdeskReviewAction(fd: FormData) {
  await startRound(fd, "helpdesk")
}

export async function decideFindingAction(fd: FormData) {
  const ctx = await ready()
  const runId = fieldText(fd, "runId")
  const documentId = fieldText(fd, "documentId")
  const findingId = fieldText(fd, "findingId")
  const decision = fieldText(fd, "decision") === "kept" ? "kept" : "accepted"
  const anchor = `${documentId}-${findingId}`
  const path = await runPath(ctx.person.companyCode, runId)
  const keep = viewOf(fd, documentId)
  let message = ""
  try {
    // Rozhoduje sa len v poslednom kole kontroly (Q3) a nie v behu spred D239.
    const current = await documentRun(ctx.person.companyCode, runId)
    if (!current?.checkId) throw new AppError("compliance.olderRound", "Rozhoduje sa len v poslednom kole kontroly.")
    const rounds = await roundsOf(ctx.person.companyCode, current.checkId)
    if (rounds.at(-1)?.runId !== runId) throw new AppError("compliance.olderRound", "Rozhoduje sa len v poslednom kole kontroly.")
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
  const path = await runPath(ctx.person.companyCode, runId)
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

/** Premenovanie kontroly na jej detaile (rola `compliance`); názov patrí kontrole (D239). */
export async function renameRunAction(fd: FormData) {
  const ctx = await ready()
  const checkId = fieldText(fd, "checkId")
  const path = `${PAGE}/${encodeURIComponent(checkId)}`
  try {
    await renameCheck(ctx.person.companyCode, checkId, fieldText(fd, "name"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true)
  }
  back(path, ctx.t.ck.checkRenamed)
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
  const path = await runPath(ctx.person.companyCode, runId)
  try {
    await stopRun(ctx.person.companyCode, runId, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(path, failure(e, ctx.language), true)
  }
  back(path, ctx.t.stoppedByPerson)
}

/** Zruší kontrolu (ADR-036, D238) aj s jej kolami: zo zoznamu zmizne, záznam ostáva (D24). */
export async function archiveRunAction(fd: FormData) {
  const ctx = await ready()
  const checkId = fieldText(fd, "checkId")
  try {
    await archiveCheck(ctx.person.companyCode, checkId, ctx.person.email, fieldText(fd, "reason"))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(`${PAGE}/${encodeURIComponent(checkId)}`, failure(e, ctx.language), true)
  }
  back(PAGE, ctx.t.ck.checkArchived)
}
