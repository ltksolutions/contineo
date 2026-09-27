/**
 * Udalosti postupu v databáze (ADR-018, D119): dokončenie časti a meranie
 * sledovania videa. Stav sa z nich **odvodzuje** v `learningProgress.ts`.
 *
 * - `part_completions` je dôkaz — vzniká raz a nemení sa (D24).
 * - `video_watch` je **meranie**, nie dôkaz (ako `reading_times`): jediný
 *   záznam modulu, ktorý sa prepisuje — zlučujú sa doň sledované úseky.
 *   `reachedAt` sa zapíše raz, keď sledovanie prvý raz prekročí hranicu.
 */

import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { versionById } from "./courses"
import { passedTestsFor } from "./testAttemptsDb"
import { getCourse } from "./coursesDb"
import type { Enrollment } from "./enrollments"
import {
  PART_COMPLETIONS_COLLECTION, VIDEO_WATCH_COLLECTION, completionBlockers, isWatched, mergeRanges, watchedSeconds,
  type CompletionBlocker, type PartCompletionFact, type ProgressFacts, type VideoWatchFact, type WatchRange,
} from "./learningProgress"

export class ProgressError extends AppError {
  readonly blockers: CompletionBlocker[]
  constructor(code: string, message: string, blockers: CompletionBlocker[] = []) {
    super(code, message)
    this.blockers = blockers
  }
}

interface PartCompletionDoc extends PartCompletionFact {
  companyCode: string
  enrollmentId: string
  personId: string
  courseKey: string
  versionId: string
}

interface VideoWatchDoc extends VideoWatchFact {
  companyCode: string
  enrollmentId: string
  personId: string
  courseKey: string
  versionId: string
  watchedSec: number
}

/**
 * Udalosti jedného zápisu vrátane prejdených testov (L2, `test_attempts`).
 */
export async function progressFacts(companyCode: string, enrollmentId: string): Promise<ProgressFacts> {
  const [completions, watches] = await Promise.all([
    (await getCollection<PartCompletionDoc>(PART_COMPLETIONS_COLLECTION))
      .find({ companyCode, enrollmentId }, { projection: { _id: 0, partKey: 1, at: 1 } }).toArray(),
    (await getCollection<VideoWatchDoc>(VIDEO_WATCH_COLLECTION))
      .find({ companyCode, enrollmentId }, { projection: { _id: 0 } }).toArray(),
  ])
  const passed = await passedTestsFor(companyCode, [enrollmentId])
  return { completions, watches, passedTests: passed.get(enrollmentId) ?? [] }
}

/** To isté pre viac zápisov naraz (obrazovka „Moje kurzy"). */
export async function progressFactsMany(companyCode: string, enrollmentIds: string[]): Promise<Map<string, ProgressFacts>> {
  const out = new Map<string, ProgressFacts>(enrollmentIds.map(id => [id, { completions: [], watches: [], passedTests: [] }]))
  if (!enrollmentIds.length) return out
  const [completions, watches] = await Promise.all([
    (await getCollection<PartCompletionDoc>(PART_COMPLETIONS_COLLECTION))
      .find({ companyCode, enrollmentId: { $in: enrollmentIds } }, { projection: { _id: 0 } }).toArray(),
    (await getCollection<VideoWatchDoc>(VIDEO_WATCH_COLLECTION))
      .find({ companyCode, enrollmentId: { $in: enrollmentIds } }, { projection: { _id: 0 } }).toArray(),
  ])
  for (const c of completions) out.get(c.enrollmentId)?.completions.push(c)
  for (const w of watches) out.get(w.enrollmentId)?.watches.push(w)
  for (const [id, list] of await passedTestsFor(companyCode, enrollmentIds)) out.get(id)?.passedTests.push(...list)
  return out
}

async function versionOf(e: Enrollment) {
  const course = await getCourse(e.companyCode, e.courseKey)
  const version = course ? versionById(course, e.versionId) : null
  if (!version) throw new ProgressError("learning.courseNotFound", `Verzia kurzu „${e.courseKey}" zo zápisu neexistuje.`)
  return version
}

/**
 * Zapíše sledované úseky videa. Úseky sa zlúčia s doterajšími a orežú
 * dĺžkou z verzie kurzu (tú zmrazilo zverejnenie); prehrávaču sa neverí
 * dĺžka ani čas mimo videa.
 */
export async function recordVideoWatch(input: {
  enrollment: Enrollment
  partKey: string
  blockId: string
  ranges: WatchRange[]
  /** Dĺžka z prehrávača — použije sa len, keď ju blok nemá. */
  durationSec?: number
}): Promise<{ watchedSec: number; watched: boolean }> {
  const e = input.enrollment
  if (e.cancelledAt) throw new ProgressError("learning.enrollmentCancelled", "Zápis do kurzu je zrušený.")
  const version = await versionOf(e)
  const block = version.parts.find(p => p.key === input.partKey)?.blocks.find(b => b.id === input.blockId)
  if (!block || block.type !== "video") throw new ProgressError("learning.blockNotFound", "Taký blok videa v kurze nie je.")
  const duration = block.durationSec ?? (input.durationSec && input.durationSec > 0 ? input.durationSec : 0)

  const col = await getCollection<VideoWatchDoc>(VIDEO_WATCH_COLLECTION)
  const filter = { companyCode: e.companyCode, enrollmentId: e.id, partKey: input.partKey, blockId: input.blockId }
  const before = await col.findOne(filter, { projection: { _id: 0 } })
  const ranges = mergeRanges([...(before?.watchedRanges ?? []), ...input.ranges], duration || undefined)
  const watchedSec = watchedSeconds(ranges)
  const watched = isWatched(ranges, duration || undefined)
  const at = new Date()
  await col.updateOne(
    filter,
    {
      $set: { watchedRanges: ranges, watchedSec, durationSec: duration, updatedAt: at },
      $setOnInsert: { personId: e.personId, courseKey: e.courseKey, versionId: e.versionId },
    },
    { upsert: true },
  )
  // `reachedAt` raz a len raz — podmienka v dotaze, nie v kóde, kvôli súbehu.
  if (watched && !before?.reachedAt) {
    await col.updateOne({ ...filter, reachedAt: null }, { $set: { reachedAt: at } })
  }
  return { watchedSec, watched }
}

/**
 * „Označiť ako prejdené" — zapíše dokončenie časti, ak mu nič nebráni.
 * Stráž počíta server z uložených údajov (D119), nie tlačidlo.
 *
 * `allowBeforeRequiredTests` podá volajúci — pravidlo je
 * `ALLOW_COMPLETE_BEFORE_REQUIRED_TEST` (PART Q1 ✅).
 */
export async function completePart(input: {
  enrollment: Enrollment
  partKey: string
  allowBeforeRequiredTests: boolean
}): Promise<PartCompletionFact> {
  const e = input.enrollment
  if (e.cancelledAt) throw new ProgressError("learning.enrollmentCancelled", "Zápis do kurzu je zrušený.")
  const version = await versionOf(e)
  const facts = await progressFacts(e.companyCode, e.id)
  const blockers = completionBlockers(version, input.partKey, facts, { allowBeforeRequiredTests: input.allowBeforeRequiredTests })
  if (!blockers) throw new ProgressError("learning.partNotFound", "Taká časť v kurze nie je.")
  const already = blockers.find(b => b.code === "alreadyCompleted")
  if (already) return facts.completions.find(c => c.partKey === input.partKey)!
  if (blockers.length) {
    throw new ProgressError(`learning.${blockers[0].code}`, "Časť sa zatiaľ nedá označiť ako prejdená.", blockers)
  }

  const doc: PartCompletionDoc = {
    companyCode: e.companyCode, enrollmentId: e.id, personId: e.personId,
    courseKey: e.courseKey, versionId: e.versionId, partKey: input.partKey, at: new Date(),
  }
  try {
    await (await getCollection<PartCompletionDoc>(PART_COMPLETIONS_COLLECTION)).insertOne({ ...doc })
  } catch (err) {
    // Unikát (enrollmentId, partKey): dvojklik zapíše raz.
    if ((err as { code?: number }).code !== 11000) throw err
  }
  return { partKey: doc.partKey, at: doc.at }
}
