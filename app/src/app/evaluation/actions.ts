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
      ctx.person.email,
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
