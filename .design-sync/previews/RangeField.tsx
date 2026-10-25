import { RangeField } from 'contineo-design-system'

/** Stropy úsekov v nastavení AI asistentov — posuvník s popisom, hodnotou a nápovedou. */
export function SearchCaps() {
  return (
    <div className="card" style={{ display: 'grid', gap: 18, padding: 20, maxWidth: 520 }}>
      <RangeField
        name="capDocuments"
        label="Knižnica a konektory — úsekov z každého zdroja"
        hint="Predvolene 8. Pod 3 chýba asistentovi kontext, nad 15 zaplní jedno hľadanie veľkú časť konverzácie."
        min={3}
        max={15}
        defaultValue={8}
      />
      <RangeField
        name="capLaw"
        label="Legislatíva — úsekov zo Slov-Lexu"
        hint="Predvolene 4. Paragraf zákona býva dlhší než úsek knižnice."
        min={1}
        max={8}
        defaultValue={4}
      />
    </div>
  )
}

/** Krajné hodnoty rozsahu — najmenej a najviac. */
export function Bounds() {
  return (
    <div className="card" style={{ display: 'grid', gap: 18, padding: 20, maxWidth: 520 }}>
      <RangeField name="low" label="Pripomenúť dní pred termínom" min={1} max={14} defaultValue={1} />
      <RangeField name="high" label="Pripomenúť dní pred termínom" min={1} max={14} defaultValue={14} />
    </div>
  )
}
