import { ContineoMark } from 'contineo-design-system'

/** Záložná značka v hlavičke, keď organizácia nenahrala logo — biela na `--accent`, 28 px, r8. */
export function HeaderFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="header-mark" aria-hidden="true"><ContineoMark size={28} /></span>
      <span style={{ fontWeight: 650, fontSize: 15, color: 'var(--ink)' }}>Slovenský futbalový zväz</span>
    </div>
  )
}

/** Samostatná značka vo farbe textu. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, color: 'var(--ink)' }}>
      <ContineoMark size={20} />
      <ContineoMark />
      <ContineoMark size={48} />
    </div>
  )
}
