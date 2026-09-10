/**
 * hrReport.ts — kto čo má potvrdiť a kto to už potvrdil (D33).
 *
 * `/hr` doteraz ukazovalo **pridelenia**: koľko ľudí z publika už potvrdilo.
 * To je pohľad kurátora — „ako dopadlo, čo som poslal". HR potrebuje opačný:
 * „ako je na tom dokument", „ako je na tom človek", „ako je na tom trasa".
 *
 * **Menovateľ je pridelenie + trasa** (rozhodnuté 2026-09-06). Sú to jediné
 * dva spôsoby, ako sa dokument k človeku dostane. Menovateľ „všetci
 * v organizácii" by nafúkol každé číslo o ľudí, ktorých sa vec netýka, a
 * výkaz, ktorý nikto nečíta, je horší než žiadny. Menovateľ „len pridelenia"
 * by zase mlčky vynechal celý onboarding cez trasu.
 *
 * **Jedna povinnosť na osobu a znenie.** Keď má človek dokument aj z trasy,
 * aj z pridelenia, je to jedna povinnosť s dvomi dôvodmi — nie dve. Inak by
 * sa dalo súčet „nepotvrdených" nafúknuť tým, že sa to isté pridelí dvakrát.
 *
 * **Prečo sa to celé počíta naraz, a nie po jednom.** Naivná podoba (pre
 * každú osobu načítaj jej dokumenty) je pri stovke ľudí a desiatke smerníc
 * tisíc dotazov do Atlasu. Tu sa načíta päť zoznamov a zvyšok je pamäť.
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION } from "./persons"
import type { Person } from "./persons"
import { DOCUMENTS_COLLECTION, effectiveVersion } from "./documents"
import type { DocumentRecord } from "./documents"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { ASSIGNMENTS_COLLECTION, matchesAudience, dueForPerson } from "./assignments"
import type { Assignment } from "./assignments"
import { TRACKS_COLLECTION } from "./tracks"
import type { Track } from "./tracks"
import { READING_COLLECTION } from "./readingTime"

/** Odkiaľ povinnosť pochádza. Jedna povinnosť môže mať oboje. */
export type DutySource = "assignment" | "track"

export interface Duty {
  personId: string
  fullName: string
  email: string
  documentId: string
  documentTitle: string
  versionId: string
  versionLabel: string
  /** Zoradené, aby sa výkaz nemenil medzi dvomi spusteniami. */
  sources: DutySource[]
  /** Názvy trás, z ktorých povinnosť plynie. Prázdne pri čistom pridelení. */
  trackTitles: string[]
  /**
   * Odkedy povinnosť beží — od toho sa počíta meškanie.
   *
   * Pri pridelení je to `assignedAt`, pri trase odkedy má človek prístup.
   * Keď má povinnosť oba pôvody, platí **neskorší** z nich: nové pridelenie
   * (D37) je nová žiadosť o potvrdenie a hodiny sa ním vracajú na nulu.
   */
  since: Date | null
  /**
   * Termín potvrdenia pre túto osobu (D61, D62), alebo `null`.
   *
   * Počíta ho `dueForPerson()` — **ten istý výpočet ako vo widgete**, nie
   * druhá kópia pravidla. Povinnosť z trasy termín nemá, kým ju nekryje
   * pridelenie s termínom: trasa vlastný termín niesť nevie.
   */
  due: Date | null
  acknowledgedAt: Date | null
  /**
   * Viditeľný čas nad znením. `null` znamená „nevieme", nie „nula" —
   * merať sme začali neskôr než potvrdzovať a rok starý údaj už nežije.
   */
  readingSeconds: number | null
}

interface PersonRow {
  id: string
  email: string
  fullName: string
  groups?: string[]
  tracks?: string[]
  departmentPath?: string[]
  /*
   * História oddelení a skupín je tu kvôli **relatívnemu termínu** (D62):
   * „do 14 dní" beží každému odo dňa, keď mu povinnosť vznikla, a to vie
   * povedať len `dateForPerson()` z týchto dvoch polí. Bez nich by človek,
   * ktorý do oddelenia prišiel neskôr, dostal termín v minulosti.
   */
  departmentHistory?: Person["departmentHistory"]
  groupHistory?: Person["groupHistory"]
  firstLoginAt?: Date
  invitedAt?: Date
  createdAt?: Date
}

/**
 * Odkedy má človek prístup. Pre povinnosť z trasy je to jediný rozumný
 * začiatok — trasa sama dátum na osobu neviaže a `lastLoginAt` sa pri
 * každom prihlásení prepíše, takže by meškanie nikdy nenarástlo.
 */
function accessSince(person: PersonRow): Date | null {
  return person.firstLoginAt ?? person.invitedAt ?? person.createdAt ?? null
}

/**
 * Všetky povinnosti organizácie.
 *
 * Vracia **plochý zoznam**, nie strom. Zhrnutia sa z neho poskladajú nižšie
 * a export je ten istý zoznam — takže sa čísla na obrazovke a v CSV nemôžu
 * rozísť, aj keby ich niekto neskôr menil.
 */
export async function duties(companyCode: string): Promise<Duty[]> {
  const [personCol, docCol, assignCol, trackCol] = await Promise.all([
    getCollection<PersonRow>(PERSONS_COLLECTION),
    getCollection<DocumentRecord>(DOCUMENTS_COLLECTION),
    getCollection<Assignment>(ASSIGNMENTS_COLLECTION),
    getCollection<Track>(TRACKS_COLLECTION),
  ])

  const [people, documents, assignments, tracks] = await Promise.all([
    personCol
      .find(
        { companyCode, status: { $ne: "inactive" } } as never,
        {
          projection: {
            id: 1, email: 1, fullName: 1, groups: 1, tracks: 1, departmentPath: 1,
            departmentHistory: 1, groupHistory: 1,
            firstLoginAt: 1, invitedAt: 1, createdAt: 1,
          },
        },
      )
      .toArray(),
    docCol.find({ companyCode }).toArray(),
    assignCol.find({ companyCode, revokedAt: null } as never).toArray(),
    trackCol.find({ companyCode, isActive: true }).toArray(),
  ])

  const byDocumentId = new Map(documents.map(d => [d.documentId, d]))

  // Kľúč je osoba + znenie. Ten istý dokument z trasy aj z pridelenia je
  // jedna povinnosť s dvomi dôvodmi, nie dve povinnosti.
  const collected = new Map<string, Duty>()

  const add = (
    person: PersonRow,
    subject: { documentId: string; documentTitle: string; versionId: string; versionLabel: string },
    source: DutySource,
    since: Date | null,
    due: Date | null,
    trackTitle?: string,
  ) => {
    const key = `${person.id} ${subject.versionId}`
    const existing = collected.get(key)
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source)
      if (trackTitle && !existing.trackTitles.includes(trackTitle)) existing.trackTitles.push(trackTitle)
      // Neskorší začiatok vyhráva: nové pridelenie vracia hodiny na nulu.
      if (since && (!existing.since || since > existing.since)) existing.since = since
      // Pri termíne naopak **skorší** vyhráva — prísnejší zaväzuje. Rovnaké
      // pravidlo ako v `pending.ts`; keby tu bolo opačné, výkaz a widget by
      // pri tej istej povinnosti ukázali iný termín.
      if (due && (!existing.due || due < existing.due)) existing.due = due
      return
    }
    collected.set(key, {
      personId: person.id,
      fullName: person.fullName,
      email: person.email,
      documentId: subject.documentId,
      documentTitle: subject.documentTitle,
      versionId: subject.versionId,
      versionLabel: subject.versionLabel,
      sources: [source],
      trackTitles: trackTitle ? [trackTitle] : [],
      since,
      due,
      acknowledgedAt: null,
      readingSeconds: null,
    })
  }

  // ── pridelenia ──
  //
  // Znenie sa berie z **odtlačku v pridelení**, nie z dokumentu. Pridelenie
  // hovorí „potvrď toto znenie"; keby sa medzitým vydalo novšie, povinnosť
  // sa tým nemení — na novú verziu je nové pridelenie s vlastným dôvodom (D37).
  for (const a of assignments) {
    for (const person of people) {
      if (!matchesAudience(person, a.audience)) continue
      add(person, a.subject, "assignment", a.assignedAt ?? null, dueForPerson(a, person))
    }
  }

  // ── trasy ──
  //
  // Tu naopak platí **aktuálne platné znenie**: trasa hovorí „prejdi tento
  // dokument", nie „prejdi toto znenie". Nový človek má čítať to, čo platí
  // dnes, nie to, čo platilo, keď trasa vznikla.
  for (const track of tracks) {
    const members = people.filter(p => (p.tracks ?? []).includes(track.key))
    if (members.length === 0) continue

    for (const step of track.steps) {
      if (step.type !== "document" || !step.requiresAcknowledgement || !step.documentId) continue
      const doc = byDocumentId.get(step.documentId)
      if (!doc) continue
      const effective = effectiveVersion(doc)
      // Dokument bez platného znenia sa potvrdiť nedá (D6), takže z neho
      // povinnosť nevzniká. Keby vznikla, výkaz by tvrdil, že ľudia
      // nepotvrdili niečo, čo im systém nikdy neukázal.
      if (!effective.ok) continue

      for (const person of members) {
        add(person, {
          documentId: doc.documentId,
          documentTitle: doc.title,
          versionId: effective.version.versionId,
          versionLabel: effective.version.label,
        }, "track", accessSince(person), null, track.title)
      }
    }
  }

  const all = [...collected.values()]
  if (all.length === 0) return []

  // ── čo je potvrdené a koľko sa čítalo ──

  const personIds = [...new Set(all.map(d => d.personId))]
  const versionIds = [...new Set(all.map(d => d.versionId))]

  const [ackCol, readCol] = await Promise.all([
    getCollection(ACKNOWLEDGEMENTS_COLLECTION),
    getCollection(READING_COLLECTION),
  ])
  const [acks, reads] = await Promise.all([
    ackCol
      .find(
        { type: "acknowledgement", personId: { $in: personIds }, versionId: { $in: versionIds } },
        { projection: { personId: 1, versionId: 1, acknowledgedAt: 1 } },
      )
      .toArray(),
    readCol
      .find(
        { personId: { $in: personIds }, versionId: { $in: versionIds } },
        { projection: { personId: 1, versionId: 1, seconds: 1 } },
      )
      .toArray(),
  ])

  const pair = (personId: string, versionId: string) => `${personId} ${versionId}`
  const ackAt = new Map(acks.map(a => [pair(a.personId, a.versionId), a.acknowledgedAt as Date]))
  const seconds = new Map(reads.map(r => [pair(r.personId, r.versionId), r.seconds as number]))

  for (const d of all) {
    const key = pair(d.personId, d.versionId)
    d.acknowledgedAt = ackAt.get(key) ?? null
    d.readingSeconds = seconds.get(key) ?? null
    d.sources.sort()
    d.trackTitles.sort()
  }

  return all
}

// ── zhrnutia ────────────────────────────────────────────────────────────────

export interface Summary {
  key: string
  label: string
  /** Druhý riadok — verzia, e-mail, kľúč trasy. Podľa pohľadu. */
  detail: string
  total: number
  done: number
  /** Medián viditeľného času v sekundách; `null`, keď sa nič nenameralo. */
  medianSeconds: number | null
}

/**
 * Medián, nie priemer.
 *
 * Jeden človek, ktorý nechal kartu otvorenú do stropu štyroch hodín, posunie
 * priemer celej smernice o hodiny. Medián posunie o jedno miesto v poradí.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function summarize(
  rows: Duty[],
  keyOf: (d: Duty) => string,
  labelOf: (d: Duty) => string,
  detailOf: (d: Duty) => string,
): Summary[] {
  const groups = new Map<string, Duty[]>()
  for (const d of rows) {
    const key = keyOf(d)
    const list = groups.get(key)
    if (list) list.push(d)
    else groups.set(key, [d])
  }

  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      label: labelOf(list[0]),
      detail: detailOf(list[0]),
      total: list.length,
      done: list.filter(d => d.acknowledgedAt).length,
      // Do mediánu ide len to, čo sa naozaj nameralo. Nenameraný čas ako nula
      // by z každej novej smernice spravil „nikto ju nečíta".
      medianSeconds: median(
        list.map(d => d.readingSeconds).filter((s): s is number => s !== null),
      ),
    }))
    // Najprv to, kde chýba najviac — to je to, s čím sa dá niečo spraviť.
    .sort((a, b) => (b.total - b.done) - (a.total - a.done) || a.label.localeCompare(b.label))
}

export function byDocument(rows: Duty[]): Summary[] {
  return summarize(rows, d => d.versionId, d => d.documentTitle, d => d.versionLabel)
}

export function byPerson(rows: Duty[]): Summary[] {
  return summarize(rows, d => d.personId, d => d.fullName, d => d.email)
}

/**
 * Podľa trás. Povinnosti z čistého pridelenia sem nepatria — nemajú trasu
 * a riadok „(bez trasy)" by v pohľade, ktorý sa volá „podľa trasy", len
 * miešal dve rôzne veci.
 */
export function byTrack(rows: Duty[]): Summary[] {
  const expanded = rows.flatMap(d => d.trackTitles.map(title => ({ ...d, trackTitles: [title] })))
  return summarize(expanded, d => d.trackTitles[0], d => d.trackTitles[0], d => "")
}
