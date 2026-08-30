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
import { peopleContext, savePerson, invitePerson, setPersonStatus, PersonValidationError } from "@/lib/people"
import { csvToPersons, REASONS } from "@/lib/personsImport"
import { previewImport, upsertPersons } from "@/lib/persons"
import type { PersonType } from "@/lib/persons"

async function peopleAdmin(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await peopleContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode }
    : null
}

function fieldText(fd: FormData, actorName: string): string {
  const v = fd.get(actorName)
  return typeof v === "string" ? v.trim() : ""
}

function listField(fd: FormData, actorName: string): string[] {
  return fieldText(fd, actorName).split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

function errorMessage(e: unknown): string {
  if (e instanceof PersonValidationError) return e.message
  console.error("[osoby] akcia zlyhala:", e)
  return "Zmenu sa nepodarilo uložiť. Skús to znova."
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
    message = "Uložené."
  } catch (e) {
    message = errorMessage(e)
    error = true
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?sprava=${encodeURIComponent(message)}${error ? "&chyba=1" : ""}`)
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
    redirect(`/osoby/${encodeURIComponent(person.id)}?sprava=${encodeURIComponent(
      "Pozvaná. Prihlási sa, keď si sama vyžiada odkaz alebo použije pracovné konto."
    )}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (isRedirect(e)) throw e
    const q = new URLSearchParams({
      chyba: errorMessage(e),
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

  if (toStatus === "inactive" && fieldText(fd, "potvrdenie").toLowerCase() !== email.toLowerCase()) {
    message = `Na vyradenie napíš adresu (${email}).`
    error = true
  } else {
    try {
      await setPersonStatus(actor.companyCode, id, toStatus, actor.email)
      message = toStatus === "inactive"
        ? "Vyradená. Záznam a jej potvrdenia zostávajú."
        : "Vrátená. Prihlási sa a stav sa prepne sám."
    } catch (e) {
      message = errorMessage(e)
      error = true
    }
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?sprava=${encodeURIComponent(message)}${error ? "&chyba=1" : ""}`)
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
  sprava?: string
  nove?: string[]
  existujuce?: string[]
  chyby?: string[]
  spolu?: number
}> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, sprava: "Nemáš na to právo." }
  if (!text?.trim()) return { ok: false, sprava: "Súbor je prázdny." }

  // Organizácia sa doplní z prihláseného, nie zo súboru: personalista zväzu
  // nesmie importom založiť človeka do cudzej organizácie (D32).
  const people = csvToPersons(text, actor.companyCode)
  if (people.length === 0) {
    return { ok: false, sprava: "V súbore nie je ani jeden riadok s údajmi. Má prvý riadok hlavičky?" }
  }

  try {
    const n = await previewImport(people)
    return {
      ok: true,
      spolu: people.length,
      nove: n.created,
      existujuce: n.existing,
      chyby: n.errors.map(e => `${e.email || "(bez adresy)"} — ${REASONS[e.reason] ?? e.reason}`),
    }
  } catch (e) {
    return { ok: false, sprava: errorMessage(e) }
  }
}

/** Zápis. Volá sa až po náhľade, z toho istého textu. */
export async function runImportAction(text: string): Promise<{ ok: boolean; sprava: string }> {
  const actor = await peopleAdmin()
  if (!actor) return { ok: false, sprava: "Nemáš na to právo." }

  try {
    const people = csvToPersons(text, actor.companyCode)
    const v = await upsertPersons(people, actor.email)
    revalidatePath("/osoby")
    return {
      ok: true,
      sprava: `Pribudlo ${v.created}, zmenených ${v.updated}, bez zmeny ${v.unchanged}` +
        (v.errors.length ? `, chybných ${v.errors.length}` : "") + ".",
    }
  } catch (e) {
    return { ok: false, sprava: errorMessage(e) }
  }
}
