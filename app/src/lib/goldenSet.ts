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
import type { Verdict } from "./ratings"

export interface GoldenQuestion {
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
export function questionText(o: GoldenQuestion): string {
  return o.upraveneZnenie?.trim() || o.povodneZnenie
}

export interface QuestionState {
  spravna: Verdict
  halucinacia: Verdict
  hodnotitel: string
  kedy: Date
}

export interface QuestionWithState extends GoldenQuestion {
  /** Posudok prihláseného hodnotiteľa. */
  stav: QuestionState | null
  /**
   * Posudky ostatných. Pri otázkach v prekryve je pole prázdne, kým
   * hodnotiteľ neposúdi sám — viď `vPrekryve()`.
   */
  cudzie: QuestionState[]
  /** Má túto otázku posúdiť viac ľudí nezávisle? */
  prekryv: boolean
  /** Komu otázka sedí najskôr — pomôcka pri rozdelení práce. */
  oblast: QuestionArea
}

/**
 * Kto je na otázku najlepší expert.
 *
 * Nie je to zákaz, len navedenie. Sada nie je celá právna: rozpisy, manuály
 * a IT tvoria takmer tretinu a pri nich vie lepšie posúdiť ten, kto s nimi
 * pracuje — právnik povie, ako sa to má robiť podľa predpisu, matrikár, ako
 * sa to robí.
 */
export type QuestionArea = "pravo" | "prevadzka" | "oboje"

const AREA_BY_SECTION: Record<string, QuestionArea> = {
  sutazny_poriadok: "pravo",
  disciplinarny_poriadok: "pravo",
  prestupovy_poriadok: "pravo",
  smernice: "pravo",
  rozpisy_manualy: "prevadzka",
  it_aplikacie: "prevadzka",
}

export const AREA_LABEL: Record<QuestionArea, string> = {
  pravo: "právo",
  prevadzka: "prevádzka",
  oboje: "ktokoľvek",
}

function questionAreaOf(o: GoldenQuestion): QuestionArea {
  return AREA_BY_SECTION[o.sectionKey ?? ""] ?? "oboje"
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
export function inOverlap(o: GoldenQuestion): boolean {
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
export async function loadGoldenSet(reviewer = ""): Promise<QuestionWithState[]> {
  const questions = await getCollection<GoldenQuestion>("eval_questions")
  const list = await questions
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray()

  const ratings = await getCollection("evaluations")
  const reviewed = await ratings
    .find(
      { otazkaId: { $exists: true }, spravna: { $ne: null } },
      { projection: { otazkaId: 1, spravna: 1, halucinacia: 1, hodnotitel: 1, upravene: 1 } }
    )
    .sort({ upravene: 1 })
    .toArray()

  // Kľúč je otázka + hodnotiteľ. Zoradené vzostupne, takže pri opakovanom
  // posúdení tej istej otázky tým istým človekom platí to najnovšie —
  // ale posudky RÔZNYCH ľudí sa navzájom neprepíšu, čo je celý zmysel.
  const byQuestion = new Map<string, Map<string, QuestionState>>()
  for (const h of reviewed) {
    if (!h.otazkaId) continue
    const who = h.hodnotitel ?? "anonym"
    if (!byQuestion.has(h.otazkaId)) byQuestion.set(h.otazkaId, new Map())
    byQuestion.get(h.otazkaId)!.set(who, {
      spravna: h.spravna ?? null,
      halucinacia: h.halucinacia ?? null,
      hodnotitel: who,
      kedy: h.upravene ?? new Date(0),
    })
  }

  return list.map(o => {
    const all = byQuestion.get(o.id) ?? new Map<string, QuestionState>()
    const own = reviewer ? all.get(reviewer) ?? null : null
    const others = [...all.values()].filter(s => s.hodnotitel !== reviewer)
    const overlap = inOverlap(o)

    return {
      ...o,
      stav: own,
      // Pri prekryve sa cudzie posudky odkryjú až po vlastnom.
      cudzie: overlap && !own ? [] : others,
      prekryv: overlap,
      oblast: questionAreaOf(o),
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
export async function verdictCount(): Promise<Record<string, number>> {
  const col = await getCollection("evaluations")
  const records = await col
    .find(
      { otazkaId: { $exists: true }, spravna: { $ne: null } },
      { projection: { otazkaId: 1, hodnotitel: 1 } }
    )
    .toArray()

  const people = new Map<string, Set<string>>()
  for (const z of records) {
    if (!z.otazkaId) continue
    if (!people.has(z.otazkaId)) people.set(z.otazkaId, new Set())
    people.get(z.otazkaId)!.add(z.hodnotitel ?? "anonym")
  }
  return Object.fromEntries([...people].map(([k, v]) => [k, v.size]))
}

export async function loadQuestion(
  id: string,
  reviewer = ""
): Promise<QuestionWithState | null> {
  const all = await loadGoldenSet(reviewer)
  return all.find(o => o.id === id) ?? null
}

/** Čo smie hodnotiteľ na otázke zmeniť. */
export interface QuestionEdit {
  upraveneZnenie?: string | null
  vyradena?: boolean
  dovodVyradenia?: string | null
}

export async function editQuestion(id: string, u: QuestionEdit): Promise<boolean> {
  const col = await getCollection<GoldenQuestion>("eval_questions")

  const changes: Record<string, unknown> = {}
  if (u.upraveneZnenie !== undefined) {
    // Prázdny reťazec znamená „vrátiť pôvodné", nie „prázdna otázka".
    const t = u.upraveneZnenie?.trim()
    changes.upraveneZnenie = t ? t.slice(0, 1000) : null
  }
  if (u.vyradena !== undefined) changes.vyradena = u.vyradena
  if (u.dovodVyradenia !== undefined) {
    changes.dovodVyradenia = u.dovodVyradenia?.trim().slice(0, 1000) || null
  }
  if (!Object.keys(changes).length) return false

  const r = await col.updateOne({ id }, { $set: changes })
  return r.matchedCount === 1
}

/** Súhrn pre ukazovateľ postupu. */
export interface GoldenSetSummary {
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

export function goldenSetSummary(questions: QuestionWithState[], counts: Record<string, number> = {}): GoldenSetSummary {
  const valid = questions.filter(o => !o.vyradena)
  const withVerdict = valid.filter(o => o.stav?.spravna !== null && o.stav !== null)
  const overlapping = valid.filter(o => o.prekryv)

  return {
    spolu: valid.length,
    posudene: withVerdict.length,
    spravne: withVerdict.filter(o => o.stav?.spravna === 1).length,
    nespravne: withVerdict.filter(o => o.stav?.spravna === 0).length,
    vyradene: questions.filter(o => o.vyradena).length,
    halucinacie: valid.filter(o => o.stav?.halucinacia === 1).length,
    vPrekryve: overlapping.length,
    prekryvHotove: overlapping.filter(o => (counts[o.id] ?? 0) >= 2).length,
  }
}

export interface Agreement {
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
export function agreement(allVerdicts: Map<string, QuestionState[]>): Agreement {
  let comparable = 0
  let matching = 0
  const disputed: string[] = []

  for (const [questionId, verdicts] of allVerdicts) {
    if (verdicts.length < 2) continue
    comparable++
    const values = new Set(verdicts.map(p => p.spravna))
    if (values.size === 1) matching++
    else disputed.push(questionId)
  }

  return { porovnatelnych: comparable, zhodnych: matching, sporne: disputed.sort() }
}
