/**
 * Kostra: pozvanie do systému
 *
 * Políčko je vysoké 38 px ako skutočný `input`. Na formulári je skok
 * najviditeľnejší — človek už mieri kurzorom tam, kde čaká prvé pole.
 */

import { SkeletonHeading, SkeletonForm } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <SkeletonForm fields={3} />
    </SkeletonShell>
  )
}
