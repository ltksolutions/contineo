import { SkeletonCard } from 'contineo-design-system'

/** Karta počas načítania — nadpis a riadky textu. */
export function Default() {
  return <div style={{ maxWidth: 460 }}><SkeletonCard /></div>
}

/** Krátka karta. */
export function TwoLines() {
  return <div style={{ maxWidth: 460 }}><SkeletonCard lines={2} /></div>
}
