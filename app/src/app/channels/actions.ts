"use server"

/**
 * Akcie sekcie Kanály (ADR-028, D161, D169). Brána je správca organizácie
 * (`orgContext()`), organizácia ide z prihlásenia, nie z formulára.
 * Validácia a audit sú v `lib/channels.ts`; tu je len formulár → vstup
 * a späť na kanál so správou.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { orgContext } from "@/lib/orgSettings"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { saveChannel, removeChannel, verifyMailbox, syncChannel, rotateWidgetSecret } from "@/lib/channels"
import { mineFaqDrafts } from "@/lib/faqMining"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}
function lines(fd: FormData, name: string): string[] {
  return fieldText(fd, name).split(/\r?\n/).map(x => x.trim()).filter(Boolean)
}
function all(fd: FormData, name: string): string[] {
  return fd.getAll(name).filter((x): x is string => typeof x === "string")
}
function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[kanaly] akcia zlyhala:", e)
  return errorText(e, language)
}
function back(key: string | null, message: string, error = false): never {
  revalidatePath("/channels")
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`${key ? `/channels/${encodeURIComponent(key)}/settings` : "/channels"}?${q.toString()}`)
}
async function ready() {
  const ctx = await orgContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, t: dictionary(ctx.person.language).channels, language: ctx.person.language }
}

export async function saveChannelAction(fd: FormData) {
  const ctx = await ready()
  const isNew = fieldText(fd, "isNew") === "1"
  // Nový kanál kľúč nemá — pridelí ho saveChannel (UUID); upravovaný ho nesie v skrytom poli.
  let key = isNew ? "" : fieldText(fd, "key").toLowerCase()
  try {
    const mailboxKind = fieldText(fd, "mailboxKind")
    const saved = await saveChannel(ctx.person.companyCode, {
      key: key || undefined,
      kind: fieldText(fd, "kind") || undefined,
      tickets: fieldText(fd, "tickets") === "on",
      name: fieldText(fd, "name"),
      audience: fieldText(fd, "audience"),
      folderIds: all(fd, "folderIds"),
      connectorScopes: all(fd, "connectorScopes"),
      assigneeIds: all(fd, "assigneeIds"),
      languages: all(fd, "languages"),
      widgetOrigins: lines(fd, "widgetOrigins"),
      rateLimitPerHour: fieldText(fd, "rateLimitPerHour"),
      mailbox: mailboxKind
        ? { kind: mailboxKind, address: fieldText(fd, "address"), tenantId: fieldText(fd, "tenantId"), clientId: fieldText(fd, "clientId"), clientSecret: fieldText(fd, "clientSecret") }
        : null,
    }, ctx.person.email)
    key = saved.key
  } catch (e) {
    if (isRedirect(e)) throw e
    if (isNew) {
      const q = new URLSearchParams({ error: errorMessage(e, ctx.language), name: fieldText(fd, "name"), kind: fieldText(fd, "kind") })
      redirect(`/channels?${q.toString()}#new`)
    }
    back(key, errorMessage(e, ctx.language), true)
  }
  back(key, isNew ? ctx.t.created : ctx.t.saved)
}

export async function removeChannelAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await removeChannel(ctx.person.companyCode, key, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, errorMessage(e, ctx.language), true)
  }
  back(null, ctx.t.removed)
}

export async function verifyMailboxAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  let message: string
  try {
    const r = await verifyMailbox(ctx.person.companyCode, key)
    message = ctx.t.verified(r.address, r.displayName ?? "")
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, errorMessage(e, ctx.language), true)
  }
  back(key, message)
}

export async function syncChannelAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  let message: string
  let failed = false
  try {
    const r = await syncChannel(ctx.person.companyCode, key)
    if (r.error) { message = errorText(new AppError(r.error, r.error), ctx.language); failed = true }
    else message = ctx.t.syncDone(r.created, r.appended, r.beforeStart)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, errorMessage(e, ctx.language), true)
  }
  back(key, message, failed)
}

export async function rotateWidgetSecretAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  try {
    await rotateWidgetSecret(ctx.person.companyCode, key, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, errorMessage(e, ctx.language), true)
  }
  // Tajomstvo sa ukáže zo servera pri najbližšom zobrazení (`takeRevealedWidgetSecret`), nie cez adresu.
  back(key, ctx.t.saved)
}

export async function mineFaqAction(fd: FormData) {
  const ctx = await ready()
  const key = fieldText(fd, "key")
  let message: string
  try {
    const r = await mineFaqDrafts(
      { companyCode: ctx.person.companyCode, personId: ctx.person.id, personName: ctx.person.fullName, email: ctx.person.email },
      { channelKey: key, documentId: fieldText(fd, "documentId"), limit: Number(fieldText(fd, "limit") || 300), language: ctx.language },
    )
    message = ctx.t.miningDone(r.threads, r.proposed, r.saved, r.duplicates)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(key, errorMessage(e, ctx.language), true)
  }
  revalidatePath("/library")
  back(key, message)
}
