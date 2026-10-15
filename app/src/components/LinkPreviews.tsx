/**
 * LinkPreviews — karty náhľadov odkazov von pod správou Kuriéra (ADR-033, D222).
 *
 * Všetko je kópia z odoslania: názov a popis ako obyčajný text (nikdy HTML),
 * obrázok ako miniatúra uložená v Contineo (`data:`), nie z cudzieho
 * servera — ten sa tak nedozvie, kto správu čítal. Bez stavu, použiteľné zo
 * servera aj z klienta (živá vrstva).
 */

import type { PreviewView } from "@/lib/courierLive"

export default function LinkPreviews({ previews }: { previews?: PreviewView[] }) {
  if (!previews?.length) return null
  return (
    <div className="link-previews">
      {previews.map(p => (
        <a key={p.url} className="link-preview" href={p.url} target="_blank" rel="noopener noreferrer nofollow ugc">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: miniatúra uložená so správou, nie súbor na optimalizáciu */}
          {p.image && <img className="link-preview-img" src={p.image} alt="" width={480} height={251} loading="lazy" />}
          <span className="link-preview-body">
            <span className="link-preview-host">{p.siteName || p.host} ↗</span>
            {p.title && <b className="link-preview-title">{p.title}</b>}
            {p.description && <span className="link-preview-desc">{p.description}</span>}
          </span>
        </a>
      ))}
    </div>
  )
}
