"use server"

/**
 * Akcie riešiteľa helpdesku (ADR-028 krok 4; pod Kanálmi od D170).
 *
 * Organizácia a kanály idú z `helpdeskContext()`, nikdy z formulára: ticket
 * cudzieho kanála sa nenájde ani s uhádnutým identifikátorom (D32).
 * Odoslanie je vždy kliknutie človeka (D12); návrh pripraví asistent, text
 * odchádza taký, aký riešiteľ odoslal, a jeho kópia ostáva v tickete (D24).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { isRedirect } from "@/lib/redirects"
import { AppError } from "@/lib/appError"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { helpdeskContext } from "@/lib/helpdeskAgents"
import { mailboxFor } from "@/lib/channels"
import {
  ticketById, assignTicket, saveTicketDraft, sendTicketAnswer, closeTicket, reopenTicket, lastIncoming, faqPrefillFromTicket, importTicketThread, TicketError,
} from "@/lib/tickets"
import { draftTicketAnswer } from "@/lib/ticketDraft"
import { saveFaqEntry, checkEntry } from "@/lib/faq"

function fieldText(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[helpdesk] akcia zlyhala:", e)
  return errorText(e, language)
}

function back(id: string, message: string, error = false): never {
  revalidatePath("/channels/tickets")
  redirect(`/channels/tickets/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

async function ready() {
  const ctx = await helpdeskContext()
  if (ctx.state !== "ready") redirect("/")
  return { ...ctx, keys: ctx.channels.map(c => c.key), t: dictionary(ctx.person.language).helpdesk }
}

export async function takeTicketAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  const release = fieldText(fd, "release") === "1"
  try {
    await assignTicket(ctx.person.companyCode, ctx.keys, id, release ? null : ctx.person.id, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  back(id, release ? ctx.t.msgReleased : ctx.t.msgTaken)
}

export async function draftWithAiAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  try {
    const ticket = await ticketById(ctx.person.companyCode, ctx.keys, id)
    const channel = ticket && ctx.channels.find(c => c.key === ticket.channelKey)
    if (!ticket || !channel) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
    const r = await draftTicketAnswer(ticket, channel, {
      companyCode: ctx.person.companyCode, personId: ctx.person.id, personName: ctx.person.fullName, email: ctx.person.email,
    })
    if (r.noSources) back(id, ctx.t.aiFailed, true)
    await saveTicketDraft(ctx.person.companyCode, ctx.keys, id, { text: r.text, sources: r.sources, model: r.model })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  back(id, ctx.t.msgDrafted)
}

export async function importThreadAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  let added = 0
  try {
    const ticket = await ticketById(ctx.person.companyCode, ctx.keys, id)
    const channel = ticket && ctx.channels.find(c => c.key === ticket.channelKey)
    if (!ticket || !channel) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
    const adapter = mailboxFor(channel)
    added = await importTicketThread(ctx.person.companyCode, ctx.keys, id, ctx.person.email, ref => adapter.listThread(ref))
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  back(id, ctx.t.msgThreadImported(added))
}

export async function saveDraftAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  try {
    const ticket = await ticketById(ctx.person.companyCode, ctx.keys, id)
    if (!ticket) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
    // Zdroje a model predošlého návrhu ostávajú — mení sa len text, ktorý riešiteľ upravil.
    await saveTicketDraft(ctx.person.companyCode, ctx.keys, id, {
      text: fieldText(fd, "text"), sources: ticket.draft?.sources ?? [], model: ticket.draft?.model ?? "human",
    })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  back(id, ctx.t.msgDraftSaved)
}

export async function sendAnswerAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  try {
    const ticket = await ticketById(ctx.person.companyCode, ctx.keys, id)
    const channel = ticket && ctx.channels.find(c => c.key === ticket.channelKey)
    if (!ticket || !channel) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
    const mailbox = mailboxFor(channel)
    await sendTicketAnswer(ctx.person.companyCode, ctx.keys, id, fieldText(fd, "text"), { email: ctx.person.email, personId: ctx.person.id }, async (t, text) => {
      // E-mailový ticket: odpoveď vo vlákne na poslednú správu pýtajúceho sa.
      // Ticket z chatu vlákno nemá — ide nová správa na adresu z tokenu.
      const incoming = lastIncoming(t)
      if (t.source === "email" && incoming) return mailbox.reply(incoming.providerId, text)
      if (!t.asker.email) throw new TicketError("ticket.noRecipient", "Ticket nemá komu odpovedať — chýba adresa.")
      return mailbox.send(t.asker.email, t.subject ? `Re: ${t.subject}` : "Odpoveď helpdesku", text)
    })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  back(id, ctx.t.msgSent)
}

export async function closeTicketAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  const reopen = fieldText(fd, "reopen") === "1"
  try {
    if (reopen) await reopenTicket(ctx.person.companyCode, ctx.keys, id, ctx.person.email)
    else await closeTicket(ctx.person.companyCode, ctx.keys, id, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  if (reopen) back(id, ctx.t.msgReopened)
  // Zavretý ticket je vybavený — riešiteľ ide na zoznam po ďalší, nie späť
  // na ticket, s ktorým už nič nerobí (Ján 8. 10. 2026).
  revalidatePath("/channels/tickets")
  redirect(`/channels/tickets?msg=${encodeURIComponent(ctx.t.msgClosed)}`)
}

/** Záznam do konceptu FAQ z odpovede (D164, D167) — schváli správca obsahu postupom znenia. */
export async function ticketToFaqAction(fd: FormData) {
  const ctx = await ready()
  const id = fieldText(fd, "id")
  try {
    const ticket = await ticketById(ctx.person.companyCode, ctx.keys, id)
    if (!ticket) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
    const prefill = faqPrefillFromTicket(ticket)
    const entry = checkEntry({
      question: fieldText(fd, "question"),
      variants: fieldText(fd, "variants"),
      answer: fieldText(fd, "answer"),
      sources: prefill.sources,
      audience: fieldText(fd, "audience").split(","),
    })
    await saveFaqEntry(ctx.person.companyCode, fieldText(fd, "documentId"), {
      ...entry, id: null,
      origin: { ...prefill.origin, minedAt: new Date(), model: ticket.draft?.model ?? "human" },
    }, ctx.person.email)
  } catch (e) {
    if (isRedirect(e)) throw e
    back(id, errorMessage(e, ctx.person.language), true)
  }
  revalidatePath("/library")
  back(id, ctx.t.toFaqDone)
}

/** Najviac ticketov v jednej hromadnej akcii — zoznam ich aj tak viac neukáže. */
const BULK_MAX = 200

/**
 * Hromadná akcia nad vybranými ticketmi (Ján 8. 10. 2026): prevziať, zavrieť,
 * otvoriť znova. Každý ticket ide cez tú istú funkciu ako jednotlivo — aj
 * s bránou kanálov riešiteľa (`ctx.keys`) a auditom; cudzí ticket zlyhá
 * sám za seba a ostatné prejdú.
 */
export async function bulkTicketsAction(fd: FormData) {
  const ctx = await ready()
  const op = fieldText(fd, "op")
  const raw = fieldText(fd, "back")
  const target = raw.startsWith("/channels/") && !raw.startsWith("//") ? raw : "/channels/tickets"
  const ids = [...new Set(fd.getAll("ids").filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, BULK_MAX)
  const go = (message: string, error = false) => {
    revalidatePath("/channels/tickets")
    const sep = target.includes("?") ? "&" : "?"
    redirect(`${target}${sep}msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
  }
  if (!ids.length) go(ctx.t.bulkNone, true)
  if (op !== "close" && op !== "take" && op !== "reopen") go(ctx.t.bulkNone, true)
  let ok = 0
  let failed = 0
  for (const id of ids) {
    try {
      if (op === "close") await closeTicket(ctx.person.companyCode, ctx.keys, id, ctx.person.email)
      else if (op === "reopen") await reopenTicket(ctx.person.companyCode, ctx.keys, id, ctx.person.email)
      else await assignTicket(ctx.person.companyCode, ctx.keys, id, ctx.person.id, ctx.person.email)
      ok++
    } catch (e) {
      if (isRedirect(e)) throw e
      if (!(e instanceof AppError)) console.error("[helpdesk] hromadná akcia zlyhala:", e)
      failed++
    }
  }
  go(ctx.t.bulkDone(op as "close" | "take" | "reopen", ok, failed), failed > 0 && ok === 0)
}
