/**
 * tracks.ts — trasa onboardingu a odvodený stav (kolekcia `onboarding_tracks`, D27).
 *
 * Trasa je poradie krokov: „prejdi týchto N dokumentov v tomto poradí".
 *
 * **Stav dokončenia sa neukladá.** Odvodzuje sa z prieniku krokov trasy
 * a existujúcich potvrdení. Samostatná kolekcia s progresom by bola druhá
 * kópia pravdy, ktorá by sa raz rozišla s prvou — a rozišla by sa práve pri
 * novej verzii dokumentu, teda vtedy, keď na správnosti najviac záleží (D27).
 *
 * Krok typu `page` je v modeli od začiatku, ale použije sa až v rozsahu C
 * (uvítanie, organizačná štruktúra, kontakty). Dovtedy sa preskakuje.
 */

import { getCollection } from "./mongodb"
import { loadDocumentFor, effectiveVersion } from "./documents"
import type { NoVersionReason } from "./documents"
import { acknowledgedVersionIds } from "./acknowledgements"

export const TRACKS_COLLECTION = "onboarding_tracks"

export interface TrackStep {
  order: number
  type: "document" | "page"
  documentId?: string
  pageId?: string
  requiresAcknowledgement: boolean
}

export interface Track {
  companyCode: string
  key: string
  title: string
  description?: string
  steps: TrackStep[]
  isActive: boolean
}

/** Prečo krok nejde prejsť — aby sa dalo povedať niečo konkrétne, nie „chyba". */
export type StepBlocker = NoVersionReason | "document-unavailable"

export interface StepStatus {
  order: number
  documentId: string
  title: string
  versionId: string | null
  versionLabel: string | null
  effectiveFrom: Date | null
  done: boolean
  /** Vyplnené, keď sa krok nedá prejsť — potom je `done` vždy `false`. */
  blocked: StepBlocker | null
}

export interface TrackProgress {
  key: string
  title: string
  description?: string
  steps: StepStatus[]
  /** Prvý nedokončený krok — „kde som skončil". `null`, keď je hotovo. */
  nextOrder: number | null
  doneCount: number
  totalCount: number
}

/** Trasy tenanta podľa kľúčov. Neaktívne sa nevracajú. */
export async function loadTracks(companyCode: string, keys: string[]): Promise<Track[]> {
  if (keys.length === 0) return []
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  return col.find({ companyCode, key: { $in: keys }, isActive: true }).toArray()
}

/**
 * Zloží stav trás pre osobu.
 *
 * Dokumenty sa načítavajú **pre osobu** (`loadDocumentFor`), takže krok
 * odkazujúci na dokument, na ktorý nevidí, sa neukáže ako povinnosť, ale ako
 * zablokovaný. Trasa zostavená omylom nesmie človeku ukázať cudzí obsah ani
 * ho postaviť pred úlohu, ktorú nemá ako splniť.
 */
export async function trackProgress(person: {
  id: string
  companyCode: string
  tracks?: string[]
}): Promise<TrackProgress[]> {
  const tracks = await loadTracks(person.companyCode, person.tracks ?? [])
  if (tracks.length === 0) return []

  const asOf = new Date()
  const pending: { track: Track; steps: StepStatus[] }[] = []
  const versionIds: string[] = []

  for (const track of tracks) {
    const steps: StepStatus[] = []
    for (const step of [...track.steps].sort((a, b) => a.order - b.order)) {
      // Kroky bez potvrdzovania (rozsah C) sa zatiaľ v zozname neobjavujú —
      // nie je čo z nich odvodiť a tvárili by sa ako nesplnená povinnosť.
      if (step.type !== "document" || !step.requiresAcknowledgement) continue
      if (!step.documentId) continue

      const doc = await loadDocumentFor(person, step.documentId)
      if (!doc) {
        steps.push({
          order: step.order, documentId: step.documentId, title: step.documentId,
          versionId: null, versionLabel: null, effectiveFrom: null,
          done: false, blocked: "document-unavailable",
        })
        continue
      }

      const v = effectiveVersion(doc, asOf)
      if (!v.ok) {
        steps.push({
          order: step.order, documentId: step.documentId, title: doc.title,
          versionId: null, versionLabel: null, effectiveFrom: null,
          done: false, blocked: v.reason,
        })
        continue
      }

      versionIds.push(v.version.versionId)
      steps.push({
        order: step.order, documentId: step.documentId, title: doc.title,
        versionId: v.version.versionId, versionLabel: v.version.label,
        effectiveFrom: v.version.effectiveFrom,
        done: false, blocked: null,
      })
    }
    pending.push({ track, steps })
  }

  // Jeden dotaz na všetky verzie naraz, nie po jednej pre každý krok.
  const acknowledged = await acknowledgedVersionIds(person.id, versionIds)

  return pending.map(({ track, steps }) => {
    for (const s of steps) {
      s.done = s.versionId != null && acknowledged.has(s.versionId)
    }
    const firstOpen = steps.find(s => !s.done && !s.blocked)
    return {
      key: track.key,
      title: track.title,
      description: track.description,
      steps,
      nextOrder: firstOpen ? firstOpen.order : null,
      doneCount: steps.filter(s => s.done).length,
      totalCount: steps.length,
    }
  })
}
