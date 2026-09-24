/**
 * ApprovalRounds — história kôl schvaľovania jedného znenia (ADR-006).
 *
 * Nie je to ozdoba: po zamietnutí je to jediné miesto, kde sa dá prečítať,
 * prečo prvý pokus neprešiel a kto to napísal. Vyčlenené z `ApprovalPanel`,
 * aby ju karta postupu znenia (ADR-014) ukazovala rovnako.
 */

import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import type { ApprovalRound } from "@/lib/approvals"

export default function ApprovalRounds({
  versionId,
  rounds,
  language,
}: {
  versionId: string
  rounds: ApprovalRound[]
  language: UiLanguage
}) {
  const t = dictionary(language).library.detail
  return (
    <ul className="approval-rounds">
      {[...rounds].reverse().map(r => (
        <li key={`${versionId}-r${r.round}`}>
          <div className="approval-round-head">
            <strong>{t.approvalRoundHeading(r.round)}</strong>
            <span className="quiet">
              {t.approvalSubmittedBy(r.submittedBy, formatDate(r.submittedAt, language))}
            </span>
          </div>
          {r.note && <div className="quiet approval-note">{r.note}</div>}
          <ul className="approval-people-decided">
            {r.approvers.map(a => (
              <li key={`${versionId}-r${r.round}-${a.email}`}>
                <span>{a.fullName}</span>
                <span className="quiet">
                  {a.decision === "approved" && a.decidedAt
                    ? t.approvalApproved(formatDate(a.decidedAt, language))
                    : a.decision === "rejected" && a.decidedAt
                      ? t.approvalRejected(formatDate(a.decidedAt, language))
                      // V **uzavretom** kole už nikto nečaká: kolo
                      // skončilo a rozhodnutie nepríde. „Čaká" by tam
                      // tvrdilo, že sa na človeka stále čaká — a je to
                      // text v histórii, ktorá má byť dôkazom.
                      : r.outcome === null ? t.approvalWaiting : t.approvalNotDecided}
                </span>
                {/* Dôvod zamietnutia je spätná väzba na prácu človeka —
                    patrí k menu toho, kto ho napísal, nie pod anonymné
                    „zamietnuté". */}
                {a.decision === "rejected" && a.reason && (
                  <span className="approval-reason">{a.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
