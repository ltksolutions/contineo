/**
 * layout.tsx — obal celej aplikácie.
 *
 * Zatiaľ je to testovacie rozhranie pre hodnotenie kvality odpovedí (D9),
 * nie produkčný portál. Preto `noindex`: obsahom sú interné normy a nechceme
 * ich vo vyhľadávačoch, ani keď je stránka za prihlásením.
 */

import type { Metadata } from "next"
import "./globals.css"
import Hlavicka from "@/components/Hlavicka"
import Paticka from "@/components/Paticka"
import Sedenie from "@/components/Sedenie"
import { currentTenant, currentEmail } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"

export const metadata: Metadata = {
  title: "Contineo — testovacie rozhranie",
  description: "Overovanie kvality odpovedí nad normami a smernicami.",
  robots: { index: false, follow: false },
}

/**
 * Vzhľad tenanta sa načítava tu, teda **raz na požiadavku**, a nie v každej
 * stránke zvlášť — hlavička je spoločná a inak by sa vetvila podľa toho,
 * odkiaľ sa na ňu človek pozerá.
 *
 * Výpadok databázy sa **nesmie** prejaviť ako biela obrazovka: obal celej
 * aplikácie je posledné miesto, kde má zmysel padnúť. Bez tenanta zostane
 * pôvodná značka a stránka sa vykreslí.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let branding
  try {
    const tenant = await currentTenant()
    if (tenant) branding = brandingView(tenant)
  } catch (e) {
    console.error("[layout] vzhľad tenanta sa nepodarilo načítať:", e)
  }

  // Rovnaká opatrnosť ako pri vzhľade: keď sa relácia nedá prečítať, stránka
  // sa má vykresliť ako pre neprihláseného, nie spadnúť.
  let email: string | undefined
  try {
    email = (await currentEmail()) ?? undefined
  } catch (e) {
    console.error("[layout] reláciu sa nepodarilo prečítať:", e)
  }

  return (
    <html lang="sk">
      {/* Stĺpec s `min-height`, aby pätička na krátkej stránke sedela dole
          a nie hneď pod obsahom uprostred prázdnej obrazovky. */}
      <body style={{ ...tenantStyle(branding), minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <Sedenie>
          <Hlavicka branding={branding} email={email} />
          <main style={{ flex: 1 }}>{children}</main>
          <Paticka />
        </Sedenie>
      </body>
    </html>
  )
}
