/**
 * konverzia.ts — z nahratého súboru Markdown (D53).
 *
 * **Prevod beží u nás, nie v modeli.** Norma je text, ktorý ľudia potvrdzujú
 * a podľa ktorého konajú; jazykový model ho vie potichu preštylizovať a nikto
 * si toho nemusí všimnúť. Knižnica prepíše to, čo v súbore je — nudne
 * a doslovne. Model je až **druhý krok, ktorý vyvolá človek** z editora, keď
 * vidí, že prvý výsledok nestačí (skenované PDF, rozsypaná tabuľka).
 *
 * Preto tu nie je žiadne „keď sa nepodarí, skús model": tichý ústup na model
 * je presne to, po čom sa v dokumente objaví text, ktorý tam nikto nenapísal.
 * Keď sa prevod nepodarí, povie sa to — menovite a s návodom.
 *
 * Čo sem **nepatrí**: rozsekanie na chunky (to je `chunker`), metadáta
 * a číselníky (to je `metadata.ts`), ukladanie (to je `ulozisko.ts`).
 */

import { AppError } from "./appError"

export type FileType = "markdown" | "docx" | "pdf" | "xlsx" | "text"

export interface ConversionResult {
  markdown: string
  /** Čím to prešlo — ide do záznamu, aby bolo o rok vidieť, ako text vznikol. */
  method: string
  /**
   * Upozornenia pre človeka v editore. Nie chyby — text existuje, len s ním
   * niečo je: chýbajúce obrázky, zlúčené bunky, podozrivo málo textu.
   */
  warnings: string[]
}

export class ConversionError extends AppError {}

/**
 * Typ súboru **z obsahu a prípony**, nie z toho, čo tvrdí prehliadač.
 *
 * `content-type` z formulára posiela klient a pri `.docx` býva podľa
 * operačného systému čokoľvek od `application/octet-stream` po prázdno.
 * Prvé bajty klamú ťažšie: ZIP-ová hlavička `PK` je v docx aj xlsx, `%PDF-`
 * v PDF.
 */
export function detectFileType(name: string, data: Buffer): FileType {
  const extension = name.toLowerCase().split(".").pop() ?? ""
  const start = data.subarray(0, 5).toString("latin1")

  if (start.startsWith("%PDF-")) return "pdf"
  if (start.startsWith("PK")) {
    if (extension === "xlsx" || extension === "xlsm") return "xlsx"
    if (extension === "docx") return "docx"
    throw new ConversionError(
      "conversion.zipNotOffice",
      "Toto je ZIP-ový balík, ale ani docx, ani xlsx. Staré `.doc` a `.xls` sa prevádzať nedajú — " +
      "ulož ich vo Worde alebo Exceli ako novší formát.",
    )
  }
  if (extension === "md" || extension === "markdown") return "markdown"
  if (extension === "txt" || extension === "csv") return "text"

  throw new ConversionError(
    "conversion.unsupportedFormat",
    `Formát ${extension ? `.${extension}` : "súboru"} zatiaľ nevieme previesť. ` +
    "Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
    { format: extension ? `.${extension}` : "súboru" },
  )
}

/** Poľudštený názov typu do hlášok a do záznamu. */
export const FILE_TYPE_LABEL: Record<FileType, string> = {
  markdown: "Markdown",
  docx: "Word (.docx)",
  pdf: "PDF",
  xlsx: "Excel (.xlsx)",
  text: "textový súbor",
}

/** Zjednotí konce riadkov a zahodí nezmyselné množstvo prázdnych. */
function tidied(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

async function fromDocx(data: Buffer): Promise<ConversionResult> {
  const mammoth = (await import("mammoth")).default
  const TurndownService = (await import("turndown")).default

  const result = await mammoth.convertToHtml({ buffer: data })
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  })
  const markdown = tidied(turndown.turndown(result.value))

  const warnings: string[] = []
  // Mammoth hlási, čo zahodil. Väčšinou sú to štýly bez významu, ale
  // obrázky a poznámky pod čiarou stoja za zmienku — v norme to býva text.
  if (result.messages.some(m => /image/i.test(m.message))) {
    warnings.push("Dokument obsahoval obrázky — do Markdownu sa neprepísali.")
  }
  if (!markdown) warnings.push("Z dokumentu nevyšiel žiadny text.")

  return { markdown, method: "mammoth + turndown", warnings: warnings }
}

async function fromPdf(data: Buffer): Promise<ConversionResult> {
  // Legacy zostava beží v Node bez prehliadačových API.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const pdfDoc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    // Bez pracovného vlákna: vo funkcii je to jeden proces a vlastný worker
    // by sa aj tak nemal odkiaľ načítať.
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise

  const pageCount: string[] = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let line = ""
    let lastY: number | null = null

    for (const item of content.items) {
      const p = item as { str?: string; transform?: number[]; hasEOL?: boolean }
      if (typeof p.str !== "string") continue
      const y = p.transform?.[5] ?? null
      // Nový riadok podľa zvislej súradnice: PDF nemá riadky, má polohy.
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim())
        line = ""
      }
      line += p.str
      if (p.hasEOL) {
        lines.push(line.trim())
        line = ""
      }
      lastY = y
    }
    if (line.trim()) lines.push(line.trim())
    pageCount.push(lines.filter(Boolean).join("\n"))
  }

  const markdown = tidied(pageCount.join("\n\n"))
  const warnings: string[] = []

  // Skenované PDF má strany a nemá text. Nepodsúvame OCR ticho: text, ktorý
  // vyzerá správne a nie je, je pri norme horší než chýbajúci dokument.
  const charsPerPage = markdown.length / Math.max(pdfDoc.numPages, 1)
  if (markdown.length === 0) {
    throw new ConversionError(
      "conversion.pdfNoText",
      "V tomto PDF nie je žiadny text — je to obrázok (sken). Prevod ho neprečíta. " +
      "V editore ho môžeš dať prepísať jazykovým modelom, alebo si vypýtaj od autora pôvodný súbor.",
    )
  }
  if (charsPerPage < 200) {
    warnings.push(
      `Na stranu vychádza len ${Math.round(charsPerPage)} znakov — časť dokumentu je zrejme obrázok. ` +
      "Porovnaj Markdown s originálom.",
    )
  }
  warnings.push(
    "PDF nemá nadpisy ani zoznamy, len polohu textu — členenie treba doplniť v editore.",
  )

  return { markdown, method: `pdfjs (${pdfDoc.numPages} strán)`, warnings: warnings }
}

async function fromXlsx(data: Buffer): Promise<ConversionResult> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(data, { type: "buffer" })

  const parts: string[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const lines = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
    if (lines.length === 0) continue

    parts.push(`## ${name}`)
    const width = Math.max(...lines.map(r => r.length))
    const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim()
    const toRow = (r: string[]) =>
      "| " + Array.from({ length: width }, (_, i) => cell(r[i])).join(" | ") + " |"

    // Prvý riadok ako hlavička. Nie je to vždy pravda, ale tabuľka bez
    // hlavičky sa v Markdowne nevykreslí vôbec — a opraviť ju v editore je
    // jednoduchšie než dopisovať.
    parts.push(toRow(lines[0]))
    parts.push("| " + Array.from({ length: width }, () => "---").join(" | ") + " |")
    for (const r of lines.slice(1)) parts.push(toRow(r))
    parts.push("")
  }

  const markdown = tidied(parts.join("\n"))
  return {
    markdown,
    method: `SheetJS (${workbook.SheetNames.length} hárkov)`,
    warnings: [
      "Prvý riadok každého hárka sa použil ako hlavička tabuľky — over, či to sedí.",
      "Vzorce sa prepísali ako hodnoty; zlúčené bunky sa rozpadli.",
    ],
  }
}

/** Prevedie nahratý súbor na Markdown. Vyhadzuje `KonverziaError` s návodom. */
export async function convert(
  name: string,
  data: Buffer,
): Promise<ConversionResult & { type: FileType }> {
  const type = detectFileType(name, data)

  switch (type) {
    case "markdown":
    case "text": {
      const text = tidied(data.toString("utf8"))
      if (!text) throw new ConversionError("conversion.noText", "Súbor neobsahuje žiadny text.")
      return {
        type: type,
        markdown: text,
        method: "bez prevodu",
        warnings: type === "text"
          ? ["Text sa prevzal tak, ako bol — členenie na nadpisy treba doplniť v editore."]
          : [],
      }
    }
    case "docx": return { type: type, ...(await fromDocx(data)) }
    case "pdf": return { type: type, ...(await fromPdf(data)) }
    case "xlsx": return { type: type, ...(await fromXlsx(data)) }
  }
}
