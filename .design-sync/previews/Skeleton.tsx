import { Skeleton } from 'contineo-design-system'

/** Riadky textu počas načítania — `skeleton-line` (12 px), posledný kratší. */
export function TextLines() {
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <Skeleton className="skeleton-line" width={140} />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line skeleton-line--last" />
    </div>
  )
}

/** Blok pevnej veľkosti — miesto obrázka alebo tlačidla. */
export function Blocks() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton width={40} height={40} />
      <Skeleton width={120} height={36} />
      <Skeleton width={180} height={36} />
    </div>
  )
}
