/**
 * evaluation.ts — kto smie posudzovať odpovede systému a čo naňho čaká.
 *
 * **Prečo vlastná rola.** Panel pod odpoveďou videl doteraz každý prihlásený
 * a písal priamo do záznamu — posudok kolegu z matriky a posudok legislatívca
 * boli v databáze nerozoznateľné. Rozhodnutie Jána Letka (2026-09-15): bežný
 * človek povie len **„sedí / nesedí"** a čo mu na odpovedi vadilo; či mal
 * pravdu, potvrdí alebo opraví **hodnotiteľ**. Až potvrdený posudok je
 * podklad pre kuráciu — D11 revidované, bez kolekcie `qa_pairs`; stav páru
 * je na tom istom zázname (`lib/curation.ts`).
 *
 * Rovnaký vzor ako `hr.ts` a `people.ts`: rola platí **vo vlastnej
 * organizácii** a nikde inde. Obe podmienky musia sedieť naraz — rola aj
 * zhoda `companyCode` s tenantom hostiteľa (D29, D32).
 *
 * Identifikátor je `evaluator`, nie `reviewer`: `reviewer` je na zázname
 * hodnotenia pole s iným významom (kto bol prihlásený, keď odpoveď vznikla)
 * a dve rôzne veci s jedným menom sa raz zamenia.
 */

import { getCollection } from "./mongodb"
import { currentTenant, currentPerson } from "./session"
import { RATINGS_COLLECTION } from "./ratings"
import type { RatingRecord, RatingOrigin } from "./ratings"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"
// Nie `people.ts`: ten importuje `EVALUATOR_ROLE` odtiaľto a kruh v produkčnom
// bundli zhodil `/api/rating` — konštanta bola pri prvom použití ešte
// neinicializovaná (30. 10. 2026, posudok sa neukladal).
import { PERSONS_COLLECTION } from "./persons"

export const EVALUATOR_ROLE = "evaluator"

export function isEvaluator(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(EVALUATOR_ROLE))
}

export type EvaluationContext =
  /** Hostiteľ nepatrí žiadnemu tenantovi — stránka tu neexistuje (D29). */
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  /** Prihlásený, ale rolu nemá. Z pohľadu stránky to isté ako zlý hostiteľ. */
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function evaluationContext(): Promise<EvaluationContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť. Bez tenanta sa nepokračuje.
    console.error("[evaluation] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isEvaluator(person)) {
    return { state: "forbidden" }
  }
  return { state: "ready", person, tenant }
}

// ── čo patrí do fronty ──────────────────────────────────────────────────────

/**
 * Patrí záznam hodnotiteľovi na stôl?
 *
 * Čistá funkcia zámerne: to isté pravidlo potrebuje zoznam, počet pri
 * navigácii aj test, a tri kópie podmienky by sa raz rozišli.
 *
 * Do fronty ide **len to, kde niečo nesedí** (rozhodnutie 2026-09-15).
 * Potvrdená správna odpoveď hodnotiteľa nezdržuje — jeho čas je to najdrahšie,
 * čo v tomto cykle je, a míňať ho na potvrdzovanie „áno, bolo to dobré" by
 * znamenalo to isté zlyhanie ako zlatá sada: fronta, do ktorej sa nikto
 * nepozrie.
 *
 * Nesedí znamená ktorékoľvek z troch:
 *   • čitateľ povedal „nesedí" (`readerVerdict === 0`),
 *   • čitateľ napísal, čo je zle (`readerNote`),
 *   • na zázname už je posudok „nesprávna" alebo „halucinácia" — to sú
 *     staršie záznamy z čias, keď panel videl každý.
 */
export function needsEvaluation(z: Partial<RatingRecord>): boolean {
  if (z.evaluatedAt) return false
  return (
    z.readerVerdict === 0 ||
    Boolean(z.readerNote?.trim()) ||
    z.correct === 0 ||
    z.hallucination === 1
  )
}

/** Položka fronty — len to, čo obrazovka vykreslí. */
export interface QueueItem {
  id: string
  question: string
  answer: string
  askedAt: Date
  /** Čo povedal čitateľ. `null` = nepovedal nič, prišiel len popis. */
  readerVerdict: 0 | 1 | null
  readerNote: string
  sources: { title: string; articleRef?: string }[]
  /**
   * Kto sa pýtal (Ján 30. 10. 2026: „potrebujem pri nich aj info o osobe").
   * `null` = nikto nebol prihlásený; `gone` = osoba už v adresári nie je
   * (záznam drží len odkaz, pri výmaze osoby zmizne s ňou — `ratings.ts`).
   */
  asker: PersonInfo | "gone" | null
  /** Odkiaľ otázka prišla (Ján 30. 10. 2026). `null` = záznam spred zavedenia poľa. */
  origin: RatingOrigin | null
  /** Ako sa o podnete rozhodlo — len v pohľadoch Posúdené a Vyradené. */
  decision?: Decision
}

export interface PersonInfo { name: string; email: string; role: string | null }

export interface Decision {
  kind: "assessed" | "dismissed"
  at: Date
  /** Hodnotiteľ; `gone` = už nie je v adresári. */
  by: PersonInfo | "gone" | null
  correct: 0 | 1 | null
  hallucination: 0 | 1 | null
  verifiedAnswer: string
  correctSources: string
}

/**
 * Pohľady fronty (Ján 30. 10. 2026: „keď rozhodnem o podnetoch, nemám
 * prístup k potvrdeným, vyradeným"). Kľúče sú v adrese `?view=`.
 */
export const EVALUATION_VIEWS = ["pending", "assessed", "dismissed"] as const
export type EvaluationView = (typeof EVALUATION_VIEWS)[number]

export function evaluationView(raw: string | undefined): EvaluationView {
  return (EVALUATION_VIEWS as readonly string[]).includes(raw ?? "") ? (raw as EvaluationView) : "pending"
}

const MAX_QUEUE = 200

/** Osoby z adresára **vlastnej organizácie** podľa `id` — jedným dotazom. */
async function peopleById(companyCode: string, ids: (string | null | undefined)[]): Promise<Map<string, PersonInfo>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (!wanted.length) return new Map()
  const rows = await (await getCollection<Person>(PERSONS_COLLECTION))
    // `companyCode` je v podmienke, nie v kontrole nad ňou (D32).
    .find({ companyCode, id: { $in: wanted } }, { projection: { id: 1, fullName: 1, email: 1, jobTitle: 1, department: 1 } })
    .toArray()
  return new Map(rows.map(p => [p.id, { name: p.fullName, email: p.email, role: p.jobTitle || p.department || null }]))
}

const lookup = (people: Map<string, PersonInfo>, id: string | null | undefined) =>
  !id ? null : people.get(id) ?? "gone"

/**
 * Kto sa pýtal. Staršie záznamy nemajú `askedBy`; **pred posudkom** je
 * v `reviewer` ten, kto sa pýtal — po posudku je tam hodnotiteľ, preto sa
 * pri vybavenom zázname naň nesiaha.
 */
const askerId = (z: RatingRecord) =>
  z.askedBy ?? (z.evaluatedAt ? undefined : z.reviewer) ?? z.readerNoteBy ?? null

function toItem(z: RatingRecord, people: Map<string, PersonInfo>): QueueItem {
  return {
    id: String(z._id),
    question: z.question ?? "",
    answer: z.answer ?? "",
    askedAt: z.createdAt ?? new Date(0),
    readerVerdict: z.readerVerdict ?? null,
    readerNote: z.readerNote ?? "",
    sources: (z.sources ?? []).map(s => ({ title: s.title, articleRef: s.articleRef })),
    origin: z.origin ?? null,
    asker: lookup(people, askerId(z)),
  }
}

/**
 * Čo čaká na hodnotiteľa v jeho organizácii.
 *
 * `companyCode` sa berie z kontextu, nikdy z adresy (D32). Staršie záznamy
 * ho nemajú — do fronty sa teda nedostanú vôbec, a je to tak správne: bez
 * neho sa nedá povedať, ktorej organizácii patria.
 */
export async function evaluationQueue(companyCode: string): Promise<QueueItem[]> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const rows = await col
    .find({ companyCode, evaluatedAt: { $exists: false } } as never)
    .sort({ createdAt: -1 })
    .limit(MAX_QUEUE)
    .toArray()

  const pending = rows.filter(needsEvaluation)
  const people = await peopleById(companyCode, pending.map(askerId))
  return pending.map(z => toItem(z, people))
}

/** Podmienka pohľadu Posúdené / Vyradené. */
const decidedFilter = (companyCode: string, kind: Decision["kind"]) => ({
  companyCode,
  evaluatedAt: { $exists: true },
  dismissedAt: { $exists: kind === "dismissed" },
})

/**
 * Posúdené alebo vyradené podnety, najnovšie rozhodnutie prvé. Posúdené sú
 * všetky záznamy s posudkom — aj tie, ktoré hodnotiteľ posúdil priamo pod
 * odpoveďou, nielen z fronty.
 */
export async function evaluationDecided(companyCode: string, kind: Decision["kind"]): Promise<QueueItem[]> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const rows = await col
    .find(decidedFilter(companyCode, kind) as never)
    .sort({ evaluatedAt: -1 })
    .limit(MAX_QUEUE)
    .toArray()
  const people = await peopleById(companyCode, rows.flatMap(z => [askerId(z), z.evaluatedBy]))
  return rows.map(z => ({
    ...toItem(z, people),
    decision: {
      kind,
      at: z.dismissedAt ?? z.evaluatedAt ?? new Date(0),
      by: lookup(people, z.dismissedBy ?? z.evaluatedBy),
      correct: z.correct ?? null,
      hallucination: z.hallucination ?? null,
      verifiedAnswer: z.verifiedAnswer ?? "",
      correctSources: z.correctSources ?? "",
    },
  }))
}

/** Počty pre prepínač pohľadov a súhrn posudkov. */
export interface EvaluationCounts {
  pending: number
  assessed: number
  dismissed: number
  correct: number
  wrong: number
  hallucination: number
}

export async function evaluationCounts(companyCode: string): Promise<EvaluationCounts> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const assessed = decidedFilter(companyCode, "assessed")
  const count = (q: Record<string, unknown>) => col.countDocuments(q as never)
  const [pending, assessedN, dismissed, correct, wrong, hallucination] = await Promise.all([
    queueCount(companyCode),
    count(assessed),
    count(decidedFilter(companyCode, "dismissed")),
    count({ ...assessed, correct: 1 }),
    count({ ...assessed, correct: 0 }),
    count({ ...assessed, hallucination: 1 }),
  ])
  return { pending, assessed: assessedN, dismissed, correct, wrong, hallucination }
}

/**
 * Koľko toho vo fronte je — pre štítok v navigácii.
 *
 * Číta tie isté záznamy ako zoznam a filtruje ich tým istým pravidlom, aby
 * číslo v navigácii sedelo s tým, čo človek po kliknutí uvidí. Pri dnešných
 * objemoch je to jeden dotaz; keby fronta narástla, počíta sa agregáciou.
 */
export async function queueCount(companyCode: string): Promise<number> {
  return (await evaluationQueue(companyCode)).length
}
