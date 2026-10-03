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
import { sameTrackTitle } from "./trackNames"
import { PERSONS_COLLECTION, trackStart, type Person } from "./persons"
import { dueFrom, type Due } from "./due"

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
  /**
   * Termín potvrdenia (3. 10. 2026) — len v dňoch od pridania na trasu.
   * Pevný dátum trasa nemá: kto na ňu príde deň pred ním, dostal by na
   * dokumenty jeden deň (ADR-004). Chýba = bez termínu.
   */
  due?: Extract<Due, { kind: "days" }> | null
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
  /** Termín pre túto osobu — od jej pridania na trasu. `null` = bez termínu. */
  due: Date | null
}

/**
 * Termín povinnosti z trasy pre osobu. Jedno miesto pre widget aj výkaz —
 * dve kópie výpočtu by pri tej istej povinnosti ukázali iný dátum.
 */
export function trackDueFor(
  track: Pick<Track, "key" | "due">,
  person: Parameters<typeof trackStart>[0],
): Date | null {
  if (!track.due) return null
  const start = trackStart(person, track.key)
  return start ? dueFrom(start, track.due) : null
}

/**
 * Overí, že človek má tú trasu a že dokument je naozaj jej krokom.
 *
 * **Prečo sa to overuje.** Kľúč trasy prichádza z adresy — teda od klienta.
 * Do dôkazného záznamu ide údaj o tom, ako sa človek k dokumentu dostal,
 * a taký údaj nesmie byť len tvrdením prehliadača: inak by sa dalo potvrdiť
 * dokument „ako krok trasy", ktorú človek nemá, alebo trasy, ktorá ten
 * dokument neobsahuje. Neplatný kľúč sa **ticho zahodí** (vráti sa `null`) —
 * potvrdenie je platný úkon aj bez trasy a odmietnuť ho kvôli zlému
 * parametru v adrese by bolo horšie než zapísať ho bez nej.
 *
 * Vracia kľúč trasy, nie jej `_id`: kľúč je to, čím sa na trasu odkazuje
 * všade inde (`assignments.audience`), a je čitateľný aj bez druhého dotazu.
 */
export async function trackForDocument(
  person: { companyCode: string; tracks?: string[] },
  trackKey: string | null | undefined,
  documentId: string,
): Promise<string | null> {
  const key = (trackKey ?? "").trim()
  if (!key) return null
  if (!(person.tracks ?? []).includes(key)) return null

  const [track] = await loadTracks(person.companyCode, [key])
  if (!track) return null

  const has = track.steps.some(s => s.type === "document" && s.documentId === documentId)
  return has ? key : null
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
} & Parameters<typeof trackStart>[0]): Promise<TrackProgress[]> {
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
  const acknowledged = await acknowledgedVersionIds(person.companyCode, person.id, versionIds)

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
      due: trackDueFor(track, person),
    }
  })
}

// ── zápis (rozsah C) ─────────────────────────────────────────────────────────
//
// Trasa dovtedy vznikala len seedovacím skriptom. Kurátor ju teraz skladá
// z obrazovky — a to znamená, že sa musí dať aj pokaziť, takže sa kontroluje.

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

/**
 * Kľúč → názov trasy, pre obrazovky, ktoré poznajú len kľúč (výber adresátov,
 * dôkazy). Kľúč sa ľuďom neukazuje (2. 10. 2026).
 */
export async function trackNames(companyCode: string): Promise<Record<string, string>> {
  return Object.fromEntries((await allTracks(companyCode)).map(t => [t.key, t.title]))
}

/** Jedna trasa vrátane neaktívnej. `null`, keď taká nie je. */
export async function trackByKey(companyCode: string, key: string): Promise<Track | null> {
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  return col.findOne({ companyCode, key })
}

async function trackOrThrow(companyCode: string, key: string): Promise<Track> {
  const found = await trackByKey(companyCode, key)
  if (!found) throw new TrackError("track.notFound", "Taká trasa tu nie je.")
  return found
}

function checkTitle(title: string): string {
  const t = title.trim()
  if (!t) throw new TrackError("track.titleRequired", "Názov trasy je povinný.")
  return t
}

/**
 * Názov trasy je **jedinečný v organizácii** (2. 10. 2026). Kľúč nikto nevidí,
 * takže trasu pri osobe aj v importe určuje názov — dve trasy s rovnakým
 * názvom by sa nedali rozlíšiť.
 */
async function checkTitleFree(companyCode: string, title: string, exceptKey?: string): Promise<void> {
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  const all = await col.find({ companyCode }, { projection: { key: 1, title: 1 } }).toArray()
  if (all.some(t => t.key !== exceptKey && sameTrackTitle(t.title, title))) {
    throw new TrackError("track.titleTaken", `Trasa s názvom „${title}" už existuje.`, { title })
  }
}

/**
 * Založí trasu a vráti jej kľúč.
 *
 * **Kľúč generuje server** (UUID, rozhodnutie Jána 2. 10. 2026) — nikto ho
 * nezadáva ani nevidí, je len v adrese stránky trasy a v dátach (osoby,
 * pridelenia, záznamy potvrdení). Trasy založené predtým majú čitateľné
 * kľúče (`novy-zamestnanec`); tie sa nemenia, lebo sa na ne odkazujú
 * záznamy potvrdení (D24).
 */
export async function createTrack(
  companyCode: string,
  input: { title: string; description?: string },
  actor: string,
): Promise<string> {
  const title = checkTitle(input.title)
  await checkTitleFree(companyCode, title)
  const key = crypto.randomUUID()

  const col = await getCollection<Track>(TRACKS_COLLECTION)

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
  return key
}

export async function renameTrack(
  companyCode: string,
  key: string,
  input: { title: string; description?: string },
  actor: string,
): Promise<void> {
  const before = await trackOrThrow(companyCode, key)
  const title = checkTitle(input.title)
  await checkTitleFree(companyCode, title, key)
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

/**
 * Nastaví termín trasy: počet dní od pridania na trasu, alebo `null` = bez
 * termínu. Mení termín aj tým, ktorí na trase už sú — počíta sa od ich
 * pridania, takže kto je na nej dlho, môže byť hneď po termíne. Stránka to
 * pred uložením povie.
 */
export async function setTrackDue(
  companyCode: string,
  key: string,
  days: number | null,
  actor: string,
): Promise<void> {
  const before = await trackOrThrow(companyCode, key)
  if (days !== null && (!Number.isFinite(days) || days < 1 || days > 365)) {
    throw new TrackError("track.badDueDays", "Počet dní musí byť od 1 do 365.")
  }
  const due = days === null ? null : { kind: "days" as const, days: Math.floor(days) }
  const col = await getCollection<Track>(TRACKS_COLLECTION)
  await col.updateOne({ companyCode, key }, { $set: { due } })
  await writeAudit({
    companyCode, subject: "track", action: "changed",
    actor, targetId: key, targetLabel: before.title,
    changes: diff({ dueDays: before.due?.days ?? null }, { dueDays: due?.days ?? null }),
  })
}

// ── ľudia na trase (2. 10. 2026) ─────────────────────────────────────────────
//
// Trasa sa osobe zapisuje do `persons.tracks` — to je jediný zdroj (D27).
// Dovtedy sa dala prideliť len na karte osoby alebo importom; zo stránky
// trasy sa teraz pridávajú osoby aj celé oddelenia naraz.

export interface TrackMembersInput {
  /** `persons.id` vybraných osôb. */
  personIds?: string[]
  /**
   * Oddelenia — pridajú sa ich **dnešní** členovia vrátane podriadených
   * (`departmentPath`). Kto do oddelenia príde neskôr, trasu nedostane sám;
   * na to je pridelenie oddeleniu (D50).
   */
  departmentIds?: string[]
}

/**
 * Pridá ľudí na trasu. Vyradené osoby sa nepridávajú. Vráti, koľkým trasa
 * pribudla a koľkí ju už mali.
 */
export async function addTrackMembers(
  companyCode: string,
  key: string,
  input: TrackMembersInput,
  actor: string,
): Promise<{ added: number; already: number; addedIds: string[] }> {
  const track = await trackOrThrow(companyCode, key)
  const personIds = [...new Set((input.personIds ?? []).filter(Boolean))]
  const departmentIds = [...new Set((input.departmentIds ?? []).filter(Boolean))]
  if (personIds.length === 0 && departmentIds.length === 0) {
    throw new TrackError("track.noMembersChosen", "Vyberte osoby alebo oddelenie.")
  }

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  // `companyCode` je v podmienke (D32) — identifikátory sa dajú uhádnuť.
  const people = await col.find(
    {
      companyCode, status: { $ne: "inactive" },
      $or: [
        ...(personIds.length ? [{ id: { $in: personIds } }] : []),
        ...(departmentIds.length ? [{ departmentPath: { $in: departmentIds } }] : []),
      ],
    } as never,
    { projection: { id: 1, fullName: 1, tracks: 1 } },
  ).toArray()

  const toAdd = people.filter(p => !(p.tracks ?? []).includes(track.key))
  if (toAdd.length > 0) {
    // Dátum pridania ide s kľúčom — nesie termín trasy (`trackHistory`).
    await col.updateMany(
      { companyCode, id: { $in: toAdd.map(p => p.id) } } as never,
      {
        $addToSet: { tracks: track.key },
        $push: { trackHistory: { track: track.key, from: new Date() } },
      } as never,
    )
    await writeAudit({
      companyCode, subject: "track", action: "membersAdded",
      actor, targetId: track.key, targetLabel: track.title,
      note: toAdd.map(p => p.fullName).join(", "),
    })
  }
  return { added: toAdd.length, already: people.length - toAdd.length, addedIds: toAdd.map(p => p.id) }
}

/** Odoberie osobu z trasy. Potvrdenia, ktoré vznikli, ostávajú (D24). */
export async function removeTrackMember(
  companyCode: string,
  key: string,
  personId: string,
  actor: string,
): Promise<boolean> {
  const track = await trackOrThrow(companyCode, key)
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const person = await col.findOne({ companyCode, id: personId } as never, { projection: { fullName: 1 } })
  if (!person) return false
  const r = await col.updateOne(
    { companyCode, id: personId, tracks: track.key } as never,
    {
      $pull: { tracks: track.key },
      // Úsek sa uzavrie, nemaže — „bol na trase od–do" je odpoveď pre audit.
      $set: { "trackHistory.$[open].to": new Date() },
    } as never,
    { arrayFilters: [{ "open.track": track.key, "open.to": { $exists: false } }] },
  )
  if (r.modifiedCount > 0) {
    await writeAudit({
      companyCode, subject: "track", action: "memberRemoved",
      actor, targetId: track.key, targetLabel: track.title, note: person.fullName,
    })
  }
  return r.modifiedCount > 0
}

