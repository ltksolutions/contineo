/**
 * LegalBasisForm — výber právneho základu znenia z číselníka (D91, D92).
 *
 * Voľný text tu nie je (rozhodnutie 2026-09-23): zodpovedná osoba vyberá
 * z ponuky organizácie, ktorú spravuje správca organizácie. Chýbajúcu
 * položku doplní on — preto nápoveda hovorí, na koho sa obrátiť.
 *
 * Prepínače zoskupené podľa kategórie, nie rozbaľovací zoznam: na telefóne
 * sa ovládajú lepšie, fungujú bez JavaScriptu a odkaz na predpis je vidieť
 * ešte pred výberom.
 *
 * Dôvod sa pýta len pri **zmene** už určeného základu.
 */

import { setLegalBasisAction } from "@/app/documents/[documentId]/actions"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { LEGAL_BASES, type LegalBasis } from "@/lib/versionResponsibility"
import type { LegalBasisOption } from "@/lib/legalBases"

export default function LegalBasisForm({
  documentId,
  versionId,
  current,
  currentKey,
  options,
  language,
  back,
}: {
  documentId: string
  versionId: string
  current?: LegalBasis | null
  currentKey?: string | null
  options: LegalBasisOption[]
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

      {LEGAL_BASES.map(category => {
        const list = options.filter(o => o.basis === category)
        if (list.length === 0) return null
        return (
          <fieldset key={category} className="hr-group">
            <legend className="field-label">{t.basisLabel[category]}</legend>
            {list.map(o => (
              <label key={o.key} className="hr-choice">
                <input type="radio" name="legalBasisKey" value={o.key} required defaultChecked={currentKey === o.key} />
                <span>
                  {o.label}
                  {o.reference && <span className="quiet field-hint"> {o.reference}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )
      })}
      <span className="quiet field-hint">{t.missingOptionNote}</span>

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
