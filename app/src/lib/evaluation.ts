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
import type { RatingRecord } from "./ratings"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"
import { loadPersonsByIds } from "./people"

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
  asker: { name: string; email: string; role: string | null } | "gone" | null
}

const MAX_QUEUE = 200

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
  // Staršie záznamy nemajú `askedBy`; pred posudkom je v `reviewer` ten, kto sa pýtal.
  const askerId = (z: RatingRecord) => z.askedBy ?? z.reviewer ?? z.readerNoteBy ?? null
  const people = await loadPersonsByIds(companyCode, pending.map(askerId).filter((id): id is string => Boolean(id)))
  return pending.map(z => {
    const id = askerId(z)
    const p = id ? people.get(id) : undefined
    return {
    id: String(z._id),
    question: z.question ?? "",
    answer: z.answer ?? "",
    askedAt: z.createdAt ?? new Date(0),
    readerVerdict: z.readerVerdict ?? null,
    readerNote: z.readerNote ?? "",
    sources: (z.sources ?? []).map(s => ({ title: s.title, articleRef: s.articleRef })),
    asker: !id ? null : p ? { name: p.fullName, email: p.email, role: p.jobTitle || p.department || null } : "gone",
    }
  })
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
