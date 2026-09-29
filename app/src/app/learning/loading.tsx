/**
 * Kostra: vzdelávanie — moje kurzy.
 */

import { SkeletonHeading, SkeletonCard } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonCard lines={3} />
    </SkeletonShell>
  )
}
