/**
 * Premenovanie a zlúčenie smart:tagov v databáze — **všade** (MANAGE Q1,
 * Ján 27. 9. 2026).
 *
 * Mení sa na kurzoch (`courses.smartTags`), v banke otázok
 * (`questions.smartTags`) a v testoch (`tests.smartTags` aj filtre sekcií).
 * Kolekcie otázok a testov pribudnú v L2 — dotaz na prázdnu kolekciu nič
 * nemení, takže funkcia ich pokrýva už teraz a pri L2 sa na ňu nezabudne.
 *
 * Prečo to nemení dôkazy: tagy sú na kurze, nie vo verzii (D118), a snímky
 * otázok v pokusoch (D120) tagy nenesú.
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { COURSES_COLLECTION } from "./courses"
import { aggregateSmartTags, mergeTagsIn, parseSmartTag, renameKeyIn, renameTagIn, tagId, type SmartTag, type SmartTagUsage } from "./smartTags"
import { slugifyKey } from "./slug"

import { QUESTIONS_COLLECTION } from "./questions"
import { TESTS_COLLECTION } from "./tests"

interface Tagged {
  companyCode: string
  key: string
  smartTags?: SmartTag[]
  sections?: { filter: SmartTag[] }[]
}

export interface RenameResult {
  courses: number
  questions: number
  tests: number
}

async function applyEverywhere(companyCode: string, match: Record<string, unknown>, change: (tags: SmartTag[]) => SmartTag[]): Promise<RenameResult> {
  const out: RenameResult = { courses: 0, questions: 0, tests: 0 }
  for (const [name, field] of [[COURSES_COLLECTION, "courses"], [QUESTIONS_COLLECTION, "questions"], [TESTS_COLLECTION, "tests"]] as const) {
    const col = await getCollection<Tagged>(name)
    const docs = await col.find(
      { companyCode, $or: [{ smartTags: { $elemMatch: match } }, { "sections.filter": { $elemMatch: match } }] },
      { projection: { _id: 0, key: 1, smartTags: 1, sections: 1 } },
    ).toArray()
    for (const d of docs) {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (d.smartTags) set.smartTags = change(d.smartTags)
      if (d.sections) set.sections = d.sections.map(s => ({ ...s, filter: change(s.filter ?? []) }))
      await col.updateOne({ companyCode, key: d.key }, { $set: set })
      out[field]++
    }
  }
  return out
}

/** „Bezpečnosť: Vytah" → „Bezpečnosť: Výťah". Na existujúci tag = zlúčenie. */
export async function renameSmartTag(
  companyCode: string,
  from: Pick<SmartTag, "key" | "value">,
  toLabel: string,
  actor: string,
): Promise<RenameResult> {
  const to = parseSmartTag(toLabel)
  if (!to) throw new AppError("learning.tagShape", `„${toLabel}" nie je smart:tag v tvare „Kľúč: Hodnota".`, { value: toLabel })
  const result = await applyEverywhere(companyCode, { key: from.key, value: from.value }, tags => renameTagIn(tags, from, to))
  await writeAudit({
    companyCode, subject: "smart-tag", action: "renamed", actor, targetId: tagId(from), targetLabel: to.label,
    note: `kurzy ${result.courses}, otázky ${result.questions}, testy ${result.tests}`,
  })
  return result
}

/** Premenuje kľúč na všetkých hodnotách („Bezpecnost" → „Bezpečnosť"). */
export async function renameSmartTagKey(companyCode: string, fromKey: string, toKeyLabel: string, actor: string): Promise<RenameResult> {
  const label = toKeyLabel.replace(/:/g, "").trim()
  if (!slugifyKey(label)) throw new AppError("learning.tagShape", `„${toKeyLabel}" nie je platný kľúč smart:tagu.`, { value: toKeyLabel })
  const result = await applyEverywhere(companyCode, { key: fromKey }, tags => renameKeyIn(tags, fromKey, label))
  await writeAudit({
    companyCode, subject: "smart-tag", action: "renamed", actor, targetId: fromKey, targetLabel: label,
    note: `kľúč; kurzy ${result.courses}, otázky ${result.questions}, testy ${result.tests}`,
  })
  return result
}

/**
 * Zlúči viac tagov do jedného — cieľ môže byť jeden zo zdrojových aj úplne
 * nový zápis. Entita, ktorá mala viac zo zlučovaných, dostane cieľ raz.
 */
export async function mergeSmartTags(
  companyCode: string,
  sources: Pick<SmartTag, "key" | "value">[],
  toLabel: string,
  actor: string,
): Promise<RenameResult> {
  const to = parseSmartTag(toLabel)
  if (!to) throw new AppError("learning.tagShape", `„${toLabel}" nie je smart:tag v tvare „Kľúč: Hodnota".`, { value: toLabel })
  const from = sources.filter(s => tagId(s) !== tagId(to))
  if (sources.length < 2) throw new AppError("learning.mergeNeedsTwo", "Na zlúčenie treba aspoň dva smart:tagy.")
  const result = await applyEverywhere(
    companyCode,
    { $or: from.map(s => ({ key: s.key, value: s.value })) },
    tags => mergeTagsIn(tags, from, to),
  )
  await writeAudit({
    companyCode, subject: "smart-tag", action: "merged", actor, targetId: tagId(to), targetLabel: to.label,
    note: `${from.map(tagId).join(", ")} → ${tagId(to)}; kurzy ${result.courses}, otázky ${result.questions}, testy ${result.tests}`,
  })
  return result
}

async function taggedAll(companyCode: string) {
  const read = async (name: string) => (await getCollection<Tagged>(name))
    .find({ companyCode }, { projection: { _id: 0, key: 1, smartTags: 1, sections: 1 } }).toArray()
  const [courses, questions, tests] = await Promise.all([read(COURSES_COLLECTION), read(QUESTIONS_COLLECTION), read(TESTS_COLLECTION)])
  return { courses, questions, tests }
}

/**
 * Prehľad použitých tagov (MANAGE `?tab=tags`) — odvodený (D27). Pri teste
 * sa ráta aj filter sekcií: tag, ktorý test vyberá, je použitý.
 */
export async function smartTagUsage(companyCode: string): Promise<SmartTagUsage[]> {
  const all = await taggedAll(companyCode)
  const withSections = (x: Tagged) => ({ smartTags: [...(x.smartTags ?? []), ...(x.sections ?? []).flatMap(s => s.filter ?? [])] })
  return aggregateSmartTags({ courses: all.courses, questions: all.questions, tests: all.tests.map(withSections) })
}

/**
 * Dopad premenovania alebo zlúčenia **pred** odoslaním: koľko entít nesie
 * aspoň jeden z tagov (každá raz), po kolekciách — veta „Zmení sa na
 * 23 miestach (4 kurzy, 17 otázok, 2 testy)".
 */
export async function smartTagImpact(companyCode: string, tags: Pick<SmartTag, "key" | "value">[]): Promise<RenameResult> {
  const ids = new Set(tags.map(tagId))
  const all = await taggedAll(companyCode)
  const hit = (x: Tagged) => [...(x.smartTags ?? []), ...(x.sections ?? []).flatMap(s => s.filter ?? [])].some(t => ids.has(tagId(t)))
  return { courses: all.courses.filter(hit).length, questions: all.questions.filter(hit).length, tests: all.tests.filter(hit).length }
}
