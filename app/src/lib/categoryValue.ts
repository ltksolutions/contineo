/**
 * categoryValue.ts — Druh dokumentu z formulára nahrávania, aj nový
 * (ZAKLAD-novy-druh-pri-nahravani, 2. 11. 2026).
 *
 * Vybraný druh ide ďalej bez zmeny. Napísaný nový (`categoryNew`) sa založí
 * v číselníku organizácie **naraz s dokumentom** (Q3) — rovnako ako nová
 * značka v `tagValues.ts`. Smie to len správca číselníkov (Q1); kontrola je
 * tu, nie len v tom, že formulár riadok „+ Pridať" iným neukáže.
 *
 * Podobný názov („Rozpisy" popri „Rozpis") sa nezaloží: druh je povinný,
 * takže dokument dostane ten existujúci a hlásenie po nahratí to povie.
 * Druhý takmer rovnaký druh by rozdelil knižnicu aj filtre na dve kôpky.
 */

import { slugifyKey } from "./slug"
import { addCodelistItem } from "./codelistsTenant"
import { CodelistError, codelistFor, type CodelistExtras } from "./codelists"
import { similarValue, foldValue } from "./valueSelect"
import { LibraryError } from "./libraryWrite"

export interface CategoryFromForm {
  category?: string
  /** Doplnky s práve založeným druhom — `checkMetadata` ho inak odmietne. */
  extras?: CodelistExtras
  /** Názov založeného druhu, do hlásenia po nahratí. */
  created?: string
  /** Nový druh sa nezaložil, dokument dostal podobný existujúci. */
  similar?: { value: string; like: string }
}

function field(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

export async function categoryFromForm(
  fd: FormData,
  companyCode: string,
  actor: string,
  canCreate: boolean,
  extras?: CodelistExtras,
): Promise<CategoryFromForm> {
  const fresh = field(fd, "categoryNew")
  if (!fresh) return { category: field(fd, "category") || undefined, extras }
  if (!canCreate) {
    throw new LibraryError("library.categoryNotAllowed", "Nový druh dokumentu môže pridať len správca číselníkov.")
  }

  const items = codelistFor("category", extras).items
  const label = (key: string) => items.find(i => i.key === key)?.label ?? key
  // Ten istý názov (aj bez diakritiky) alebo ten istý kľúč = existujúci druh.
  const same = items.find(i => foldValue(i.label ?? i.key) === foldValue(fresh) || i.key === slugifyKey(fresh))
  if (same) return { category: same.key, extras }
  const like = similarValue(fresh, items.map(i => i.label ?? i.key))
  if (like) {
    const key = items.find(i => (i.label ?? i.key) === like)?.key ?? like
    return { category: key, extras, similar: { value: fresh, like: label(key) } }
  }

  const key = slugifyKey(fresh)
  const role = field(fd, "categoryRole") || "guidance"
  try {
    await addCodelistItem(companyCode, "category", key, fresh, actor, role)
  } catch (e) {
    // Súbežne ho založil niekto iný — stačí ho použiť.
    if (!(e instanceof CodelistError && e.code === "codelist.alreadyThere")) throw e
  }
  const added = { key, label: fresh, role } as NonNullable<CodelistExtras["category"]>[number]
  return {
    category: key,
    extras: { ...extras, category: [...(extras?.category ?? []), added] },
    created: fresh,
  }
}
