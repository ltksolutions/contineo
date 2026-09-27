/**
 * Stav testu na zobrazenie (rám TESTS): pripravenému testu môže banka
 * medzičasom prestať stačiť — vtedy „⚠ Nedostatok otázok", aj keď je
 * uložený ako `ready`. Odvodené (D27), nič sa neukladá.
 */

import type { Question } from "./questions"
import { sectionAvailability } from "./testAttempts"
import type { Test } from "./tests"

export type TestDisplayStatus = "ready" | "short" | "draft" | "retired"

export function displayStatus(t: Pick<Test, "status" | "sections">, bank: Question[]): TestDisplayStatus {
  if (t.status === "retired") return "retired"
  if (t.status === "draft") return "draft"
  const avail = sectionAvailability(t, bank)
  return t.sections.some(s => (avail.get(s.key) ?? 0) < s.count) ? "short" : "ready"
}
