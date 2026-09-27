"use server"

/**
 * Akcie obrazovky Vzdelávanie (ADR-018). Brána sa overuje v každej akcii —
 * akcia je verejná adresa a formulár sa dá odoslať aj odinakiaľ.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { learningContext } from "@/lib/learning"
import { enrollSelf } from "@/lib/enrollmentsDb"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"

/** Samozápis do otvoreného kurzu (rám LEARNING, „Zapísať sa"). */
export async function enrolAction(fd: FormData) {
  const ctx = await learningContext()
  if (ctx.state !== "ready") redirect("/")
  const key = String(fd.get("courseKey") ?? "").trim()
  let message: string
  let error = false
  try {
    const e = await enrollSelf(ctx.person.companyCode, key, ctx.person)
    message = dictionary(ctx.person.language).learning.enrolled(e.courseTitle)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] samozápis zlyhal:", e)
    message = errorText(e, ctx.person.language)
    error = true
  }
  revalidatePath("/learning")
  redirect(`/learning?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}
