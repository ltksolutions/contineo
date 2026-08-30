"use client"

/**
 * Obal pre `useSession()`.
 *
 * Musí byť klientský komponent, ale layout chceme nechať serverový —
 * preto tento medzikus. Sedenie beží na JWT, takže sa nedopytuje servera
 * pri každom prekliku.
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
