/**
 * Kostra: prehľad HR
 *
 * Nadpis, pás ovládania a zoznam kariet — v tom poradí, v akom ich má aj
 * hotová stránka. Zoznam je stĺpec `.card`, nie panel s riadkami; kostra
 * z panela by mala o medzery medzi kartami menej.
 */

import { SkeletonShell, SkeletonHeading, SkeletonToolbar, SkeletonList } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonToolbar buttons={3} search />
      <SkeletonList items={6} />
    </SkeletonShell>
  )
}
