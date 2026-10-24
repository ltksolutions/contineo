"use server"

/**
 * Pripojené aplikácie — odvolanie vlastného súhlasu (ADR-038, D249).
 * Odvolanie je `revokedAt`, záznam ostáva (D24); tokeny zhasnú okamžite.
 */

import { redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { revokeGrant } from "@/lib/oauthServer"
import { writeAudit } from "@/lib/audit"
import { dictionary } from "@/lib/i18n"

export async function revokeOwnGrantAction(fd: FormData) {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/sign-in")
  const { person, tenant } = ctx
  const t = dictionary(person.language).mcp.apps
  const grantId = typeof fd.get("grantId") === "string" ? String(fd.get("grantId")) : ""
  const clientName = typeof fd.get("clientName") === "string" ? String(fd.get("clientName")) : ""
  const ok = await revokeGrant(tenant.companyCode, grantId, person.email, person.id)
  if (ok) {
    await writeAudit({
      companyCode: tenant.companyCode, subject: "assistants", action: "revoked", actor: person.email,
      targetId: grantId, targetLabel: clientName || null,
    })
  }
  const q = new URLSearchParams({ msg: ok ? t.revokedMessage : t.notFound })
  if (!ok) q.set("error", "1")
  redirect(`/account/apps?${q}`)
}
