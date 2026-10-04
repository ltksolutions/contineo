import { Select } from 'contineo-design-system'

/** Výber v poli formulára — kanál námietky. */
export function FormField() {
  return (
    <label className="field" style={{ maxWidth: 320 }}>
      <span className="field-label">Ako prišla</span>
      <Select
        name="channel"
        initial="email"
        language="sk"
        options={[
          { value: 'email', label: 'e-mailom' },
          { value: 'letter', label: 'listom' },
          { value: 'in-person', label: 'osobne' },
          { value: 'other', label: 'inak' },
        ]}
      />
    </label>
  )
}

/** Dlhý zoznam s hľadaním a cestou v strome — oddelenie osoby. */
export function SearchableTree() {
  return (
    <label className="field" style={{ maxWidth: 360 }}>
      <span className="field-label">Oddelenie</span>
      <Select
        name="department"
        initial="it"
        searchable
        language="sk"
        options={[
          { value: 'sekr', label: 'Sekretariát' },
          { value: 'it', label: 'Oddelenie IT', path: 'Sekretariát' },
          { value: 'ekon', label: 'Ekonomické oddelenie', path: 'Sekretariát' },
          { value: 'legal', label: 'Legislatíva', path: 'Sekretariát' },
          { value: 'komisie', label: 'Komisie' },
          { value: 'disc', label: 'Disciplinárna komisia', path: 'Komisie' },
          { value: 'rozh', label: 'Komisia rozhodcov', path: 'Komisie' },
          { value: 'mladez', label: 'Komisia mládeže', path: 'Komisie' },
          { value: 'media', label: 'Médiá a komunikácia' },
        ]}
      />
    </label>
  )
}
