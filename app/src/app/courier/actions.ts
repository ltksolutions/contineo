"use server"

/**
 * Akcie Kuriéra (ADR-033) — nová 1:1 správa a odpoveď vo vlákne.
 *
 * Identita odosielateľa ide **z relácie**, nikdy z formulára: kto je
 * prihlásený, ten píše. Adresát sa overuje proti osobám organizácie
 * (`companyCode` v dotaze, D32) a externé osoby z okna pomoci adresátmi nie
 * sú (D204) — ich cesta je ticket.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { onboardingContext } from "@/lib/session"
import { createDirectThread, postMessage, CourierError } from "@/lib/courier"
import { loadPersonById } from "@/lib/people"
import { AppError } from "@/lib/appError"
import { isRedirect } from "@/lib/redirects"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"

async function ready() {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/")
  return ctx
}

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[courier] akcia zlyhala:", e)
  return errorText(e, language)
}

/**
 * Nová správa jednej osobe. Pri chybe sa vráti na formulár aj s tým, čo
 * človek napísal — predmet a text sa nestrácajú kvôli nevybranému adresátovi.
 */
export async function sendDirectAction(fd: FormData) {
  const ctx = await ready()
  const language = ctx.person.language
  const to = fieldText(fd, "to").replace(/^person:/, "")
  const subject = fieldText(fd, "subject")
  const text = typeof fd.get("text") === "string" ? String(fd.get("text")) : ""

  let threadId: string
  try {
    if (!to) throw new CourierError("courier.recipientMissing", "Vyberte, komu správu posielate.")
    const recipient = await loadPersonById(ctx.person.companyCode, to)
    if (!recipient || recipient.status === "inactive" || recipient.personType === "external") {
      throw new CourierError("courier.recipientUnknown", "Taká osoba v organizácii nie je alebo je vyradená.")
    }
    threadId = await createDirectThread({
      companyCode: ctx.person.companyCode,
      from: { personId: ctx.person.id, email: ctx.person.email, name: ctx.person.fullName },
      to: { personId: recipient.id, email: recipient.email, name: recipient.fullName },
      subject,
      text,
    })
  } catch (e) {
    if (isRedirect(e)) throw e
    const q = new URLSearchParams({ error: errorMessage(e, language), subject, text })
    if (to) q.set("to", to)
    redirect(`/courier/new?${q.toString()}`)
  }
  // Počet na obálke je v layoute — bez revalidácie by ostal starý.
  revalidatePath("/", "layout")
  redirect(`/courier/${encodeURIComponent(threadId)}?msg=${encodeURIComponent(dictionary(language).courier.msgSent)}`)
}

/** Odpoveď vo vlákne, ktorého je prihlásená osoba účastníkom. */
export async function replyAction(fd: FormData) {
  const ctx = await ready()
  const language = ctx.person.language
  const id = fieldText(fd, "id")
  const text = typeof fd.get("text") === "string" ? String(fd.get("text")) : ""
  const back = (message: string, error = false): never => {
    revalidatePath("/", "layout")
    redirect(`/courier/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
  }
  try {
    await postMessage({
      companyCode: ctx.person.companyCode,
      threadId: id,
      author: { personId: ctx.person.id, email: ctx.person.email, name: ctx.person.fullName },
      text,
    })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(errorMessage(e, language), true)
  }
  back(dictionary(language).courier.msgReplied)
}
