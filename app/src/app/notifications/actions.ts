"use server"

/**
 * actions.ts — jediný zápis zo zvončeka: označenie prečítaného.
 *
 * `personId` sa berie **z prihlásenej osoby, nikdy z formulára** (D32). Keby
 * prišiel z prehliadača, dalo by sa ním označiť cudzie upozornenia — a hoci by
 * to nič nezničilo, bol by to zápis do cudzieho záznamu.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { onboardingContext } from "@/lib/session"
import { markAllRead } from "@/lib/notifications"
import { dictionary } from "@/lib/i18n"

export async function markAllReadAction() {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") redirect("/")

  const n = await markAllRead(ctx.person.companyCode, ctx.person.id)
  const message = dictionary(ctx.person.language).notifications.allRead(n)

  // Aj hlavička — počet pri zvončeku sa počíta v `layout.tsx` a bez tohto by
  // ostal na starom čísle až do ďalšej navigácie.
  revalidatePath("/", "layout")
  redirect(`/notifications?msg=${encodeURIComponent(message)}`)
}
