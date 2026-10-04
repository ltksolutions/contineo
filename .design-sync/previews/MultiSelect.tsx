import { MultiSelect } from 'contineo-design-system'

/** Štítky dokumentu — dá sa napísať aj nová hodnota. */
export function Tags() {
  return (
    <div style={{ maxWidth: 420 }}>
      <MultiSelect
        name="tags"
        label="Štítky"
        allowNew
        language="sk"
        selected={['bozp', 'zamestnanci']}
        placeholder="Pridať štítok"
        options={[
          { value: 'bozp', label: 'bozp', count: 4 },
          { value: 'zamestnanci', label: 'zamestnanci', count: 11 },
          { value: 'rozhodcovia', label: 'rozhodcovia', count: 6 },
          { value: 'mladez', label: 'mládež', count: 3 },
        ]}
      />
    </div>
  )
}

/** Oddelenia ako strom — identifikátory, nič sa nepíše. */
export function Departments() {
  return (
    <div style={{ maxWidth: 420 }}>
      <MultiSelect
        name="department"
        label="Oddelenia"
        caseSensitive
        noscript="checkboxes"
        emit="repeat"
        language="sk"
        selected={['it']}
        note="Oddelenie platí aj pre podriadené."
        options={[
          { value: 'sekr', label: 'Sekretariát', level: 1 },
          { value: 'it', label: 'Oddelenie IT', level: 2, path: 'Sekretariát' },
          { value: 'ekon', label: 'Ekonomické oddelenie', level: 2, path: 'Sekretariát' },
          { value: 'komisie', label: 'Komisie', level: 1 },
          { value: 'disc', label: 'Disciplinárna komisia', level: 2, path: 'Komisie' },
        ]}
      />
    </div>
  )
}
