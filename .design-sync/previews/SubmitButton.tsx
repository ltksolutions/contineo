import { SubmitButton } from 'contineo-design-system'

/** Plné tlačidlo formulára — najviac jedno na obrazovke, vpravo. */
export function Primary() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <SubmitButton>Uložiť zmeny</SubmitButton>
    </form>
  )
}

/** Tiché tlačidlo — vedľajšia akcia. */
export function Quiet() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <SubmitButton className="button button--quiet">Zaevidovať námietku</SubmitButton>
    </form>
  )
}

/** Riadok akcií: tiché vľavo, plné posledné. */
export function ActionRow() {
  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <SubmitButton className="button button--quiet" name="intent" value="draft">Uložiť koncept</SubmitButton>
      <SubmitButton name="intent" value="publish">Zverejniť znenie</SubmitButton>
    </form>
  )
}
