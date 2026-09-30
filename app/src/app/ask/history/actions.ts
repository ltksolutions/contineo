"use server"

/**
 * Akcie stránky „Moje otázky" (`/ask/history`, ASK-historia-otazok).
 *
 * Formuláre, nie volania z klienta — × aj „Vymazať celú históriu" fungujú
 * bez JavaScriptu. Osoba a organizácia z prihlásenia (D32); skrytie nie je
 * výmaz (H2).
 */

import { redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { hideQuestion, unhideQuestion, hideAll, unhideAll } from "@/lib/askHistory"

async function who() {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/sign-in")
  return { personId: ctx.person.id, companyCode: ctx.tenant.companyCode }
}

/** Späť na zoznam s tým istým hľadaním — bez toho by × hľadanie zahodilo. */
function back(fd: FormData, extra: Record<string, string> = {}): string {
  const q = String(fd.get("q") ?? "").trim()
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...extra })
  const s = params.toString()
  return `/ask/history${s ? `?${s}` : ""}`
}

export async function hideQuestionAction(fd: FormData) {
  const { personId, companyCode } = await who()
  const id = String(fd.get("id") ?? "")
  const ok = await hideQuestion(companyCode, personId, id)
  redirect(back(fd, ok ? { hidden: id } : {}))
}

export async function unhideQuestionAction(fd: FormData) {
  const { personId, companyCode } = await who()
  await unhideQuestion(companyCode, personId, String(fd.get("id") ?? ""))
  redirect(back(fd))
}

export async function hideAllAction(fd: FormData) {
  const { personId, companyCode } = await who()
  const { at } = await hideAll(companyCode, personId)
  redirect(back(fd, { cleared: at.toISOString() }))
}

export async function unhideAllAction(fd: FormData) {
  const { personId, companyCode } = await who()
  const at = new Date(String(fd.get("at") ?? ""))
  if (!Number.isNaN(at.getTime())) await unhideAll(companyCode, personId, at)
  redirect(back(fd))
}
