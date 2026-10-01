/**
 * answerCitations.ts — či má odpoveď bočný stĺpec citácií.
 *
 * Volá ju klientsky `Search` aj serverová stránka uloženej odpovede
 * `/ask/a/[id]`. Preto nesmie bývať v `Answer.tsx`: ten je `"use client"`
 * a funkciu z neho server zavolať nevie — stránka padala s chybou servera
 * (30. 9. 2026, ASK-historia-otazok). Komponent sa serveru dá odovzdať,
 * obyčajná funkcia nie.
 */
import type { AnswerState } from "@/components/Answer"
import { mergeCitations } from "./formatText"

/** Či má odpoveď bočný stĺpec citácií: beží, alebo má aspoň jednu citáciu. */
export function answerHasCitations(state: AnswerState): boolean {
  if (state.done?.error && !state.text) return false
  if (state.done && !state.text && state.done.sources.length === 0) return false
  return state.running || mergeCitations(state.citations).length > 0
}
