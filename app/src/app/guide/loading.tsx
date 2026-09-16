/**
 * Kostra: návod
 *
 * Samy text, žiadny zoznam — kostra je preto odseková.
 */

import { SkeletonShell, SkeletonHeading, SkeletonText } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div className="card">
        <SkeletonText lines={10} />
      </div>
    </SkeletonShell>
  )
}
