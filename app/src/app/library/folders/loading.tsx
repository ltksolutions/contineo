/**
 * Kostra: správa priečinkov — strom priečinkov a formulár nového.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonList items={6} />
        <SkeletonCard lines={2} />
      </div>
    </SkeletonShell>
  )
}
