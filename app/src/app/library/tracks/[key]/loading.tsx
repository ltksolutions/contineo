/**
 * Kostra: detail trasy
 *
 * Hlavička, karta s popisom trasy a zoznam predpisov v nej.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={2} />
        <SkeletonList items={5} />
      </div>
    </SkeletonShell>
  )
}
