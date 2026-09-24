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
      {/* Pod 640 px dlaždica na palec (ZNENIE-kontakt-a-privacy, bod 5);
          od 640 px tlačidlo a riadok pod vloženým PDF ako doteraz. */}
      <a className="pdf-tile" href={href} target="_blank" rel="noreferrer">
        <span className="pdf-tile-ico" aria-hidden="true">PDF</span>
        <span className="pdf-tile-main">
          <span className="pdf-tile-name">{labels.open}</span>
          <span className="pdf-tile-meta">{name} · {size}</span>
        </span>
        <span className="pdf-tile-go" aria-hidden="true">↗</span>
      </a>
      <p className="pdf-view-link">
        <a className="button button--quiet" href={href} target="_blank" rel="noreferrer">{labels.open}</a>
        <span className="quiet">{name} · {size}</span>
      </p>
    </div>
  )
}
