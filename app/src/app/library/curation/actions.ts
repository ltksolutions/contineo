"use server"

/**
 * actions.ts — zverejnenie overenej odpovede do znalostí.
 *
 * Text sa berie **z pripraveného návrhu na zázname, nie z formulára**: kto
 * zverejňuje, schvaľuje presne to, čo napísal hodnotiteľ, a nemôže to cestou
 * zmeniť. Z formulára prichádza jediná vec — ktorý záznam.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { libraryContext } from "@/lib/library"
import { publishCuration, CurationError } from "@/lib/curation"
import { isRedirect } from "@/lib/redirects"

export async function publishCurationAction(fd: FormData) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") redirect("/")

  const raw = fd.get("id")
  const id = typeof raw === "string" ? raw.trim() : ""

  let message = ""
  try {
    const curation = await publishCuration(id, ctx.person.id)
    message = curation.accessLevel === "public"
      ? "Overená odpoveď je v znalostiach. Prístup: verejný — vyšiel zo zdrojov, z ktorých vznikla."
      : "Overená odpoveď je v znalostiach. Prístup: interný — aspoň jeden zdroj je interný."
  } catch (e) {
    if (isRedirect(e)) throw e
    const text = e instanceof CurationError ? e.message : "Zverejnenie zlyhalo."
    redirect(`/library/curation?msg=${encodeURIComponent(text)}&error=1`)
  }

  revalidatePath("/library/curation")
  revalidatePath("/evaluation")
  redirect(`/library/curation?msg=${encodeURIComponent(message)}`)
}
