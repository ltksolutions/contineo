/**
 * Kostra obrazovky s otázkou (`/ask`).
 *
 * Kreslí sa nadpis (otázka) a riadok pod ním. **Miesto pre odpoveď kostru
 * nemá** — odpoveď v tej chvíli neexistuje ani ako prázdna karta a obdĺžnik
 * na jej mieste by sľuboval obsah, ktorý nepríde. Čakanie na odpoveď má
 * vlastné fázy a kostru v `Answer.tsx`, kde sa naozaj čaká.
 */

import { Skeleton } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell>
      <div className="ask-page">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" width={180} />
      </div>
    </SkeletonShell>
  )
}
