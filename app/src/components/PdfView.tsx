/**
 * PDF znenia priamo na stránke — to, čo sa schvaľuje a potvrdzuje (ADR-011, D94).
 *
 * **Všetky strany pod sebou, na telefóne aj na počítači** (rozhodnutie Jána
 * 30. 9. 2026). Zamestnanec potvrdzuje, že sa s textom oboznámil, takže ho
 * musí vedieť prečítať celý tam, kde potvrdzuje — aj na telefóne.
 *
 * Dovtedy tu bol `<object type="application/pdf">` od 640 px a na telefóne
 * len odkaz. Vložené PDF iOS Safari zobrazí len prvou stranou (alebo vôbec)
 * a človek by si myslel, že dokument má jednu stranu; Chrome na Androide ho
 * nezobrazí vôbec. Strany preto kreslí pdf.js do plátien (`PdfPages`) —
 * rovnako v každom prehliadači.
 *
 * Odkaz „Otvoriť PDF" zostáva **vždy** a nad stranami: na celú obrazovku,
 * na stiahnutie, a bez JavaScriptu alebo pri chybe pdf.js je jediná cesta
 * k textu. Pod 640 px ako dlaždica na palec, od 640 px ako tlačidlo.
 */

import PdfPages, { type PdfPagesLabels } from "./PdfPages"

export default function PdfView({
  href,
  name,
  bytes,
  labels,
}: {
  href: string
  name: string
  bytes: number
  labels: { open: string } & PdfPagesLabels
}) {
  const size = bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} kB`
  return (
    <div className="pdf-view">
      {/* Pod 640 px dlaždica na palec (ZNENIE-kontakt-a-privacy, bod 5);
          od 640 px tlačidlo a riadok s názvom súboru. */}
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
      <PdfPages href={href} labels={{ loading: labels.loading, failed: labels.failed, page: labels.page }} />
    </div>
  )
}
