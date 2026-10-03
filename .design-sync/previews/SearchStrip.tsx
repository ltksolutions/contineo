import { SearchStrip } from 'contineo-design-system'

/** Pole hľadania v zozname (knižnica, výkaz DPO) — lupa vnútri, 36 px. GET formulár. */
export function ListSearch() {
  return (
    <form method="get" role="search" onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', maxWidth: 520 }}>
      <SearchStrip name="q" placeholder="Hľadať predpis — názov, základ, zákon, osoba" label="Hľadať predpis" submitLabel="Hľadať" />
    </form>
  )
}

/** S hľadaným výrazom — po odoslaní nesie hodnotu z adresy. */
export function WithQuery() {
  return (
    <form method="get" role="search" onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', maxWidth: 520 }}>
      <SearchStrip name="q" defaultValue="prestup" placeholder="Hľadať v knižnici" label="Hľadať v knižnici" />
    </form>
  )
}
