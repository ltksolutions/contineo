/**
 * LegalBasisForm — určenie alebo zmena právneho základu znenia (D91, O15).
 *
 * Serverový formulár bez klientskeho stavu. Odkaz na predpis je v DOM stále,
 * aj pri oprávnenom záujme: bez skriptu sa pole skryť nedá a povinnosť pri
 * zákonnej povinnosti stráži server (`legalBasisProblem()`), nie prehliadač.
 *
 * Dôvod sa pýta len pri **zmene** už určeného základu — pri prvom určení nie
 * je čo zdôvodňovať a pole navyše by ľudí učilo písať doň „-“.
 */

import { setLegalBasisAction } from "@/app/documents/[documentId]/actions"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { LEGAL_BASES, MAX_LEGAL_REFERENCE, type LegalBasis } from "@/lib/versionResponsibility"

export default function LegalBasisForm({
  documentId,
  versionId,
  current,
  currentReference,
  language,
  back,
}: {
  documentId: string
  versionId: string
  current?: LegalBasis | null
  currentReference?: string | null
  language: UiLanguage
  /** Kam sa vrátiť po uložení — knižnica alebo znenie pre čitateľa. */
  back: "library" | "document"
}) {
  const t = dictionary(language).responsibility
  return (
    <form action={setLegalBasisAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="back" value={back} />

      <fieldset className="hr-group">
        <legend className="field-label">{t.legalBasis}</legend>
        {LEGAL_BASES.map(b => (
          <label key={b} className="hr-choice">
            <input type="radio" name="legalBasis" value={b} required defaultChecked={current === b} />
            <span>
              {t.basisLabel[b]}
              <span className="quiet field-hint"> {t.basisHint[b]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field-label">{t.reference}</span>
        <input
          className="field-input"
          name="legalBasisReference"
          maxLength={MAX_LEGAL_REFERENCE}
          defaultValue={currentReference ?? ""}
          placeholder={t.referencePlaceholder}
        />
        <span className="quiet field-hint">{t.referenceNote}</span>
      </label>

      {current && (
        <label className="field">
          <span className="field-label">{t.basisReason}</span>
          <input className="field-input" name="reason" required />
          <span className="quiet field-hint">{t.basisReasonNote}</span>
        </label>
      )}

      <div><button className="button" type="submit">{t.saveBasis}</button></div>
    </form>
  )
}
