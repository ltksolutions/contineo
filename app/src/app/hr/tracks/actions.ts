"use server"

/**
 * actions.ts — skladanie trás onboardingu (rozsah C).
 *
 * Bránou je `trackManagerContext()` — personalista alebo správca obsahu
 * (od 2. 10. 2026 sú trasy v Pridelených dokumentoch, dovtedy v knižnici).
 * `companyCode` je z prihláseného človeka, nikdy z formulára (D32).
 *
 * Kroky sa **ukladajú celé**, nie po jednom. Pridanie, odobranie aj posun sú
 * tu len tri spôsoby, ako zostaviť to isté pole — a `setTrackSteps()` ho
 * očísluje podľa poradia. Prírastkové operácie („posuň tretí krok o jedna")
 * by znamenali druhé miesto, kde sa počíta poradie, a to sa raz rozíde
 * s prvým.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { trackManagerContext } from "@/lib/hr"
import { isRedirect } from "@/lib/redirects"
import { createTrack, renameTrack, setTrackSteps, setTrackActive, addTrackMembers, removeTrackMember, type StepInput } from "@/lib/tracks"
import { dictionary, errorText, type UiLanguage } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import { trackRecipients } from "@/lib/trackNotify"
import { send, reminderEmail } from "@/lib/ecomail"
import { writeAudit } from "@/lib/audit"
import { brandingView } from "@/lib/tenants"
import { requestHostname } from "@/lib/session"
import { normalizeLanguage, formatDate } from "@/lib/i18n"

async function actor(): Promise<{ email: string; companyCode: string; language: UiLanguage } | null> {
  const ctx = await trackManagerContext()
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

  try {
    // Kľúč vygeneruje server (UUID, 2. 10. 2026) — z formulára prichádza len názov.
    const key = await createTrack(
      self.companyCode,
      { title: text(fd, "title"), description: text(fd, "description") || undefined },
      self.email,
    )
    revalidatePath("/hr/tracks")
    // Rovno do detailu: po založení nasleduje skladanie krokov a hľadať
    // novú trasu v zozname je zbytočný krok.
    back(`/hr/tracks/${encodeURIComponent(key)}`, { msg: say(self.language).created })
  } catch (e) {
    if (isRedirect(e)) throw e
    back("/hr/tracks", { error: message(e, self.language), title: text(fd, "title") })
  }
}

export async function renameTrackAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const to = `/hr/tracks/${encodeURIComponent(key)}`
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
  const to = `/hr/tracks/${encodeURIComponent(key)}`
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
  const to = `/hr/tracks/${encodeURIComponent(key)}`
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

/**
 * Pridá na trasu vybrané osoby a dnešných členov vybraných oddelení
 * (2. 10. 2026). Hodnoty prichádzajú z výberu — `person` je `persons.id`,
 * `department` je `id` oddelenia; overuje ich `addTrackMembers()` proti
 * organizácii prihláseného.
 */
export async function addMembersAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const to = `/hr/tracks/${encodeURIComponent(key)}`
  const values = (name: string) => fd.getAll(name).filter((v): v is string => typeof v === "string" && v.trim() !== "")
  try {
    const r = await addTrackMembers(
      self.companyCode, key,
      { personIds: values("person"), departmentIds: values("department") },
      self.email,
    )
    revalidatePath(to)
    revalidatePath("/documents")
    back(to, { msg: say(self.language).membersAdded(r.added, r.already) })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(to, { error: message(e, self.language) })
  }
}

/** Odoberie jednu osobu z trasy. Potvrdenia ostávajú (D24). */
export async function removeMemberAction(fd: FormData) {
  const self = await actor()
  if (!self) redirect("/")

  const key = text(fd, "key")
  const to = `/hr/tracks/${encodeURIComponent(key)}`
  try {
    await removeTrackMember(self.companyCode, key, text(fd, "personId"), self.email)
    revalidatePath(to)
    revalidatePath("/documents")
    back(to, { msg: say(self.language).memberRemoved })
  } catch (e) {
    if (isRedirect(e)) throw e
    back(to, { error: message(e, self.language) })
  }
}

/** Koľko e-mailov naraz — ako pri prideleniach v `/hr`. */
const CONCURRENCY = 5

/**
 * Dá ľuďom na trase vedieť e-mailom (2. 10. 2026). **Len tým, ktorí z trasy
 * ešte niečo nepotvrdili**, a len o tom, čo im chýba — zoznam sa prepočíta
 * tu znova, neberie sa z formulára (medzi náhľadom a kliknutím mohol niekto
 * potvrdiť). Jeden e-mail na človeka so všetkými dokumentmi.
 */
export async function sendTrackNotificationAction(fd: FormData) {
  const ctx = await trackManagerContext()
  if (ctx.state !== "ready") redirect("/")
  const key = text(fd, "key")
  const to = `/hr/tracks/${encodeURIComponent(key)}`
  const t = dictionary(ctx.person.language).hr.actions

  const found = await trackRecipients(ctx.person.companyCode, key)
  if (!found) redirect("/hr/tracks")
  if (found.recipients.length === 0) back(to, { error: t.nobodyToNotify })

  const host = await requestHostname()
  const branding = brandingView(ctx.tenant)
  const link = `https://${host}/documents`
  let sent = 0
  const failed: string[] = []
  for (let i = 0; i < found.recipients.length; i += CONCURRENCY) {
    await Promise.all(found.recipients.slice(i, i + CONCURRENCY).map(async r => {
      try {
        await send({
          to: r.person.email,
          ...reminderEmail(
            link, host,
            r.open.map(d => ({
              title: d.documentTitle, versionLabel: d.versionLabel, days: 0,
              effectiveFrom: d.effectiveFrom ? formatDate(d.effectiveFrom, normalizeLanguage(r.person.language)) : undefined,
            })),
            normalizeLanguage(r.person.language), branding, "notice",
          ),
        })
        sent++
      } catch (e) {
        console.error(`[trasy] e-mail na ${r.person.email} zlyhal:`, e)
        failed.push(r.person.email)
      }
    }))
  }
  if (sent > 0) {
    await writeAudit({
      companyCode: ctx.person.companyCode, subject: "track", action: "notified",
      actor: ctx.person.email, targetId: found.track.key, targetLabel: found.track.title,
      note: t.sent(sent),
    })
  }
  const message = failed.length === 0
    ? t.sent(sent)
    : t.sentWithFailures(sent, `(${failed.length}) ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`)
  back(to, failed.length ? { msg: message, error: "1" } : { msg: message })
}

