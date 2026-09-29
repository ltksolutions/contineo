/**
 * Kostra: ochrana údajov (DPO) — dlaždice s počtami, výkaz a námietky.
 */

import { SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={2} />
        <SkeletonList items={6} />
        <SkeletonCard lines={3} />
      </div>
    </SkeletonShell>
  )
}
