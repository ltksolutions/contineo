/**
 * Kostra: karta osoby v HR
 *
 * Hlavička, karta s údajmi a zoznam pridelených predpisov.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"

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
