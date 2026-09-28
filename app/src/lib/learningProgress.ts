/**
 * Postup v kurze — **odvodený z udalostí** (ADR-018, D119; D27, D24).
 *
 * V databáze nie je „aktuálna časť", „percento" ani `courseCompleted`.
 * Uložené sú len udalosti: dokončenie časti (`part_completions`), meranie
 * sledovania videa (`video_watch`) a — od L2 — prejdený pokus o test.
 * Všetko ostatné sa počíta tu, čistými funkciami bez databázy:
 *
 * - **Časť je hotová** ⇔ dokončenie **a** každé video s povinným
 *   dopozeraním má sledované ≥ 90 % dĺžky **a** každý povinný test časti
 *   má prejdený pokus.
 * - **Kurz je hotový** ⇔ všetky povinné časti hotové. Dátum dokončenia je
 *   dátum posledného chýbajúceho dôkazu, nie uložený príznak.
 * - **Zamknutá časť** existuje len pri `sequential`: pred ňou je povinná
 *   časť, ktorá hotová nie je.
 */

import type { CourseVersion, Part } from "./courses"

export const PART_COMPLETIONS_COLLECTION = "part_completions"
export const VIDEO_WATCH_COLLECTION = "video_watch"

/** Koľko z dĺžky videa treba pozrieť, aby platilo „dopozerané" (D119). */
export const WATCH_THRESHOLD = 0.9

/** Sledovaný úsek v sekundách `[od, do]`. */
export type WatchRange = [number, number]

export interface PartCompletionFact {
  partKey: string
  at: Date
}

export interface VideoWatchFact {
  partKey: string
  blockId: string
  watchedRanges: WatchRange[]
  durationSec: number
  /** Kedy sledovanie prvý raz prekročilo hranicu. Zapíše sa raz, potom sa nemení. */
  reachedAt?: Date | null
  updatedAt: Date
  /**
   * Úseky boli rok po dokončení kurzu odstránené (ADR-021, D131). Dôkazom
   * dopozerania je odvtedy `reachedAt`, nie `watchedRanges`.
   */
  detailsPurgedAt?: Date | null
}

/** Prejdený pokus o test v kontexte časti (L2). */
export interface PassedTestFact {
  partKey: string
  testKey: string
  at: Date
}

export interface ProgressFacts {
  completions: PartCompletionFact[]
  watches: VideoWatchFact[]
  passedTests: PassedTestFact[]
}

export const NO_FACTS: ProgressFacts = { completions: [], watches: [], passedTests: [] }

/* ── Video ─────────────────────────────────────────────────────────────── */

/**
 * Úseky zoradené a zlúčené; záporné a obrátené sa opravia, úseky za koncom
 * sa orežú dĺžkou (ak je známa). Prehrávač posiela, čo videl — dvakrát
 * pozretý úsek sa nesmie rátať dvakrát.
 */
export function mergeRanges(ranges: readonly WatchRange[], durationSec?: number): WatchRange[] {
  const max = durationSec && durationSec > 0 ? durationSec : Infinity
  const clean = ranges
    .filter(r => Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(max, Math.max(a, b))] as WatchRange)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  const out: WatchRange[] = []
  for (const r of clean) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out
}

export function watchedSeconds(ranges: readonly WatchRange[], durationSec?: number): number {
  return mergeRanges(ranges, durationSec).reduce((n, [a, b]) => n + (b - a), 0)
}

/** Podiel pozretého 0–1. Bez dĺžky 0 — percento z neznámej dĺžky nie je údaj. */
export function watchedShare(ranges: readonly WatchRange[], durationSec: number | undefined): number {
  if (!durationSec || durationSec <= 0) return 0
  return Math.min(1, watchedSeconds(ranges, durationSec) / durationSec)
}

/** Najďalej pozreté miesto — kde prehrávač pokračuje a po kadiaľ smie pretáčať. */
export function furthestSecond(ranges: readonly WatchRange[], durationSec?: number): number {
  const m = mergeRanges(ranges, durationSec)
  // Pretáča sa len v súvislom úseku od začiatku; diera za ním je nepozretá.
  return m.length && m[0][0] <= 1 ? m[0][1] : 0
}

export function isWatched(ranges: readonly WatchRange[], durationSec: number | undefined): boolean {
  return watchedShare(ranges, durationSec) >= WATCH_THRESHOLD
}

/* ── Časť ──────────────────────────────────────────────────────────────── */

export interface PartEvaluation {
  done: boolean
  /** Dátum posledného dôkazu, ktorý časť dokončil. Len pri `done`. */
  doneAt: Date | null
  completedAt: Date | null
  /** Bloky s povinným dopozeraním, ktoré ešte nemajú 90 %. */
  videosMissing: string[]
  /** Povinné testy bez prejdeného pokusu. */
  testsMissing: string[]
  /** Nejaká udalosť existuje — rozlišuje „rozpracovaná" od „dostupná". */
  touched: boolean
}

function mustWatchBlocks(part: Part) {
  return part.blocks.filter((b): b is Extract<Part["blocks"][number], { type: "video" }> => b.type === "video" && b.mustWatch)
}

export function evaluatePart(part: Part, facts: ProgressFacts): PartEvaluation {
  const completion = facts.completions
    .filter(c => c.partKey === part.key)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null
  const watches = facts.watches.filter(w => w.partKey === part.key)
  const passed = facts.passedTests.filter(t => t.partKey === part.key)

  const proof: Date[] = []
  const videosMissing: string[] = []
  for (const b of mustWatchBlocks(part)) {
    const w = watches.find(x => x.blockId === b.id)
    // Dĺžka z verzie kurzu má prednosť: tú zmrazilo zverejnenie, meranie
    // z prehrávača je len meranie.
    const duration = b.durationSec ?? w?.durationSec
    // Po orezaní podrobností (D131) úseky chýbajú; dopozeranie dokazuje `reachedAt`.
    const watched = w && (w.detailsPurgedAt && w.reachedAt ? true : isWatched(w.watchedRanges, duration))
    if (!w || !watched) videosMissing.push(b.id)
    else proof.push(w.reachedAt ?? w.updatedAt)
  }
  const testsMissing: string[] = []
  for (const t of part.tests.filter(t => t.required)) {
    const p = passed.filter(x => x.testKey === t.testKey).sort((a, b) => a.at.getTime() - b.at.getTime())[0]
    if (!p) testsMissing.push(t.testKey)
    else proof.push(p.at)
  }
  if (completion) proof.push(completion.at)

  const done = Boolean(completion) && videosMissing.length === 0 && testsMissing.length === 0
  return {
    done,
    doneAt: done ? new Date(Math.max(...proof.map(d => d.getTime()))) : null,
    completedAt: completion?.at ?? null,
    videosMissing,
    testsMissing,
    touched: Boolean(completion) || passed.length > 0 || watches.some(w => watchedSeconds(w.watchedRanges, w.durationSec) > 0),
  }
}

export type PartState = "done" | "in-progress" | "available" | "locked"

export interface PartProgress {
  part: Part
  state: PartState
  evaluation: PartEvaluation
}

/**
 * Stav každej časti v poradí verzie. Pri `sequential` je časť zamknutá,
 * kým pred ňou nie sú hotové všetky **povinné** časti — nepovinná časť
 * cestu nezatvára. Hotová časť zamknutá nie je nikdy (napr. po zmene
 * poradia v novej verzii to aj tak neplatí — zápis drží svoju verziu).
 */
export function partStates(version: Pick<CourseVersion, "parts" | "sequential">, facts: ProgressFacts): PartProgress[] {
  let blocked = false
  return version.parts.map(part => {
    const evaluation = evaluatePart(part, facts)
    const state: PartState = evaluation.done
      ? "done"
      : version.sequential && blocked
        ? "locked"
        : evaluation.touched ? "in-progress" : "available"
    if (part.required && !evaluation.done) blocked = true
    return { part, state, evaluation }
  })
}

export interface CourseProgress {
  parts: PartProgress[]
  requiredTotal: number
  requiredDone: number
  /** Nejaká udalosť v ktorejkoľvek časti. */
  started: boolean
  /** Prvá nehotová povinná časť — cieľ „Pokračovať" (rám LEARNING, COURSE). */
  nextPart: Part | null
  /** Kurz je hotový, keď sú hotové všetky povinné časti. */
  done: boolean
  /** Dátum posledného dôkazu povinných častí. Len pri `done`. */
  completedAt: Date | null
}

export function courseProgress(version: Pick<CourseVersion, "parts" | "sequential">, facts: ProgressFacts): CourseProgress {
  const parts = partStates(version, facts)
  const required = parts.filter(p => p.part.required)
  const requiredDone = required.filter(p => p.state === "done")
  const done = required.length > 0 && requiredDone.length === required.length
  return {
    parts,
    requiredTotal: required.length,
    requiredDone: requiredDone.length,
    started: parts.some(p => p.evaluation.touched),
    nextPart: required.find(p => p.state !== "done")?.part ?? null,
    done,
    completedAt: done
      ? new Date(Math.max(...requiredDone.map(p => p.evaluation.doneAt!.getTime())))
      : null,
  }
}

/* ── Stráž „Označiť ako prejdené" ──────────────────────────────────────── */

/**
 * Časť sa smie označiť ako prejdená aj pred prejdením povinného testu —
 * tlačidlo stráži len video (rám PART, Q1 ✅ Ján 27. 9. 2026). Hotová je
 * časť aj tak až s prejdeným testom (`evaluatePart`). Obrazovka podá túto
 * hodnotu do `completionBlockers` / `completePart`.
 */
export const ALLOW_COMPLETE_BEFORE_REQUIRED_TEST = true

export type CompletionBlocker =
  | { code: "locked" }
  | { code: "alreadyCompleted" }
  | { code: "videoNotWatched"; blockId: string }
  | { code: "testNotPassed"; testKey: string }

/**
 * Čo bráni zapísať dokončenie časti. Server to overuje z uložených údajov,
 * nie z tlačidla (D119).
 *
 * `allowBeforeRequiredTests` — pravidlo PART Q1 je
 * `ALLOW_COMPLETE_BEFORE_REQUIRED_TEST`; parameter ostáva výslovný, aby
 * sa pri zmene rozhodnutia menilo jedno miesto a testy videli obe vetvy.
 */
export function completionBlockers(
  version: Pick<CourseVersion, "parts" | "sequential">,
  partKey: string,
  facts: ProgressFacts,
  opts: { allowBeforeRequiredTests: boolean },
): CompletionBlocker[] | null {
  const progress = partStates(version, facts).find(p => p.part.key === partKey)
  if (!progress) return null
  const out: CompletionBlocker[] = []
  if (progress.state === "locked") out.push({ code: "locked" })
  if (progress.evaluation.completedAt) out.push({ code: "alreadyCompleted" })
  for (const blockId of progress.evaluation.videosMissing) out.push({ code: "videoNotWatched", blockId })
  if (!opts.allowBeforeRequiredTests) {
    for (const testKey of progress.evaluation.testsMissing) out.push({ code: "testNotPassed", testKey })
  }
  return out
}
