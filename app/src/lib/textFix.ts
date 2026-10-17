/**
 * textFix.ts — oprava **textu** už publikovaného znenia, bez novej verzie (D57, D28).
 *
 * ## Načo to je
 *
 * Dokument je schválený, pridelený ľuďom a zaindexovaný do RAG. Niekto napíše, že
 * je v ňom gramatická chyba, ktorá nemení význam — chýbajúca čiarka, preklep, zlá
 * diakritika. Dovtedy sa to dalo vyriešiť jedine novým znením: nový `versionId`,
 * nová povinnosť pre každého, kto už potvrdil. Za jednu čiarku.
 *
 * ## Čo sa pri oprave nemení
 *
 * `versionId` je **identita** znenia, nie odtlačok jeho dnešného textu. Visia na
 * ňom potvrdenia, pridelenia, trasy aj chunky v RAG. Oprava ho nechá tak; mení sa
 * `contentHash`, ktorý odteraz hovorí „takto ten text vyzerá teraz“. Dovtedy boli
 * obe čísla zhodné — nie preto, že sú to to isté, ale preto, že sa nemali ako
 * rozísť.
 *
 * Potvrdenia zostávajú platné a je to v poriadku: formulka, ktorú ľudia podpísali,
 * cituje **názov, označenie a dátum platnosti** (D28), nie text. Oprava čiarky
 * z nej nerobí nepravdivé tvrdenie. Keby sa menil význam, nie je to oprava, ale
 * nové znenie — a rozhodnúť to musí človek: systém rozdiel medzi preklepom
 * a novou povinnosťou nepozná (D30).
 *
 * ## Prečo musí byť rozdiel vidieť dopredu
 *
 * „Nemení to význam“ je tvrdenie toho, kto opravuje. Bez rozdielu pred očami je
 * to tvrdenie neoveriteľné — a pritom práve na ňom stojí, že podpisy iných ľudí
 * zostávajú platné. Preto `textDiff()`: nie je to ozdoba, ale podmienka.
 */

import { normalizeMarkdown, textFingerprint } from "./chunkIdentity"

export type TextFixProblem =
  | "textFix.notContentManager"
  | "textFix.noEffectiveVersion"
  | "textFix.emptyText"
  | "textFix.draftChanged"
  | "textFix.noChange"
  | "textFix.reasonRequired"
  | "textFix.pastVersion"

/**
 * Smie sa tento text opraviť?
 *
 * Rola sa pýta prvá — rovnako ako pri odvolaní potvrdenia: kto nesmie konať, nemá
 * sa dozvedieť ani to, či je čo opravovať.
 */
export function textFixProblem(input: {
  canManageContent: boolean
  hasEffectiveVersion: boolean
  /** Cieľ opravy je minulé znenie — to sa neopravuje (D78). */
  targetIsPast?: boolean
  before: string
  after: string
  /** Odtlačok textu, ktorého rozdiel mal človek pred očami. */
  expectedFingerprint?: string
  reason?: string
}): TextFixProblem | null {
  if (!input.canManageContent) return "textFix.notContentManager"
  /*
   * Opraviť sa dá len **platné** znenie. Archivované je doklad o tom, čo platilo
   * vtedy; prepísať ho by neznamenalo opraviť chybu, ale zmeniť minulosť.
   */
  if (!input.hasEffectiveVersion) return "textFix.noEffectiveVersion"
  if (input.targetIsPast) return "textFix.pastVersion"
  if (!input.after?.trim()) return "textFix.emptyText"
  /*
   * Ukladá sa **ten text, ktorého rozdiel bol vidieť**. Keby medzitým do
   * konceptu siahol niekto iný, prešla by zmena, ktorú nikto neposúdil — a práve
   * na „videl som to a nemení to význam“ stojí, že cudzie podpisy zostávajú
   * platné. Rovnaká poistka ako dátum súboru pri prepisovaní: nie nedôvera, ale
   * to jediné, čo dva súbežné zápisy rozlíši.
   */
  if (input.expectedFingerprint && textFingerprint(input.after) !== input.expectedFingerprint) {
    return "textFix.draftChanged"
  }
  /*
   * Zhoda sa meria **tou istou normalizáciou ako odtlačok** (D57). Keby mala
   * vlastnú, existoval by rozdiel, ktorý pravidlo vidí a `versionId` nie —
   * alebo naopak, a to je horšie: zápis, ktorý sa tvári ako oprava, hoci sa
   * nezmenilo nič.
   */
  if (normalizeMarkdown(input.before) === normalizeMarkdown(input.after)) return "textFix.noChange"
  if (!input.reason?.trim()) return "textFix.reasonRequired"
  return null
}

export type DiffKind = "same" | "added" | "removed" | "gap"

export interface DiffLine {
  kind: DiffKind
  /** Pri `gap` je to počet vynechaných nezmenených riadkov ako text. */
  text: string
}

export interface TextDiff {
  lines: DiffLine[]
  added: number
  removed: number
  /**
   * Zmena bola priveľká na porovnanie po riadkoch — ukazuje sa celý starý blok
   * a celý nový. Je to poctivejšie než tabuľka, ktorá by sa počítala minútu.
   */
  coarse: boolean
}

/**
 * Nad týmto počtom úprav (pridaný alebo zmazaný riadok) sa už po riadkoch
 * neporovnáva. Myersov rozdiel trvá úmerne počtu **zmien**, nie dĺžke textu:
 * 57 roztrúsených opráv v 660 riadkoch (Súťažný poriadok, 16. 10. 2026) je
 * zlomok milisekundy. Dovtedy tabuľka LCS s limitom 400 × 400 riadkov ukázala
 * „+658 / −660" a varovanie, hoci sa menilo 57 miest.
 */
const EDIT_LIMIT = 1000

const toLines = (s: string) => normalizeMarkdown(s).split("\n")

/**
 * Rozdiel dvoch textov po riadkoch.
 *
 * Spoločný začiatok a koniec sa odkrojí **skôr**, než sa začne počítať: pri
 * oprave čiarky v tisícriadkovom predpise zostane v strede jeden riadok. Bez
 * toho by sa pre jeden znak počítala tabuľka milión na milión.
 */
export function textDiff(before: string, after: string, context = 2): TextDiff {
  const a = toLines(before)
  const b = toLines(after)

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const edits = lineEdits(midA, midB)
  const coarse = edits === null

  const middle: DiffLine[] = edits === null
    ? [
        ...midA.map(text => ({ kind: "removed" as const, text })),
        ...midB.map(text => ({ kind: "added" as const, text })),
      ]
    : edits.map(e => ({ kind: e.kind, text: e.text }))

  /*
   * Kontext: pár riadkov pred zmenou a za ňou. Rozdiel bez okolia sa nedá
   * prečítať — „pridaný riadok“ bez toho, kam patrí, nehovorí nič.
   */
  const head = a.slice(Math.max(0, start - context), start).map(text => ({ kind: "same" as const, text }))
  const tail = a.slice(endA, Math.min(a.length, endA + context)).map(text => ({ kind: "same" as const, text }))

  return {
    lines: collapse([...head, ...middle, ...tail], context),
    added: middle.filter(l => l.kind === "added").length,
    removed: middle.filter(l => l.kind === "removed").length,
    coarse,
  }
}

/**
 * Dlhé nezmenené úseky medzi dvoma zmenami sa zbalia do jedného riadku.
 *
 * Dva preklepy vzdialené päťsto riadkov sú dve zmeny, nie päťsto riadkov textu
 * na čítanie. Kto chce celé znenie, má ho o kus vyššie na tej istej stránke.
 */
function collapse(lines: DiffLine[], context: number): DiffLine[] {
  const out: DiffLine[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].kind !== "same") {
      out.push(lines[i])
      i++
      continue
    }
    let j = i
    while (j < lines.length && lines[j].kind === "same") j++
    const run = lines.slice(i, j)
    if (run.length > context * 2 + 1) {
      out.push(...run.slice(0, context))
      out.push({ kind: "gap", text: String(run.length - context * 2) })
      out.push(...run.slice(run.length - context))
    } else {
      out.push(...run)
    }
    i = j
  }
  return out
}

/** Jedna položka rozdielu po riadkoch s pozíciou v starom (`a`) a novom (`b`) texte. */
export interface LineEdit {
  kind: "same" | "added" | "removed"
  text: string
  /** Index v starom texte (pri `same` a `removed`). */
  a: number | null
  /** Index v novom texte (pri `same` a `added`). */
  b: number | null
}

/**
 * Myersov rozdiel riadkov (O(ND)). `null`, keď je úprav viac než
 * `EDIT_LIMIT` — vtedy volajúci ukáže celý starý a celý nový blok.
 *
 * Postup: pre každý počet úprav `d` sa pamätá najďalší dosiahnutý bod na
 * každej diagonále (`v`); po nájdení konca sa cesta prejde späť cez uložené
 * stavy. Rovnaké riadky („hady") sa prechádzajú bez úprav, preto pri pár
 * zmenách v dlhom texte stačí pár krokov.
 */
export function lineEdits(a: string[], b: string[]): LineEdit[] | null {
  const n = a.length
  const m = b.length
  const max = n + m
  const limit = Math.min(max, EDIT_LIMIT)
  const offset = max + 1
  let v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  let found = -1
  outer: for (let d = 0; d <= limit; d++) {
    trace.push(v)
    v = v.slice()
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset]) ? v[k + 1 + offset] : v[k - 1 + offset] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) { x++; y++ }
      v[k + offset] = x
      if (x >= n && y >= m) { found = d; break outer }
    }
  }
  if (found < 0) return null

  const out: LineEdit[] = []
  let x = n
  let y = m
  for (let d = found; d >= 0; d--) {
    const prev = trace[d]
    const k = x - y
    const prevK = k === -d || (k !== d && prev[k - 1 + offset] < prev[k + 1 + offset]) ? k + 1 : k - 1
    const prevX = d === 0 ? 0 : prev[prevK + offset]
    const prevY = d === 0 ? 0 : prevX - prevK
    while (x > prevX && y > prevY) { x--; y--; out.push({ kind: "same", text: a[x], a: x, b: y }) }
    if (d === 0) break
    if (x === prevX) { y--; out.push({ kind: "added", text: b[y], a: null, b: y }) }
    else { x--; out.push({ kind: "removed", text: a[x], a: x, b: null }) }
  }
  return out.reverse()
}

/* ─────────────────────────────────────────────────────────────────────────
 * Oprava ÚDAJOV znenia — označenie a dátum platnosti (D82)
 *
 * Iné pravidlo než pri oprave textu, a z dobrého dôvodu: **text vo formulke
 * nie je, označenie a dátum áno.** Formulka znie „…dokumentom „{názov}",
 * verzia {označenie}, platná od {dátum}…" (D28), takže oprava čiarky v texte
 * nechá podpis pravdivý, kým zmena dátumu pod už podpísaným záznamom vyrobí
 * rozpor medzi tým, čo ľudia podpísali, a tým, čo systém tvrdí.
 *
 * Preto sa tie dva údaje po **prvom platnom potvrdení zamykajú**. Odomkne ich
 * jedine hromadné odvolanie potvrdení toho znenia; potom sa údaj opraví
 * a ľudia potvrdia opravenú formulku.
 *
 * **Prečo tak tvrdo.** Dátum platnosti je údaj, od ktorého sa počíta
 * viazanosť. Skoršia voľba „oprava zápisu, potvrdenia zostávajú" stála na
 * predpoklade, že podľa zlého dátumu nikto nekonal — a ten sa nedá overiť.
 * ───────────────────────────────────────────────────────────────────────── */

export type VersionFixProblem =
  | "versionFix.reasonRequired"
  | "versionFix.locked"

/**
 * Prečo sa údaje znenia nedajú opraviť — alebo `null`, keď sa dajú.
 *
 * Čisté pravidlo bez databázy, rovnako ako `textFixProblem()`: čo sa smie, sa
 * musí dať otestovať bez Monga a bez toho, aby si to niekto domýšľal z dotazu.
 */
export function versionFixProblem(input: {
  /** Koľko platných potvrdení toto znenie má. */
  acknowledgements: number
  changesLabel: boolean
  changesEffectiveFrom: boolean
  reason: string
}): VersionFixProblem | null {
  if (!input.reason?.trim()) return "versionFix.reasonRequired"
  const touchesStatement = input.changesLabel || input.changesEffectiveFrom
  if (touchesStatement && input.acknowledgements > 0) return "versionFix.locked"
  return null
}


/** To, čo pravidlá opravy potrebujú vedieť o znení. */
export interface FixableVersion {
  versionId: string
  isActive?: boolean
  effectiveTo?: Date | string | null
  markdown?: string
}

/**
 * Ktoré znenia sa smú opraviť (D78, D150): **platné dnes** a **zverejnené
 * s budúcou účinnosťou** (novela vopred). Minulé nie — je to doklad o tom, čo
 * platilo vtedy.
 *
 * Pripravované je to isté pravidlo ako na karte dokumentu: naposledy
 * zverejnené, ktoré dnes neplatí a nemá koniec účinnosti.
 */
export function fixableVersions<V extends FixableVersion>(versions: V[], currentVersionId: string | undefined): V[] {
  const current = versions.find(v => v.versionId === currentVersionId)
  const latest = versions.find(v => v.isActive)
  const upcoming = latest && latest !== current && !latest.effectiveTo ? latest : undefined
  return [current, upcoming].filter((v): v is V => Boolean(v))
}

/**
 * Ktoré znenie koncept opravuje: to, ktorého text je mu najbližší (najmenej
 * zmenených riadkov). Po „Opraviť text" pri znení je to vždy ono — koncept
 * vznikol z jeho textu. Nič sa neukladá (D27); cieľ sa dá na obrazovke zmeniť.
 */
export function closestVersion<V extends FixableVersion>(draft: string, candidates: V[]): V | undefined {
  let best: V | undefined
  let bestScore = Infinity
  for (const v of candidates) {
    const d = textDiff(String(v.markdown ?? ""), draft)
    const score = d.added + d.removed
    if (score < bestScore) { best = v; bestScore = score }
  }
  return best
}

/**
 * Je koncept voľný na opravu textu? Áno, keď je prázdny alebo sa zhoduje
 * s textom niektorého zverejneného znenia a nemá vlastné PDF — teda keď sa
 * nepripravuje nové znenie. Inak by „Opraviť text" prepísal rozpracovaný
 * koncept (a s ním aj to, na čom beží kolo schvaľovania).
 */
export function draftIsFree(
  draft: string | undefined,
  versions: FixableVersion[],
  draftPdfId?: string | null,
  versionPdfIds: string[] = [],
): boolean {
  if (draftPdfId && !versionPdfIds.includes(draftPdfId)) return false
  const text = String(draft ?? "").trim()
  if (!text) return true
  const n = normalizeMarkdown(text)
  return versions.some(v => normalizeMarkdown(String(v.markdown ?? "")) === n)
}
