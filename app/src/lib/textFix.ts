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

/**
 * Smie sa tento text opraviť?
 *
 * Rola sa pýta prvá — rovnako ako pri odvolaní potvrdenia: kto nesmie konať, nemá
 * sa dozvedieť ani to, či je čo opravovať.
 */
export function textFixProblem(input: {
  canManageContent: boolean
  hasEffectiveVersion: boolean
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

/** Nad týmto počtom zmenených riadkov sa už po riadkoch neporovnáva. */
const LCS_LIMIT = 400

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
  const coarse = midA.length * midB.length > LCS_LIMIT * LCS_LIMIT

  const middle: DiffLine[] = coarse
    ? [
        ...midA.map(text => ({ kind: "removed" as const, text })),
        ...midB.map(text => ({ kind: "added" as const, text })),
      ]
    : lcsDiff(midA, midB)

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

/**
 * Najdlhšia spoločná podpostupnosť riadkov — klasická tabuľka.
 *
 * Beží až na **odkrojenom strede**, nie na celom texte; horná hranica veľkosti
 * je `LCS_LIMIT` a rieši ju volajúci.
 */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length
  const m = b.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ kind: "removed", text: a[i] })
      i++
    } else {
      out.push({ kind: "added", text: b[j] })
      j++
    }
  }
  while (i < n) out.push({ kind: "removed", text: a[i++] })
  while (j < m) out.push({ kind: "added", text: b[j++] })
  return out
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
