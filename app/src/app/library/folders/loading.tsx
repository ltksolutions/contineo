/**
 * Kostra: správa priečinkov — strom priečinkov a formulár nového.
 */

import { SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

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
