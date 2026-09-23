/**
 * PDF vložené do stránky — to, čo sa schvaľuje a potvrdzuje (ADR-011, D94).
 *
 * `<object>`, nie vlastný prehliadač: PDF vykreslí prehliadač sám, verne,
 * aj s prílohami a formulármi, a nič netreba doťahovať. Rovnaký prvok už
 * používa editor textu vedľa Markdownu.
 *
 * **Mobile first:** na telefóne je len odkaz. Vložené PDF sa tam zobrazí
 * prvou stranou alebo vôbec (iOS Safari) a človek by si myslel, že dokument
 * má jednu stranu. Od 640 px je PDF vložené a odkaz zostáva pre celú obrazovku.
 */

export default function PdfView({
  href,
  name,
  bytes,
  labels,
}: {
  href: string
  name: string
  bytes: number
  labels: { open: string }
}) {
  const size = bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} kB`
  return (
    <div className="pdf-view">
      <object className="pdf-view-frame" data={href} type="application/pdf" aria-label={name}>
        {/* Prehliadač bez vstavaného PDF zobrazí toto. */}
        <a href={href} target="_blank" rel="noreferrer">{labels.open}</a>
      </object>
      <p className="pdf-view-link">
        <a className="button button--quiet" href={href} target="_blank" rel="noreferrer">{labels.open}</a>
        <span className="quiet">{name} · {size}</span>
      </p>
    </div>
  )
}
