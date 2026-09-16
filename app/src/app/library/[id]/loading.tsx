/**
 * Kostra: detail predpisu
 *
 * Hlavička, karta s metúdajmi a zoznam znení. Znení býva málo, preto štyri
 * — kostra desiatich nad zoznamom o dvoch je viditeľný skok.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={4} />
        <SkeletonList items={4} />
      </div>
    </SkeletonShell>
  )
}
