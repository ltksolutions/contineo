"use client"

/**
 * Obal pre `useSession()`.
 *
 * Musí byť klientský komponent, ale layout chceme nechať serverový —
 * preto tento medzikus. Sedenie beží na JWT, takže sa nedopytuje servera
 * pri každom prekliku.
 */

import { SessionProvider } from "next-auth/react"

export default function Sedenie({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
