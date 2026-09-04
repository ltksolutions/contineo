"use server"

/**
 * actions.ts — zápisy zo správy osôb (D46).
 *
 * **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný;
 * to, že sa volá z formulára na chránenej stránke, nie je kontrola prístupu.
 *
 * Organizácia sa **nikdy neberie z formulára**, vždy z prihláseného človeka.
 * Keby prišla z prehliadača, personalista jedného zväzu by mohol založiť
 * alebo vyradiť človeka v druhom (D32).
 */

import { redirect } from "next/navigation"
import { isRedirect } from "@/lib/redirects"
import { revalidatePath } from "next/cache"
import { peopleContext, savePerson, invitePerson, setPersonStatus } from "@/lib/people"
import { csvToPersons } from "@/lib/personsImport"
import { previewImport, upsertPersons } from "@/lib/persons"
import type { PersonType } from "@/lib/persons"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

async function peopleAdmin(): Promise<
  { email: string; companyCode: string; language: UiLanguage } | null
> {
  const ctx = await peopleContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }
    : null
}

/** Hlásenia v jazyku prihláseného človeka. */
function say(language: UiLanguage) {
  return dictionary(language).people.actions
}

/** Kým nevieme, kto sa pýta, nevieme ani v akom jazyku — predvolený. */
const NO_RIGHT = dictionary(undefined).people.actions.noRight

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

function listField(fd: FormData, actorName: string): string[] {
  return fieldText(fd, actorName).split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

function errorMessage(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[osoby] akcia zlyhala:", e)
  return errorText(e, language)
}

export async function savePersonAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/osoby")

  const id = fieldText(fd, "id")
  let message = ""
  let error = false
  try {
    await savePerson(actor.companyCode, id, {
      email: fieldText(fd, "email"),
      fullName: fieldText(fd, "fullName"),
      // Voľba „— bez oddelenia —" má prázdnu hodnotu a znamená vyradiť zo
      // štruktúry, nie „nemeniť". Preto `|| null`, nie `|| undefined`.
      departmentId: fieldText(fd, "departmentId") || null,
      jobTitle: fieldText(fd, "jobTitle"),
      personType: (fieldText(fd, "personType") || undefined) as PersonType | undefined,
      language: fieldText(fd, "language") || undefined,
      tracks: listField(fd, "tracks"),
      groups: listField(fd, "groups"),
      // Zaškrtávacie políčka: neprítomná hodnota znamená „odobrať".
      roles: fd.getAll("roles").filter((r): r is string => typeof r === "string"),
    }, actor.email)
    message = say(actor.language).saved
  } catch (e) {
    message = errorMessage(e, actor.language)
    error = true
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

export async function invitePersonAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/osoby")

  try {
    const person = await invitePerson(actor.companyCode, {
      email: fieldText(fd, "email"),
      fullName: fieldText(fd, "fullName"),
      department: fieldText(fd, "department"),
      personType: (fieldText(fd, "personType") || undefined) as PersonType | undefined,
      language: fieldText(fd, "language") || undefined,
    }, actor.email)

    revalidatePath("/osoby")
    // Rovno na detail: po pozvaní nasleduje priradenie trás a skupín,
    // a hľadať toho človeka znova v zozname je zbytočný krok.
    redirect(`/osoby/${encodeURIComponent(person.id)}?msg=${encodeURIComponent(
      say(actor.language).invited,
    )}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (isRedirect(e)) throw e
    const q = new URLSearchParams({
      error: errorMessage(e, actor.language),
      email: fieldText(fd, "email"),
      fullName: fieldText(fd, "fullName"),
      department: fieldText(fd, "department"),
    })
    redirect(`/osoby/nova?${q.toString()}`)
  }
}

/**
 * Vyradí alebo vráti osobu.
 *
 * Vyradenie si vyžiada napísanie adresy. Je to jediná zmena, ktorá človeka
 * okamžite odstrihne od portálu; obyčajné „naozaj?" sa odklikne skôr, než sa
 * prečíta. Vrátenie potvrdenie nepotrebuje — nič sa ním nestráca.
 */
export async function togglePersonStatusAction(fd: FormData) {
  const actor = await peopleAdmin()
  if (!actor) redirect("/osoby")

  const id = fieldText(fd, "id")
  const email = fieldText(fd, "email")
  const toStatus = fieldText(fd, "status") === "inactive" ? "inactive" : "invited"
  let message = ""
  let error = false

  if (toStatus === "inactive" && fieldText(fd, "confirmation").toLowerCase() !== email.toLowerCase()) {
    message = say(actor.language).confirmAddress(email)
    error = true
  } else {
    try {
      await setPersonStatus(actor.companyCode, id, toStatus, actor.email)
      message = toStatus === "inactive"
        ? say(actor.language).excluded
        : say(actor.language).returned
    } catch (e) {
      message = errorMessage(e, actor.language)
      error = true
    }
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/**
 * Náhľad importu — **čo by sa stalo, keby**.
 *
 * Nie je to voliteľná ozdoba. Nahratie stovky ľudí naslepo je presne tá
 * operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` nemá rollback.
 * Preto import bez náhľadu neexistuje ani na obrazovke, ani v skripte.
 */
export async function previewImportAction(text: string): Promise<{
  ok: boolean
  message?: string
  created?: string[]
  existing?: string[]
  errors?: string[]
  total?: number
}> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, message: NO_RIGHT }
  if (!text?.trim()) return { ok: false, message: say(actor.language).fileEmpty }

  // Organizácia sa doplní z prihláseného, nie zo súboru: personalista zväzu
  // nesmie importom založiť človeka do cudzej organizácie (D32).
  const people = csvToPersons(text, actor.companyCode)
  if (people.length === 0) {
    return { ok: false, message: say(actor.language).noRows }
  }

  try {
    const n = await previewImport(people)
    return {
      ok: true,
      total: people.length,
      created: n.created,
      existing: n.existing,
      errors: n.errors.map(e =>
        `${e.email || "—"} — ${dictionary(actor.language).people.import.reasons[e.reason] ?? e.reason}`),
    }
  } catch (e) {
    return { ok: false, message: errorMessage(e, actor.language) }
  }
}

/** Zápis. Volá sa až po náhľade, z toho istého textu. */
export async function runImportAction(text: string): Promise<{ ok: boolean; message: string }> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, message: NO_RIGHT }

  try {
    const people = csvToPersons(text, actor.companyCode)
    const v = await upsertPersons(people, actor.email)
    revalidatePath("/osoby")
    return {
      ok: true,
      message: say(actor.language).importResult(v.created, v.updated, v.unchanged, v.errors.length),
    }
  } catch (e) {
    return { ok: false, message: errorMessage(e, actor.language) }
  }
}
