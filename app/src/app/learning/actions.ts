"use server"

/**
 * Akcie obrazovky Vzdelávanie (ADR-018). Brána sa overuje v každej akcii —
 * akcia je verejná adresa a formulár sa dá odoslať aj odinakiaľ.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { learningContext } from "@/lib/learning"
import { enrollSelf, enrollmentFor } from "@/lib/enrollmentsDb"
import { completePart } from "@/lib/learningProgressDb"
import { ALLOW_COMPLETE_BEFORE_REQUIRED_TEST } from "@/lib/learningProgress"
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
  // Späť tam, odkiaľ sa zapisovalo — len v rámci modulu, nikdy inam.
  const raw = String(fd.get("back") ?? "")
  const back = /^\/learning(\/[a-z0-9-]+)?$/.test(raw) ? raw : "/learning"
  revalidatePath("/learning")
  redirect(`${back}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * „Označiť ako prejdené" (rám PART). Stráž počíta server z uložených údajov
 * (D119) — tlačidlo vypnuté v prehliadači nie je ochrana. Pred povinným
 * testom sa označiť dá (PART Q1 ✅, `ALLOW_COMPLETE_BEFORE_REQUIRED_TEST`).
 */
export async function completePartAction(fd: FormData) {
  const ctx = await learningContext()
  if (ctx.state !== "ready") redirect("/")
  const courseKey = String(fd.get("courseKey") ?? "").trim()
  const partKey = String(fd.get("partKey") ?? "").trim()
  const back = /^[a-z0-9-]+$/.test(courseKey) && /^[a-z0-9-]+$/.test(partKey) ? `/learning/${courseKey}/${partKey}` : "/learning"
  let message: string
  let error = false
  try {
    const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, courseKey)
    if (!e || e.cancelledAt) throw new AppError("learning.courseNotFound", "Zápis do kurzu neexistuje.")
    await completePart({ enrollment: e, partKey, allowBeforeRequiredTests: ALLOW_COMPLETE_BEFORE_REQUIRED_TEST })
    message = dictionary(ctx.person.language).learning.part.marked
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] označenie časti zlyhalo:", e)
    message = errorText(e, ctx.person.language)
    error = true
  }
  revalidatePath(back)
  redirect(`${back}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}
