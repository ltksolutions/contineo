/**
 * conversion.ts — z nahratého súboru Markdown (D53).
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
 * a číselníky (to je `metadata.ts`), ukladanie (to je `fileStore.ts`).
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

/**
 * Obrázky vložené do textu ako `data:` adresa — `![popis](data:image/…;base64,…)`
 * aj holý `<img src="data:…">`, ktorý turndown niekedy nechá v HTML.
 */
const INLINE_IMAGE = /!\[[^\]]*\]\(\s*data:[^)]*\)|<img\b[^>]*\bsrc=["']?data:[^>]*>/gi

/**
 * Odstráni z Markdownu obrázky vložené ako `data:` adresa.
 *
 * **Poistka, nie hlavná cesta** — `fromDocx()` obrázky zahodí už pri prevode.
 * Je tu preto, že obrázok v texte nerobí len šum: 23. 9. 2026 mal pracovný
 * poriadok (2,5 MB .docx) vo vnútri 34 MB obrázok EMF, z textu bolo 47 MB
 * base64 a zápis do Monga padol na strope 17 MB buffra BSON. Do úsekov na
 * hľadanie by sa navyše dostali stovky kilobajtov nezmyslov, ktoré sa
 * embeddujú a za ktoré sa platí.
 */
export function stripInlineImages(markdown: string): { markdown: string; removed: number } {
  let removed = 0
  const out = markdown.replace(INLINE_IMAGE, () => {
    removed++
    return ""
  })
  return { markdown: out, removed }
}

/**
 * Obsah vygenerovaný Wordom — každý riadok je odkaz na kotvu `#_Toc…` s číslom
 * strany. V prevedenom texte nič nenaviguje (kotvy nie sú) a vo vyhľadávaní je
 * to šum: štyridsať riadkov „Článok 7 – Pracovná cesta 9" pred prvým článkom.
 * Zahodia sa aj prázdne kotvy `<a id="_Toc…">`, ktoré Word rozsieva po nadpisoch.
 */
export function stripWordToc(html: string): string {
  return html
    .replace(/<p>\s*<a href="#_Toc[^"]*">[\s\S]*?<\/a>\s*<\/p>/g, "")
    .replace(/<a id="_Toc[^"]*"><\/a>/g, "")
}

/**
 * Poznámky pod čiarou **k textu**, nie na koniec (23. 9. 2026, pracovný
 * poriadok SFZ). V predpisoch sú to spravidla odkazy na zákon — „§ 140 ZP" —
 * a úsek s článkom sa na vyhľadávanie reže osobitne; poznámky na konci
 * dokumentu by pri ňom nikdy neboli. Odkaz `[39]` sa nahradí
 * „(pozn. 39: § 140 ZP)" a zoznam poznámok na konci sa zahodí.
 *
 * Tvar je presne ten, ktorý robí mammoth: `<sup><a href="#footnote-N"
 * id="footnote-ref-N">[N]</a></sup>` v texte a `<li id="footnote-N">` so
 * spätným odkazom „↑" na konci.
 */
export function inlineFootnotes(html: string): string {
  const notes = new Map<string, string>()
  const withoutList = html.replace(/<li id="footnote-(\d+)">([\s\S]*?)<\/li>/g, (_all, n: string, body: string) => {
    const text = body
      .replace(/<a href="#footnote-ref-\d+">[\s\S]*?<\/a>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    notes.set(n, text)
    return ""
  })
  return withoutList
    .replace(/<ol>\s*<\/ol>/g, "")
    .replace(/<sup><a href="#footnote-(\d+)" id="footnote-ref-\d+">\[\d+\]<\/a><\/sup>/g, (all, n: string) => {
      const text = notes.get(n)
      return text ? ` (pozn. ${n}: ${text})` : all
    })
}

/**
 * Tabuľka ako tabuľka Markdownu (GFM). Turndown ju bez doplnku rozsype na
 * samostatné odseky — „Schválil" a „VV SFZ" potom stoja v texte ako dva
 * nesúvisiace riadky. Prvý riadok je hlavička (Markdown bez nej tabuľku
 * nevykreslí); bunky sa zlejú do jedného riadku a `|` sa escapuje.
 */
type TurndownLike = { turndown(html: string): string }
type TableNode = { querySelectorAll(sel: string): ArrayLike<{ querySelectorAll(sel: string): ArrayLike<{ innerHTML: string }> }> }

function tableToMarkdown(node: TableNode, service: TurndownLike): string {
  const rows = Array.from(node.querySelectorAll("tr")).map(tr =>
    Array.from(tr.querySelectorAll("td, th")).map(cell =>
      service.turndown(cell.innerHTML).replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|").trim(),
    ),
  ).filter(r => r.length > 0)
  if (rows.length === 0) return ""
  const width = Math.max(...rows.map(r => r.length))
  const line = (r: string[]) => "| " + Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ") + " |"
  return "\n\n" + [
    line(rows[0]),
    "| " + Array.from({ length: width }, () => "---").join(" | ") + " |",
    ...rows.slice(1).map(line),
  ].join("\n") + "\n\n"
}

async function fromDocx(data: Buffer): Promise<ConversionResult> {
  const mammoth = (await import("mammoth")).default
  const TurndownService = (await import("turndown")).default

  /*
   * Obrázky sa **zahodia pri prevode**, nie až v Markdowne. Predvolene ich
   * mammoth vkladá do HTML ako base64 — celé, aj 34 MB obrázok EMF, ktorý
   * prehliadač ani nezobrazí. Obrázok bez `src` turndown vynechá; norma je
   * text a originál so všetkými obrázkami zostáva v GridFS.
   *
   * Počítajú sa tu, nie z hlásení mammothu — ten hlási len nezvyčajné
   * formáty (EMF), takže pri bežnom PNG by varovanie nezaznelo nikdy.
   */
  let images = 0
  const result = await mammoth.convertToHtml(
    { buffer: data },
    {
      convertImage: mammoth.images.imgElement(async () => {
        images++
        return { src: "" }
      }),
    },
  )
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  })
  turndown.addRule("table", {
    filter: "table",
    replacement: (_content, node) => tableToMarkdown(node as unknown as TableNode, turndown),
  })
  const html = inlineFootnotes(stripWordToc(result.value))
  const stripped = stripInlineImages(turndown.turndown(html))
  const markdown = tidied(stripped.markdown)

  const warnings: string[] = []
  // Obrázok v norme býva text (schéma, podpis, tabuľka ako obrázok), takže
  // stojí za zmienku, že sa do Markdownu nedostal.
  if (images > 0 || stripped.removed > 0) {
    warnings.push("Dokument obsahoval obrázky — do Markdownu sa neprepísali.")
  }
  if (!markdown) warnings.push("Z dokumentu nevyšiel žiadny text.")

  return { markdown, method: "mammoth + turndown", warnings: warnings }
}

async function fromPdf(data: Buffer): Promise<ConversionResult> {
  /*
   * Zlyhanie **samotnej knižnice** dostane vlastný kód.
   *
   * Bez neho spadne cudzia výnimka do `errorMessage()` v serverovej akcii,
   * tá ju do obrazovky nepustí (a je to správne — text výnimky človeku nič
   * nehovorí) a zostane hláška „Nepodarilo sa to. Skús to znova." Lenže
   * pokazená knižnica zlyhá vždy rovnako, takže tá veta pozýva na úkon,
   * ktorý nemôže prejsť.
   *
   * Stalo sa to naozaj: `pdf.worker.mjs` nebol v serverless zväzku a prevod
   * PDF v produkcii nefungoval vôbec (2026-09-14, nájdené nácvikom na
   * ostrom PDF). Príčina je opravená v `next.config.mjs`; toto je poistka
   * na nabudúce — aby sa ďalšie takéto zlyhanie prejavilo vetou, ktorá
   * povie, čo sa stalo, a nie mlčaním.
   */
  let pdfjs
  try {
    // Legacy zostava beží v Node bez prehliadačových API.
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  } catch (e) {
    console.error("[prevod] pdfjs-dist sa nepodarilo načítať:", e)
    throw new ConversionError(
      "conversion.pdfEngineFailed",
      "Prevod PDF je nedostupný — knižnica na čítanie PDF sa nespustila.",
    )
  }

  let pdfDoc
  try {
    pdfDoc = await pdfjs.getDocument({
      data: new Uint8Array(data),
      // Bez pracovného vlákna: vo funkcii je to jeden proces a vlastný worker
      // by sa aj tak nemal odkiaľ načítať.
      useWorkerFetch: false,
      useSystemFonts: false,
    }).promise
  } catch (e) {
    console.error("[prevod] PDF sa nepodarilo otvoriť:", e)
    throw new ConversionError(
      "conversion.pdfEngineFailed",
      "PDF sa nepodarilo otvoriť.",
    )
  }

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
