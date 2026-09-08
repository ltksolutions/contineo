"use client"

/**
 * Potvrdzovacie tlačidlo.
 *
 * **Je to formulár, nie `fetch`.** Predtým posielalo `POST` na
 * `/api/acknowledgements` skriptom — bez JavaScriptu teda tlačidlo mlčalo
 * a človek nemal ako potvrdiť, že sa s normou oboznámil. Pri právne záväznom
 * úkone (dôkazný záznam D24) je to priveľa: prehliadač bez skriptu, firemná
 * politika, výpadok pri načítaní balíka — a záväzok sa nedá splniť.
 *
 * Klientský komponent zostáva kvôli jedinej veci: `useFormStatus()` dá stav
 * odosielania, takže tlačidlo počas zápisu povie „Potvrdzujem…". Bez toho
 * človek klikne druhýkrát. Druhý klik síce nič nepokazí (unikátny index,
 * D24), ale ticho po prvom vyzerá ako pokazená stránka. Bez skriptu ten stav
 * nie je — a to je v poriadku: formulár odošle prehliadač sám a odpovie
 * presmerovanie s hlásením.
 *
 * Do akcie ide **len `documentId`**. Verziu aj znenie určuje server.
 */

import { useFormStatus } from "react-dom"

function Submit({ label, pending }: { label: string; pending: string }) {
  // `useFormStatus()` musí byť vnútri formulára, preto vlastný komponent —
  // v rodičovi by vracal stav nadradeného formulára, teda vždy `false`.
  const status = useFormStatus()
  return (
    <button className="button" type="submit" disabled={status.pending} style={{ minWidth: 180 }}>
      {status.pending ? pending : label}
    </button>
  )
}

export default function AcknowledgeButton({
  documentId,
  action,
  labels,
}: {
  documentId: string
  /** Serverová akcia zo stránky dokumentu. */
  action: (fd: FormData) => Promise<void>
  labels: {
    button: string
    pending: string
  }
}) {
  return (
    <form action={action}>
      <input type="hidden" name="documentId" value={documentId} />
      <Submit label={labels.button} pending={labels.pending} />
    </form>
  )
}
