/**
 * learningPaths.ts — adresy častí Vzdelávania (DESIGN_ODCHYLKY R3, 7. 10. 2026).
 *
 * Do 7. 10. 2026 boli časti správy kurzov a testov parametre (`?tab=topics`,
 * `?tab=parts&part=…`, `?tab=questions&q=…`). Časť, ktorú má cesta
 * pomenovať, má ale vlastnú adresu (CLAUDE.md); parameter ostáva len tam,
 * kde sa miesto nemení — filter, pohľad, otvorený formulár na tej istej
 * obrazovke (`?new=1`, `?add=`, `?assign=1`). Staré tvary prekladá
 * `legacyQueryRoute` v `lib/legacyRoutes.ts`.
 *
 * Statický úsek má v Nexte prednosť pred dynamickým: `/learning/manage/topics`
 * by zatienil kurz s kľúčom `topics`. Tieto slová sa preto ako kľúč kurzu,
 * testu a otázky nedajú použiť (`RESERVED_*`).
 */

export const MANAGE_PATH = "/learning/manage"
export const TESTS_PATH = "/learning/tests"

export type ManageTab = "courses" | "topics" | "tags"
export type CourseTab = "parts" | "settings" | "people"
export type TestsTab = "tests" | "questions" | "results"

/** Kľúče kurzu obsadené časťami správy kurzov. */
export const RESERVED_COURSE_KEYS: readonly string[] = ["topics", "tags"]
/** Kľúče testu obsadené časťami sekcie Testy. */
export const RESERVED_TEST_KEYS: readonly string[] = ["questions", "results"]
/** Kľúče otázky obsadené krokmi banky otázok. */
export const RESERVED_QUESTION_KEYS: readonly string[] = ["new", "import"]

export function managePath(tab: ManageTab): string {
  return tab === "courses" ? MANAGE_PATH : `${MANAGE_PATH}/${tab}`
}

export function coursePath(courseKey: string, tab: CourseTab = "parts"): string {
  const base = `${MANAGE_PATH}/${encodeURIComponent(courseKey)}`
  return tab === "parts" ? base : `${base}/${tab}`
}

export function partPath(courseKey: string, partKey: string): string {
  return `${coursePath(courseKey)}/parts/${encodeURIComponent(partKey)}`
}

export function testsPath(tab: TestsTab): string {
  return tab === "tests" ? TESTS_PATH : `${TESTS_PATH}/${tab}`
}

export function questionPath(questionKey: string): string {
  return `${TESTS_PATH}/questions/${encodeURIComponent(questionKey)}`
}

export const NEW_QUESTION_PATH = `${TESTS_PATH}/questions/new`

/** Bez `id` nahratie súboru, s `id` náhľad nahratého importu. */
export function importPath(id?: string): string {
  return `${TESTS_PATH}/questions/import${id ? `/${encodeURIComponent(id)}` : ""}`
}
