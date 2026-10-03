import { Icon } from 'contineo-design-system'

const NAV = [
  ['overview', 'Prehľad'], ['library', 'Knižnica'], ['learning', 'Vzdelávanie'], ['toAcknowledge', 'Na potvrdenie'],
  ['assigned', 'Pridelené dokumenty'], ['people', 'Osoby'], ['dpo', 'Ochrana údajov'], ['notifications', 'Upozornenia'],
] as const

/** Ikony sekcií — tá istá sada v lište, menu aj na dlaždiciach Prehľadu. */
export function SectionIcons() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 18px', maxWidth: 420 }}>
      {NAV.map(([name, label]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
          <Icon name={name} />
          <span style={{ fontSize: 'var(--fs-body)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

/** Ovládacie ikony a veľkosti — 17 px predvolene, 21 px zvonček v hlavičke. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: 'var(--ink)' }}>
      <Icon name="search" size={16} />
      <Icon name="filters" />
      <Icon name="grid" size={18} />
      <Icon name="mail" />
      <Icon name="notifications" size={21} />
      <Icon name="more" />
    </div>
  )
}
