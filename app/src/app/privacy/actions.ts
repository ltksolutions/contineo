"use server"

/**
 * Námietka podaná prihlásenou osobou na `/privacy` (ADR-012, D153).
 *
 * Stránka je verejná, akcia nie: osoba sa berie z relácie, nie z formulára.
 * Kto nie je prihlásený, námietku tu nepodá — pošle ju e-mailom na kontakt
 * GDPR a DPO ju zaeviduje ručne (D105).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { currentPerson, currentTenant } from "@/lib/session"
import { submitOwnObjection } from "@/lib/objectionsDb"
import { sendObjectionEmails } from "@/lib/objectionNotice"
import { dictionary, errorText } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

export async function submitObjectionAction(fd: FormData) {
  const tenant = await currentTenant()
  const person = await currentPerson()
  if (!tenant || !person) redirect("/sign-in")

  const text = String(fd.get("text") ?? "")
  let message = dictionary(person.language).privacy.objectionSent
  let error = false
  try {
    const objection = await submitOwnObjection(person, text)
    // E-maily až po zápise; ich zlyhanie námietku nezruší (loguje sa).
    await sendObjectionEmails(tenant, objection, person)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[privacy] podanie námietky zlyhalo:", e)
    message = errorText(e, person.language)
    error = true
  }
  revalidatePath("/privacy")
  revalidatePath("/dpo")
  // `redirect()` mimo `try` — vyhadzuje výnimku (CLAUDE.md).
  redirect(`/privacy?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}#rights`)
}
