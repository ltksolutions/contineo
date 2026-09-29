/**
 * Kostra: návod
 *
 * Samy text, žiadny zoznam — kostra je preto odseková.
 */

import { SkeletonHeading, SkeletonText } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

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
