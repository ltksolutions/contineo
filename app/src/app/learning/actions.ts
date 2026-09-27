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
import { getCourse } from "@/lib/coursesDb"
import { versionById } from "@/lib/courses"
import { getAttempt, saveAnswers, startAttempt, submitAttempt } from "@/lib/testAttemptsDb"
import { answerFromForm } from "@/lib/testAttempts"
import { ensureCertificate } from "@/lib/certificatesDb"
import type { Enrollment } from "@/lib/enrollments"
import type { Tenant } from "@/lib/tenants"

/**
 * Po udalosti, ktorá môže kurz dokončiť, sa skúsi vydať certifikát (D122).
 * `ensureCertificate` si dokončenie overí sám; zlyhanie nesmie zhodiť
 * označenie časti ani odovzdanie testu — stránka certifikátu to skúsi znova.
 */
async function tryCertificate(e: Enrollment, tenant: Tenant) {
  try {
    await ensureCertificate(e, tenant)
  } catch (err) {
    console.error("[learning] vydanie certifikátu zlyhalo:", err)
  }
}
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
    await tryCertificate(e, ctx.tenant)
    message = dictionary(ctx.person.language).learning.part.marked
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] označenie časti zlyhalo:", e)
    message = errorText(e, ctx.person.language)
    error = true
  }
  revalidatePath(back)
  redirect(`${back}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

function testBase(courseKey: string, partKey: string, testKey: string): string {
  const ok = [courseKey, partKey, testKey].every(k => /^[a-z0-9-]+$/.test(k))
  return ok ? `/learning/${courseKey}/${partKey}/test/${testKey}` : "/learning"
}

/**
 * „Spustiť test" (rám TEST-ATTEMPT). Idempotentné — kľúč z úvodnej
 * stránky; otvorený pokus sa vráti a pokračuje sa v ňom (Q2 ✅).
 */
export async function startAttemptAction(fd: FormData) {
  const ctx = await learningContext()
  if (ctx.state !== "ready") redirect("/")
  const [courseKey, partKey, testKey] = ["courseKey", "partKey", "testKey"].map(k => String(fd.get(k) ?? "").trim())
  const base = testBase(courseKey, partKey, testKey)
  let attemptId = ""
  try {
    const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, courseKey)
    if (!e || e.cancelledAt) throw new AppError("learning.courseNotFound", "Zápis do kurzu neexistuje.")
    const course = await getCourse(ctx.person.companyCode, courseKey)
    const part = course ? versionById(course, e.versionId)?.parts.find(p => p.key === partKey) : null
    const pt = part?.tests.find(t => t.testKey === testKey)
    if (!pt) throw new AppError("attempt.testNotFound", "Taký test nie je.")
    attemptId = (await startAttempt({ enrollment: e, partKey, testKey, testVersion: pt.testVersion, idempotencyKey: String(fd.get("idempotencyKey") ?? crypto.randomUUID()) })).id
  } catch (err) {
    if (!(err instanceof AppError)) console.error("[learning] spustenie testu zlyhalo:", err)
    redirect(`${base}?msg=${encodeURIComponent(errorText(err, ctx.person.language))}&error=1`)
  }
  redirect(`${base}/${attemptId}`)
}

/**
 * Uloženie odpovede a posun (Ďalej, Späť, Prehľad, odovzdanie). Funguje bez
 * JavaScriptu — každý posun je odoslanie formulára, teda aj uloženie.
 */
export async function answerAction(fd: FormData) {
  const ctx = await learningContext()
  if (ctx.state !== "ready") redirect("/")
  const [courseKey, partKey, testKey, attemptId] = ["courseKey", "partKey", "testKey", "attemptId"].map(k => String(fd.get(k) ?? "").trim())
  const base = `${testBase(courseKey, partKey, testKey)}/${attemptId}`
  const go = String(fd.get("go") ?? "next")
  const index = Number(fd.get("index") ?? 0)
  const a = await getAttempt(ctx.person.companyCode, attemptId)
  if (!a || a.personId !== ctx.person.id) redirect(testBase(courseKey, partKey, testKey))
  if (a.submittedAt) redirect(`${base}/result`)
  const q = a.questions[index]
  if (q && fd.get("hasAnswer") === "1") {
    const value = answerFromForm(q, fd.getAll("a").map(String))
    if (value) await saveAnswers(ctx.person.companyCode, attemptId, ctx.person.id, { [q.questionKey]: value }).catch(() => {})
  }
  if (go === "submit") {
    await submitAttempt(ctx.person.companyCode, attemptId, ctx.person.id)
    const e = await enrollmentFor(ctx.person.companyCode, ctx.person.id, courseKey)
    if (e) await tryCertificate(e, ctx.tenant)
    revalidatePath(`/learning/${courseKey}`)
    redirect(`${base}/result`)
  }
  if (go === "review" || go === "confirm") redirect(`${base}?review=1${go === "confirm" ? "&confirm=1" : ""}`)
  const target = go === "prev" ? index - 1 : go.startsWith("q:") ? Number(go.slice(2)) : index + 1
  if (target >= a.questions.length) redirect(`${base}?review=1`)
  redirect(`${base}?q=${Math.max(0, target) + 1}`)
}
