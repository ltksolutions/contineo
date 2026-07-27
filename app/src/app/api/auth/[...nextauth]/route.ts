/**
 * NextAuth route handler. Konfigurácia je v `src/lib/auth.ts`, aby sa dala
 * použiť aj na serverových stránkach, nielen tu.
 */
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
