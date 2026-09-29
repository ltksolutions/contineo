/**
 * Kostra: karta osoby v HR
 *
 * Hlavička, karta s údajmi a zoznam pridelených predpisov.
 */

import { SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={3} />
        <SkeletonList items={4} />
      </div>
    </SkeletonShell>
  )
}
