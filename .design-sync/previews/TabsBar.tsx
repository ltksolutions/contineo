import { TabsBar } from 'contineo-design-system'

/** Podmenu sekcie Pridelené dokumenty — pás pod nadpisom, vybraná vo farbe organizácie. */
export function SectionSubmenu() {
  return (
    <div style={{ maxWidth: 760 }}>
      <h1 className="page-title">Pridelené dokumenty</h1>
      <nav className="tabs" aria-label="Časti sekcie">
        <TabsBar>
          <a className="tab" href="#">Pridelenia</a>
          <a className="tab is-active" aria-current="page" href="#">Výkaz potvrdení</a>
          <a className="tab" href="#">Pripomienky</a>
          <a className="tab" href="#">Trasy</a>
          <a className="tab" href="#">Reťaz dôkazov</a>
        </TabsBar>
      </nav>
    </div>
  )
}

/** Tri časti — Správa kurzov. */
export function ThreeParts() {
  return (
    <nav className="tabs" aria-label="Správa kurzov">
      <TabsBar>
        <a className="tab is-active" aria-current="page" href="#">Kurzy</a>
        <a className="tab" href="#">Témy</a>
        <a className="tab" href="#">Smart:tagy</a>
      </TabsBar>
    </nav>
  )
}
