/**
 * Prihlasovacia stránka.
 *
 * Bez hesla — zadá sa e-mail a príde odkaz. Stránka zámerne nehovorí,
 * či je adresa na zozname pozvaných: po odoslaní ukáže tú istú hlášku
 * v oboch prípadoch. Inak by sa dalo skúšaním adries zistiť, kto zo zväzu
 * má k systému prístup.
 */

import Prihlasenie from "@/components/Prihlasenie"

export const dynamic = "force-dynamic"

// Od Next 15 sú `params` aj `searchParams` prísľuby — stránka sa smie začať
// vykresľovať skôr, než sú známe. Preto `await`, nie priamy prístup.
export default async function StrankaPrihlasenia({
  searchParams,
}: {
  searchParams: Promise<{ odoslane?: string; error?: string }>
}) {
  const parametre = await searchParams
  return (
    <div className="obal" style={{ padding: "64px 20px", maxWidth: 460 }}>
      <Prihlasenie
        odoslane={parametre.odoslane === "1"}
        chyba={parametre.error}
      />
    </div>
  )
}
