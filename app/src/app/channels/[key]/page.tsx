/**
 * /channels/[key] — rozcestník kanála (D170).
 *
 * Riešiteľa kanála pošle na jeho tickety, správcu organizácie na
 * nastavenie. Kto nie je ani jedno, dostane 404 — kanál, ku ktorému
 * prístup nemá, sa mu nepotvrdí ani neexistenciou.
 */

import { notFound, redirect } from "next/navigation"
import { channelsContext } from "@/lib/helpdeskAgents"
import { channelHref } from "@/components/ChannelTabs"

export const dynamic = "force-dynamic"

export default async function ChannelPage({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const key = decodeURIComponent((await params).key)
  if (ctx.agentChannels.some(c => c.key === key)) redirect(channelHref(key, "tickets"))
  if (ctx.isAdmin && ctx.visible.some(c => c.key === key)) redirect(channelHref(key, "settings"))
  notFound()
}
