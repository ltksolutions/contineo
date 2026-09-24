/**
 * Polia údajov o znení (ADR-013) — autor, schválil, dátum schválenia, dátum
 * účinnosti. Tie isté pri novom dokumente, novom znení aj na detaile.
 *
 * Autor a Schválil sú voľný text s návrhmi (`<datalist>`): hodnoty už použité
 * v organizácii a názvy jej útvarov. Funguje bez JavaScriptu.
 *
 * Hodnota vo formulári je uložený údaj, a keď chýba, **návrh** z prvej strany
 * dokumentu (D108) — ten sa uloží až odoslaním formulára.
 */

import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { VersionMeta } from "@/lib/versionMeta"

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "")

export default function VersionMetaFields({
  value,
  suggestion,
  authors,
  approvers,
  language,
  disabled = false,
}: {
  value?: VersionMeta | null
  suggestion?: VersionMeta | null
  authors: string[]
  approvers: string[]
  language: UiLanguage
  disabled?: boolean
}) {
  const t = dictionary(language).versionMeta
  const pick = <K extends keyof VersionMeta>(k: K) => value?.[k] ?? suggestion?.[k] ?? null
  return (
    <div className="upload-grid">
      <label className="field">
        <span className="field-label">{t.author}</span>
        <input className="field-input" name="metaAuthor" list="meta-authors" maxLength={200}
               defaultValue={pick("author") ?? ""} disabled={disabled} />
        <span className="quiet field-hint">{t.authorHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.approvedBy}</span>
        <input className="field-input" name="metaApprovedBy" list="meta-approvers" maxLength={200}
               defaultValue={pick("approvedBy") ?? ""} disabled={disabled} />
        <span className="quiet field-hint">{t.approvedByHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.approvedOn}</span>
        <input className="field-input" type="date" name="metaApprovedOn"
               defaultValue={iso(pick("approvedOn"))} disabled={disabled} />
      </label>
      <label className="field">
        <span className="field-label">{t.effectiveFrom}</span>
        <input className="field-input" type="date" name="metaEffectiveFrom"
               defaultValue={iso(pick("effectiveFrom"))} disabled={disabled} />
        <span className="quiet field-hint">{t.effectiveFromHint}</span>
      </label>
      <datalist id="meta-authors">{authors.map(a => <option key={a} value={a} />)}</datalist>
      <datalist id="meta-approvers">{approvers.map(a => <option key={a} value={a} />)}</datalist>
    </div>
  )
}
