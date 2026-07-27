/**
 * Domovská stránka testovacieho rozhrania.
 *
 * Účel je jediný: dať hodnotiteľovi vyskúšať, ako systém odpovedá, aby vedel
 * posúdiť, čo je dobrá odpoveď. Až potom má zmysel pýtať sa ho na zlatú sadu
 * (D9, otvorený bod E1).
 */

import Hladanie from "@/components/Hladanie"

export default function Domov() {
  return (
    <div className="obal" style={{ padding: "36px 20px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Vyskúšajte, ako systém odpovedá
        </h1>
        <p className="tichy" style={{ fontSize: 15.5, margin: 0, maxWidth: 620 }}>
          Odpoveď sa skladá výlučne z nahraných dokumentov. Ak informácia
          v nich nie je, systém to má povedať — a to je rovnako dôležité ako
          správna odpoveď.
        </p>
      </div>

      <Hladanie />
    </div>
  )
}
