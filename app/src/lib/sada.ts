/**
 * sada.ts — zlatá sada D9 uložená v databáze.
 *
 * Otázky pochádzajú z `eval/seed/questions_seed.json` a do kolekcie
 * `eval_questions` ich prenesie `scripts/import_sady.mjs`.
 *
 * Rozdelenie polí je zámerné a dôležité:
 *
 *   povodneZnenie   — zo seedu, prepisuje sa pri každom importe
 *   upraveneZnenie  — práca hodnotiteľa, seed sa jej NIKDY nedotkne
 *
 * D9 výslovne pripúšťa, že znenie sa smie upraviť — otázky sú návrhy a môžu
 * byť neprirodzené. Pôvodné znenie ale musí zostať, lebo sada slúži na
 * regresné merania: keby sa otázka ticho preformulovala, dva behy by sa
 * porovnávali ako rovnaké, hoci rovnaké nie sú.
 */

import { getCollection } from "./mongodb"
import type { Posudok } from "./hodnotenia"

export interface OtazkaSady {
  id: string
  povodneZnenie: string
  /** Znenie upravené hodnotiteľom. `null` = používa sa pôvodné. */
  upraveneZnenie: string | null
  vyradena: boolean
  dovodVyradenia: string | null

  searchMode: "fulltext" | "vector" | "hybrid"
  sectionKey: string | null
  companyCode: string
  accessLevel: string
  /** R1–R4 podľa `docs/PRECEDENCIA_NORIEM.md`; null = netýka sa. */
  precedenceRule: string | null
  /** Typ pasce; null = bežná otázka, na ktorú sa MÁ odpovedať. */
  trapType: string | null
  expectedBehaviour: "answer" | "refuse" | "escalate"
  goldChunkIds: string[]
}

/** Znenie, ktoré sa má položiť — upravené má prednosť pred pôvodným. */
export function znenie(o: OtazkaSady): string {
  return o.upraveneZnenie?.trim() || o.povodneZnenie
}

export interface StavOtazky {
  spravna: Posudok
  halucinacia: Posudok
  hodnotitel: string
  kedy: Date
}

export interface OtazkaSoStavom extends OtazkaSady {
  stav: StavOtazky | null
}

/**
 * Načíta celú sadu aj s tým, čo je už posúdené.
 *
 * Hodnotitelia sa vidia navzájom — kto otvorí zoznam, vidí, čo už spravil
 * niekto iný, a pokračuje tam, kde sa skončilo. Preto sa berie posledné
 * hodnotenie bez ohľadu na to, kto ho urobil.
 */
export async function nacitajSadu(): Promise<OtazkaSoStavom[]> {
  const otazky = await getCollection<OtazkaSady>("eval_questions")
  const zoznam = await otazky
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray()

  const hodnotenia = await getCollection("evaluations")
  const posudene = await hodnotenia
    .find(
      { otazkaId: { $exists: true }, spravna: { $ne: null } },
      { projection: { otazkaId: 1, spravna: 1, halucinacia: 1, hodnotitel: 1, upravene: 1 } }
    )
    .sort({ upravene: 1 })
    .toArray()

  // Zoradené vzostupne, takže posledný zápis prepíše skoršie — pri
  // opakovanom hodnotení tej istej otázky platí to najnovšie.
  const stavy = new Map<string, StavOtazky>()
  for (const h of posudene) {
    if (!h.otazkaId) continue
    stavy.set(h.otazkaId, {
      spravna: h.spravna ?? null,
      halucinacia: h.halucinacia ?? null,
      hodnotitel: h.hodnotitel ?? "anonym",
      kedy: h.upravene ?? new Date(0),
    })
  }

  return zoznam.map(o => ({ ...o, stav: stavy.get(o.id) ?? null }))
}

export async function nacitajOtazku(id: string): Promise<OtazkaSoStavom | null> {
  const vsetky = await nacitajSadu()
  return vsetky.find(o => o.id === id) ?? null
}

/** Čo smie hodnotiteľ na otázke zmeniť. */
export interface UpravaOtazky {
  upraveneZnenie?: string | null
  vyradena?: boolean
  dovodVyradenia?: string | null
}

export async function upravOtazku(id: string, u: UpravaOtazky): Promise<boolean> {
  const col = await getCollection<OtazkaSady>("eval_questions")

  const zmeny: Record<string, unknown> = {}
  if (u.upraveneZnenie !== undefined) {
    // Prázdny reťazec znamená „vrátiť pôvodné", nie „prázdna otázka".
    const t = u.upraveneZnenie?.trim()
    zmeny.upraveneZnenie = t ? t.slice(0, 1000) : null
  }
  if (u.vyradena !== undefined) zmeny.vyradena = u.vyradena
  if (u.dovodVyradenia !== undefined) {
    zmeny.dovodVyradenia = u.dovodVyradenia?.trim().slice(0, 1000) || null
  }
  if (!Object.keys(zmeny).length) return false

  const r = await col.updateOne({ id }, { $set: zmeny })
  return r.matchedCount === 1
}

/** Súhrn pre ukazovateľ postupu. */
export interface Suhrn {
  spolu: number
  posudene: number
  spravne: number
  nespravne: number
  vyradene: number
  halucinacie: number
}

export function suhrn(otazky: OtazkaSoStavom[]): Suhrn {
  const platne = otazky.filter(o => !o.vyradena)
  const sPosudkom = platne.filter(o => o.stav?.spravna !== null && o.stav !== null)
  return {
    spolu: platne.length,
    posudene: sPosudkom.length,
    spravne: sPosudkom.filter(o => o.stav?.spravna === 1).length,
    nespravne: sPosudkom.filter(o => o.stav?.spravna === 0).length,
    vyradene: otazky.filter(o => o.vyradena).length,
    halucinacie: platne.filter(o => o.stav?.halucinacia === 1).length,
  }
}
