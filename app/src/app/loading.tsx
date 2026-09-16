/**
 * Kostra prehľadu (`/`).
 *
 * Prvá obrazovka po prihlásení — a zároveň tá, na ktorú sa chodí najčastejšie.
 * Tvar ide presne po stránke: uvítacia karta s poľom na otázku, pás štyroch
 * dlaždíc a pod ním dva panely. Štyri dlaždice nie sú odhad, toľko ich je
 * v `tiles`; keby ich kostra mala tri, mriežka `.kpi` by po načítaní preskupila
 * celý riadok.
 */

import { Skeleton, SkeletonPanel, SkeletonShell } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <div className="overview">
        <div className="card overview-hero">
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-sub" />
          <div className="overview-ask" style={{ marginTop: 16 }}>
            <Skeleton height={40} />
          </div>
          <div className="overview-suggestions" style={{ marginTop: 12 }}>
            {[112, 148, 96].map(w => (
              <Skeleton key={w} height={28} width={w} />
            ))}
          </div>
        </div>

        <div className="kpi">
          {[0, 1, 2, 3].map(i => (
            <div className="card kpi-tile" key={i}>
              <Skeleton className="skeleton-line" width={72} height={10} />
              <Skeleton className="skeleton-line" width={44} height={18} />
            </div>
          ))}
        </div>

        <div className="overview-panels">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={3} />
        </div>
      </div>
    </SkeletonShell>
  )
}
