"use server"

/**
 * Akcie DPO — zápis a rozhodnutie námietky (ADR-012, D105).
 *
 * Rola sa overuje v každej akcii, nie len na stránke: akcia je verejná
 * adresa a formulár sa dá odoslať aj odinakiaľ.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { dpoContext } from "@/lib/dpo"
import { recordObjection, decideObjection } from "@/lib/objectionsDb"
import { dictionary, errorText } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

async function dpo() {
  const ctx = await dpoContext()
  return ctx.state === "ready" ? ctx.person : null
}

function field(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

/** `<input type="date">` → polnoc UTC; prázdne alebo nečitateľné je neplatný dátum. */
function dateField(fd: FormData, name: string): Date | null {
  const v = field(fd, name)
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : new Date(NaN)
}

function back(message: string, error: boolean): never {
  revalidatePath("/dpo")
  redirect(`/dpo?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}#objections`)
}

export async function recordObjectionAction(fd: FormData) {
  const person = await dpo()
  if (!person) redirect("/")
  const t = dictionary(person.language).dpo
  let message: string
  let error = false
  try {
    await recordObjection(person.companyCode, field(fd, "email"), {
      receivedAt: dateField(fd, "receivedAt"),
      channel: field(fd, "channel"),
      text: field(fd, "text"),
    }, person.email)
    message = t.objectionRecorded
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[dpo] zápis námietky zlyhal:", e)
    message = errorText(e, person.language)
    error = true
  }
  back(message, error)
}

export async function decideObjectionAction(fd: FormData) {
  const person = await dpo()
  if (!person) redirect("/")
  const t = dictionary(person.language).dpo
  let message: string
  let error = false
  try {
    const r = await decideObjection(person.companyCode, field(fd, "id"), field(fd, "decision"), field(fd, "note"), person.email)
    message = r.status === "upheld" ? t.objectionUpheld : t.objectionRejected
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[dpo] rozhodnutie o námietke zlyhalo:", e)
    message = errorText(e, person.language)
    error = true
  }
  back(message, error)
}
