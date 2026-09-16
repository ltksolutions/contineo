/**
 * Kostra prihlasovacej obrazovky.
 *
 * **Bez `SkeletonShell`.** Prihlásenie je jediná obrazovka mimo `AppShell`-u —
 * navigácia na nej nie je a kostra pásu odkazov by tam bola sľubom niečoho,
 * čo neexistuje. Rovnaký `.wrap` a rovnaká šírka 460 px ako na stránke.
 */

import { Skeleton } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div className="wrap" style={{ padding: "64px 20px", maxWidth: 460 }}>
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    </div>
  )
}
