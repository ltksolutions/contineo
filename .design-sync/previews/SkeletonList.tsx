import { SkeletonList } from 'contineo-design-system'

/** Zoznam kariet počas načítania, so štítkom vpravo. */
export function Default() {
  return <div style={{ maxWidth: 560 }}><SkeletonList items={3} /></div>
}

/** Bez štítkov. */
export function NoChip() {
  return <div style={{ maxWidth: 560 }}><SkeletonList items={2} chip={false} /></div>
}
