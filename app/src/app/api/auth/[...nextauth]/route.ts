/**
 * NextAuth route handler.
 *
 * Konfigurácia sa skladá **pri každej požiadavke** podľa hostiteľa (D44).
 * Nie je to zbytočná práca: ktorý Microsoft je „ten správny", závisí od
 * domény — na `intranet.futbalsfz.sk` je to Entra zväzu, na našej doméne naša
 * skúšobná aplikácia. Zoznam poskytovateľov preto nemôže byť konštanta
 * vyhodnotená pri štarte.
 *
 * Cena je jedno prečítanie tenanta navyše, a to má vlastnú pamäť
 * (`tenants.ts`), takže do databázy sa pri tom väčšinou vôbec nejde.
 */

import NextAuth from "next-auth"
import { authOptionsForHost } from "@/lib/auth"
import type { NextRequest } from "next/server"

type Kontext = { params: Promise<{ nextauth: string[] }> }

async function handler(req: NextRequest, ctx: Kontext) {
  // Za proxy Vercelu je pôvodný hostiteľ v `x-forwarded-host`; `host` môže
  // byť interná adresa. Poradie je preto takéto a nie opačné.
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim()

  const options = await authOptionsForHost(host)
  return NextAuth(req, ctx, options)
}

export { handler as GET, handler as POST }
