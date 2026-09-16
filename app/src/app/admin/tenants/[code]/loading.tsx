/**
 * Kostra: detail tenanta
 *
 * Hlavička a tri karty nastavení — údaje, vzhľad, doména.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </SkeletonShell>
  )
}
