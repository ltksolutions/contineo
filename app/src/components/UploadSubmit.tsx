"use client"

/**
 * Tlačidlo „Nahrať a previesť" so stavom počas odosielania.
 *
 * Nahratie normy trvá — súbor putuje na server, uloží sa do GridFS, prevedie
 * na text a rozreže na úseky. Pri 2,5 MB dokumente sú to desiatky sekúnd
 * a dovtedy bola stránka úplne ticho: tlačidlo vyzeralo rovnako, nič sa
 * nehýbalo, a človek nevedel, či klikol, alebo či sa to zaseklo (Ján,
 * 23. 9. 2026). Klikne druhýkrát, alebo odíde.
 *
 * **Formulár zostáva formulárom** — bez JavaScriptu ho odošle prehliadač
 * sám a stav sa len neukáže. Ten istý vzor ako `AcknowledgeButton`:
 * `useFormStatus()` musí byť vnútri `<form>`, preto samostatný komponent.
 *
 * **Pruh nemá percentá, lebo ich nepozná.** Serverová akcia nehlási priebeh
 * odosielania ani prevodu; pruh, ktorý by ukazoval 60 %, by si ich vymyslel.
 * Povie len „pracuje sa" a veta pod ním, čo sa deje a že to môže trvať.
 */

import { useFormStatus } from "react-dom"

export default function UploadSubmit({
  labels,
}: {
  labels: {
    submit: string
    pending: string
    pendingNote: string
  }
}) {
  const status = useFormStatus()
  return (
    <>
      <button className="button" type="submit" disabled={status.pending} aria-disabled={status.pending}>
        {status.pending ? labels.pending : labels.submit}
      </button>
      {/* `role="status"` je v DOM stále, aby ho čítačka ohlásila pri zmene —
          živá oblasť, ktorá vznikne až s obsahom, sa často neprečíta. */}
      <div className="upload-progress" role="status">
        {status.pending && (
          <>
            <span className="upload-progress-bar" aria-hidden="true" />
            <span className="quiet upload-progress-note">{labels.pendingNote}</span>
          </>
        )}
      </div>
    </>
  )
}
