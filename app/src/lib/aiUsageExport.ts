/**
 * aiUsageExport.ts — spotreba AI ako tabuľka pre CSV a Excel (D158).
 *
 * Jeden zoznam stĺpcov pre oba formáty: výkaz v CSV a v Exceli sa nesmie
 * líšiť v tom, čo obsahuje — inak by sa dve čísla za ten istý mesiac
 * nedali porovnať.
 *
 * Názvy stĺpcov sú anglické a stabilné (`inputTokens`, `usd`) — výkaz sa
 * spracúva aj skriptom. Popis účelu je v jazyku toho, kto exportuje.
 */

import type { AiUsageRecord } from "./aiUsage"
import { dictionary } from "./i18n"

export type CellValue = string | number | Date

export interface ExportColumn {
  label: string
  value: (r: AiUsageRecord) => CellValue
}

export function usageExportColumns(language: string | undefined): ExportColumn[] {
  const t = dictionary(language).org.aiUsage
  return [
    // Čas ako dátum, nie text — v Exceli sa podľa neho dá zoraďovať a filtrovať.
    { label: "at", value: r => r.at },
    { label: "personName", value: r => r.personName },
    { label: "email", value: r => r.email },
    { label: "purpose", value: r => r.purpose },
    { label: "description", value: r => {
      const p = t.purposes[r.purpose]
      return [p?.label ?? r.purpose, r.subject, p?.why].filter(Boolean).join(" — ")
    } },
    { label: "provider", value: r => r.provider },
    { label: "model", value: r => r.model },
    { label: "keySource", value: r => r.keySource ?? "" },
    { label: "inputTokens", value: r => r.tokens.input },
    { label: "outputTokens", value: r => r.tokens.output },
    { label: "cacheWriteTokens", value: r => r.tokens.cacheWrite },
    { label: "cacheReadTokens", value: r => r.tokens.cacheRead },
    // Plné číslo, nie zaokrúhlené na centy: súčet zaokrúhlených riadkov by
    // sa od súčtu na obrazovke líšil.
    { label: "usd", value: r => r.usd },
    { label: "pricelistVersion", value: r => r.pricelistVersion },
    { label: "failed", value: r => (r.failed ? "yes" : "") },
  ]
}

/** Riadky ako pole polí (hlavička + dáta) — vstup pre SheetJS `aoa_to_sheet`. */
export function usageAoa(rows: AiUsageRecord[], language: string | undefined): CellValue[][] {
  const cols = usageExportColumns(language)
  return [cols.map(c => c.label), ...rows.map(r => cols.map(c => c.value(r)))]
}
