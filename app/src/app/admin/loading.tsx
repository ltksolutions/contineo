/**
 * Kostra: správa platformy
 *
 * Nadpis a zoznam kariet v tom poradí, v akom ich má aj hotová stránka.
 */

import { SkeletonHeading, SkeletonList } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonList items={4} />
    </SkeletonShell>
  )
}
