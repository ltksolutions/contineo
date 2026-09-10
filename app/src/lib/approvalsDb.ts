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
import {
  APPROVALS_COLLECTION, submitProblem, versionState,
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
