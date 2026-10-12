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
import {
  createDirectThread, replyToAnnouncement, createAnnouncement, announcementRecipients,
  canAnnounce, saveDraft, clearDraft, CourierError,
} from "@/lib/courier"
import { audienceFromSelection } from "@/lib/assignments"
import { audienceSignature } from "@/lib/assignSummary"
import { allDepartments } from "@/lib/departments"
import { trackNames } from "@/lib/tracks"
import { loadPersonById } from "@/lib/people"
import { getCollection } from "@/lib/mongodb"
import { PERSONS_COLLECTION, type Person } from "@/lib/persons"
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

function audienceValues(fd: FormData): string[] {
  return fd.getAll("audience").filter((v): v is string => typeof v === "string")
}

/**
 * Krok „Skontrolovať príjemcov" (R2): nič sa neodošle. Výber, predmet a text
 * sa odložia do konceptu a stránka ukáže, komu presne to pôjde.
 */
export async function previewAnnouncementAction(fd: FormData) {
  const ctx = await ready()
  if (!canAnnounce(ctx.person)) redirect("/courier")
  await saveDraft({
    companyCode: ctx.person.companyCode,
    personId: ctx.person.id,
    all: fd.get("all") === "1",
    audience: audienceValues(fd),
    subject: fieldText(fd, "subject"),
    text: typeof fd.get("text") === "string" ? String(fd.get("text")) : "",
  })
  redirect("/courier/announce?preview=1")
}

/**
 * Odoslanie oznamu. Príjemcovia sa rátajú **znova z formulára**, nie z toho,
 * čo videl náhľad — a podpis výberu musí sedieť s tým, ktorý náhľad potvrdil.
 * Kto po náhľade zmení publikum, dostane náhľad znova, nie odoslanie.
 */
export async function sendAnnouncementAction(fd: FormData) {
  const ctx = await ready()
  const language = ctx.person.language
  const t = dictionary(language).courier
  const subject = fieldText(fd, "subject")
  const text = typeof fd.get("text") === "string" ? String(fd.get("text")) : ""
  const selection = { all: fd.get("all") === "1", audience: audienceValues(fd), addresses: "" }

  let threadId = ""
  let count = 0
  try {
    if (!canAnnounce(ctx.person)) throw new CourierError("courier.notAllowed", "Oznam skupine môže poslať len správca osôb, HR alebo správca obsahu.")
    if (fieldText(fd, "confirmed") !== audienceSignature(selection)) {
      await saveDraft({ companyCode: ctx.person.companyCode, personId: ctx.person.id, all: selection.all, audience: selection.audience, subject, text })
      redirect(`/courier/announce?preview=1&error=${encodeURIComponent(t.recipientsChanged)}`)
    }
    const [tree, names] = await Promise.all([allDepartments(ctx.person.companyCode), trackNames(ctx.person.companyCode)])
    const audiences = audienceFromSelection({
      all: selection.all,
      selected: selection.audience,
      departmentNames: Object.fromEntries(tree.map(o => [o.id, o.name])),
      trackNames: names,
    })
    const from = { personId: ctx.person.id, email: ctx.person.email, name: ctx.person.fullName }
    const recipients = await announcementRecipients(ctx.person.companyCode, audiences, ctx.person.id)
    count = recipients.length
    threadId = await createAnnouncement({ companyCode: ctx.person.companyCode, from, audiences, recipients, subject, text })
    await clearDraft(ctx.person.companyCode, ctx.person.id)
  } catch (e) {
    if (isRedirect(e)) throw e
    await saveDraft({ companyCode: ctx.person.companyCode, personId: ctx.person.id, all: selection.all, audience: selection.audience, subject, text })
    redirect(`/courier/announce?preview=1&error=${encodeURIComponent(errorMessage(e, language))}`)
  }
  revalidatePath("/", "layout")
  redirect(`/courier/${encodeURIComponent(threadId)}?msg=${encodeURIComponent(t.msgAnnounced(count))}`)
}

/**
 * Ranný súhrn zapnúť/vypnúť (D207) — jediné nastavenie, ktoré si osoba
 * mení sama; je v plachte účtu v hlavičke. Vracia nový stav.
 */
export async function setCourierDigestAction(on: boolean): Promise<boolean> {
  const ctx = await ready()
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  await col.updateOne({ companyCode: ctx.person.companyCode, id: ctx.person.id }, { $set: { courierDigest: on } })
  return on
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
  // Pri ozname ide odpoveď príjemcu súkromne autorovi (D205) — do iného
  // vlákna; preto sa po odoslaní otvorí to, kam odpoveď naozaj išla.
  let target = id
  try {
    target = await replyToAnnouncement({
      companyCode: ctx.person.companyCode,
      threadId: id,
      author: { personId: ctx.person.id, email: ctx.person.email, name: ctx.person.fullName },
      text,
    })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(errorMessage(e, language), true)
  }
  revalidatePath("/", "layout")
  redirect(`/courier/${encodeURIComponent(target)}?msg=${encodeURIComponent(dictionary(language).courier.msgReplied)}`)
}
