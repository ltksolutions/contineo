/**
 * tidyStructure.ts — obnovenie členenia prevedeného textu **bez modelu**.
 *
 * **Prečo nie model.** Prepis cez jazykový model sa na tento účel povolal,
 * aby „obnovil členenie". Lenže členenie sa nestratilo: v texte prevedenom
 * z PDF stojí `Článok 1` sám na riadku a jeho názov na ďalšom, presne
 * a bez výnimky. Členenie je teda **strojovo rozpoznateľné** a model by pri
 * jeho dopĺňaní prepisoval slová normy — dokumentu, ktorý ľudia potvrdzujú
 * a podľa ktorého sa ukladajú tresty.
 *
 * Navyše to ani nefungovalo: `max_tokens` je strop výstupu a dlhá norma sa
 * doň nezmestí. Prepis Disciplinárneho poriadku vrátil necelú polovicu
 * (51 z 97 článkov) a nikto sa to nedozvedel — `stop_reason` nikto nečítal.
 * Zistené nácvikom 2026-09-14.
 *
 * **Čo sa tu mení.** Riadky sa spájajú, pribúdajú mriežky a pomlčka medzi
 * číslom článku a jeho názvom, a odstraňuje sa pätička strany. **Žiadne
 * slovo normy sa nemení, nepridáva ani nevypúšťa** — stráži to test, ktorý
 * porovnáva postupnosť všetkých slov pred a po.
 *
 * Model zostáva tam, kde je nenahraditeľný: pri skenoch bez textovej vrstvy
 * (`llmRewrite.rewritePdf`).
 */

/** Rímske poradie v slovenčine — v normách sa časti aj hlavy píšu slovom. */
const ORDER_UPPER = "PRVÁ|DRUHÁ|TRETIA|ŠTVRTÁ|PIATA|ŠIESTA|SIEDMA|ÔSMA|DEVIATA|DESIATA|JEDENÁSTA|DVANÁSTA"
const ORDER_LOWER = "Prvá|Druhá|Tretia|Štvrtá|Piata|Šiesta|Siedma|Ôsma|Deviata|Desiata|Jedenásta|Dvanásta"

const PART = new RegExp(`^(?:${ORDER_UPPER})\\s+ČASŤ$`)
const CHAPTER = new RegExp(`^(?:${ORDER_LOWER})\\s+hlava$`, "i")
const SECTION = new RegExp(`^(?:${ORDER_LOWER})\\s+diel$`, "i")
const ARTICLE = /^Článok\s+\d+[a-z]?$/
const ANNEX = /^PR[ÍI]LOHA\s+č\.\s*\d+[a-z]?$/i

/** Pätička strany. Z nej sa odvodí, čo ďalšie sa na každej strane opakuje. */
const PAGE_NUMBER = /^Strana\s+\d+\s+z\s+\d+$/

/** Odsek normy — nikdy nie je názvom nadpisu, takže sa za neho nepripojí. */
const NORM_PARAGRAPH = /^\(\d+[a-z]?\)/
/** Písmeno v odseku — to isté. */
const LETTER = /^[a-z]\)\s/

/** Značka poznámky pod čiarou rozbitá prevodom na dva riadky. */
const LONE_NUMBER = /^\d+$/
const CLOSING = /^\)/

/** Koľko riadkov okolo pätičky sa najviac skúma. Ochrana pred ujdením. */
const MAX_FURNITURE = 4

export interface TidyReport {
  /** Odstránené riadky pätičky a hlavičky strany. */
  removedFurniture: number
  /** Koľko riadkov sa stalo nadpisom. */
  headings: number
  /** Koľko rozbitých značiek poznámok sa zlepilo. */
  footnotes: number
  /** Čo stojí za pozretie, ale nie je chyba. */
  warnings: string[]
}

export interface TidyResult extends TidyReport {
  markdown: string
}

/** Je riadok štruktúrny? Taký sa nikdy nesmie zmazať ani pripojiť k nadpisu. */
function structural(line: string): boolean {
  return PART.test(line) || CHAPTER.test(line) || SECTION.test(line) ||
         ARTICLE.test(line) || ANNEX.test(line)
}

/**
 * Riadky pätičky a hlavičky strany.
 *
 * **Nie podľa toho, čo sa často opakuje.** V Disciplinárnom poriadku sa veta
 * „alebo ďalšie disciplinárne sankcie podľa disciplinárneho poriadku." opakuje
 * sedemkrát a je to obsah normy; pravidlo postavené na početnosti by ju
 * zmazalo.
 *
 * Vychádza sa preto z `Strana N z M` a odstránia sa len tie susedné riadky,
 * ktoré sú pri **všetkých** výskytoch rovnaké. Dokument bez čísel strán teda
 * nepríde o nič.
 */
function furnitureIndices(lines: string[]): Set<number> {
  const pages = lines.map((l, i) => [l.trim(), i] as const)
    .filter(([t]) => PAGE_NUMBER.test(t))
    .map(([, i]) => i)

  const out = new Set<number>(pages)
  if (pages.length < 2) return out

  // Koľko rovnakých riadkov stojí NAD každým číslom strany.
  for (let k = 1; k <= MAX_FURNITURE; k++) {
    const at = (i: number) => lines[i - k]?.trim() ?? null
    const first = at(pages[0])
    if (!first || structural(first) || NORM_PARAGRAPH.test(first)) break
    if (!pages.every(i => at(i) === first)) break
    for (const i of pages) out.add(i - k)
  }

  // …a koľko POD ním (hlavička nasledujúcej strany).
  for (let k = 1; k <= MAX_FURNITURE; k++) {
    const at = (i: number) => lines[i + k]?.trim() ?? null
    const first = at(pages[0])
    if (!first || structural(first) || NORM_PARAGRAPH.test(first)) break
    if (!pages.every(i => at(i) === first)) break
    for (const i of pages) out.add(i + k)
  }

  return out
}

/** Úroveň nadpisu podľa toho, aká je to úroveň členenia normy. */
function headingFor(line: string): string | null {
  if (PART.test(line) || ANNEX.test(line)) return "#"
  if (CHAPTER.test(line) || SECTION.test(line)) return "##"
  if (ARTICLE.test(line)) return "###"
  return null
}

/**
 * Prečistí členenie prevedeného textu.
 *
 * Čisté — bez databázy, bez siete, bez modelu. Preto sa dá otestovať na
 * skutočnom texte normy a preto nemá limit na dĺžku.
 */
export function tidyStructure(input: string): TidyResult {
  const lines = (input ?? "").split(/\r\n|\r|\n/)
  const furniture = furnitureIndices(lines)

  const report: TidyReport = {
    removedFurniture: furniture.size,
    headings: 0,
    footnotes: 0,
    warnings: [],
  }

  // 1) preč s pätičkou a hlavičkou strany
  const kept = lines.filter((_, i) => !furniture.has(i))

  // 2) značka poznámky rozbitá na `1` a `) text` späť na jeden riadok
  const joined: string[] = []
  for (let i = 0; i < kept.length; i++) {
    const t = kept[i].trim()
    const next = kept[i + 1]?.trim() ?? ""
    if (LONE_NUMBER.test(t) && CLOSING.test(next)) {
      joined.push(t + next)
      report.footnotes++
      i++
      continue
    }
    joined.push(kept[i])
  }

  // 3) štruktúrny riadok a jeho názov z ďalšieho riadku na jeden nadpis
  const out: string[] = []
  for (let i = 0; i < joined.length; i++) {
    const t = joined[i].trim()
    const mark = headingFor(t)
    if (!mark) { out.push(joined[i]); continue }

    const next = joined[i + 1]?.trim() ?? ""
    // Názov je na ďalšom riadku — ale len ak to naozaj názov je. Za `Článok 5`
    // môže rovno nasledovať odsek `(1)`; vtedy článok názov nemá a vymyslieť
    // mu ho nie je naša vec.
    const hasTitle = Boolean(next) && !structural(next) &&
                     !NORM_PARAGRAPH.test(next) && !LETTER.test(next) &&
                     !PAGE_NUMBER.test(next)

    out.push(hasTitle ? `${mark} ${t} — ${next}` : `${mark} ${t}`)
    report.headings++
    if (hasTitle) i++
  }

  if (report.headings === 0) {
    report.warnings.push("V texte sa nenašla ani jedna úroveň členenia — text zostal, ako bol.")
  }
  if (report.removedFurniture === 0) {
    report.warnings.push("Nenašli sa čísla strán, takže sa neodstránila žiadna pätička.")
  }

  return { markdown: out.join("\n"), ...report }
}

/**
 * Odtlačok textu — na overenie, že sa nezmenilo ani jedno slovo.
 *
 * Tvrdenie „nemení sa ani jedno slovo normy" musí byť **overiteľné**, nie
 * sľúbené: je to dôvod, pre ktorý sa na túto prácu nepoužíva jazykový model.
 *
 * Porovnávajú sa všetky znaky okrem bielych miest, lebo prečistenie riadky
 * spája — `1` a `) text` na dvoch riadkoch sa stanú `1) text` na jednom
 * a medzi slovami tak ubudne zalomenie. Značky, ktoré prečistenie **pridáva**
 * (mriežky nadpisu a pomlčka medzi číslom článku a názvom), sa odrátajú;
 * všetko ostatné musí sedieť znak na znak.
 */
export function textFingerprint(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/—/g, "")
    .replace(/\s+/g, "")
}
