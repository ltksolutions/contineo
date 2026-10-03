import { Fact } from 'contineo-design-system'

/** Súhrn organizácie v správe tenantov — údaj a jeho hodnota. */
export function TenantSummary() {
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, maxWidth: 520 }}>
      <Fact label="Platné predpisy" value="14" />
      <Fact label="Osoby" value="312" />
      <Fact label="Trasy" value="0" muted />
    </div>
  )
}

/** Tlmená hodnota — keď niet čo počítať. */
export function Muted() {
  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <Fact label="Znenia" value="0" muted />
      <Fact label="Posledné prihlásenie" value="—" muted />
    </div>
  )
}
