/**
 * aiConversion.ts — prevod PDF modelom: analýza, potom prevod po častiach
 * (ADR-046, D297–D298).
 *
 * **Žiadna šablóna dokumentu.** Pokyny obsahujú len zákazy (nemeniť slová,
 * nedopĺňať) a tvar výstupu. Akú štruktúru dokument má — či články, body
 * „7.", prílohy, tabuľky, obrázky —, povie analýza *tohto* dokumentu a prevod
 * sa riadi ňou. Rozpis súťaží a pracovný poriadok sú postavené inak a jedno
 * pravidlo by jednému z nich ublížilo.
 *
 * Model dostane pri každej časti **jej strany ako PDF** (vidí sadzbu aj
 * obrázky) a **textovú vrstvu tých strán** (presné znenie). Slová berie
 * z textovej vrstvy, štruktúru a text obrázkov z PDF. Výsledok potom aj tak
 * prejde kontrolou slov (`conversionCheck.ts`) — pokyn nie je záruka.
 *
 * Táto knižnica do databázy nesiaha; stav behu drží `aiConversionJob.ts`.
 */

import { PDFDocument } from "pdf-lib"
import { callModel, answerText, type RewriteAi } from "./llmRewrite"
import type { LayerPage } from "./conversionCheck"

/** Strop strán na jedno volanie — model PDF nad 100 strán neprijme. */
export const MAX_PAGES_PER_CALL = 100
/**
 * Časť prevodu najviac takto dlhá — jedno volanie sa musí zmestiť do 300 s
 * funkcie aj s premýšľaním modelu. Hustá strana je ~600 slov; päť strán je
 * výstup okolo 8 000 tokenov.
 */
export const MAX_PART_PAGES = 5
/** Keď analýza časti nenavrhne, delí sa po toľkých stranách. */
const FALLBACK_PART_PAGES = 4
/** Koľko riadkov konca predošlej časti dostane ďalšia — aby nadviazala. */
const TAIL_LINES = 30

export interface PagePart {
  from: number
  to: number
}

const PROHIBITION = `ZÁKAZ, ktorý je dôležitejší než výsledok:
- Neprepisuj, nepreštylizuj a neskracuj znenie. Ani jedno slovo.
- Nedopĺňaj, čo v dokumente nie je — ani vtedy, keď je zjavné, čo tam malo byť.
- Neopravuj gramatiku, interpunkciu ani veľké a malé písmená pôvodného textu.
- Nepridávaj úvod, zhrnutie ani vlastné poznámky.
Každé slovo výsledku sa strojovo porovná s textovou vrstvou PDF a každý rozdiel musí potvrdiť človek.`

const ANALYSIS_INSTRUCTION = `Si analytik dokumentov. Dostaneš PDF a jeho textovú vrstvu. Tvojou úlohou je opísať, ako je TENTO dokument postavený, aby ho iný prevodca vedel verne previesť do Markdownu po častiach.

${PROHIBITION}

Neočakávaj žiadnu štruktúru vopred — každý dokument je iný. Opíš to, čo v ňom naozaj je:
- úrovne členenia a ako sú v dokumente označené (doslovne, s príkladom z dokumentu) a ktorá úroveň je nadradená ktorej;
- tabuľky: na ktorých stranách, či sú textom alebo obrázkom, ich stĺpce;
- obrázky: na ktorých stranách a čo je na nich (text, tabuľka, schéma, logo, podpis);
- hlavičky, päty, čísla strán a iné opakujúce sa prvky, ktoré do textu nepatria;
- zvláštnosti sadzby, ktoré by prevodca mohol pokaziť (stĺpce, zalomené tabuľky, poznámky pod čiarou).

Potom rozdeľ dokument na časti na prevod: súvislé rozsahy strán, najviac ${MAX_PART_PAGES} strán na časť, hranicu daj tam, kde sa nerozdelí tabuľka a kde to dáva zmysel podľa členenia.

Odpovedz takto: najprv analýza v Markdowne, na úplnom konci blok
\`\`\`json
{"parts":[{"from":1,"to":8},{"from":9,"to":15}]}
\`\`\``

const CONVERT_INSTRUCTION = `Si prevodca dokumentov do Markdownu. Dostaneš strany PDF, ich textovú vrstvu a analýzu celého dokumentu.

${PROHIBITION}

ČO MÁŠ ROBIŤ:
- Preveď LEN zadané strany. Začni presne tam, kde skončila predošlá časť — jej koniec dostaneš; nič z neho neopakuj.
- Slová ber z textovej vrstvy (je presná), štruktúru z toho, ako strany vyzerajú, a z analýzy.
- Členenie dokumentu vyjadri nadpismi Markdownu (#, ##, ###) podľa úrovní z analýzy. Označenie píš doslovne tak, ako je v dokumente.
- Odseky, zoznamy a tabuľky vyjadri Markdownom; tabuľku ako tabuľku (| … |) s riadkom hlavičky.
- Spoj riadky, ktoré rozdelilo zalomenie riadku alebo strany; slovo rozdelené spojovníkom na konci riadku spoj.
- Hlavičky, päty a čísla strán vynechaj.
- Text, ktorý je na obrázku (tabuľka, text), prepíš doslova. Obrázok bez textu (schéma, logo) opíš jednou vetou v kurzíve, ktorá začína „Obrázok v origináli:".

Odpovedz LEN samotným Markdownom zadaných strán, bez komentára pred ním či za ním.`

/** Textová vrstva strán `from…to` ako text pre model. */
export function layerText(layer: LayerPage[], from: number, to: number): string {
  const out: string[] = []
  for (let p = from; p <= to; p++) {
    const page = layer[p - 1]
    if (!page) continue
    out.push(`--- strana ${p}${page.images ? ` (obrázky: ${page.images})` : ""} ---`, ...page.lines)
  }
  return out.join("\n")
}

/** Rovnomerné časti, keď analýza žiadne platné nenavrhla. */
export function fallbackParts(pageCount: number, size = FALLBACK_PART_PAGES): PagePart[] {
  const parts: PagePart[] = []
  for (let from = 1; from <= pageCount; from += size) parts.push({ from, to: Math.min(pageCount, from + size - 1) })
  return parts
}

/**
 * Časti z odpovede analýzy. Prijmú sa len vtedy, keď pokryjú strany
 * `first…last` súvisle a bez prekryvu; priveľká časť sa rozdelí. Inak sa
 * delí rovnomerne — rozdelenie na časti mení len to, kde model nadväzuje,
 * nie text, takže náhradné delenie je bezpečné.
 */
export function parsePlan(answer: string, first: number, last: number): { analysis: string; parts: PagePart[]; fromModel: boolean } {
  const blocks = [...answer.matchAll(/```json\s*([\s\S]*?)```/g)]
  const block = blocks[blocks.length - 1]
  const analysis = (block ? answer.slice(0, block.index) : answer).trim()
  const even = fallbackParts(last - first + 1).map(p => ({ from: p.from + first - 1, to: p.to + first - 1 }))
  if (!block) return { analysis, parts: even, fromModel: false }
  let raw: unknown
  try { raw = JSON.parse(block[1]) } catch { return { analysis, parts: even, fromModel: false } }
  const list = (raw as { parts?: unknown })?.parts
  if (!Array.isArray(list) || !list.length) return { analysis, parts: even, fromModel: false }
  const parts: PagePart[] = []
  let next = first
  for (const item of list) {
    const from = Number((item as PagePart)?.from)
    const to = Number((item as PagePart)?.to)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from !== next || to < from || to > last) {
      return { analysis, parts: even, fromModel: false }
    }
    for (let s = from; s <= to; s += MAX_PART_PAGES) parts.push({ from: s, to: Math.min(to, s + MAX_PART_PAGES - 1) })
    next = to + 1
  }
  if (next !== last + 1) return { analysis, parts: even, fromModel: false }
  return { analysis, parts, fromModel: true }
}

/** Posledné riadky textu — koniec predošlej časti pre nadviazanie. */
export function tailOf(markdown: string, lines = TAIL_LINES): string {
  return markdown.trim().split("\n").slice(-lines).join("\n")
}

/**
 * Nadpisy hotových častí s ich úrovňou — ďalšia časť v nich pokračuje.
 * Bez toho sa úrovne medzi časťami rozišli (rozpis ÚLK 3. 11. 2026: body
 * B.1–9 ako `###`, B.10–20 ako `##`). Nie je to šablóna: sú to nadpisy
 * tohto dokumentu, ako ich model sám zvolil. Pri dlhom dokumente posledné.
 */
export function headingOutline(parts: string[], limit = 200): string {
  const headings = parts.join("\n").split("\n").filter(l => /^#{1,6}\s/.test(l)).map(l => l.trim())
  return headings.slice(-limit).join("\n")
}

/** Časti za sebou; prázdne sa vynechajú. */
export function joinParts(parts: string[]): string {
  return parts.map(p => p.trim()).filter(Boolean).join("\n\n") + "\n"
}

/** Strany `from…to` ako samostatné PDF. */
export async function slicePdf(pdf: Buffer, from: number, to: number): Promise<Buffer> {
  const source = await PDFDocument.load(pdf, { ignoreEncryption: true })
  if (from === 1 && to >= source.getPageCount()) return pdf
  const out = await PDFDocument.create()
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i)
  for (const page of await out.copyPages(source, indices)) out.addPage(page)
  return Buffer.from(await out.save())
}

const pdfBlock = (data: Buffer) => ({
  type: "document",
  source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") },
})

/**
 * Analýza strán `from…to` (pri dlhom dokumente po oknách do 100 strán).
 * `previous` je analýza predošlých okien — okno ju má doplniť, nie začať znova.
 */
export async function analyse(
  pdf: Buffer, layer: LayerPage[], from: number, to: number, previous: string, ai: RewriteAi,
): Promise<{ analysis: string; parts: PagePart[]; fromModel: boolean }> {
  const pages = await slicePdf(pdf, from, to)
  const intro = from === 1 && to === layer.length
    ? `Dokument má ${layer.length} strán; dostávaš celý.`
    : `Dokument má ${layer.length} strán; dostávaš strany ${from}–${to}. Čísla strán v pláne píš podľa celého dokumentu.`
  const answer = await callModel(ai, {
    system: ANALYSIS_INSTRUCTION,
    content: [
      pdfBlock(pages),
      {
        type: "text",
        text: [intro,
          previous ? `Analýza predošlých strán (doplň ju, nezačínaj odznova):\n\n${previous}` : "",
          `Textová vrstva:\n\n${layerText(layer, from, to)}`].filter(Boolean).join("\n\n"),
      },
    ],
  })
  return parsePlan(answerText(answer.content as { type: string; text?: string }[]), from, to)
}

/** Prevod jednej časti — Markdown jej strán. */
export async function convertPart(
  pdf: Buffer, layer: LayerPage[], analysis: string, part: PagePart, previousTail: string, ai: RewriteAi, outline = "",
): Promise<string> {
  const pages = await slicePdf(pdf, part.from, part.to)
  const answer = await callModel(ai, {
    system: CONVERT_INSTRUCTION,
    content: [
      pdfBlock(pages),
      {
        type: "text",
        text: [
          `Preveď strany ${part.from}–${part.to} z ${layer.length} (PDF vyššie obsahuje len tieto strany).`,
          `Analýza celého dokumentu:\n\n${analysis}`,
          outline ? `Nadpisy, ktoré už prevedené časti majú. Pokračuj v rovnakých úrovniach — nadpis s rovnakým druhom označenia ako niektorý z nich dostane rovnakú úroveň (#, ##, ###):\n\n${outline}` : "",
          previousTail ? `Koniec predošlej časti (už prevedený — neopakuj ho, nadviaž):\n\n${previousTail}` : "Toto je začiatok dokumentu.",
          `Textová vrstva týchto strán:\n\n${layerText(layer, part.from, part.to)}`,
        ].filter(Boolean).join("\n\n"),
      },
    ],
  })
  return answerText(answer.content as { type: string; text?: string }[])
}
