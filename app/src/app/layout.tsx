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

export const metadata: Metadata = {
  title: "Contineo — testovacie rozhranie",
  description: "Overovanie kvality odpovedí nad normami a smernicami.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <Hlavicka />
        <main>{children}</main>
      </body>
    </html>
  )
}
