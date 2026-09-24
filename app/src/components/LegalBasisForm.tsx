/**
 * LegalBasisForm — výber právneho základu znenia z číselníka (D91, D92).
 *
 * Voľný text tu nie je (rozhodnutie 2026-09-23): zodpovedná osoba vyberá
 * z ponuky organizácie, ktorú spravuje správca organizácie. Chýbajúcu
 * položku doplní on — preto nápoveda hovorí, na koho sa obrátiť.
 *
 * Zaškrtávacie políčka zoskupené podľa kategórie (ADR-017, D115): znenie
 * môže mať viac základov, aj z oboch kategórií. Fungujú bez JavaScriptu
 * a odkaz na predpis je vidieť ešte pred výberom.
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
  currentKeys,
  options,
  language,
  back,
}: {
  documentId: string
  versionId: string
  current?: LegalBasis | null
  /** Kľúče základov, ktoré znenie má (ADR-017). */
  currentKeys?: string[]
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
              <label key={o.key} className="hr-choice hr-choice--tile">
                <input type="checkbox" name="legalBasisKey" value={o.key} defaultChecked={currentKeys?.includes(o.key)} />
                <span>
                  {o.label}
                  {/* Odkaz na zákon na vlastnom riadku (ZNENIE-kontakt-a-privacy, bod 4). */}
                  {o.reference && <span className="quiet field-hint hr-choice-ref">{o.reference}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )
      })}
      <span className="quiet field-hint">{t.multipleNote} {t.missingOptionNote}</span>

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
