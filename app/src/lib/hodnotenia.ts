/**
 * hodnotenia.ts — ukladanie odpovedí a ľudského posúdenia (D9).
 *
 * Prečo to vôbec je: z metrík D9 vie skript spočítať všetko okrem dvoch
 * vecí — *správnosti odpovede* a *halucinácií*. Tie vyžadujú úsudok. Pôvodný
 * plán bol dať hodnotiteľovi Excel so 74 otázkami; jenže hárok bez systému
 * je abstraktná domáca úloha a odpovede z neho vychádzajú formálne.
 *
 * Preto sa zbierajú priamo tu: hodnotiteľ sa pýta, vidí odpoveď aj citácie
 * a rovno povie, či sedí. Zlatá sada tak vzniká používaním.
 *
 * Dôležité: záznam sa ukladá **hneď po odpovedi**, ešte pred hodnotením.
 * Automatické metriky (hit@5, latencia, únik interného obsahu) sa dajú
 * počítať aj z neohodnotených odpovedí, takže by bola škoda ich zahodiť len
 * preto, že hodnotiteľ nedoklikal.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import type { Zdroj, Citacia } from "./sseKlient"
import type { Tokeny, Naklad } from "./cennik"

/** Ľudský úsudok. `null` = zatiaľ neposúdené, čo je iný stav než 0. */
export type Posudok = 0 | 1 | null

export interface Hodnotenie {
  _id?: ObjectId

  /** Väzba na zlatú sadu, napr. „D9-001". Chýba pri voľnom dotaze. */
  otazkaId?: string

  otazka: string
  odpoved: string
  zdroje: Zdroj[]
  citacie: Citacia[]

  // Technické údaje — bez nich sa nedajú porovnať dve konfigurácie.
  model: string
  provider: string
  overeneCitacie: boolean
  ttftMs: number | null
  celkovoMs: number
  casy?: Record<string, number>

  /**
   * Spotreba a cena. Ukladá sa oboje zámerne: cena je historický fakt,
   * ktorý sa po zmene cenníka nedopočíta, tokeny sú nemenné a dovolia
   * prepočet podľa nových sadzieb. `naklad.verziaCennika` hovorí, ktoré
   * sumy sa smú sčítavať.
   */
  tokeny?: Tokeny
  naklad?: Naklad

  // To, čo vie povedať len človek (D9, kapitola 3).
  spravna: Posudok
  halucinacia: Posudok

  /** Overené znenie odpovede — napĺňa `goldAnswer` v zlatej sade. */
  overenaOdpoved?: string
  /** Správne predpisy a §, napr. „SP čl. 78". Napĺňa `goldSources`. */
  spravneZdroje?: string
  poznamka?: string

  hodnotitel: string
  vytvorene: Date
  upravene: Date
}

/** Údaje, ktoré prídu z prehliadača po dobehnutí odpovede. */
export interface NovyZaznam {
  otazkaId?: string
  otazka: string
  odpoved: string
  zdroje: Zdroj[]
  citacie: Citacia[]
  model: string
  provider: string
  overeneCitacie: boolean
  ttftMs: number | null
  celkovoMs: number
  casy?: Record<string, number>
  tokeny?: Tokeny
  naklad?: Naklad
}

/** Polia, ktoré smie hodnotiteľ meniť. Nič iné sa cez API prepísať nedá. */
export interface UpravaHodnotenia {
  spravna?: Posudok
  halucinacia?: Posudok
  overenaOdpoved?: string
  spravneZdroje?: string
  poznamka?: string
}

const KOLEKCIA = "evaluations"

/**
 * Založí záznam o odpovedi. Hodnotenie zatiaľ prázdne.
 *
 * Text odpovede aj citácie sa ukladajú celé zámerne — pri neskoršej zmene
 * chunkovania či modelu sa už tá istá odpoveď nedá zopakovať a bez nej by
 * bolo hodnotenie neoveriteľné.
 */
export async function zapisOdpoved(
  z: NovyZaznam,
  hodnotitel: string
): Promise<string> {
  const col = await getCollection<Hodnotenie>(KOLEKCIA)
  const teraz = new Date()

  const zaznam: Hodnotenie = {
    ...z,
    spravna: null,
    halucinacia: null,
    hodnotitel,
    vytvorene: teraz,
    upravene: teraz,
  }

  const r = await col.insertOne(zaznam)
  return String(r.insertedId)
}

/**
 * Doplní ľudské posúdenie.
 *
 * Vracia `false`, keď záznam neexistuje — volajúci to má ohlásiť, nie
 * ticho prejsť. Stratené hodnotenie je horšie než chybová hláška.
 */
export async function ulozPosudok(
  id: string,
  uprava: UpravaHodnotenia,
  hodnotitel: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false

  // Prepisujeme len to, čo naozaj prišlo. Bez tejto kontroly by kliknutie
  // na „správna" zmazalo predtým vyplnené overené znenie.
  const zmeny: Record<string, unknown> = { upravene: new Date(), hodnotitel }
  for (const kluc of [
    "spravna", "halucinacia", "overenaOdpoved", "spravneZdroje", "poznamka",
  ] as const) {
    if (uprava[kluc] !== undefined) zmeny[kluc] = uprava[kluc]
  }

  const col = await getCollection<Hodnotenie>(KOLEKCIA)
  const r = await col.updateOne({ _id: new ObjectId(id) }, { $set: zmeny })
  return r.matchedCount === 1
}

/** Koľko otázok zo zlatej sady je už posúdených — na ukazovateľ postupu. */
export async function postupSady(): Promise<Record<string, Posudok>> {
  const col = await getCollection<Hodnotenie>(KOLEKCIA)
  const zaznamy = await col
    .find(
      { otazkaId: { $exists: true } },
      { projection: { otazkaId: 1, spravna: 1, upravene: 1 } }
    )
    .sort({ upravene: 1 })
    .toArray()

  // Pri opakovanom hodnotení tej istej otázky platí posledné.
  const stav: Record<string, Posudok> = {}
  for (const z of zaznamy) if (z.otazkaId) stav[z.otazkaId] = z.spravna
  return stav
}
