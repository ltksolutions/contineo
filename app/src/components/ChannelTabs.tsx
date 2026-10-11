/**
 * Podmenu sekcie Kanály (D170, Ján 7. 10. 2026).
 *
 * `SectionTabs` — Kanály · Moje tickety. Moje tickety vidí len riešiteľ
 * aspoň jedného kanála; správca bez kanálov by mal jedinú položku, a tá sa
 * nekreslí (CLAUDE.md: podmenu s jedinou položkou sa nekreslí).
 *
 * `ChannelPartTabs` — časti jedného kanála: Tickety (riešiteľ kanála)
 * a Nastavenie (správca organizácie). Správca obsah ticketov nevidí,
 * takže mu podmenu Tickety neukáže — vrátilo by mu 404.
 */

import SectionTabs from "./SectionTabs"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export function channelHref(key: string, part?: "tickets" | "settings" | "proposals" | "faq"): string {
  return `/channels/${encodeURIComponent(key)}${part ? `/${part}` : ""}`
}

export function ChannelSectionTabs({ current, isAgent, language }: { current: string; isAgent: boolean; language?: UiLanguage }) {
  if (!isAgent) return null
  const t = dictionary(language).channels
  return (
    <SectionTabs
      label={t.tabsLabel}
      current={current}
      tabs={[{ href: "/channels", label: t.tabList }, { href: "/channels/tickets", label: t.tabMyTickets }]}
    />
  )
}

export function ChannelPartTabs({ channelKey, current, canTickets, canSettings, canContent = false, hasFaq = false, language }: {
  channelKey: string
  current: string
  canTickets: boolean
  canSettings: boolean
  /** Správca obsahu: Návrhy FAQ a FAQ kanála (ADR-028, D201). */
  canContent?: boolean
  /** Kanál má FAQ dokument (D201) — inak by časť FAQ vrátila 404. */
  hasFaq?: boolean
  language?: UiLanguage
}) {
  const t = dictionary(language).channels
  const tabs = [
    ...(canTickets ? [{ href: channelHref(channelKey, "tickets"), label: t.tabTickets }] : []),
    ...(canContent ? [{ href: channelHref(channelKey, "proposals"), label: t.tabProposals }] : []),
    ...(canContent && hasFaq ? [{ href: channelHref(channelKey, "faq"), label: t.tabFaq }] : []),
    ...(canSettings ? [{ href: channelHref(channelKey, "settings"), label: t.tabSettings }] : []),
  ]
  if (tabs.length < 2) return null
  return <SectionTabs label={t.tabsLabel} current={current} tabs={tabs} />
}
