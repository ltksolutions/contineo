/**
 * Kostra obrazovky s otázkami (`/ask`).
 *
 * Kreslí sa iba to, čo na stránke naozaj je pred prvou otázkou: karta s poľom
 * a príklady pod ňou. **Miesto pre odpoveď kostru nemá** — odpoveď v tej chvíli
 * neexistuje ani ako prázdna karta a obdĺžnik na jej mieste by sľuboval obsah,
 * ktorý nepríde. Čakanie na odpoveď má vlastnú kostru až v `Answer.tsx`, kde
 * sa naozaj čaká.
 *
 * Výška poľa je 92 px — tri riadky `textarea` pri 16 px písme a riadkovaní 1.6
 * plus odsadenie. Pole má 16 px zámerne (iOS Safari), takže sa to číslo nedá
 * zmenšiť bez toho, aby sa zmenšilo aj tam.
 */

import { Skeleton, SkeletonShell } from "@/components/Skeleton"

export default function Loading() {
  return (
    <SkeletonShell>
      <div className="ask-hero">
        <Skeleton height={92} />
        <div className="ask-actions" style={{ marginTop: 10 }}>
          <Skeleton height={36} width={110} />
        </div>
        <div className="ask-examples-wrap">
          <Skeleton className="skeleton-line" width={92} height={11} />
          <div className="ask-examples" style={{ marginTop: 8 }}>
            {[196, 232, 168].map(w => (
              <Skeleton key={w} height={30} width={w} />
            ))}
          </div>
        </div>
      </div>
    </SkeletonShell>
  )
}
