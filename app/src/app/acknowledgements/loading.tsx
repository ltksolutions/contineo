/**
 * Kostra: moje potvrdenia
 *
 * Nadpis a zoznam kariet v tom poradí, v akom ich má aj hotová stránka.
 */

import { SkeletonShell, SkeletonHeading, SkeletonList } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonList items={5} />
    </SkeletonShell>
  )
}
