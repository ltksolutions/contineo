/**
 * Kostra: dokument na potvrdenie
 *
 * Hlavička, karta so stavom potvrdenia a pod ňou samotný text v ráme
 * `.document-sheet` — v tom, ktorý od 2026-09-16 oddeľuje dokument od
 * zvyšku obrazovky.
 */

import { SkeletonShell, SkeletonHeading, SkeletonCard, SkeletonText } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonHeading />
      <div style={{ display: "grid", gap: "var(--gap)" }}>
        <SkeletonCard lines={2} />
        <div className="card document-sheet">
          <SkeletonText lines={12} />
        </div>
      </div>
    </SkeletonShell>
  )
}
