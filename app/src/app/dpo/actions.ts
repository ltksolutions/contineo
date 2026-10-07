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
import { saveTenant } from "@/lib/tenantAdmin"
import { retentionSettings } from "@/lib/retention"

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

/**
 * Späť na záložku GDPR v nastaveniach organizácie (D154) — tam lehoty,
 * doplnok aj kontakt od 1. 10. 2026 bývajú. Na `/dpo` zostal výkaz
 * a námietky.
 */
function backToGdpr(message: string, error: boolean, anchor: string): never {
  revalidatePath("/organisation", "layout")
  revalidatePath("/dpo")
  revalidatePath("/privacy")
  redirect(`/organisation/gdpr?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}#${anchor}`)
}

/**
 * Celá časť GDPR jedným uložením (ZAKLAD-lista-ulozenia, 7. 10. 2026):
 * kontakt (D153), lehoty uchovávania (ADR-022, D136) a doplnok na `/privacy`
 * (D137) v jazykoch organizácie. Jeden zápis `saveTenant` — buď sa uloží
 * všetko, alebo nič (Q6).
 *
 * **Lehoty len pri zmene** (Q2): oprava e-mailu DPO nemá znova potvrdiť
 * lehoty, pri ktorých stojí varovanie o mazaní, ani ich zapísať do auditu.
 * Rozsahy stráži `retentionSettings`.
 */
export async function saveGdprPageAction(fd: FormData) {
  const ctx = await dpoContext()
  if (ctx.state !== "ready") redirect("/")
  const t = dictionary(ctx.person.language)
  const retention = {
    evidenceYears: Number(field(fd, "evidenceYears")),
    capYears: Number(field(fd, "capYears")),
    learningDetailMonths: Number(field(fd, "learningDetailMonths")),
    answersMonths: Number(field(fd, "answersMonths")),
  }
  const before = retentionSettings(ctx.tenant.privacy?.retention)
  const after = retentionSettings(retention)
  const retentionChanged = (Object.keys(after) as (keyof typeof after)[]).some(k => after[k] !== before[k])
  const extra: Record<string, string> = {}
  for (const l of ctx.tenant.languages) extra[l] = field(fd, `extra-${l}`)
  let message = t.org.gdpr.saved
  let error = false
  try {
    await saveTenant(ctx.person.companyCode, {
      privacyContactName: field(fd, "privacyContactName"),
      privacyContactEmail: field(fd, "privacyContactEmail"),
      ...(retentionChanged ? { privacyRetention: retention } : {}),
      privacyExtra: extra,
    }, ctx.person.email)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[dpo] uloženie časti GDPR zlyhalo:", e)
    message = errorText(e, ctx.person.language)
    error = true
  }
  backToGdpr(message, error, "contact")
}
