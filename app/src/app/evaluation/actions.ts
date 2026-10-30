"use server"

/**
 * actions.ts — zápisy z fronty hodnotiteľa.
 *
 * Každá akcia začína bránou `evaluationContext()`. Serverová akcia je koncový
 * bod ako každý iný; to, že sa volá z formulára na chránenej stránke, nie je
 * kontrola prístupu.
 *
 * `companyCode` sa **nikdy** neberie z formulára, vždy z prihláseného
 * človeka (D32).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { evaluationContext } from "@/lib/evaluation"
import { saveCurationDraft, CurationError } from "@/lib/curation"
import { isRedirect } from "@/lib/redirects"
import { dismissRating, restoreRating } from "@/lib/ratings"
import { dictionary } from "@/lib/i18n"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

/**
 * Hodnotiteľ pripraví pár. **Nezverejňuje** — do znalostí sa nedostane nič,
 * kým to správca obsahu nezverejní.
 */
export async function prepareCurationAction(fd: FormData) {
  const ctx = await evaluationContext()
  if (ctx.state !== "ready") redirect("/")

  const id = fieldText(fd, "id")
  const chunkIds = fd.getAll("chunkIds").filter((v): v is string => typeof v === "string")

  try {
    await saveCurationDraft(
      id,
      {
        question: fieldText(fd, "question"),
        answer: fieldText(fd, "answer"),
        chunkIds,
      },
      ctx.person.id,
      ctx.tenant.companyCode,
    )
  } catch (e) {
    if (isRedirect(e)) throw e
    const message = e instanceof CurationError
      ? e.message
      : "Návrh sa nepodarilo uložiť."
    redirect(`/evaluation?msg=${encodeURIComponent(message)}&error=1`)
  }

  revalidatePath("/evaluation")
  revalidatePath("/library/curation")
  redirect(`/evaluation?msg=${encodeURIComponent(
    "Pár je pripravený. Zverejní ho správca obsahu — do znalostí sa zatiaľ nedostal.",
  )}`)
}

/**
 * Vyradí podnet, ktorý nesúvisí s témou (Ján 30. 10. 2026: „niekto skúšal
 * hlúposti"). Záznam ostáva, len odíde z fronty bez posudku.
 */
export async function dismissEvaluationAction(fd: FormData) {
  const ctx = await evaluationContext()
  if (ctx.state !== "ready") redirect("/")
  const t = dictionary(ctx.person.language).evaluation
  const ok = await dismissRating(fieldText(fd, "id"), ctx.person.id, ctx.tenant.companyCode)
  revalidatePath("/evaluation")
  redirect(ok ? `/evaluation?msg=${encodeURIComponent(t.dismissed)}` : `/evaluation?msg=${encodeURIComponent(t.dismissFailed)}&error=1`)
}

/** Vráti vyradený podnet do fronty — vyradenie omylom. */
export async function restoreEvaluationAction(fd: FormData) {
  const ctx = await evaluationContext()
  if (ctx.state !== "ready") redirect("/")
  const t = dictionary(ctx.person.language).evaluation
  const ok = await restoreRating(fieldText(fd, "id"), ctx.tenant.companyCode)
  revalidatePath("/evaluation")
  // Neúspech = podnet už nie je vyradený; pohľad Vyradené ukáže skutočný stav.
  redirect(ok ? `/evaluation?msg=${encodeURIComponent(t.restored)}` : "/evaluation?view=dismissed")
}
