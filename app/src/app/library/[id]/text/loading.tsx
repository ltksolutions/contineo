/**
 * Kostra: znenie predpisu
 *
 * Text predpisu v ráme `.document-sheet` — v tom istom, v akom sa potom
 * číta. Kostra je dlhá zámerne: krátka by vyzerala ako krátky predpis.
 */

import { SkeletonHeading, SkeletonText } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div className="card document-sheet">
        <SkeletonText lines={14} />
      </div>
    </SkeletonShell>
  )
}
