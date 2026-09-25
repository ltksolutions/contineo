/**
 * Kostra: ochrana údajov (DPO) — dlaždice s počtami, výkaz a námietky.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonList } from "@/components/Skeleton"

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
