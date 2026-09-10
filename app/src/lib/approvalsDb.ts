/**
 * approvalsDb.ts — kolá schvaľovania v databáze (ADR-006).
 *
 * Pravidlá sú vedľa v `approvals.ts` a sú **bez databázy**. Tento súbor len
 * číta a zapisuje; čo sa smie a čo nie, rozhoduje tam. Delenie je zámerné:
 * pravidlo, na ktorom stojí brána pri prideľovaní, sa musí dať otestovať bez
 * Monga a bez toho, aby si ho niekto domýšľal z dotazu.
 *
 * Kolekcia je **append-only**, ako `acknowledgements`. Kolo sa nemaže a text
 * predloženia sa nemení; druhé kolo po zamietnutí je **nové kolo**. Inak by
 * z histórie zmizlo, že prvý pokus neprešiel — a práve to je na nej to
 * cenné.
 */

import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { writeAudit } from "./audit"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { DOCUMENTS_COLLECTION } from "./documents"
import {
  APPROVALS_COLLECTION, submitProblem, versionState, decideProblem, roundOutcome,
  type ApprovalRound, type ApproverDecision, type VersionState,
} from "./approvals"

export class ApprovalError extends AppError {}

/** Kolá pre jedno znenie, od najstaršieho. */
export async function roundsForVersion(
  companyCode: string,
  documentId: string,
  versionId: string,
): Promise<ApprovalRound[]> {
  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  return col
    .find({ companyCode, documentId, versionId })
    .sort({ round: 1 })
    .toArray()
}

/**
 * Kolá pre celý dokument, zoskupené podľa znenia.
 *
 * Detail dokumentu ukazuje všetky znenia naraz; jeden dotaz namiesto dotazu
 * na každé znenie. Pri desiatich zneniach je to rozdiel medzi jedným
 * a desiatimi kolami komunikácie s databázou pri každom otvorení stránky.
 */
export async function roundsByVersion(
  companyCode: string,
  documentId: string,
): Promise<Map<string, ApprovalRound[]>> {
  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  const all = await col.find({ companyCode, documentId }).sort({ round: 1 }).toArray()

  const out = new Map<string, ApprovalRound[]>()
  for (const r of all) {
    const list = out.get(r.versionId)
    if (list) list.push(r)
    else out.set(r.versionId, [r])
  }
  return out
}

/** Stav znenia — kolá plus príznak z D74. */
export function stateOf(
  rounds: ApprovalRound[] | undefined,
  publishedBefore?: boolean,
): VersionState {
  return versionState(rounds ?? [], { publishedBefore })
}

export interface SubmitInput {
  companyCode: string
  documentId: string
  versionId: string
  /** `persons.id`, nie adresy — odtlačok sa berie zo záznamu osoby, nie z formulára. */
  approverIds: string[]
  note?: string
  submittedBy: string
  /** Znenie zverejnené pred zavedením schvaľovania (D74). */
  publishedBefore?: boolean
}

/**
 * Otvorí nové kolo schvaľovania.
 *
 * **Mená sa berú zo záznamu osoby, nie z formulára.** Odtlačok mena v kole je
 * dôkazná vec (D24) a formulár je vstup od človeka: kto si ho prepíše, prepíše
 * si aj to, kto podľa záznamu schvaľoval. Preto sem chodia `persons.id`
 * a meno aj adresa sa dotiahnu na serveri.
 */
export async function submitForApproval(input: SubmitInput): Promise<ApprovalRound> {
  const persons = await getCollection<Person>(PERSONS_COLLECTION)

  // Len osoby z **vlastnej** organizácie (D32) a nie vyradené: kolo, ktoré
  // čaká na človeka, čo v zväze už nie je, sa neuzavrie nikdy. Pozvaný, ktorý
  // sa ešte neprihlásil, schvaľovateľ byť môže — prihlásiť sa vie.
  const ids = [...new Set(input.approverIds.map(v => v.trim()).filter(Boolean))]
  const chosen = ids.length === 0 ? [] : await persons
    .find({ companyCode: input.companyCode, id: { $in: ids }, status: { $ne: "inactive" } })
    .toArray()

  if (chosen.length !== ids.length) {
    throw new ApprovalError(
      "approval.unknownApprover",
      "Niektorý z vybraných schvaľovateľov tu nie je alebo je vyradený.",
    )
  }

  const rounds = await roundsForVersion(input.companyCode, input.documentId, input.versionId)
  const problem = submitProblem({
    rounds,
    approvers: chosen.map(p => p.email),
    submittedBy: input.submittedBy,
    publishedBefore: input.publishedBefore,
  })
  if (problem) throw new ApprovalError(problem, `Znenie sa nedá predložiť: ${problem}`)

  const approvers: ApproverDecision[] = chosen.map(p => ({
    email: p.email,
    fullName: p.fullName,
    decidedAt: null,
    decision: null,
  }))

  const round: ApprovalRound = {
    companyCode: input.companyCode,
    documentId: input.documentId,
    versionId: input.versionId,
    // Číslo z počtu kôl, nie z databázového čítača: kolá sa nemažú, takže
    // počet je poradie. Jedinečnosť stráži index.
    round: rounds.length + 1,
    submittedBy: input.submittedBy,
    submittedAt: new Date(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    approvers,
    closedAt: null,
    outcome: null,
  }

  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  try {
    await col.insertOne(round as ApprovalRound)
  } catch (e) {
    // Dvaja ľudia stlačili „Predložiť" naraz. Index na
    // {companyCode, documentId, versionId, round} to zachytí a druhý dostane
    // vetu, nie chybovú stránku.
    if (typeof e === "object" && e !== null && (e as { code?: number }).code === 11000) {
      throw new ApprovalError(
        "approval.alreadyRunning",
        "Kolo schvaľovania pre toto znenie už beží.",
      )
    }
    throw e
  }

  // Audit až po úspešnom zápise (D51).
  await writeAudit({
    companyCode: input.companyCode,
    subject: "document",
    action: "submitted-for-approval",
    actor: input.submittedBy,
    targetId: input.documentId,
    targetLabel: input.documentId,
    note:
      `Znenie ${input.versionId}, kolo ${round.round}. ` +
      `Schvaľovatelia: ${approvers.map(a => a.fullName).join(", ")}.` +
      (round.note ? ` Poznámka: ${round.note}` : ""),
  })

  return round
}

/**
 * Zruší bežiace kolo — jediná cesta, ako sa zo zoznamu schvaľovateľov dostane
 * ten, kto tam byť nemá (ADR-006, časť 5).
 *
 * Kolo sa **nemaže**: dostane výsledok `rejected` a poznámku, kto ho zrušil
 * a prečo. Zmazané kolo by z histórie odstránilo, že sa raz predložilo niečo,
 * čo sa predkladať nemalo — a to je práve to, čo má byť vidieť.
 */
export async function cancelRound(input: {
  companyCode: string
  documentId: string
  versionId: string
  reason: string
  by: string
}): Promise<void> {
  const reason = input.reason.trim()
  if (!reason) {
    throw new ApprovalError("approval.reasonRequired", "Bez dôvodu sa kolo zrušiť nedá.")
  }

  const rounds = await roundsForVersion(input.companyCode, input.documentId, input.versionId)
  const last = rounds[rounds.length - 1]
  if (!last || last.outcome !== null) {
    throw new ApprovalError("approval.nothingRunning", "Pre toto znenie nebeží žiadne kolo.")
  }

  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  const now = new Date()
  await col.updateOne(
    { companyCode: input.companyCode, documentId: input.documentId, versionId: input.versionId, round: last.round },
    {
      $set: {
        outcome: "rejected",
        closedAt: now,
        note: `${last.note ? `${last.note}\n\n` : ""}Kolo zrušil predkladateľ (${input.by}): ${reason}`,
      },
    },
  )

  await writeAudit({
    companyCode: input.companyCode,
    subject: "document",
    action: "approval-cancelled",
    actor: input.by,
    targetId: input.documentId,
    targetLabel: input.documentId,
    note: `Znenie ${input.versionId}, kolo ${last.round}. Dôvod: ${reason}`,
  })
}

/** Kolá, v ktorých tento človek ešte nerozhodol. Obrazovka schvaľovateľa. */
export async function roundsWaitingFor(
  companyCode: string,
  email: string,
): Promise<ApprovalRound[]> {
  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  return col
    .find({
      companyCode,
      outcome: null,
      approvers: { $elemMatch: { email: email.trim().toLowerCase(), decision: null } },
    })
    .sort({ submittedAt: 1 })
    .toArray()
}

/**
 * Zapíše rozhodnutie jedného schvaľovateľa a — ak tým kolo skončilo — kolo
 * uzavrie.
 *
 * **Rozhodnutie sa nemení** (D24): zapisuje sa len tomu, kto ešte nerozhodol,
 * a podmienka je súčasťou dotazu, nie len kontrolou pred ním. Dvaja ľudia,
 * ktorí kliknú naraz, tak nemôžu prepísať jeden druhého — a ten istý človek
 * nemôže dvoma kartami zapísať dve rôzne veci.
 */
export async function decide(input: {
  companyCode: string
  documentId: string
  versionId: string
  round: number
  by: string
  decision: "approved" | "rejected"
  reason?: string
}): Promise<{ outcome: "approved" | "rejected" | null }> {
  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  const key = {
    companyCode: input.companyCode,
    documentId: input.documentId,
    versionId: input.versionId,
    round: input.round,
  }

  const current = await col.findOne(key)
  if (!current) throw new ApprovalError("approval.nothingRunning", "Také kolo tu nie je.")

  const problem = decideProblem({
    round: current,
    by: input.by,
    decision: input.decision,
    reason: input.reason,
  })
  if (problem) throw new ApprovalError(problem, `Rozhodnúť sa nedá: ${problem}`)

  const me = input.by.trim().toLowerCase()
  const now = new Date()
  const written = await col.updateOne(
    { ...key, outcome: null, approvers: { $elemMatch: { email: me, decision: null } } },
    {
      $set: {
        "approvers.$[ja].decision": input.decision,
        "approvers.$[ja].decidedAt": now,
        ...(input.decision === "rejected" ? { "approvers.$[ja].reason": input.reason?.trim() } : {}),
      },
    },
    { arrayFilters: [{ "ja.email": me, "ja.decision": null }] },
  )
  if (written.modifiedCount !== 1) {
    // Medzi čítaním a zápisom sa niečo zmenilo — kolo sa uzavrelo alebo
    // rozhodnutie už pribudlo. Nezapisujeme nasilu.
    throw new ApprovalError("approval.alreadyDecided", "Toto rozhodnutie je už zapísané.")
  }

  // Výsledok kola sa počíta z rozhodnutí, ktoré sú **v databáze**, nie z tých,
  // ktoré sme si domysleli — inak by súbežný zápis druhého schvaľovateľa
  // vypadol z výpočtu.
  const after = await col.findOne(key)
  const outcome = after ? roundOutcome(after.approvers) : null
  if (outcome) {
    await col.updateOne({ ...key, outcome: null }, { $set: { outcome, closedAt: new Date() } })
  }

  await writeAudit({
    companyCode: input.companyCode,
    subject: "document",
    action: input.decision === "approved" ? "approved" : "rejected",
    actor: input.by,
    targetId: input.documentId,
    targetLabel: input.documentId,
    note:
      `Znenie ${input.versionId}, kolo ${input.round}.` +
      (input.reason?.trim() ? ` Dôvod: ${input.reason.trim()}` : "") +
      (outcome ? ` Kolo uzavreté: ${outcome}.` : ""),
  })

  return { outcome }
}

/**
 * Zapíše, komu sa o kole ozvalo (ADR-006, krok 5).
 *
 * Volá sa **po** odoslaní a len pre tých, ktorým správa naozaj odišla.
 * Zapísať to dopredu by znamenalo tvrdiť, že sa človek dozvedel niečo, čo mu
 * nikdy neprišlo — a práve na túto otázku má pole odpovedať.
 */
export async function markNotified(input: {
  companyCode: string
  documentId: string
  versionId: string
  round: number
  emails: string[]
}): Promise<void> {
  const emails = input.emails.map(e => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) return

  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  await col.updateOne(
    {
      companyCode: input.companyCode,
      documentId: input.documentId,
      versionId: input.versionId,
      round: input.round,
    },
    { $set: { "approvers.$[komu].notifiedAt": new Date() } },
    { arrayFilters: [{ "komu.email": { $in: emails } }] },
  )
}

/**
 * Bežiace kolá v organizácii — „čaká na schválenie" (ADR-006, krok 6).
 *
 * Zoznam, nie počet: číslo bez mien hovorí, že sa niečo deje, ale nie, či sa
 * čaká deň alebo mesiac a na koho. Práve to je jediné, čo s tým vie
 * predkladateľ urobiť.
 */
export async function openRounds(companyCode: string): Promise<ApprovalRound[]> {
  const col = await getCollection<ApprovalRound>(APPROVALS_COLLECTION)
  return col.find({ companyCode, outcome: null }).sort({ submittedAt: 1 }).toArray()
}

/**
 * Názvy dokumentov ku kolám.
 *
 * Kolo si názov **neukladá** zámerne: názov je vec dokumentu a mení sa, kým
 * kolo je záznam o rozhodovaní. Odtlačok mena schvaľovateľa je iná vec — ten
 * v zázname byť musí (D24), lebo bez neho sa nedá povedať, kto rozhodol.
 */
export async function documentTitles(
  companyCode: string,
  documentIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(documentIds)]
  if (ids.length === 0) return new Map()

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const rows = await col
    .find({ companyCode, documentId: { $in: ids } }, { projection: { documentId: 1, title: 1 } })
    .toArray()
  return new Map(rows.map(d => [String(d.documentId), String(d.title ?? d.documentId)]))
}
