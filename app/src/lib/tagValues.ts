/**
 * tagValues.ts — značky dokumentu z formulára (ZAKLAD-vyber-skupin-a-znaciek,
 * 8. 10. 2026): zaškrtnuté kľúče + nové z poľa „Nová značka".
 *
 * Nová značka (Q2): z napísaného názvu vznikne kľúč ako v `KeyFromLabel`
 * („Štart hráča" → `start_hraca`) a položka sa založí v číselníku
 * organizácie s týmto názvom — dovtedy vznikla len ako kľúč na dokumente,
 * bez názvu, a názov s diakritikou `checkValue` odmietol.
 *
 * Podobná nová značka (Q3) sa nezaloží; volajúci ju vráti ako varovanie.
 */

import { readValues, splitSimilar } from "./valueSelect"
import { slugifyKey } from "./slug"
import { tagOptions } from "./libraryRead"
import { addCodelistItem } from "./codelistsTenant"
import { CodelistError, type CodelistExtras } from "./codelists"

export async function tagsFromForm(
  fd: FormData,
  companyCode: string,
  actor: string,
  extras?: CodelistExtras,
): Promise<{ tags: string[]; similar: { value: string; like: string }[] }> {
  const { picked, fresh, forced } = readValues(fd, "tags")
  const options = await tagOptions(companyCode, extras)
  const byKey = new Map(options.map(o => [o.value, o.label ?? o.value]))
  const tags = picked.map(v => v.trim().toLowerCase())
  // Nová hodnota, ktorej kľúč už existuje, je len zaškrtnutie existujúcej.
  const unknown: string[] = []
  for (const label of fresh) {
    const key = slugifyKey(label)
    if (!key) continue
    if (byKey.has(key)) tags.push(key)
    else unknown.push(label)
  }
  const { keep, similar: near } = splitSimilar(unknown, [...byKey.values()], forced)
  // Podobnosť sa hľadá v názvoch; späť ide kľúč existujúcej značky — ten sa
  // dá zaškrtnúť.
  const keyOf = new Map([...byKey].map(([k, label]) => [label, k]))
  const similar = near.map(x => ({ value: x.value, like: keyOf.get(x.like) ?? x.like }))
  for (const label of keep) {
    const key = slugifyKey(label)
    try {
      await addCodelistItem(companyCode, "tags", key, label, actor)
    } catch (e) {
      // Súbežne ju založil niekto iný — stačí ju použiť.
      if (!(e instanceof CodelistError && e.code === "codelist.alreadyThere")) throw e
    }
    tags.push(key)
  }
  return { tags: [...new Set(tags)], similar }
}
