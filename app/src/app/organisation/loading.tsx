/**
 * Kostra: nastavenia organizácie
 *
 * Nie zoznam, ale stĺpec nastavovacích kariet — preto karty, nie riadky.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
      </div>
    </SkeletonShell>
  )
}
