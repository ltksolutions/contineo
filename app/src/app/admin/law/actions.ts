"use server"

/**
 * actions.ts — zápisy do katalógu legislatívy zo správy platformy
 * (ADR-039, D257, D261).
 *
 * Každá akcia začína bránou správcu platformy (D41, D42) — formulár na
 * chránenej stránke nie je kontrola prístupu. Výsledok ide do adresy
 * (`msg`, `error`), stránka je serverová a beží bez skriptu.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { platformContext } from "@/lib/admin"
import { addAct, removeAct, syncAct } from "@/lib/lawCatalog"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import { isRedirect } from "@/lib/redirects"

async function isAdmin(): Promise<{ email: string; companyCode: string; language: UiLanguage } | null> {
  const ctx = await platformContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.tenant.companyCode, language: ctx.person.language }
    : null
}

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[admin/law] akcia zlyhala:", e)
  return errorText(e, language)
}

function back(message: string, error = false): never {
  revalidatePath("/admin/law")
  const q = new URLSearchParams({ msg: message })
  if (error) q.set("error", "1")
  redirect(`/admin/law?${q.toString()}`)
}

/** Správca pridá predpis do katalógu bez odberu — napr. vopred pre nového zákazníka. */
export async function addLawActAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")
  const t = dictionary(actor.language).admin.law
  try {
    const act = await addAct(fieldText(fd, "address"), { companyCode: actor.companyCode, email: actor.email })
    back(t.added(act.title))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(errorMessage(e, actor.language), true)
  }
}

/** To isté, čo denný cron, pre jeden predpis — na výslovné stlačenie (D261). */
export async function checkLawActAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")
  const t = dictionary(actor.language).admin.law
  const out = await syncAct(fieldText(fd, "actId"), new Date(), 8)
  if (out.error) back(t.error(out.error), true)
  back(t.result(out.added.length, out.refreshed.length))
}

export async function removeLawActAction(fd: FormData) {
  const actor = await isAdmin()
  if (!actor) redirect("/admin")
  const t = dictionary(actor.language).admin.law
  try {
    await removeAct(fieldText(fd, "actId"))
    back(t.removed)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(errorMessage(e, actor.language), true)
  }
}
