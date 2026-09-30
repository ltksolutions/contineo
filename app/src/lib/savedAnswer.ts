/**
 * savedAnswer.ts — uložená odpoveď `/ask/a/{id}` (ASK-historia-otazok).
 *
 * Uložená odpoveď je **stav vtedy**, nie dnes: s dátumom a s upozornením,
 * keď má citovaný dokument odvtedy iné platné znenie. Poctivejšie než tichý
 * nový beh — človek vidí, z čoho vtedy odpoveď bola, a sám sa rozhodne
 * opýtať znova.
 */

import type { AnswerSource } from "./sseClient"
import { effectiveVersion, type DocumentRecord } from "./documents"

export interface NewerVersion {
  documentId: string
  title: string
  label: string
  effectiveFrom: Date
}

/**
 * Dokumenty zo zdrojov odpovede, ktoré majú dnes platné iné znenie, než
 * z ktorého odpoveď bola. Porovnáva sa začiatok účinnosti — znenie sa
 * nemení, pribúda nové. Zdroj bez `documentId` alebo bez znenia (staršie
 * odpovede, overená odpoveď) sa porovnať nedá a vynechá sa.
 */
export function newerVersions(sources: AnswerSource[], docs: DocumentRecord[], now: Date = new Date()): NewerVersion[] {
  const out = new Map<string, NewerVersion>()
  for (const s of sources) {
    if (!s.documentId || !s.version?.effectiveFrom || out.has(s.documentId)) continue
    const doc = docs.find(d => d.documentId === s.documentId)
    if (!doc) continue
    const current = effectiveVersion(doc, now)
    if (!current.ok || !current.version.effectiveFrom) continue
    const then = new Date(s.version.effectiveFrom).getTime()
    if (current.version.effectiveFrom.getTime() <= then) continue
    out.set(s.documentId, {
      documentId: s.documentId,
      title: doc.title || s.title,
      label: current.version.label,
      effectiveFrom: current.version.effectiveFrom,
    })
  }
  return [...out.values()]
}
