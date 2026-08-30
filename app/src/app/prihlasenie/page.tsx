/**
 * Prihlasovacia stránka.
 *
 * Bez hesla — zadá sa e-mail a príde odkaz. Stránka zámerne nehovorí,
 * či je adresa na zozname pozvaných: po odoslaní ukáže tú istú hlášku
 * v oboch prípadoch. Inak by sa dalo skúšaním adries zistiť, kto zo zväzu
 * má k systému prístup.
 */

import { notFound, redirect } from "next/navigation"
import SignIn from "@/components/SignIn"
import { currentTenant, currentEmail } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { availableProviders } from "@/lib/oauth"
import { tenantStyle } from "@/components/TenantHeader"
import type { Tenant } from "@/lib/tenants"

export const dynamic = "force-dynamic"

// Od Next 15 sú `params` aj `searchParams` prísľuby — stránka sa smie začať
// vykresľovať skôr, než sú známe. Preto `await`, nie priamy prístup.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ odoslane?: string; error?: string }>
}) {
  const params = await searchParams

  // Neznámy hostiteľ nedostane ani prihlasovaciu stránku (D29) — ale výpadok
  // databázy sa od neznámej domény musí odlíšiť. Keby sme oboje riešili
  // rovnako, pri výpadku by portál tvrdil stovke ľudí, že ich organizácia
  // neexistuje. Prihlásiť sa pri nedostupnej databáze aj tak nedá, takže
  // strácame len vzhľad, nie kontrolu.
  let tenant: Tenant | null = null
  let databaseFailed = false
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[prihlasenie] tenanta sa nepodarilo načítať:", e)
    databaseFailed = true
  }
  if (!tenant && !databaseFailed) notFound()

  // Kto je prihlásený, nemá na tejto stránke čo robiť: formulár mu ponúka to,
  // čo už má, a nič ho odtiaľ nepustí ďalej. Nastane to vždy, keď odkaz
  // vznikol na tejto stránke, ale aj zo záložky alebo z histórie — preto to
  // rieši stránka sama, nie len `callbackUrl` v odkaze. Až po kontrole
  // hostiteľa: neznáma doména nemá dostať ani presmerovanie (D29).
  if (await currentEmail()) redirect("/")

  const branding = tenant ? brandingView(tenant) : undefined
  // Ktoré kontá má táto organizácia zapnuté (D44). Rozhoduje o tom hostiteľ,
  // nie premenná nasadenia — na doméne zväzu je to Entra zväzu.
  const providers = availableProviders(tenant)

  return (
    <div className="obal" style={{ padding: "64px 20px", maxWidth: 460, ...tenantStyle(branding) }}>
      <SignIn
        odoslane={params.odoslane === "1"}
        chyba={params.error}
        branding={branding}
        poskytovatelia={providers}
      />
    </div>
  )
}
