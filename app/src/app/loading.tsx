/**
 * Kostra prehľadu (`/`).
 *
 * Prvá obrazovka po prihlásení — a zároveň tá, na ktorú sa chodí najčastejšie.
 * Tvar ide presne po stránke: oslovenie, pás štyroch
 * dlaždíc, dlaždice sekcií a pod nimi dva panely. Pás cesty Prehľad nemá
 * (`path={false}`). Štyri dlaždice nie sú odhad, toľko ich je
 * v `tiles`; keby ich kostra mala tri, mriežka `.kpi` by po načítaní preskupila
 * celý riadok.
 */

import { Skeleton, SkeletonPanel } from "@/components/Skeleton"
import { SkeletonShell } from "@/components/SkeletonShell"

export default function Loading() {
  return (
    <SkeletonShell path={false}>
      <div className="overview">
        <Skeleton className="skeleton-title" />

        <div className="kpi">
          {[0, 1, 2, 3].map(i => (
            <div className="card kpi-tile" key={i}>
              <Skeleton className="skeleton-line" width={72} height={10} />
              <Skeleton className="skeleton-line" width={44} height={18} />
            </div>
          ))}
        </div>

        {/* Dlaždice sekcií — jedna skupina; koľko ich kto má, kostra nevie. */}
        <div className="section-tiles">
          {[0, 1, 2].map(i => (
            <div className="section-tile" key={i}>
              <Skeleton className="section-tile-icon" />
              <Skeleton className="skeleton-line" width={96} />
              <Skeleton className="skeleton-line" width={170} height={10} />
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
