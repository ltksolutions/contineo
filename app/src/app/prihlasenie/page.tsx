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

export default function StrankaPrihlasenia({
  searchParams,
}: {
  searchParams: { odoslane?: string; error?: string }
}) {
  return (
    <div className="obal" style={{ padding: "64px 20px", maxWidth: 460 }}>
      <Prihlasenie
        odoslane={searchParams.odoslane === "1"}
        chyba={searchParams.error}
      />
    </div>
  )
}
