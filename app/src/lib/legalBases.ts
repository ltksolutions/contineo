/**
 * legalBases.ts — číselník právnych základov (D92, nadväzuje na D91 a O15).
 *
 * ## Dve úrovne, zámerne oddelené
 *
 * **Kategória** (`legal_obligation` / `legitimate_interest`) je pevne v kóde
 * (`versionResponsibility.ts`). Od nej sa odvíja, čo systém urobí pri žiadosti
 * o výmaz alebo pri námietke — organizácia si ju meniť nemá.
 *
 * **Položka** je konkrétny právny základ: názov, kategória a odkaz na predpis
 * („BOZP — § 7 zák. č. 124/2006 Z. z."). Zodpovedná osoba vyberá **len**
 * z ponuky (rozhodnutie 2026-09-23) — voľný text by ten istý zákon citoval
 * desiatimi spôsobmi.
 *
 * ## Odkiaľ ponuka je
 *
 * - štandardné položky sú v kóde (`codelists/legalBasis.json`) — každá
 *   organizácia ich má hneď, do jej dát sa nič nezapisuje;
 * - organizácia štandardnú položku **skryje**, ale neprepíše
 *   (`tenant.legalBasesHidden`);
 * - vlastné položky organizácie sú v `tenant.legalBases` a **nemažú sa**,
 *   len vyradia (`retiredAt`) — znenia na ne odkazujú.
 *
 * Znenie si pri výbere uloží kľúč **a kópiu** názvu, kategórie a odkazu. Keď
 * sa číselník neskôr zmení, znenie ani potvrdenia sa spätne nezmenia.
 *
 * Tento súbor je bez databázy — pravidlá sa dajú otestovať bez Monga.
 */

import raw from "@/codelists/legalBasis.json"
import { isLegalBasis, legalBasisProblem, tidyReference, MAX_LEGAL_REFERENCE, type LegalBasis } from "./versionResponsibility"
import { KEY_PATTERN } from "./codelists"

/** Strop poľa na obrazovke — ten istý ako pri overení. */
export const MAX_LEGAL_REFERENCE_FIELD = MAX_LEGAL_REFERENCE

export interface LegalBasisItem {
  key: string
  label: string
  basis: LegalBasis
  reference: string | null
}

/** Vlastná položka organizácie. */
export interface TenantLegalBasis extends LegalBasisItem {
  createdAt: Date
  createdBy: string
  /** Vyradená z ponuky. Znenia, ktoré ju majú, si ju nesú ďalej. */
  retiredAt?: Date | null
}

/** Tá časť tenanta, ktorú číselník potrebuje. */
export interface LegalBasisTenant {
  legalBases?: TenantLegalBasis[]
  legalBasesHidden?: string[]
}

export const STANDARD_LEGAL_BASES: readonly LegalBasisItem[] = Object.freeze(
  (raw.items as { key: string; label: string; basis: string; reference: string | null }[])
    .filter(i => isLegalBasis(i.basis))
    .map(i => ({ key: i.key, label: i.label, basis: i.basis as LegalBasis, reference: i.reference ?? null })),
)

export type LegalBasisOption = LegalBasisItem & { source: "standard" | "custom" }

/** Ponuka pre zodpovednú osobu — štandardné bez skrytých, vlastné bez vyradených. */
export function legalBasisOptions(tenant: LegalBasisTenant | null | undefined): LegalBasisOption[] {
  const hidden = new Set(tenant?.legalBasesHidden ?? [])
  return [
    ...STANDARD_LEGAL_BASES.filter(i => !hidden.has(i.key)).map(i => ({ ...i, source: "standard" as const })),
    ...(tenant?.legalBases ?? [])
      .filter(i => !i.retiredAt)
      .map(i => ({ key: i.key, label: i.label, basis: i.basis, reference: i.reference ?? null, source: "custom" as const })),
  ]
}

/** Položka z **aktívnej** ponuky — skrytá ani vyradená sa vybrať nedá. */
export function findLegalBasisOption(tenant: LegalBasisTenant | null | undefined, key: string): LegalBasisOption | null {
  return legalBasisOptions(tenant).find(o => o.key === key.trim()) ?? null
}

export type LegalBasisItemProblem =
  | "legalBasis.badKey"
  | "legalBasis.labelRequired"
  | "legalBasis.keyTaken"
  | "legalBasis.invalid"
  | "legalBasis.referenceRequired"
  | "legalBasis.referenceTooLong"

/**
 * Dá sa takáto vlastná položka pridať?
 *
 * Kľúč nesmie kolidovať **so žiadnou** existujúcou — ani so skrytou
 * štandardnou, ani s vyradenou vlastnou: na tie sa odkazujú znenia a kľúč
 * s dvoma významami by z nich spravil nečitateľné údaje.
 */
export function newLegalBasisProblem(
  tenant: LegalBasisTenant | null | undefined,
  item: { key: string; label: string; basis: unknown; reference?: string | null },
): LegalBasisItemProblem | null {
  const key = (item.key ?? "").trim().toLowerCase()
  if (!KEY_PATTERN.test(key)) return "legalBasis.badKey"
  if (!(item.label ?? "").trim()) return "legalBasis.labelRequired"
  const taken = STANDARD_LEGAL_BASES.some(i => i.key === key) || (tenant?.legalBases ?? []).some(i => i.key === key)
  if (taken) return "legalBasis.keyTaken"
  const p = legalBasisProblem({ basis: item.basis, reference: item.reference })
  if (p === "legalBasis.invalid" || p === "legalBasis.referenceRequired" || p === "legalBasis.referenceTooLong") return p
  return null
}

/** Uprataná položka na zápis — volať až po `newLegalBasisProblem()`. */
export function tidyLegalBasisItem(item: { key: string; label: string; basis: LegalBasis; reference?: string | null }): LegalBasisItem {
  return {
    key: item.key.trim().toLowerCase(),
    label: item.label.trim(),
    basis: item.basis,
    reference: tidyReference(item.reference),
  }
}
