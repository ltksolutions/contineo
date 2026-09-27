"use server"

/**
 * Akcie správy kurzov (rám MANAGE). Rola `learning-admin` sa overuje v každej
 * akcii — akcia je verejná adresa a formulár sa dá odoslať aj odinakiaľ.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { learningAdminContext } from "@/lib/learning"
import { createCourse } from "@/lib/coursesDb"
import { addTopic, findTopic, renameTopic, restoreTopic, retireTopic } from "@/lib/learningTopics"
import { mergeSmartTags, renameSmartTag, renameSmartTagKey, smartTagUsage } from "@/lib/smartTagsDb"
import { parseSmartTag, tagId } from "@/lib/smartTags"
import { slugifyTrackKey } from "@/lib/slug"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"

const BASE = "/learning/manage"

async function admin() {
  const ctx = await learningAdminContext()
  if (ctx.state !== "ready") redirect("/")
  return ctx
}

function field(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function back(query: string, message: string, error = false): never {
  revalidatePath(BASE)
  const sep = query ? "&" : ""
  redirect(`${BASE}?${query}${sep}msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}`)
}

/** „Kľúč:hodnota" z adresy alebo formulára → identita tagu. */
function tagRef(raw: string): { key: string; value: string } | null {
  const at = raw.indexOf(":")
  if (at < 1) return null
  const key = raw.slice(0, at).trim(), value = raw.slice(at + 1).trim()
  return key && value ? { key, value } : null
}

export async function createCourseAction(fd: FormData) {
  const ctx = await admin()
  const title = field(fd, "title")
  const key = field(fd, "key") || slugifyTrackKey(title)
  const topic = findTopic(ctx.tenant, field(fd, "topicKey"))
  let created = false
  try {
    if (!topic || topic.retiredAt) throw new AppError("learning.topicRequired", "Vyberte tému kurzu.")
    await createCourse({
      companyCode: ctx.person.companyCode, key, title, topicKey: topic.key, topicLabel: topic.label,
      language: ctx.person.language, actor: ctx.person.email,
    })
    created = true
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[learning] založenie kurzu zlyhalo:", e)
    back(`tab=courses&new=1&title=${encodeURIComponent(title)}&key=${encodeURIComponent(key)}`, errorText(e, ctx.person.language), true)
  }
  if (created) redirect(`${BASE}/${key}`)
}

export async function addTopicAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.manage
  try {
    await addTopic({ companyCode: ctx.person.companyCode, label: field(fd, "label"), key: field(fd, "key") || undefined, actor: ctx.person.email })
  } catch (e) {
    back("tab=topics", errorText(e, ctx.person.language), true)
  }
  back("tab=topics", t.topicAdded)
}

export async function renameTopicAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.manage
  try {
    await renameTopic(ctx.person.companyCode, field(fd, "key"), field(fd, "label"), ctx.person.email)
  } catch (e) {
    back("tab=topics", errorText(e, ctx.person.language), true)
  }
  back("tab=topics", t.topicRenamed)
}

export async function retireTopicAction(fd: FormData) {
  const ctx = await admin()
  await retireTopic(ctx.person.companyCode, field(fd, "key"), ctx.person.email)
  back("tab=topics", dictionary(ctx.person.language).learning.manage.topicRetired)
}

export async function restoreTopicAction(fd: FormData) {
  const ctx = await admin()
  await restoreTopic(ctx.person.companyCode, field(fd, "key"), ctx.person.email)
  back("tab=topics", dictionary(ctx.person.language).learning.manage.topicRestored)
}

/**
 * Premenovanie hodnoty. Na existujúci tag je to zlúčenie (MANAGE Q1) — prvý
 * krát sa vráti s upozornením a tlačidlom „Zlúčiť" (`confirm=1`).
 */
export async function renameTagAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.manage
  const from = tagRef(field(fd, "from"))
  const toLabel = field(fd, "to")
  const to = parseSmartTag(toLabel)
  const again = `tab=tags&rename=${encodeURIComponent(field(fd, "from"))}&to=${encodeURIComponent(toLabel)}`
  if (!from) back("tab=tags", errorText(new AppError("learning.tagShape", "", { value: field(fd, "from") }), ctx.person.language), true)
  if (!to) back(again, errorText(new AppError("learning.tagShape", "", { value: toLabel }), ctx.person.language), true)
  const exists = tagId(to) !== tagId(from) && (await smartTagUsage(ctx.person.companyCode)).some(u => tagId(u) === tagId(to))
  if (exists && field(fd, "confirm") !== "1") redirect(`${BASE}?${again}&exists=1`)
  try {
    await renameSmartTag(ctx.person.companyCode, from, toLabel, ctx.person.email)
  } catch (e) {
    back(again, errorText(e, ctx.person.language), true)
  }
  back("tab=tags", t.renamed(to.label))
}

export async function renameKeyAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.manage
  const label = field(fd, "to")
  try {
    await renameSmartTagKey(ctx.person.companyCode, field(fd, "from"), label, ctx.person.email)
  } catch (e) {
    back(`tab=tags&renameKey=${encodeURIComponent(field(fd, "from"))}`, errorText(e, ctx.person.language), true)
  }
  back("tab=tags", t.renamed(label))
}

/** Zlúčenie (krok 2 → výsledok). Cieľ je jeden z vybraných alebo nový zápis. */
export async function mergeTagsAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.manage
  const sources = fd.getAll("tag").map(String).map(tagRef).filter((x): x is { key: string; value: string } => x !== null)
  const choice = field(fd, "target")
  const usage = await smartTagUsage(ctx.person.companyCode)
  const targetLabel = choice === "__new" ? field(fd, "newLabel") : usage.find(u => tagId(u) === choice)?.label ?? ""
  const again = `tab=tags&merge=${encodeURIComponent(sources.map(tagId).join(","))}`
  try {
    await mergeSmartTags(ctx.person.companyCode, sources, targetLabel, ctx.person.email)
  } catch (e) {
    back(again, errorText(e, ctx.person.language), true)
  }
  back("tab=tags", t.merged(sources.length, parseSmartTag(targetLabel)?.label ?? targetLabel))
}
