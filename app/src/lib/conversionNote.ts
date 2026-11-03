/**
 * conversionNote.ts — veta o tom, čo prevod modelom práve robí (ADR-046).
 *
 * Skladá ju server v jazyku osoby — rovnako pre prvé vykreslenie editora aj
 * pre priebežné otázky z prehliadača (`/api/library/conversion/[id]`), aby
 * klient nemusel ťahať celý slovník.
 */

import { dictionary, errorText, type UiLanguage } from "./i18n"
import { AppError } from "./appError"
import { conversionPhase, type AiConversion } from "./aiConversionJob"
import { isConverting } from "./conversionCheckDb"

export interface ConversionNote {
  running: boolean
  /** Aktuálny krok. */
  text: string
  /** Čo je hotové a ako dlho to beží. */
  detail: string
}

export function conversionNote(job: AiConversion, language: UiLanguage, now = new Date()): ConversionNote {
  const t = dictionary(language).library.editor
  const phase = conversionPhase(job)
  const text = phase.kind === "analysis"
    ? t.convertPhaseAnalysis(phase.step, phase.steps, phase.from, phase.to, phase.pageCount)
    : phase.kind === "part"
      ? t.convertPhasePart(phase.step, phase.steps, phase.no, phase.of, phase.from, phase.to)
      : t.convertPhaseFinishing(phase.step, phase.steps)
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(job.startedAt).getTime()) / 60_000))
  const retry = job.error ? errorText(new AppError(job.error, ""), language) : null
  const detail = [
    phase.kind !== "analysis" ? t.convertPlan(job.parts.length, job.partsFromModel) : "",
    retry ? t.convertRetrying(retry) : "",
    t.convertElapsed(minutes),
  ].filter(Boolean).join(" ")
  return { running: isConverting(job), text, detail }
}
