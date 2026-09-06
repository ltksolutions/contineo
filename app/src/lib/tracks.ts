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
import { AppError } from "./appError"
import { writeAudit, diff } from "./audit"
import { DOCUMENTS_COLLECTION } from "./documents"
import { loadDocumentFor, effectiveVersion } from "./documents"
import type { NoVersionReason } from "./documents"
import { acknowledgedVersionIds } from "./acknowledgements"

export const TRACKS_COLLECTION = "onboarding_tracks"

export class TrackError extends AppError {}

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

// ── zápis (rozsah C) ─────────────────────────────────────────────────────────
//
// Trasa dovtedy vznikala len seedovacím skriptom. Kurátor ju teraz skladá
// z obrazovky — a to znamená, že sa musí dať aj pokaziť, takže sa kontroluje.

/** Kľúč trasy — rovnaký tvar ako pri číselníkoch: ide do adries a zostáva. */
const TRACK_KEY = /^[a-z0-9][a-z0-9-]{1,60}$/

/** Krok tak, ako ho zadáva človek. Poradie sa odvodí z poľa, nečísluje ho. */
export interface StepInput {
  documentId: string
  requiresAcknowledgement?: boolean
}

/** Všetky trasy tenanta vrátane neaktívnych — kurátor musí vidieť aj tie. */
export async function allTracks(companyCode: string): Promise<Track[]> {
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  return col.find({ companyCode }).sort({ title: 1 }).toArray()
}

async function trackOrThrow(companyCode: string, key: string): Promise<Track> {
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  const found = await col.findOne({ companyCode, key })
  if (!found) throw new TrackError("track.notFound", "Taká trasa tu nie je.")
  return found
}

function checkTitle(title: string): string {
  const t = title.trim()
  if (!t) throw new TrackError("track.titleRequired", "Názov trasy je povinný.")
  return t
}

export async function createTrack(
  companyCode: string,
  input: { key: string; title: string; description?: string },
  actor: string,
): Promise<void> {
  const key = input.key.trim().toLowerCase()
  if (!key) throw new TrackError("track.keyRequired", "Kľúč trasy je povinný.")
  if (!TRACK_KEY.test(key)) {
    throw new TrackError(
      "track.badKey",
      `„${key}" sa nedá použiť ako kľúč trasy. Malé písmená bez diakritiky, číslice a pomlčka.`,
      { key },
    )
  }
  const title = checkTitle(input.title)

  const col = await getCollection<Track>(TRACKS_COLLECTION)
  if (await col.findOne({ companyCode, key })) {
    throw new TrackError("track.alreadyExists", `Trasa „${key}" už existuje.`, { key })
  }

  // Nová trasa je prázdna a **neaktívna**: kroky sa dopĺňajú vzápätí a trasa,
  // ktorá by medzitým visela na ľuďoch bez krokov, by tvrdila „hotovo".
  await col.insertOne({
    companyCode, key, title,
    description: input.description?.trim() || undefined,
    steps: [], isActive: false,
  } as Track)

  await writeAudit({
    companyCode, subject: "track", action: "created",
    actor, targetId: key, targetLabel: title,
  })
}

export async function renameTrack(
  companyCode: string,
  key: string,
  input: { title: string; description?: string },
  actor: string,
): Promise<void> {
  const before = await trackOrThrow(companyCode, key)
  const title = checkTitle(input.title)
  const description = input.description?.trim() || undefined

  const col = await getCollection<Track>(TRACKS_COLLECTION)
  await col.updateOne({ companyCode, key }, { $set: { title, description } })
  await writeAudit({
    companyCode, subject: "track", action: "changed",
    actor, targetId: key, targetLabel: title,
    changes: diff(
      { title: before.title, description: before.description ?? null },
      { title, description: description ?? null },
    ),
  })
}

/**
 * Prepíše kroky trasy.
 *
 * Poradie je **poradie v poli**, nie číslo, ktoré by niekto zadával: dve
 * položky s `order: 3` sú stav, ktorý sa v zozname nedá opraviť, len uhádnuť.
 *
 * Dokumenty sa overujú proti tenantovi. Krok na cudzí `documentId` by trasu
 * nezhodil — `trackProgress()` ho ukáže ako zablokovaný — ale kurátor by sa
 * o preklepe dozvedel až od človeka, ktorý pred ním uviazne.
 */
export async function setTrackSteps(
  companyCode: string,
  key: string,
  steps: StepInput[],
  actor: string,
): Promise<void> {
  const before = await trackOrThrow(companyCode, key)

  const documents = await getCollection(DOCUMENTS_COLLECTION)
  const seen = new Set<string>()
  const next: TrackStep[] = []
  for (const s of steps) {
    const documentId = s.documentId.trim()
    if (!documentId || seen.has(documentId)) continue
    seen.add(documentId)
    if (!(await documents.findOne({ companyCode, documentId }))) {
      throw new TrackError(
        "track.documentNotFound",
        `Dokument „${documentId}" v tejto organizácii nie je.`,
        { documentId },
      )
    }
    next.push({
      order: next.length + 1,
      type: "document",
      documentId,
      requiresAcknowledgement: s.requiresAcknowledgement !== false,
    })
  }

  const col = await getCollection<Track>(TRACKS_COLLECTION)
  await col.updateOne({ companyCode, key }, { $set: { steps: next } })
  await writeAudit({
    companyCode, subject: "track", action: "changed",
    actor, targetId: key, targetLabel: before.title,
    changes: diff(
      { steps: before.steps.map(s => s.documentId ?? "").join(", ") },
      { steps: next.map(s => s.documentId ?? "").join(", ") },
    ),
  })
}

/**
 * Zapne alebo vypne trasu.
 *
 * Vypnutá trasa sa ľuďom neukáže, ale **zostáva na nich zapísaná** — a to je
 * zámer: zmazať ju by znamenalo, že sa o rok nedá povedať, čo mal kto prejsť.
 */
export async function setTrackActive(
  companyCode: string,
  key: string,
  isActive: boolean,
  actor: string,
): Promise<void> {
  const before = await trackOrThrow(companyCode, key)
  if (isActive && before.steps.length === 0) {
    throw new TrackError("track.noSteps", "Prázdnu trasu zapnúť nejde — najprv jej pridaj kroky.")
  }
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  await col.updateOne({ companyCode, key }, { $set: { isActive } })
  await writeAudit({
    companyCode, subject: "track", action: isActive ? "restored" : "excluded",
    actor, targetId: key, targetLabel: before.title,
  })
}
