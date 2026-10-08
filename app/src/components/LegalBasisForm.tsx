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
 * Dôvod sa pýta len pri **zmene** už určeného základu — a nikdy pri
 * pripravovanom znení (`draft`, ADR-023): naň sa ešte nikto nepotvrdil.
 */

import { setLegalBasisAction } from "@/app/documents/[documentId]/actions"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { LEGAL_BASES, type LegalBasis } from "@/lib/versionResponsibility"
import type { LegalBasisOption } from "@/lib/legalBases"
import SubmitButton from "@/components/SubmitButton"

export default function LegalBasisForm({
  documentId,
  versionId,
  current,
  currentKeys,
  options,
  language,
  back,
  draft = false,
  quiet = false,
}: {
  documentId: string
  /** Pri pripravovanom znení (`draft`) sa nevypĺňa. */
  versionId?: string
  current?: LegalBasis | null
  /** Kľúče základov, ktoré znenie má (ADR-017). */
  currentKeys?: string[]
  options: LegalBasisOption[]
  language: UiLanguage
  /** Kam sa vrátiť po uložení — knižnica alebo znenie pre čitateľa. */
  back: "library" | "document"
  /** Základ pripravovaného znenia (ADR-023) — uloží sa na koncept. */
  draft?: boolean
  /**
   * Tiché „Uložiť", keď je na obrazovke viac kariet úloh alebo iná hlavná
   * akcia — plné tlačidlo je najviac jedno (R1; KNIZNICA-akcie-dokumentu Q4).
   */
  quiet?: boolean
}) {
  const t = dictionary(language).responsibility
  return (
    <form action={setLegalBasisAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="documentId" value={documentId} />
      {draft
        ? <input type="hidden" name="draft" value="1" />
        : <input type="hidden" name="versionId" value={versionId ?? ""} />}
      <input type="hidden" name="back" value={back} />

      {LEGAL_BASES.map(category => {
        const list = options.filter(o => o.basis === category)
        if (list.length === 0) return null
        return (
          <fieldset key={category} className="form-group">
            <legend className="form-group-head">{t.basisLabel[category]}</legend>
            {/* Riadky s kruhom vľavo namiesto dlaždíc (ZAKLAD-vyber-a-prepinace). */}
            <div className="card form-group-body form-group-body--rows">
            <div className="form-list">
            {list.map(o => (
              <label key={o.key} className="form-row select-row">
                <input type="checkbox" name="legalBasisKey" value={o.key} defaultChecked={currentKeys?.includes(o.key)} />
                <span className="form-row-main">
                  <span>{o.label}</span>
                  {/* Odkaz na zákon na vlastnom riadku (ZNENIE-kontakt-a-privacy, bod 4). */}
                  {o.reference && <span className="form-row-sub">{o.reference}</span>}
                </span>
              </label>
            ))}
            </div>
            </div>
          </fieldset>
        )
      })}
      <span className="quiet field-hint">{t.multipleNote} {t.missingOptionNote}</span>

      {current && !draft && (
        <label className="field">
          <span className="field-label">{t.basisReason}</span>
          <input className="field-input" name="reason" required />
          <span className="quiet field-hint">{t.basisReasonNote}</span>
        </label>
      )}

      <div><SubmitButton className={quiet ? "button button--quiet" : "button"}>{t.saveBasis}</SubmitButton></div>
    </form>
  )
}
