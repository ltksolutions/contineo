/**
 * ApprovalPanel.tsx — stav schvaľovania jedného znenia a formuláre k nemu
 * (ADR-006, krok 3).
 *
 * Serverový komponent bez JavaScriptu: predloženie aj zrušenie kola sú
 * obyčajné formuláre nad serverovou akciou. Je to úkon s následkom — kto ho
 * spustí, otvorí ostatným povinnosť rozhodnúť —, takže sa naň nedá spoliehať
 * na skript v prehliadači ani na volanie API z cudzej stránky.
 *
 * **Stav sa nikde neukladá.** Skladá sa z kôl (D27); táto obrazovka je pohľad
 * naň, nie druhý zdroj pravdy.
 */

import { formatDate, dictionary, type UiLanguage } from "@/lib/i18n"
import type { ApprovalRound, VersionState } from "@/lib/approvals"
import { submitForApprovalAction, cancelApprovalAction } from "@/app/library/actions"

export interface ApproverChoice {
  id: string
  fullName: string
  email: string
  department?: string
}

export default function ApprovalPanel({
  documentId,
  versionId,
  state,
  rounds,
  people,
  language,
}: {
  documentId: string
  versionId: string
  state: VersionState
  rounds: ApprovalRound[]
  /** Koho možno vybrať. Predkladateľ je zo zoznamu vynechaný už na serveri. */
  people: ApproverChoice[]
  language: UiLanguage
}) {
  const t = dictionary(language).library.detail
  const label =
    state === "approved" ? t.stateApproved
    : state === "in-review" ? t.stateInReview
    : state === "published-before" ? t.statePublishedBefore
    : t.stateDraft

  const running = rounds.find(r => r.outcome === null)

  return (
    <div className="approval">
      <div className="approval-head">
        <span className={`tag approval-state approval-state--${state}`}>{label}</span>
        {running && (
          <span className="quiet approval-count">
            {running.approvers.filter(a => a.decision !== null).length}/{running.approvers.length}
          </span>
        )}
      </div>

      {state === "published-before" && (
        <p className="quiet approval-note">{t.statePublishedBeforeNote}</p>
      )}

      {/*
        História kôl. Nie je to ozdoba: po zamietnutí je to jediné miesto, kde
        sa dá prečítať, prečo prvý pokus neprešiel a kto to napísal.
      */}
      {rounds.length > 0 && (
        <details className="approval-history">
          <summary className="quiet">{t.approvalHistory(rounds.length)}</summary>
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
                            : t.approvalWaiting}
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
        </details>
      )}

      {state === "draft" && (
        <details className="approval-submit">
          <summary className="quiet">{t.approvalSubmit}</summary>
          <form action={submitForApprovalAction} className="approval-form">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="versionId" value={versionId} />

            <fieldset className="hr-group">
              <legend className="field-label">{t.approvalApprovers}</legend>
              <span className="quiet field-hint">{t.approvalApproversHint}</span>

              {people.length === 0 ? (
                <p className="quiet">{t.approvalNoPeople}</p>
              ) : (
                /*
                  Zaškrtávacie políčka, nie `select multiple`: na telefóne sa
                  viacnásobný výber v rozbaľovacom zozname ovláda zle a bez
                  JavaScriptu ho nemá čo nahradiť. Zoznam je v posuvnom rámiku,
                  aby pri stovke ľudí neodtlačil tlačidlo mimo obrazovku.
                */
                <div className="approval-people">
                  {people.map(p => (
                    <label key={p.id} className="approval-person">
                      <input type="checkbox" name="approver" value={p.id} />
                      <span>
                        <span className="approval-person-name">{p.fullName}</span>
                        <span className="quiet approval-person-meta">
                          {p.department ? `${p.department} · ` : ""}{p.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <label className="field">
              <span className="field-label">{t.approvalNote}</span>
              <textarea
                className="field-input"
                name="note"
                rows={3}
                placeholder={t.approvalNotePlaceholder}
              />
              <span className="quiet field-hint">{t.approvalNoteHint}</span>
            </label>

            <div>
              <button className="button" type="submit" disabled={people.length === 0}>
                {t.approvalSubmitButton}
              </button>
            </div>
          </form>
        </details>
      )}

      {state === "in-review" && (
        <details className="approval-submit">
          <summary className="quiet">{t.approvalCancel}</summary>
          <form action={cancelApprovalAction} className="approval-form">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="versionId" value={versionId} />
            <label className="field">
              <span className="field-label">{t.approvalCancelReason}</span>
              <input className="field-input" name="reason" required />
              <span className="quiet field-hint">{t.approvalCancelHint}</span>
            </label>
            <div>
              <button className="button button--quiet" type="submit">{t.approvalCancelButton}</button>
            </div>
          </form>
        </details>
      )}
    </div>
  )
}
