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
 *
 * **Značka „len tu"** (na dokumente, ale nie v číselníku — z čias pred Q2):
 * keď ju človek napíše ako novú, založí sa v číselníku s napísaným názvom
 * (3. 11. 2026). Dovtedy ju server pokladal za existujúcu, len ju zaškrtol
 * a do číselníka sa nedala dostať inak než cez Organizáciu.
 */

import { readValues, splitSimilar } from "./valueSelect"
import { slugifyKey } from "./slug"
import { tagOptions } from "./libraryRead"
import { addCodelistItem } from "./codelistsTenant"
import { CodelistError, codelistOptions, type CodelistExtras } from "./codelists"

export async function tagsFromForm(
  fd: FormData,
  companyCode: string,
  actor: string,
  extras?: CodelistExtras,
): Promise<{ tags: string[]; similar: { value: string; like: string }[] }> {
  const { picked, fresh, forced } = readValues(fd, "tags")
  const options = await tagOptions(companyCode, extras)
  const byKey = new Map(options.map(o => [o.value, o.label ?? o.value]))
  const inCodelist = new Set(codelistOptions("tags", extras).map(o => o.value))
  const tags = picked.map(v => v.trim().toLowerCase())
  // Nová hodnota, ktorej kľúč už je v číselníku, je len zaškrtnutie existujúcej.
  // Kľúč, ktorý je len na dokumentoch, sa do číselníka zapíše — presná zhoda,
  // podobnosť sa nerieši.
  const unknown: string[] = []
  const catalogue: string[] = []
  for (const label of fresh) {
    const key = slugifyKey(label)
    if (!key) continue
    if (inCodelist.has(key)) tags.push(key)
    else if (byKey.has(key)) catalogue.push(label)
    else unknown.push(label)
  }
  const { keep, similar: near } = splitSimilar(unknown, [...byKey.values()], forced)
  // Podobnosť sa hľadá v názvoch; späť ide kľúč existujúcej značky — ten sa
  // dá zaškrtnúť.
  const keyOf = new Map([...byKey].map(([k, label]) => [label, k]))
  const similar = near.map(x => ({ value: x.value, like: keyOf.get(x.like) ?? x.like }))
  for (const label of [...catalogue, ...keep]) {
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
