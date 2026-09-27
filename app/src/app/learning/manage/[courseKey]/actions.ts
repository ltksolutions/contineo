"use server"

/**
 * Akcie úpravy kurzu (rám MANAGE-COURSE). Rola `learning-admin` sa overuje
 * v každej akcii. Menia sa len **koncepty** — `saveDraft` má v podmienke
 * stav `draft`, zverejnená verzia sa nezmení ani súbežným klikom (D118).
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { learningAdminContext } from "@/lib/learning"
import { archiveCourse, getCourse, publishCourse, saveCourseSettings, saveDraft, startNewVersion } from "@/lib/coursesDb"
import { findTopic } from "@/lib/learningTopics"
import { readyTestVersions } from "@/lib/testsDb"
import { revokeCertificate } from "@/lib/certificatesDb"
import { assignCourse } from "@/lib/enrollmentsDb"
import { audienceFromSelection } from "@/lib/assignments"
import { allDepartments } from "@/lib/departments"
import { parseSmartTags } from "@/lib/smartTags"
import { findLegalBasisOption } from "@/lib/legalBases"
import { draftVersion, type ContentBlock, type Part } from "@/lib/courses"
import { addBlock, addPart, addPartTest, DraftError, moveBlock, movePart, removeBlock, removePart, removePartTest, setPartTestRequired, updateBlock, updatePart } from "@/lib/courseDraft"
import { documentChoices } from "@/lib/courseDocs"
import { embedUrl } from "@/lib/courseView"
import { AppError } from "@/lib/appError"
import { dictionary, errorText, UI_LANGUAGES } from "@/lib/i18n"

function field(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

async function admin() {
  const ctx = await learningAdminContext()
  if (ctx.state !== "ready") redirect("/")
  return ctx
}

function go(courseKey: string, query: string, message?: string, error = false): never {
  const base = `/learning/manage/${courseKey}`
  revalidatePath(base)
  const msg = message ? `${query ? "&" : ""}msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}` : ""
  redirect(`${base}${query || msg ? "?" : ""}${query}${msg}`)
}

/** Úprava častí konceptu: načítať, zmeniť čistou funkciou, zapísať. */
async function editParts(fd: FormData, change: (parts: Part[]) => Part[], query: (fd: FormData) => string) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  const course = await getCourse(ctx.person.companyCode, courseKey)
  if (!course) redirect("/learning/manage")
  const draft = draftVersion(course)
  try {
    if (!draft) throw new DraftError("learning.noDraft", "Kurz nemá koncept.", { key: courseKey })
    await saveDraft(ctx.person.companyCode, courseKey, { parts: change(draft.parts) }, ctx.person.email)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] úprava konceptu zlyhala:", e)
    go(courseKey, query(fd), errorText(e, ctx.person.language), true)
  }
  go(courseKey, query(fd))
}

const partsTab = () => "tab=parts"
const partTab = (fd: FormData) => `tab=parts&part=${encodeURIComponent(field(fd, "partKey"))}`
const dir = (fd: FormData): "up" | "down" => (field(fd, "dir") === "up" ? "up" : "down")

export async function addPartAction(fd: FormData) {
  await editParts(fd, parts => addPart(parts, field(fd, "title"), fd.get("required") === "1"), partsTab)
}

export async function movePartAction(fd: FormData) {
  await editParts(fd, parts => movePart(parts, field(fd, "partKey"), dir(fd)), partsTab)
}

export async function updatePartAction(fd: FormData) {
  const minutes = Number(field(fd, "estimatedMinutes"))
  await editParts(fd, parts => updatePart(parts, field(fd, "partKey"), {
    title: field(fd, "title"),
    required: fd.get("required") === "1",
    summary: field(fd, "summary"),
    estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
  }), partTab)
}

export async function removePartAction(fd: FormData) {
  await editParts(fd, parts => removePart(parts, field(fd, "partKey")), partsTab)
}

export async function moveBlockAction(fd: FormData) {
  await editParts(fd, parts => moveBlock(parts, field(fd, "partKey"), field(fd, "blockId"), dir(fd)), partTab)
}

export async function removeBlockAction(fd: FormData) {
  await editParts(fd, parts => removeBlock(parts, field(fd, "partKey"), field(fd, "blockId")), partTab)
}

function providerOf(url: string): "youtube" | "vimeo" | "stream" {
  if (/youtu\.?be/.test(url)) return "youtube"
  if (/vimeo\.com/.test(url)) return "vimeo"
  return "stream"
}

/** Blok z formulára „Pridať blok". Súbory sú už nahraté (`fileIds`). */
async function blockFrom(fd: FormData, companyCode: string): Promise<ContentBlock> {
  const id = crypto.randomUUID()
  const ids = field(fd, "fileIds").split(",").map(s => s.trim()).filter(Boolean)
  switch (field(fd, "type")) {
    case "image":
      if (!ids[0]) throw new DraftError("learning.fileRequired", "Najprv nahrajte súbor.")
      return { id, type: "image", fileId: ids[0], alt: field(fd, "alt"), caption: field(fd, "caption") || undefined }
    case "gallery": {
      if (!ids.length) throw new DraftError("learning.fileRequired", "Najprv nahrajte súbor.")
      const alt = field(fd, "alt")
      return { id, type: "gallery", items: ids.map((fileId, i) => ({ fileId, alt: alt ? (ids.length > 1 ? `${alt} ${i + 1}` : alt) : "" })) }
    }
    case "document": {
      const [documentId, versionId] = field(fd, "document").split("|")
      const choice = (await documentChoices(companyCode)).find(c => c.documentId === documentId && c.versionId === versionId)
      if (!choice) throw new DraftError("learning.documentRequired", "Vyberte dokument z knižnice.")
      return { id, type: "document", documentId, versionId, title: choice.title }
    }
    case "video": {
      if (field(fd, "source") === "external") {
        const url = field(fd, "url")
        const provider = providerOf(url)
        if (!embedUrl(provider, url)) throw new DraftError("learning.urlInvalid", "Adresa videa nie je platná.")
        return { id, type: "video", source: { kind: "external", provider, url }, mustWatch: false }
      }
      if (!ids[0]) throw new DraftError("learning.fileRequired", "Najprv nahrajte súbor.")
      const duration = Number(field(fd, "durationSec"))
      return {
        id, type: "video", source: { kind: "internal", assetId: ids[0] }, mustWatch: fd.get("mustWatch") === "1",
        durationSec: Number.isFinite(duration) && duration > 0 ? duration : undefined,
      }
    }
    default:
      return { id, type: "text", markdown: field(fd, "markdown") }
  }
}

export async function addBlockAction(fd: FormData) {
  const ctx = await admin()
  let block: ContentBlock
  try {
    block = await blockFrom(fd, ctx.person.companyCode)
  } catch (e) {
    go(field(fd, "courseKey"), `${partTab(fd)}&add=${encodeURIComponent(field(fd, "type"))}`, errorText(e, ctx.person.language), true)
  }
  await editParts(fd, parts => addBlock(parts, field(fd, "partKey"), block), partTab)
}

/** Úprava bloku na mieste: text, popisy obrázka, povinné dopozeranie. */
export async function updateBlockAction(fd: FormData) {
  await editParts(fd, parts => updateBlock(parts, field(fd, "partKey"), field(fd, "blockId"), b => {
    if (b.type === "text") return { ...b, markdown: field(fd, "markdown") || b.markdown }
    if (b.type === "image") return { ...b, alt: field(fd, "alt") || b.alt, caption: field(fd, "caption") || undefined }
    if (b.type === "video") return { ...b, mustWatch: fd.get("mustWatch") === "1" }
    return b
  }), partTab)
}

export async function publishAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  const t = dictionary(ctx.person.language).learning.edit
  // Zmrazia sa verzie testov v stave `ready` (D118); iný test zverejnenie zastaví.
  const r = await publishCourse(ctx.person.companyCode, courseKey, ctx.person.email, await readyTestVersions(ctx.person.companyCode))
  go(courseKey, "", r.ok ? t.published(r.version.version) : t.cannotPublish, !r.ok)
}

export async function newVersionAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  const t = dictionary(ctx.person.language).learning.edit
  let version = 0
  try {
    version = (await startNewVersion(ctx.person.companyCode, courseKey, ctx.person.email)).version
  } catch (e) {
    go(courseKey, "", errorText(e, ctx.person.language), true)
  }
  go(courseKey, "tab=parts", t.newVersionStarted(version))
}

export async function archiveAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  try {
    await archiveCourse(ctx.person.companyCode, courseKey, ctx.person.email)
  } catch (e) {
    go(courseKey, "", errorText(e, ctx.person.language), true)
  }
  go(courseKey, "", dictionary(ctx.person.language).learning.edit.archived)
}

/**
 * Nastavenia kurzu (záložka Nastavenia). Polia verzie idú do konceptu,
 * téma, smart:tagy, jazyk a samozápis na kurz — len keď je koncept
 * (zverejnená verzia je len na čítanie, rám MANAGE-COURSE).
 */
export async function saveSettingsAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  const te = dictionary(ctx.person.language).learning.edit
  const course = await getCourse(ctx.person.companyCode, courseKey)
  if (!course) redirect("/learning/manage")
  try {
    if (!draftVersion(course)) throw new DraftError("learning.noDraft", "Kurz nemá koncept.", { key: courseKey })
    const topic = findTopic(ctx.tenant, field(fd, "topicKey"))
    if (!topic) throw new AppError("learning.topicRequired", "Vyberte tému kurzu.")
    const { tags, invalid } = parseSmartTags(field(fd, "smartTags"))
    if (invalid.length) throw new AppError("learning.tagShape", "", { value: invalid[0] })
    const language = (UI_LANGUAGES as readonly string[]).includes(field(fd, "language")) ? field(fd, "language") : course.language
    const legal = field(fd, "legalBasisKey") ? findLegalBasisOption(ctx.tenant, field(fd, "legalBasisKey")) : null
    const minutes = Number(field(fd, "estimatedMinutes"))
    const issues = fd.get("issuesCertificate") === "1"
    const b = ctx.tenant.branding
    await saveDraft(ctx.person.companyCode, courseKey, {
      title: field(fd, "title"),
      subtitle: field(fd, "subtitle") || null,
      description: field(fd, "description") || null,
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
      sequential: fd.get("sequential") === "1",
      issuesCertificate: issues,
      // Vydavateľ = organizácia sama (D122), kópia v čase uloženia.
      issuer: issues ? { kind: "tenant", name: b.displayName, shortName: b.shortName, logoUrl: b.logoUrl || undefined } : null,
      signer: field(fd, "signerName") ? { name: field(fd, "signerName"), role: field(fd, "signerRole") } : null,
      legalBasisKey: legal?.key ?? null,
      legalBasisLabel: legal?.label ?? null,
    }, ctx.person.email)
    await saveCourseSettings(ctx.person.companyCode, courseKey, {
      topicKey: topic.key, topicLabel: topic.label, smartTags: tags, openEnrollment: fd.get("openEnrollment") === "1", language,
    }, ctx.person.email)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] uloženie nastavení zlyhalo:", e)
    go(courseKey, "tab=settings", errorText(e, ctx.person.language), true)
  }
  go(courseKey, "tab=settings", te.settingsSaved)
}

/**
 * Prideliť kurz (záložka Zapísaní, `?assign=1`) — ten istý výber adresátov
 * ako pri norme (`audienceFromSelection`, `matchesAudience`). Trasa ostáva
 * (MANAGE-COURSE Q2 ✅): zapíše ľudí, ktorí trasu majú.
 */
export async function assignCourseAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  const tp = dictionary(ctx.person.language).learning.people
  const departmentNames = Object.fromEntries((await allDepartments(ctx.person.companyCode)).map(d => [d.id, d.name]))
  const audiences = audienceFromSelection({ all: fd.get("all") === "1", selected: fd.getAll("audience").map(String), departmentNames })
  let result = { created: 0, existing: 0 }
  try {
    if (!audiences.length) throw new AppError("learning.audienceRequired", "Vyberte adresátov.")
    result = await assignCourse(ctx.person.companyCode, courseKey, audiences, { email: ctx.person.email, fullName: ctx.person.fullName })
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] pridelenie kurzu zlyhalo:", e)
    go(courseKey, "tab=people&assign=1", errorText(e, ctx.person.language), true)
  }
  go(courseKey, "tab=people", tp.assigned(result.created, result.existing))
}

/** Priradiť hotový test k časti (len `ready`, rám MANAGE-COURSE). */
export async function addPartTestAction(fd: FormData) {
  const ctx = await admin()
  const testKey = field(fd, "testKey")
  const ready = await readyTestVersions(ctx.person.companyCode)
  if (!ready.has(testKey)) go(field(fd, "courseKey"), partTab(fd), errorText(new AppError("attempt.testNotFound", ""), ctx.person.language), true)
  await editParts(fd, parts => addPartTest(parts, field(fd, "partKey"), testKey, fd.get("required") === "1"), partTab)
}

export async function removePartTestAction(fd: FormData) {
  await editParts(fd, parts => removePartTest(parts, field(fd, "partKey"), field(fd, "testKey")), partTab)
}

export async function partTestRequiredAction(fd: FormData) {
  await editParts(fd, parts => setPartTestRequired(parts, field(fd, "partKey"), field(fd, "testKey"), fd.get("required") === "1"), partTab)
}

/** Odvolať certifikát (CERTIFICATE Q3 ✅): lektor, povinný dôvod, nevratné, audit. */
export async function revokeCertificateAction(fd: FormData) {
  const ctx = await admin()
  const courseKey = field(fd, "courseKey")
  try {
    await revokeCertificate(ctx.person.companyCode, field(fd, "enrollmentId"), field(fd, "reason"), ctx.person.email)
  } catch (e) {
    go(courseKey, `tab=people&revoke=${encodeURIComponent(field(fd, "enrollmentId"))}`, errorText(e, ctx.person.language), true)
  }
  go(courseKey, "tab=people", dictionary(ctx.person.language).learning.cert.revokedMsg)
}
