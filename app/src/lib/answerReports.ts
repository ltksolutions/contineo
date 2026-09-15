/**
 * answerReports.ts — „Nahlásiť nepresnosť": spätná väzba na odpovede.
 *
 * ## Prečo to je prvé z pohodlia a nie posledné
 *
 * `docs/O6_rozhodovaci_harok.md`, bod 12: je to **jediný spôsob, ako sa
 * dozvieme, že systém odpovedá zle**. Bez neho vieme len to, koľko otázok
 * padlo — nie ktoré odpovede boli mimo. Zlatá sada (`/golden-set`) testuje to,
 * na čo sme sa dopredu spýtali; toto zachytáva to, na čo sme sa nespýtali.
 *
 * ## Čo sa ukladá a prečo aj otázka a odpoveď
 *
 * Hlásenie bez otázky a bez odpovede je veta „niečo bolo zle" — nedá sa z nej
 * nič opraviť. Ukladá sa preto **obe doslovne**, plus zdroje, ktoré systém
 * odcitoval: bez nich sa nedá rozlíšiť „našlo zlý predpis" od „našlo správny
 * a zle ho prečítalo", a to sú dve úplne iné chyby s dvomi rôznymi opravami.
 *
 * Otázka je text, ktorý napísal človek, takže **môže obsahovať osobný údaj**.
 * Je to vedomé: bez nej je hlásenie bezcenné. Preto krátka retencia, riadok
 * v zázname o spracovateľských činnostiach a otázka na DPO (O15/O16).
 *
 * ## Čomu sa tu neverí
 *
 * Otázka, odpoveď aj zdroje prichádzajú **z prehliadača** — je to kópia toho,
 * čo mal človek na obrazovke, a inak sa to získať nedá (odpoveď sa streamuje
 * a nikde sa neukladá). Preto sa dĺžky orezávajú a berie sa to ako **tvrdenie
 * nahlasovateľa, nie ako záznam systému**. Identita naopak z prehliadača
 * nechodí nikdy: `companyCode` aj `personId` sú z prihlásenej osoby (D32).
 */

import type { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"

export const ANSWER_REPORTS_COLLECTION = "answer_reports"

/**
 * Retencia. **24 mesiacov** (rozhodnutie Jána Letka, 2026-09-15).
 *
 * Dlhšia než pri upozorneniach zámerne: hlásenie o zlej odpovedi je podklad
 * na zlepšenie vyhľadávania, nie prevádzková stopa. Polrok by znamenal, že
 * pri pohľade „čo sa nám opakovane vyčíta" zostane prázdno práve vtedy, keď
 * sa na to niekto konečne pozrie.
 */
export const RETENTION_MONTHS = 24

/** Najväčšie dĺžky. Orezáva sa, nezamieta — hlásenie sa nemá stratiť. */
export const MAX_QUESTION = 2_000
export const MAX_ANSWER = 20_000
export const MAX_NOTE = 2_000
export const MAX_SOURCES = 20

export class AnswerReportError extends AppError {}

export interface ReportedSource {
  title: string
  articleRef?: string
  url?: string
}

export interface AnswerReport {
  _id?: ObjectId
  companyCode: string
  personId: string
  /** Kópie v čase hlásenia — osoba sa môže premenovať alebo odísť. */
  email: string
  fullName: string
  question: string
  answer: string
  sources: ReportedSource[]
  /** Čo je zle. **Povinné** — bez neho je to palec dole, nie hlásenie. */
  note: string
  createdAt: Date
  /** Kým `null`, nikto sa tým nezaoberal. */
  resolvedAt: Date | null
  resolvedBy?: string | null
}

/** Skrátenie na hranicu, s výpustkou, aby bolo vidieť, že sa orezávalo. */
export function clip(text: string, max: number): string {
  const v = (text ?? "").trim()
  return v.length <= max ? v : `${v.slice(0, max - 1)}…`
}

/**
 * Očistenie vstupu z prehliadača na tvar, ktorý sa ukladá.
 *
 * **Čistá funkcia** — dá sa otestovať bez databázy a je to jediné miesto,
 * kde sa rozhoduje, čo z hlásenia zostane.
 */
export function tidyReport(input: {
  question?: unknown
  answer?: unknown
  note?: unknown
  sources?: unknown
}): { question: string; answer: string; note: string; sources: ReportedSource[] } {
  const text = (v: unknown) => (typeof v === "string" ? v : "")
  const note = clip(text(input.note), MAX_NOTE)
  if (!note) {
    throw new AnswerReportError(
      "report.noteRequired",
      "Napíš, čo je na odpovedi zle — bez toho sa nedá nič opraviť.",
    )
  }

  const raw = Array.isArray(input.sources) ? input.sources : []
  const sources: ReportedSource[] = raw.slice(0, MAX_SOURCES).map(s => {
    const o = (s ?? {}) as Record<string, unknown>
    return {
      title: clip(text(o.title), 300),
      articleRef: text(o.articleRef) ? clip(text(o.articleRef), 120) : undefined,
      url: text(o.url) ? clip(text(o.url), 500) : undefined,
    }
  }).filter(s => s.title)

  return {
    question: clip(text(input.question), MAX_QUESTION),
    answer: clip(text(input.answer), MAX_ANSWER),
    note: note,
    sources: sources,
  }
}

/** Hranica retencie. Oddelene od zápisu, nech sa dá otestovať bez databázy. */
export function retentionCutoff(asOf: Date = new Date(), months = RETENTION_MONTHS): Date {
  const d = new Date(asOf.getTime())
  d.setMonth(d.getMonth() - months)
  return d
}

export async function saveReport(input: {
  companyCode: string
  personId: string
  email: string
  fullName: string
  question?: unknown
  answer?: unknown
  note?: unknown
  sources?: unknown
}): Promise<void> {
  const tidy = tidyReport(input)
  const col = await getCollection<AnswerReport>(ANSWER_REPORTS_COLLECTION)
  await col.insertOne({
    companyCode: input.companyCode,
    personId: input.personId,
    email: input.email,
    fullName: input.fullName,
    question: tidy.question,
    answer: tidy.answer,
    sources: tidy.sources,
    note: tidy.note,
    createdAt: new Date(),
    resolvedAt: null,
  } as AnswerReport)
}

/** Hlásenia organizácie, najnovšie hore. Pre toho, kto sa nimi zaoberá. */
export async function reports(companyCode: string, limit = 100): Promise<AnswerReport[]> {
  const col = await getCollection<AnswerReport>(ANSWER_REPORTS_COLLECTION)
  return col
    .find({ companyCode } as never)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(500, limit)))
    .toArray()
}

/** Zmaže staršie než retencia. Naprieč organizáciami — púšťa to cron. */
export async function purgeExpired(asOf: Date = new Date()): Promise<number> {
  const col = await getCollection<AnswerReport>(ANSWER_REPORTS_COLLECTION)
  const r = await col.deleteMany({ createdAt: { $lt: retentionCutoff(asOf) } } as never)
  return r.deletedCount ?? 0
}
