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

import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

export default function UploadSubmit({
  labels,
}: {
  labels: {
    submit: string
    pending: string
    /** „Najprv vyber PDF." — tlačidlo je neaktívne, kým PDF nie je vybrané. */
    pickPdfFirst?: string
  }
}) {
  const status = useFormStatus()
  const ref = useRef<HTMLButtonElement>(null)
  /*
   * Bez PDF je tlačidlo **neaktívne na pohľad** (`aria-disabled`), nie
   * `disabled` (NAHRAVANIE-pdf-a-udaje-o-zneni, bod 5). Odoslanie zastaví
   * `required` na poli PDF — prehliadač ukáže, čo chýba — a server kontrolu
   * drží ďalej. Bez skriptu je tlačidlo aktívne ako doteraz.
   */
  const [hasPdf, setHasPdf] = useState(true)
  useEffect(() => {
    const form = ref.current?.closest("form")
    const input = form?.querySelector<HTMLInputElement>('input[data-upload="pdf"]')
    if (!form || !input || !labels.pickPdfFirst) return
    const check = () => setHasPdf(Boolean(input.files?.length))
    check()
    form.addEventListener("change", check)
    return () => form.removeEventListener("change", check)
  }, [labels.pickPdfFirst])

  // Priebeh ukazuje okno v `UploadFiles` (stred obrazovky); tu stačí, že
  // tlačidlo počas odosielania nepustí druhý klik a povie prečo.
  const waiting = !hasPdf && !status.pending
  return (
    <>
      <button ref={ref} className="button" type="submit" disabled={status.pending}
              aria-disabled={status.pending || waiting}
              aria-describedby={waiting ? "upload-pick-pdf" : undefined}>
        {status.pending ? labels.pending : labels.submit}
      </button>
      {waiting && labels.pickPdfFirst && (
        <span id="upload-pick-pdf" className="upload-submit-note">{labels.pickPdfFirst}</span>
      )}
    </>
  )
}
