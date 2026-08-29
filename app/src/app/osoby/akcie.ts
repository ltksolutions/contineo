"use server"

/**
 * akcie.ts — zápisy zo správy osôb (D46).
 *
 * **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný;
 * to, že sa volá z formulára na chránenej stránke, nie je kontrola prístupu.
 *
 * Organizácia sa **nikdy neberie z formulára**, vždy z prihláseného človeka.
 * Keby prišla z prehliadača, personalista jedného zväzu by mohol založiť
 * alebo vyradiť človeka v druhom (D32).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { peopleContext, savePerson, invitePerson, setPersonStatus, PersonValidationError } from "@/lib/people"
import { csvNaOsoby, DOVODY } from "@/lib/personsImport"
import { previewImport, upsertPersons } from "@/lib/persons"
import type { PersonType } from "@/lib/persons"

async function personalny(): Promise<{ email: string; companyCode: string } | null> {
  const ctx = await peopleContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode }
    : null
}

function textPola(fd: FormData, meno: string): string {
  const v = fd.get(meno)
  return typeof v === "string" ? v.trim() : ""
}

function zoznamPola(fd: FormData, meno: string): string[] {
  return textPola(fd, meno).split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

function spravaChyby(e: unknown): string {
  if (e instanceof PersonValidationError) return e.message
  console.error("[osoby] akcia zlyhala:", e)
  return "Zmenu sa nepodarilo uložiť. Skús to znova."
}

export async function ulozOsobu(fd: FormData) {
  const kto = await personalny()
  if (!kto) redirect("/osoby")

  const id = textPola(fd, "id")
  let sprava = ""
  let chyba = false
  try {
    await savePerson(kto.companyCode, id, {
      email: textPola(fd, "email"),
      fullName: textPola(fd, "fullName"),
      department: textPola(fd, "department"),
      personType: (textPola(fd, "personType") || undefined) as PersonType | undefined,
      language: textPola(fd, "language") || undefined,
      tracks: zoznamPola(fd, "tracks"),
      groups: zoznamPola(fd, "groups"),
      // Zaškrtávacie políčka: neprítomná hodnota znamená „odobrať".
      roles: fd.getAll("roles").filter((r): r is string => typeof r === "string"),
    }, kto.email)
    sprava = "Uložené."
  } catch (e) {
    sprava = spravaChyby(e)
    chyba = true
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

export async function pozviOsobu(fd: FormData) {
  const kto = await personalny()
  if (!kto) redirect("/osoby")

  try {
    const osoba = await invitePerson(kto.companyCode, {
      email: textPola(fd, "email"),
      fullName: textPola(fd, "fullName"),
      department: textPola(fd, "department"),
      personType: (textPola(fd, "personType") || undefined) as PersonType | undefined,
      language: textPola(fd, "language") || undefined,
    }, kto.email)

    revalidatePath("/osoby")
    // Rovno na detail: po pozvaní nasleduje priradenie trás a skupín,
    // a hľadať toho človeka znova v zozname je zbytočný krok.
    redirect(`/osoby/${encodeURIComponent(osoba.id)}?sprava=${encodeURIComponent(
      "Pozvaná. Prihlási sa, keď si sama vyžiada odkaz alebo použije pracovné konto."
    )}`)
  } catch (e) {
    // `redirect()` vyhadzuje výnimku — nesmie sa chytiť ako chyba zápisu.
    if (e && typeof e === "object" && "digest" in e) throw e
    const q = new URLSearchParams({
      chyba: spravaChyby(e),
      email: textPola(fd, "email"),
      fullName: textPola(fd, "fullName"),
      department: textPola(fd, "department"),
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
export async function prepniStavOsoby(fd: FormData) {
  const kto = await personalny()
  if (!kto) redirect("/osoby")

  const id = textPola(fd, "id")
  const email = textPola(fd, "email")
  const naStav = textPola(fd, "status") === "inactive" ? "inactive" : "invited"
  let sprava = ""
  let chyba = false

  if (naStav === "inactive" && textPola(fd, "potvrdenie").toLowerCase() !== email.toLowerCase()) {
    sprava = `Na vyradenie napíš adresu (${email}).`
    chyba = true
  } else {
    try {
      await setPersonStatus(kto.companyCode, id, naStav, kto.email)
      sprava = naStav === "inactive"
        ? "Vyradená. Záznam a jej potvrdenia zostávajú."
        : "Vrátená. Prihlási sa a stav sa prepne sám."
    } catch (e) {
      sprava = spravaChyby(e)
      chyba = true
    }
  }

  revalidatePath("/osoby")
  redirect(`/osoby/${encodeURIComponent(id)}?sprava=${encodeURIComponent(sprava)}${chyba ? "&chyba=1" : ""}`)
}

/**
 * Náhľad importu — **čo by sa stalo, keby**.
 *
 * Nie je to voliteľná ozdoba. Nahratie stovky ľudí naslepo je presne tá
 * operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` nemá rollback.
 * Preto import bez náhľadu neexistuje ani na obrazovke, ani v skripte.
 */
export async function nahladImportu(text: string): Promise<{
  ok: boolean
  sprava?: string
  nove?: string[]
  existujuce?: string[]
  chyby?: string[]
  spolu?: number
}> {
  const kto = await personalny()
  if (!kto) return { ok: false, sprava: "Nemáš na to právo." }
  if (!text?.trim()) return { ok: false, sprava: "Súbor je prázdny." }

  // Organizácia sa doplní z prihláseného, nie zo súboru: personalista zväzu
  // nesmie importom založiť človeka do cudzej organizácie (D32).
  const osoby = csvNaOsoby(text, kto.companyCode)
  if (osoby.length === 0) {
    return { ok: false, sprava: "V súbore nie je ani jeden riadok s údajmi. Má prvý riadok hlavičky?" }
  }

  try {
    const n = await previewImport(osoby)
    return {
      ok: true,
      spolu: osoby.length,
      nove: n.created,
      existujuce: n.existing,
      chyby: n.errors.map(e => `${e.email || "(bez adresy)"} — ${DOVODY[e.reason] ?? e.reason}`),
    }
  } catch (e) {
    return { ok: false, sprava: spravaChyby(e) }
  }
}

/** Zápis. Volá sa až po náhľade, z toho istého textu. */
export async function vykonajImport(text: string): Promise<{ ok: boolean; sprava: string }> {
  const kto = await personalny()
  if (!kto) return { ok: false, sprava: "Nemáš na to právo." }

  try {
    const osoby = csvNaOsoby(text, kto.companyCode)
    const v = await upsertPersons(osoby, kto.email)
    revalidatePath("/osoby")
    return {
      ok: true,
      sprava: `Pribudlo ${v.created}, zmenených ${v.updated}, bez zmeny ${v.unchanged}` +
        (v.errors.length ? `, chybných ${v.errors.length}` : "") + ".",
    }
  } catch (e) {
    return { ok: false, sprava: spravaChyby(e) }
  }
}
