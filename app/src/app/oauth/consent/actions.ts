"use server"

/**
 * Obrazovka súhlasu — rozhodnutie človeka (ADR-038, D249).
 *
 * Povolenie zapíše súhlas **doslovne v jazyku, v ktorom ho človek videl**
 * (D28) a vráti ho k aplikácii s kódom; zamietnutie vráti `access_denied`.
 * Oboje je presmerovanie na cudziu adresu — tú registroval klient a overil
 * ju `/oauth/authorize`, nie formulár.
 */

import { redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { approveAuthRequest, authRequestById, denyAuthRequest } from "@/lib/oauthServer"
import { brandingView } from "@/lib/tenants"
import { dictionary, formatDate } from "@/lib/i18n"
import { writeAudit } from "@/lib/audit"

async function request(fd: FormData) {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/sign-in")
  const id = typeof fd.get("req") === "string" ? String(fd.get("req")) : ""
  const req = await authRequestById(ctx.tenant.companyCode, id)
  if (!req) redirect("/oauth/consent?expired=1")
  return { ctx, req }
}

export async function approveConsentAction(fd: FormData) {
  const { ctx, req } = await request(fd)
  const { person, tenant } = ctx
  const t = dictionary(person.language).mcp
  const org = brandingView(tenant).displayName
  const scopes = req.scopes.map(s => t.scopes[s].title).join(", ")
  const statement = t.consent.statement(formatDate(new Date(), person.language), person.fullName, person.email, req.clientName, org, scopes)
  const to = await approveAuthRequest(req, { id: person.id, fullName: person.fullName, email: person.email, language: person.language }, statement)
  await writeAudit({
    companyCode: tenant.companyCode, subject: "assistants", action: "granted", actor: person.email,
    targetId: req.clientId, targetLabel: req.clientName, note: req.scopes.join(" "),
  })
  redirect(to)
}

export async function denyConsentAction(fd: FormData) {
  const { req } = await request(fd)
  redirect(await denyAuthRequest(req))
}
