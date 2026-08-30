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
import type { Posudok } from "./ratings"

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
  /** Posudok prihláseného hodnotiteľa. */
  stav: StavOtazky | null
  /**
   * Posudky ostatných. Pri otázkach v prekryve je pole prázdne, kým
   * hodnotiteľ neposúdi sám — viď `vPrekryve()`.
   */
  cudzie: StavOtazky[]
  /** Má túto otázku posúdiť viac ľudí nezávisle? */
  prekryv: boolean
  /** Komu otázka sedí najskôr — pomôcka pri rozdelení práce. */
  oblast: Oblast
}

/**
 * Kto je na otázku najlepší expert.
 *
 * Nie je to zákaz, len navedenie. Sada nie je celá právna: rozpisy, manuály
 * a IT tvoria takmer tretinu a pri nich vie lepšie posúdiť ten, kto s nimi
 * pracuje — právnik povie, ako sa to má robiť podľa predpisu, matrikár, ako
 * sa to robí.
 */
export type Oblast = "pravo" | "prevadzka" | "oboje"

const OBLAST_PODLA_SEKCIE: Record<string, Oblast> = {
  sutazny_poriadok: "pravo",
  disciplinarny_poriadok: "pravo",
  prestupovy_poriadok: "pravo",
  smernice: "pravo",
  rozpisy_manualy: "prevadzka",
  it_aplikacie: "prevadzka",
}

export const POPIS_OBLASTI: Record<Oblast, string> = {
  pravo: "právo",
  prevadzka: "prevádzka",
  oboje: "ktokoľvek",
}

function oblastOtazky(o: OtazkaSady): Oblast {
  return OBLAST_PODLA_SEKCIE[o.sectionKey ?? ""] ?? "oboje"
}

/**
 * Má otázku posúdiť viac ľudí nezávisle?
 *
 * Áno pri precedencii a pasciach — to sú miesta, kde je výklad najťažší
 * a kde sa experti najskôr rozídu. Práve tá nezhoda je cenná: ukazuje, kde
 * je doména neurčitá, a teda kde systém NEMÁ odpovedať autoritatívne.
 *
 * Zvyšok sady posudzuje jeden človek; zdvojovať všetko by znamenalo dvakrát
 * toľko práce za informáciu, ktorú tam nečakáme.
 */
export function vPrekryve(o: OtazkaSady): boolean {
  return Boolean(o.precedenceRule || o.trapType)
}

/**
 * Načíta celú sadu aj s tým, čo je už posúdené.
 *
 * Hodnotitelia sa **väčšinou** vidia navzájom, aby sa práca nezdvojovala.
 * Pri otázkach v prekryve to ale neplatí: kým hodnotiteľ neposúdi sám,
 * cudzí posudok sa mu nezobrazí. Keby ho videl, mieru zhody by sme merali
 * na tom, či prvému uveril — a to je iná otázka než či sa zhodnú.
 *
 * `hodnotitel` je e-mail prihláseného. Bez neho sa skryjú všetky posudky
 * na prekryvových otázkach — to je prísnejšie a bezpečnejšie.
 */
export async function nacitajSadu(hodnotitel = ""): Promise<OtazkaSoStavom[]> {
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

  // Kľúč je otázka + hodnotiteľ. Zoradené vzostupne, takže pri opakovanom
  // posúdení tej istej otázky tým istým človekom platí to najnovšie —
  // ale posudky RÔZNYCH ľudí sa navzájom neprepíšu, čo je celý zmysel.
  const podlaOtazky = new Map<string, Map<string, StavOtazky>>()
  for (const h of posudene) {
    if (!h.otazkaId) continue
    const kto = h.hodnotitel ?? "anonym"
    if (!podlaOtazky.has(h.otazkaId)) podlaOtazky.set(h.otazkaId, new Map())
    podlaOtazky.get(h.otazkaId)!.set(kto, {
      spravna: h.spravna ?? null,
      halucinacia: h.halucinacia ?? null,
      hodnotitel: kto,
      kedy: h.upravene ?? new Date(0),
    })
  }

  return zoznam.map(o => {
    const vsetky = podlaOtazky.get(o.id) ?? new Map<string, StavOtazky>()
    const vlastny = hodnotitel ? vsetky.get(hodnotitel) ?? null : null
    const ostatni = [...vsetky.values()].filter(s => s.hodnotitel !== hodnotitel)
    const prekryv = vPrekryve(o)

    return {
      ...o,
      stav: vlastny,
      // Pri prekryve sa cudzie posudky odkryjú až po vlastnom.
      cudzie: prekryv && !vlastny ? [] : ostatni,
      prekryv,
      oblast: oblastOtazky(o),
    }
  })
}

/**
 * Koľko ľudí už otázku posúdilo — bez toho, AKO ju posúdili.
 *
 * Toto sa smie ukázať vždy: hodnotiteľ vidí, že na otázke niekto pracoval,
 * ale nie jeho záver. Bez tohto údaja by pri prekryve nevedel, či má ešte
 * čakať na druhého, alebo je otázka hotová.
 */
export async function pocetPosudkov(): Promise<Record<string, number>> {
  const col = await getCollection("evaluations")
  const zaznamy = await col
    .find(
      { otazkaId: { $exists: true }, spravna: { $ne: null } },
      { projection: { otazkaId: 1, hodnotitel: 1 } }
    )
    .toArray()

  const ludia = new Map<string, Set<string>>()
  for (const z of zaznamy) {
    if (!z.otazkaId) continue
    if (!ludia.has(z.otazkaId)) ludia.set(z.otazkaId, new Set())
    ludia.get(z.otazkaId)!.add(z.hodnotitel ?? "anonym")
  }
  return Object.fromEntries([...ludia].map(([k, v]) => [k, v.size]))
}

export async function nacitajOtazku(
  id: string,
  hodnotitel = ""
): Promise<OtazkaSoStavom | null> {
  const vsetky = await nacitajSadu(hodnotitel)
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
  /** Koľko otázok vyžaduje dvojité posúdenie. */
  vPrekryve: number
  /** Z nich koľko už posúdili aspoň dvaja. */
  prekryvHotove: number
}

export function suhrn(otazky: OtazkaSoStavom[], pocty: Record<string, number> = {}): Suhrn {
  const platne = otazky.filter(o => !o.vyradena)
  const sPosudkom = platne.filter(o => o.stav?.spravna !== null && o.stav !== null)
  const prekryvove = platne.filter(o => o.prekryv)

  return {
    spolu: platne.length,
    posudene: sPosudkom.length,
    spravne: sPosudkom.filter(o => o.stav?.spravna === 1).length,
    nespravne: sPosudkom.filter(o => o.stav?.spravna === 0).length,
    vyradene: otazky.filter(o => o.vyradena).length,
    halucinacie: platne.filter(o => o.stav?.halucinacia === 1).length,
    vPrekryve: prekryvove.length,
    prekryvHotove: prekryvove.filter(o => (pocty[o.id] ?? 0) >= 2).length,
  }
}

export interface Zhoda {
  /** Otázky, kde sa vyjadrili aspoň dvaja. */
  porovnatelnych: number
  zhodnych: number
  /** Označenia otázok, na ktorých sa hodnotitelia rozišli. */
  sporne: string[]
}

/**
 * Ako často sa hodnotitelia zhodli.
 *
 * Nezhoda **nie je chyba merania** — je to nález. Otázka, na ktorej sa dvaja
 * experti rozídu, je otázka, kde je doména neurčitá, a teda kde systém nemá
 * odpovedať autoritatívne, ale ponúknuť eskaláciu. Sada má na to typ pasce
 * `ambiguous_conflict`, ale zatiaľ len podľa nášho odhadu; toto ho overí
 * v dátach.
 *
 * Počíta sa z holej zhody, nie z Cohenovho kappa. Pri dvoch hodnotiteľoch
 * a niekoľkých desiatkach otázok by kappa dávala presnosť, ktorú tie čísla
 * neunesú — a zoznam sporných otázok je aj tak užitočnejší než jedno číslo.
 */
export function zhoda(vsetkyPosudky: Map<string, StavOtazky[]>): Zhoda {
  let porovnatelnych = 0
  let zhodnych = 0
  const sporne: string[] = []

  for (const [otazkaId, posudky] of vsetkyPosudky) {
    if (posudky.length < 2) continue
    porovnatelnych++
    const hodnoty = new Set(posudky.map(p => p.spravna))
    if (hodnoty.size === 1) zhodnych++
    else sporne.push(otazkaId)
  }

  return { porovnatelnych, zhodnych, sporne: sporne.sort() }
}
