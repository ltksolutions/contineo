/**
 * askHistoryApi.ts — spoločná brána API histórie otázok.
 *
 * Osoba aj organizácia idú **z prihlásenia, nikdy z požiadavky** (D32) —
 * história je vždy „moja", cudzia sa nedá vypýtať ani poznaným id.
 */

import { NextResponse } from "next/server"
import { onboardingContext } from "./session"

export async function historyCaller() {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") return { error: new Response(null, { status: 404 }) } as const
  if (ctx.state === "not-signed-in") return { error: NextResponse.json({ error: "not-signed-in" }, { status: 401 }) } as const
  if (ctx.state !== "ready") return { error: NextResponse.json({ error: "not-in-tenant" }, { status: 403 }) } as const
  return { personId: ctx.person.id, companyCode: ctx.tenant.companyCode } as const
}
