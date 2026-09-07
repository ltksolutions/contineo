"use server"

/**
 * actions.ts — skladanie trás onboardingu (rozsah C).
 *
 * Rovnaká zásada ako v knižnici: bránou je `libraryContext()`, `companyCode`
 * je z prihláseného človeka, nikdy z formulára (D32).
 *
 * Kroky sa **ukladajú celé**, nie po jednom. Pridanie, odobranie aj posun sú
 * tu len tri spôsoby, ako zostaviť to isté pole — a `setTrackSteps()` ho
 * očísluje podľa poradia. Prírastkové operácie („posuň tretí krok o jedna")
 * by znamenali druhé miesto, kde sa počíta poradie, a to sa raz rozíde
 * s prvým.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { libraryContext } from "@/lib/library"
import { isRedirect } from "@/lib/redirects"
import { createTrack, renameTrack, setTrackSteps, setTrackActive, type StepInput } from "@/lib/tracks"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

async function actor(): Promise<{ email: string; companyCode: string; language: UiLanguage } | null> {
  const ctx = await libraryContext()
  return ctx.state === "ready"
    ? { email: ctx.person.email, companyCode: ctx.person.companyCode, language: ctx.person.language }
    : null
}

function text(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function say(language: UiLanguage) {
  return dictionary(language).library.tracks
}

function message(e: unknown, language: UiLanguage): string {
  if (!(e instanceof AppError)) console.error("[trasy] akcia zlyhala:", e)
  return errorText(e, language)
}

/** Späť na tú istú obrazovku so správou — oboje ide cez adresu, nie cez stav. */
function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`)
}

export async function createTrackAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  try {
    await createTrack(
      self.companyCode,
      { key, title: text(fd, "title"), description: text(fd, "description") || undefined },
      self.email,
    )
    revalidatePath("/library/tracks")
    // Rovno do detailu: po založení nasleduje skladanie krokov a hľadať
    // novú trasu v zozname je zbytočný krok.
    back(`/library/tracks/${encodeURIComponent(key.toLowerCase())}`, { msg: say(self.language).created })
  } catch (e) {
    if (isRedirect(e)) throw e
    back("/library/tracks", { error: message(e, self.language), key, title: text(fd, "title") })
  }
}

export async function renameTrackAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const to = `/library/tracks/${encodeURIComponent(key)}`
  try {
    await renameTrack(
      self.companyCode, key,
      { title: text(fd, "title"), description: text(fd, "description") || undefined },
      self.email,
    )
    revalidatePath(to)
    back(to, { msg: say(self.language).renamed })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(to, { error: message(e, self.language) })
  }
}

/**
 * Prepíše kroky podľa toho, čo prišlo z formulára, a k tomu vykoná jednu
 * zmenu: pridanie, odobranie alebo posun.
 *
 * Poradie prichádza z formulára, nie z databázy — inak by sa dve zmeny
 * v dvoch záložkách navzájom potichu prepísali podľa toho, ktorá dobehla
 * druhá.
 */
async function editSteps(
  fd: FormData,
  change: (steps: StepInput[]) => StepInput[],
) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const to = `/library/tracks/${encodeURIComponent(key)}`
  try {
    const ids = fd.getAll("stepDocumentId").filter((v): v is string => typeof v === "string")
    const acks = new Set(fd.getAll("stepAck").filter((v): v is string => typeof v === "string"))
    const current: StepInput[] = ids.map(documentId => ({
      documentId,
      requiresAcknowledgement: acks.has(documentId),
    }))

    await setTrackSteps(self.companyCode, key, change(current), self.email)
    revalidatePath(to)
    revalidatePath("/documents")
    back(to, { msg: say(self.language).stepsSaved })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(to, { error: message(e, self.language) })
  }
}

export async function addStepAction(fd: FormData) {
  const documentId = text(fd, "documentId")
  const requiresAcknowledgement = fd.get("requiresAcknowledgement") !== null
  // Prázdny výber nie je chyba, len nič — človek odoslal formulár, ktorý
  // nevyplnil, a hláška „vyber dokument" mu nepovie viac než prázdny zoznam.
  return editSteps(fd, steps =>
    documentId ? [...steps, { documentId, requiresAcknowledgement }] : steps,
  )
}

export async function removeStepAction(fd: FormData) {
  const documentId = text(fd, "documentId")
  return editSteps(fd, steps => steps.filter(s => s.documentId !== documentId))
}

export async function moveStepAction(fd: FormData) {
  const documentId = text(fd, "documentId")
  const up = text(fd, "direction") === "up"
  return editSteps(fd, steps => {
    const i = steps.findIndex(s => s.documentId === documentId)
    const j = up ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= steps.length) return steps
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
}

export async function setTrackActiveAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const isActive = text(fd, "isActive") === "1"
  const to = `/library/tracks/${encodeURIComponent(key)}`
  try {
    await setTrackActive(self.companyCode, key, isActive, self.email)
    revalidatePath(to)
    revalidatePath("/documents")
    back(to, { msg: isActive ? say(self.language).enabled : say(self.language).disabled })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(to, { error: message(e, self.language) })
  }
}
