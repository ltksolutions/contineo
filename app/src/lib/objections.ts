/**
 * Námietka proti spracúvaniu (čl. 21 GDPR) — ADR-012, D105.
 *
 * Pri predpisoch s **oprávneným záujmom** má dotknutá osoba právo namietať.
 * Námietku zaeviduje a o nej rozhodne **DPO**; do rozhodnutia sa nič nemaže
 * (O15/A8). Pri vyhovení sa zmažú doklady osoby pri zneniach, ktorých základ
 * bol v čase potvrdenia oprávnený záujem — pri zákonnej povinnosti sa námietka
 * neuplatňuje.
 *
 * Čisté pravidlá; zápis je v `objectionsDb.ts`.
 */

import { AppError } from "./appError"

export const OBJECTIONS_COLLECTION = "objections"

export type ObjectionStatus = "pending" | "upheld" | "rejected"

/** Ako námietka prišla — kvôli preukázaniu lehoty na vybavenie (čl. 12 ods. 3). */
export const OBJECTION_CHANNELS = ["email", "letter", "in-person", "other"] as const
export type ObjectionChannel = (typeof OBJECTION_CHANNELS)[number]

export interface Objection {
  id: string
  companyCode: string
  personId: string
  /** Kópia mena v čase zápisu — o rok musí byť čitateľné, koho sa týkala. */
  personName: string
  receivedAt: Date
  channel: ObjectionChannel
  /** Znenie námietky, ako prišla. Osobný údaj — maže sa s dokladmi osoby (D105). */
  text: string
  recordedBy: string
  recordedAt: Date
  status: ObjectionStatus
  decidedAt?: Date | null
  decidedBy?: string | null
  /** Odôvodnenie rozhodnutia. Povinné pri oboch výsledkoch. */
  decisionNote?: string | null
  /** Čo sa pri vyhovení zmazalo — počty, nie obsah. */
  deleted?: Record<string, number> | null
}

export class ObjectionError extends AppError {}

export interface NewObjection {
  receivedAt: Date | null
  channel: string
  text: string
}

/** Kontrola vstupu pri zápise. Vracia vyčistenú podobu alebo vyhodí chybu s kódom. */
export function checkNewObjection(input: NewObjection, now: Date): { receivedAt: Date; channel: ObjectionChannel; text: string } {
  const text = input.text.trim()
  if (!text) throw new ObjectionError("objection.emptyText", "Chýba znenie námietky.")
  if (!input.receivedAt || Number.isNaN(input.receivedAt.getTime())) {
    throw new ObjectionError("objection.badDate", "Dátum doručenia nie je platný dátum.")
  }
  if (input.receivedAt.getTime() > now.getTime()) {
    throw new ObjectionError("objection.futureDate", "Dátum doručenia nemôže byť v budúcnosti.")
  }
  const channel = (OBJECTION_CHANNELS as readonly string[]).includes(input.channel)
    ? (input.channel as ObjectionChannel)
    : "other"
  return { receivedAt: input.receivedAt, channel, text }
}

/** Kontrola rozhodnutia. Odôvodnenie je povinné pri vyhovení aj zamietnutí. */
export function checkDecision(decision: string, note: string): { decision: "upheld" | "rejected"; note: string } {
  if (decision !== "upheld" && decision !== "rejected") {
    throw new ObjectionError("objection.badDecision", "Rozhodnutie musí byť vyhovieť alebo zamietnuť.")
  }
  const n = note.trim()
  if (!n) throw new ObjectionError("objection.noteRequired", "Rozhodnutie potrebuje odôvodnenie.")
  return { decision, note: n }
}

/**
 * Znenia, ktorých sa vyhovená námietka týka: tie, pri ktorých potvrdenie
 * nieslo **oprávnený záujem**. Potvrdenie bez zapísaného základu (spred D91)
 * sa nemaže — základ nie je známy a námietku pri zákonnej povinnosti
 * uplatniť nemožno. DPO ho vidí v počte „bez základu" a rozhodne ručne.
 */
export function objectionScope(
  acks: { documentId: string; versionId: string; legalBasis?: string | null }[],
): { versions: Set<string>; unknownBasis: number } {
  const versions = new Set<string>()
  let unknownBasis = 0
  for (const a of acks) {
    if (a.legalBasis === "legitimate_interest") versions.add(`${a.documentId}|${a.versionId}`)
    else if (!a.legalBasis) unknownBasis++
  }
  return { versions, unknownBasis }
}
