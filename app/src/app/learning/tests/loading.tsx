/**
 * Kostra: testy.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonCard lines={3} />
    </SkeletonShell>
  )
}
