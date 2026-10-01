/**
 * Výkaz právnych základov ako CSV (ADR-012, D104) — stĺpce na jednom
 * mieste, aby sa dali otestovať bez relácie a databázy.
 */
import type { LegalBasisRow } from "./dpo"
import { toCsv } from "./csv"
import { dictionary, type UiLanguage } from "./i18n"

export function legalBasisCsv(rows: LegalBasisRow[], language: UiLanguage): string {
  const t = dictionary(language).dpo
  return toCsv(rows, [
    { label: "documentId", value: r => r.documentId },
    { label: "title", value: r => r.title },
    { label: "versionId", value: r => r.versionId },
    { label: "versionLabel", value: r => r.versionLabel },
    { label: "effectiveFrom", value: r => (r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : "") },
    { label: "legalBasis", value: r => r.legalBasis ?? "" },
    /*
      Všetky druhy základu, nie len hlavný. Kombinácia „BOZP + interná
      smernica" má `legalBasis` zákonnú povinnosť, ale ráta sa aj medzi
      oprávneným záujmom (ADR-017) — a práve od neho závisí námietka (D105).
      Bez tohto stĺpca CSV ukazovalo menej predpisov s oprávneným záujmom
      než dlaždica na `/dpo` (1. 10. 2026: 2 verzus 4).
    */
    { label: "categories", value: r => r.categories.join(" + ") },
    { label: "basisLabel", value: r => r.basisLabel ?? "" },
    { label: "reference", value: r => r.reference ?? "" },
    { label: "responsibleName", value: r => r.responsible?.fullName ?? "" },
    { label: "responsibleEmail", value: r => r.responsible?.email ?? "" },
    { label: "problems", value: r => r.problems.map(p => t.problems[p]).join("; ") },
  ])
}
