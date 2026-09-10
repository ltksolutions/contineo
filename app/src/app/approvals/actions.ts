"use server"

/**
 * actions.ts — rozhodnutie schvaľovateľa (ADR-006, krok 4).
 *
 * **Formulár nad serverovou akciou, nie API.** Schválenie znenia je úkon
 * s následkom: znenie sa ním stáva prideliteľným a meno schvaľovateľa zostane
 * v histórii natrvalo. Volanie API by sa dalo spustiť z cudzej stránky za
 * prihláseného človeka — rovnaká úvaha ako pri potvrdzovaní.
 *
 * `companyCode` ani totožnosť sa **neberú z formulára**, vždy z prihláseného
 * človeka. Z formulára prichádza len to, čoho sa rozhodnutie týka.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { onboardingContext } from "@/lib/session"
import { isRedirect } from "@/lib/redirects"
import { decide } from "@/lib/approvalsDb"
import { dictionary, errorText } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

export async function decideAction(fd: FormData) {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/sign-in")

  const language = ctx.person.language
  const t = dictionary(language).approvals
  const choice = fieldText(fd, "decision")
  const decision = choice === "rejected" ? "rejected" : "approved"

  let message = ""
  let error = false
  try {
    const r = await decide({
      companyCode: ctx.person.companyCode,
      documentId: fieldText(fd, "documentId"),
      versionId: fieldText(fd, "versionId"),
      round: Number(fieldText(fd, "round")),
      by: ctx.person.email,
      decision,
      reason: fieldText(fd, "reason"),
    })
    message =
      decision === "rejected" ? t.doneRejected
      : r.outcome === "approved" ? t.doneApprovedClosed
      : t.doneApproved
  } catch (e) {
    if (isRedirect(e)) throw e
    if (!(e instanceof AppError)) console.error("[schvalovanie] rozhodnutie zlyhalo:", e)
    message = errorText(e, language)
    error = true
  }

  revalidatePath("/approvals")
  redirect(`/approvals?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}
