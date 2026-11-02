import { RequiredFieldsGuard } from 'contineo-design-system'

/**
 * Formulár s dvoma povinnými poľami. Stlačte „Nahrať" bez vyplnenia: namiesto
 * bubliny prehliadača sa pod poľami ukáže chyba, fokus dostane prvé pole
 * a pri tlačidle súhrn „Chýbajú povinné údaje: …".
 */
export function UploadForm() {
  return (
    <>
      <RequiredFieldsGuard />
      <form onSubmit={(e) => e.preventDefault()} className="card" style={{ display: 'grid', gap: 20, padding: 20, maxWidth: 520 }}>
        <label className="field">
          <span className="field-label">Názov</span>
          <input className="field-input" name="title" required />
          <span className="quiet field-hint">Objaví sa doslovne v potvrdzovacej formulke.</span>
          <p className="field-error"><span className="field-error-mark" aria-hidden="true">!</span>Doplňte názov dokumentu.</p>
        </label>
        <label className="field">
          <span className="field-label">Účinnosť od</span>
          <input className="field-input" name="effectiveFrom" type="date" required />
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <p className="form-summary" role="status" aria-live="polite"
            data-one="Chýba povinný údaj: {names}." data-many="Chýbajú povinné údaje: {names}." />
          <button type="submit" className="button">Nahrať</button>
        </div>
      </form>
    </>
  )
}
