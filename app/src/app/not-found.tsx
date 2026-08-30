/**
 * Stránka 404.
 *
 * Nextov predvolený text je po anglicky („This page could not be found.")
 * a v slovenskom rozhraní vyzerá skôr ako porucha servera než ako preklep
 * v adrese.
 *
 * Túto stránku dostane aj **neznámy hostiteľ** (D29) — ktokoľvek, kto si
 * nasmeruje vlastnú doménu na naše nasadenie. Preto tu nie je ani slovo
 * o tom, čo tu beží: obal v takom prípade nevykreslí hlavičku ani pätičku
 * a text nesmie prezradiť to, čo tým zamlčiavame.
 */

import Link from "next/link"

export default function NotFoundPage() {
  return (
    <div className="obal" style={{ padding: "72px 20px", maxWidth: 520 }}>
      <h1 style={{ fontSize: 27, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
        Stránka sa nenašla
      </h1>
      <p className="tichy" style={{ margin: "0 0 22px", fontSize: 15.5 }}>
        Adresa neexistuje alebo už neplatí.
      </p>
      <Link className="tlacidlo tlacidlo--tiche" href="/">
        Na úvodnú stranu
      </Link>
    </div>
  )
}
