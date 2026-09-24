/**
 * MetaFacts — údaje o znení ako mriežka štyroch faktov (ADR-013).
 *
 * Na detaile v knižnici (krok 2 a 3 postupu znenia) aj na obrazovke
 * schvaľovateľa (rám APPROVALS-pdf-konceptu). Chýbajúci údaj sa na
 * schvaľovaní vynecháva (`omitEmpty`), v knižnici sa ukáže „—" — správca
 * má vidieť, čo ešte chýba.
 */

import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import type { VersionMeta } from "@/lib/versionMeta"

export default function MetaFacts({
  meta,
  language,
  omitEmpty = false,
}: {
  meta: VersionMeta
  language: UiLanguage
  omitEmpty?: boolean
}) {
  const tm = dictionary(language).versionMeta
  const none = dictionary(language).library.detail.side.none
  const day = (v: Date | null) => (v ? formatDate(new Date(v), language) : "")
  const rows: [string, string][] = [
    [tm.author, meta.author ?? ""],
    [tm.approvedBy, meta.approvedBy ?? ""],
    [tm.approvedOn, day(meta.approvedOn)],
    [tm.effectiveFrom, day(meta.effectiveFrom)],
  ]
  return (
    <dl className="facts">
      {rows.filter(([, v]) => v || !omitEmpty).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v || none}</dd></div>
      ))}
    </dl>
  )
}
