/**
 * Údaje o znení v jednom riadku (ADR-013) — pri schvaľovaní, v histórii
 * znení a na stránke dokumentu. Chýbajúci údaj sa vynechá; keď nie je
 * žiadny, nekreslí sa nič.
 */

import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"

export default function VersionMetaLine({
  author,
  approvedBy,
  approvedOn,
  effectiveFrom,
  language,
}: {
  author?: string | null
  approvedBy?: string | null
  approvedOn?: Date | null
  effectiveFrom?: Date | null
  language: UiLanguage
}) {
  const t = dictionary(language).versionMeta
  const parts = [
    author && `${t.author}: ${author}`,
    approvedBy && `${t.approvedBy}: ${approvedBy}`,
    approvedOn && `${t.approvedOn}: ${formatDate(approvedOn, language)}`,
    effectiveFrom && `${t.effectiveFrom}: ${formatDate(effectiveFrom, language)}`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: 0, overflowWrap: "anywhere" }}>
      {parts.join(" · ")}
    </p>
  )
}
