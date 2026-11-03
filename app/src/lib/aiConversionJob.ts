/**
 * aiConversionJob.ts — beh prevodu PDF modelom na pozadí a kontrola slov
 * pri koncepte (ADR-046, D297–D302).
 *
 * Stav je pri dokumente v poli `aiConversion` — beh patrí jednému konceptu
 * a s novým nahratím zaniká (`uploadDocument` ho maže). Jeden krok = jedno
 * volanie modelu: okno analýzy alebo jedna časť prevodu. Kroky reťazí
 * `/api/cron/conversion` (vzor kontroly súladu, `backgroundKick.ts`), cron je
 * poistka. Súbeh stráži zámok `leaseUntil`.
 *
 * **Doslovný prevod sa neprepíše potichu.** Keď človek koncept počas behu
 * upravil (odtlačok textu sa líši od toho na začiatku), výsledok ide ako
 * návrh vedľa (`llmDraft`, D53) — prijme ho človek.
 *
 * Kontrola slov pri koncepte, jej potvrdenie a prekážka schválenia sú
 * v `conversionCheckDb.ts` — schvaľovanie ich potrebuje bez tohto behu
 * (a bez `libraryWrite.ts`, ktorý beh používa).
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { AppError } from "./appError"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { loadFile } from "./fileStore"
import { pdfTextLayer } from "./conversion"
import { checkConversion, type LayerPage } from "./conversionCheck"
import {
  ConversionError, MAX_FAILURES, isConverting, referenceLayer, storedCheck, type StoredCheck, type Confirmation,
} from "./conversionCheckDb"
import {
  analyse, convertPart, joinParts, tailOf, headingOutline, MAX_PAGES_PER_CALL, type PagePart,
} from "./aiConversion"
import type { RewriteAi } from "./llmRewrite"
import { textFingerprint } from "./chunkIdentity"
import { saveDraft } from "./libraryWrite"
import { writeAudit } from "./audit"
import { notify } from "./notifications"
import { proposeChunkCut } from "./chunkProposal"
import { cutterState } from "./chunkCutter"

/** Strop jedného volania modelu — krok sa musí zmestiť do 300 s funkcie. */
const CALL_TIMEOUT_MS = 240_000
/** Najmenej toľko slov musí mať textová vrstva, aby bolo s čím porovnávať. */
const MIN_LAYER_WORDS = 50
/** Chyby, pri ktorých ďalší pokus nepomôže — beh sa vzdá hneď. */
const FINAL_ERRORS = new Set(["rewrite.notConfigured", "rewrite.answerTruncated", "conversion.pdfMissing"])

export { ConversionError, MAX_FAILURES, isConverting }

export type ConversionStatus = "running" | "done" | "proposed" | "failed"

export interface AiConversion {
  status: ConversionStatus
  startedAt: Date
  startedBy: string
  personId: string | null
  personName: string
  model: string
  /** Odtlačok konceptu na začiatku — keď sa do konca zmení, výsledok ide ako návrh. */
  baseHash: string
  /** PDF, z ktorého sa prevádza — `originalFile.id`. */
  pdfFileId: string
  pageCount: number
  /** Okná analýzy (dokument nad 100 strán ide po oknách). */
  windows: PagePart[]
  windowsDone: number
  analysis: string
  /** Časti prevodu — z analýzy, po poslednom okne. */
  parts: PagePart[]
  /** Či časti navrhla analýza (inak rovnomerné delenie). */
  partsFromModel: boolean
  /** Markdown hotových častí, v poradí. */
  done: string[]
  /** Názov druhu dokumentu pre návrh rezov (ADR-035). */
  kindLabel: string | null
  leaseUntil: Date | null
  failures: number
  error: string | null
  updatedAt: Date
  finishedAt: Date | null
}

interface JobDoc {
  documentId: string
  companyCode: string
  title?: string
  draftMarkdown?: string
  originalFile?: { id: string; type?: string } | null
  aiConversion?: AiConversion | null
  conversionCheck?: StoredCheck | null
  conversionConfirmed?: Confirmation[]
}

const layerWords = (layer: LayerPage[]) =>
  layer.reduce((n, p) => n + p.lines.join(" ").split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length, 0)

async function documents() {
  return getCollection(DOCUMENTS_COLLECTION)
}

/** Okná analýzy po najviac 100 stranách. */
export function analysisWindows(pageCount: number): PagePart[] {
  const out: PagePart[] = []
  for (let from = 1; from <= pageCount; from += MAX_PAGES_PER_CALL) out.push({ from, to: Math.min(pageCount, from + MAX_PAGES_PER_CALL - 1) })
  return out
}

/**
 * Čo beh práve robí — pre priebežný oznam v editore (Ján 3. 11. 2026:
 * „priebežne ukazovať info o každom kroku, nečakať na Obnoviť").
 * Počet krokov je známy až po analýze; dovtedy `steps` je `null`.
 */
export type ConversionPhase =
  | { kind: "analysis"; step: number; steps: number | null; from: number; to: number; pageCount: number }
  | { kind: "part"; step: number; steps: number; no: number; of: number; from: number; to: number; fromModel: boolean }
  | { kind: "finishing"; step: number; steps: number }

export function conversionPhase(job: AiConversion): ConversionPhase {
  const known = job.windowsDone >= job.windows.length
  const steps = known ? job.windows.length + job.parts.length + 1 : null
  if (!known) {
    const w = job.windows[job.windowsDone]
    return { kind: "analysis", step: job.windowsDone + 1, steps, from: w.from, to: w.to, pageCount: job.pageCount }
  }
  const step = job.windows.length + job.done.length + 1
  if (job.done.length < job.parts.length) {
    const p = job.parts[job.done.length]
    return { kind: "part", step, steps: steps!, no: job.done.length + 1, of: job.parts.length, from: p.from, to: p.to, fromModel: job.partsFromModel }
  }
  return { kind: "finishing", step: steps!, steps: steps! }
}

/**
 * Spustí prevod modelom. Podmienky: pôvodný súbor je PDF s textovou vrstvou
 * a organizácia má nastavenú AI. Inak vyhodí — volajúci pri nahratí chybu
 * zahodí (ostáva doslovný prevod), tlačidlo ju ukáže.
 */
export async function startAiConversion(
  companyCode: string,
  documentId: string,
  starter: { email: string; personId: string | null; personName: string },
  kindLabel: string | null,
  now = new Date(),
): Promise<void> {
  const col = await documents()
  const doc = await col.findOne({ companyCode, documentId }, { projection: { draftMarkdown: 1, originalFile: 1, aiConversion: 1 } }) as JobDoc | null
  if (!doc) throw new ConversionError("library.documentNotFound", "Taký dokument tu nie je.")
  if (isConverting(doc.aiConversion)) throw new ConversionError("conversion.alreadyRunning", "Prevod modelom už beží.")
  const original = doc.originalFile
  if (!original || original.type !== "pdf") throw new ConversionError("conversion.onlyPdf", "Modelom sa prevádza len PDF.")
  const ai = await aiForCompany(companyCode)
  if (!ai.apiKey) throw new ConversionError("rewrite.notConfigured", "Prepis modelom nie je nastavený.")
  const layer = await referenceLayer(companyCode, original.id)
  if (layerWords(layer) < MIN_LAYER_WORDS) {
    throw new ConversionError("conversion.noTextLayer", "PDF nemá textovú vrstvu — je to sken. Prepis skenu je samostatné tlačidlo.")
  }
  const job: AiConversion = {
    status: "running", startedAt: now, startedBy: starter.email, personId: starter.personId, personName: starter.personName,
    model: ai.models.rewrite, baseHash: textFingerprint(doc.draftMarkdown ?? ""), pdfFileId: original.id,
    pageCount: layer.length, windows: analysisWindows(layer.length), windowsDone: 0, analysis: "",
    parts: [], partsFromModel: false, done: [], kindLabel,
    leaseUntil: null, failures: 0, error: null, updatedAt: now, finishedAt: null,
  }
  await col.updateOne({ companyCode, documentId }, { $set: { aiConversion: job } })
  await writeAudit({
    companyCode, subject: "document", action: "model-conversion-start", actor: starter.email,
    targetId: documentId, targetLabel: documentId, note: `${ai.models.rewrite} · ${layer.length} strán`,
  })
}

/** Bežiace prevody naprieč organizáciami — pre cron. */
export async function conversionsInProgress(): Promise<{ companyCode: string; documentId: string }[]> {
  return (await documents())
    .find({ "aiConversion.status": "running", "aiConversion.failures": { $lt: MAX_FAILURES } }, { projection: { _id: 0, companyCode: 1, documentId: 1 } })
    .toArray() as unknown as Promise<{ companyCode: string; documentId: string }[]>
}

/**
 * Jeden krok behu. Vráti `true`, keď krok prebehol a beh ešte nie je hotový
 * — vtedy treba zavolať ďalší kúsok.
 */
export async function continueConversion(companyCode: string, documentId: string): Promise<boolean> {
  const col = await documents()
  const now = new Date()
  const doc = await col.findOneAndUpdate(
    {
      companyCode, documentId, "aiConversion.status": "running", "aiConversion.failures": { $lt: MAX_FAILURES },
      $or: [{ "aiConversion.leaseUntil": null }, { "aiConversion.leaseUntil": { $lt: now } }],
    },
    { $set: { "aiConversion.leaseUntil": new Date(now.getTime() + CALL_TIMEOUT_MS + 60_000) }, $inc: { "aiConversion.failures": 1 } },
    { returnDocument: "after", projection: { title: 1, aiConversion: 1 } },
  ) as JobDoc | null
  const job = doc?.aiConversion
  if (!doc || !job) return false
  // Každý zápis len do toho istého behu — nové nahratie ho zmaže a starý kúsok nesmie nič prepísať.
  const mine = { companyCode, documentId, "aiConversion.startedAt": job.startedAt }
  const title = String(doc.title ?? documentId)
  const actor: UsageActor = { companyCode, personId: job.personId, personName: job.personName, email: job.startedBy }

  try {
    const settings = await aiForCompany(companyCode)
    const ai: RewriteAi = {
      apiKey: settings.apiKey, model: job.model, timeoutMs: CALL_TIMEOUT_MS,
      onUsage: (tokens, failed) => void recordAiUsage(usageRecord({
        actor, purpose: "pdf-conversion", subject: title, provider: "anthropic",
        model: job.model, keySource: settings.keySource, tokens, failed,
      })),
    }
    const file = await loadFile(companyCode, job.pdfFileId)
    if (!file) throw new ConversionError("conversion.pdfMissing", "Pôvodné PDF sa nenašlo.")
    const layer = await pdfTextLayer(file.data)

    if (job.windowsDone < job.windows.length) {
      const w = job.windows[job.windowsDone]
      const plan = await analyse(file.data, layer, w.from, w.to, job.analysis, ai)
      await col.updateOne(mine, {
        $set: {
          "aiConversion.analysis": [job.analysis, plan.analysis].filter(Boolean).join("\n\n"),
          "aiConversion.parts": [...job.parts, ...plan.parts],
          "aiConversion.partsFromModel": (job.windowsDone === 0 || job.partsFromModel) && plan.fromModel,
          "aiConversion.windowsDone": job.windowsDone + 1,
          "aiConversion.failures": 0, "aiConversion.error": null, "aiConversion.updatedAt": new Date(),
        },
      })
      return true
    }

    if (job.done.length < job.parts.length) {
      const part = job.parts[job.done.length]
      const previous = job.done.length ? tailOf(job.done[job.done.length - 1]) : ""
      const markdown = await convertPart(file.data, layer, job.analysis, part, previous, ai, headingOutline(job.done))
      const done = [...job.done, markdown]
      await col.updateOne(mine, {
        $set: { "aiConversion.done": done, "aiConversion.failures": 0, "aiConversion.error": null, "aiConversion.updatedAt": new Date() },
      })
      if (done.length < job.parts.length) return true
      await finish(companyCode, documentId, { ...job, done }, layer, title, actor)
      return false
    }

    await finish(companyCode, documentId, job, layer, title, actor)
    return false
  } catch (e) {
    const code = e instanceof AppError ? e.code : "conversion.failed"
    if (!(e instanceof AppError)) console.error(`[conversion] ${companyCode}/${documentId} krok zlyhal:`, e)
    const final = FINAL_ERRORS.has(code) || job.failures >= MAX_FAILURES
    await col.updateOne(mine, {
      $set: {
        "aiConversion.error": code, "aiConversion.updatedAt": new Date(),
        ...(final ? { "aiConversion.status": "failed", "aiConversion.failures": MAX_FAILURES, "aiConversion.finishedAt": new Date() } : {}),
      },
    })
    if (final && job.personId) {
      await notify({ companyCode, personId: job.personId, kind: "conversionFailed", params: { documentId, documentTitle: title } })
    }
    return !final
  } finally {
    await col.updateOne(mine, { $set: { "aiConversion.leaseUntil": null } })
  }
}

/**
 * Koniec behu: časti za sebou, kontrola slov a zápis. Do konceptu len vtedy,
 * keď ho nikto medzitým neupravil a PDF je stále to isté; inak návrh vedľa.
 */
async function finish(
  companyCode: string, documentId: string, job: AiConversion, layer: LayerPage[], title: string, actor: UsageActor,
): Promise<void> {
  const col = await documents()
  const mine = { companyCode, documentId, "aiConversion.startedAt": job.startedAt }
  const markdown = joinParts(job.done)
  const now = new Date()
  const current = await col.findOne({ companyCode, documentId }, { projection: { draftMarkdown: 1, originalFile: 1 } }) as JobDoc | null
  const untouched = Boolean(current && textFingerprint(current.draftMarkdown ?? "") === job.baseHash && current.originalFile?.id === job.pdfFileId)
  const method = `model ${job.model} · analýza a ${job.parts.length} častí` + (job.partsFromModel ? "" : " (rovnomerné delenie)")

  if (untouched) {
    await saveDraft(companyCode, documentId, markdown, `${job.startedBy} (prevod modelom)`)
    const check = storedCheck(checkConversion(layer, markdown), markdown, job.pdfFileId, now)
    await col.updateOne(mine, {
      $set: {
        conversion: { method, warnings: [], at: now },
        conversionCheck: check, conversionConfirmed: [],
        "aiConversion.status": "done", "aiConversion.finishedAt": now, "aiConversion.updatedAt": now,
      },
    })
  } else {
    await col.updateOne(mine, {
      $set: {
        llmDraft: { text: markdown, model: method, mode: "convert", at: now },
        "aiConversion.status": "proposed", "aiConversion.finishedAt": now, "aiConversion.updatedAt": now,
      },
    })
  }
  await writeAudit({
    companyCode, subject: "document", action: "model-conversion", actor: job.startedBy,
    targetId: documentId, targetLabel: title, note: `${method} · ${markdown.length} znakov · ${untouched ? "do konceptu" : "ako návrh"}`,
  })
  if (job.personId) await notify({ companyCode, personId: job.personId, kind: "converted", params: { documentId, documentTitle: title } })

  // Návrh rezov až nad textom od modelu (D302) — nad doslovným prevodom by bol zbytočný.
  if (untouched) {
    try {
      const state = await cutterState(companyCode, documentId)
      if (state) await proposeChunkCut(actor, documentId, { current: state.current, source: "auto", kindLabel: job.kindLabel })
    } catch (e) {
      if (!(e instanceof AppError)) console.error("[conversion] návrh rezu zlyhal:", e)
    }
  }
}
