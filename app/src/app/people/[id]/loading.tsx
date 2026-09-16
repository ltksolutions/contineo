/**
 * Kostra: karta osoby
 *
 * Hlavička osoby, potom dve karty: údaje a časová os. Riadkov v druhej karte
 * je viac — os býva dlhšia než údaje.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={6} />
      </div>
    </SkeletonShell>
  )
}
