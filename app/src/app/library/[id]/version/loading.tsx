/**
 * Kostra: nové znenie — nadpis, krokovník a formulár nahratia.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    </SkeletonShell>
  )
}
