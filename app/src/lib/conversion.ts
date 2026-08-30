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

export type TypSuboru = "markdown" | "docx" | "pdf" | "xlsx" | "text"

export interface VysledokPrevodu {
  markdown: string
  /** Čím to prešlo — ide do záznamu, aby bolo o rok vidieť, ako text vznikol. */
  sposob: string
  /**
   * Upozornenia pre človeka v editore. Nie chyby — text existuje, len s ním
   * niečo je: chýbajúce obrázky, zlúčené bunky, podozrivo málo textu.
   */
  upozornenia: string[]
}

export class KonverziaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KonverziaError"
  }
}

/**
 * Typ súboru **z obsahu a prípony**, nie z toho, čo tvrdí prehliadač.
 *
 * `content-type` z formulára posiela klient a pri `.docx` býva podľa
 * operačného systému čokoľvek od `application/octet-stream` po prázdno.
 * Prvé bajty klamú ťažšie: ZIP-ová hlavička `PK` je v docx aj xlsx, `%PDF-`
 * v PDF.
 */
export function urcTyp(nazov: string, data: Buffer): TypSuboru {
  const pripona = nazov.toLowerCase().split(".").pop() ?? ""
  const zaciatok = data.subarray(0, 5).toString("latin1")

  if (zaciatok.startsWith("%PDF-")) return "pdf"
  if (zaciatok.startsWith("PK")) {
    if (pripona === "xlsx" || pripona === "xlsm") return "xlsx"
    if (pripona === "docx") return "docx"
    throw new KonverziaError(
      "Toto je ZIP-ový balík, ale ani docx, ani xlsx. Staré `.doc` a `.xls` sa prevádzať nedajú — " +
      "ulož ich vo Worde alebo Exceli ako novší formát.",
    )
  }
  if (pripona === "md" || pripona === "markdown") return "markdown"
  if (pripona === "txt" || pripona === "csv") return "text"

  throw new KonverziaError(
    `Formát ${pripona ? `.${pripona}` : "súboru"} zatiaľ nevieme previesť. ` +
    "Podporujeme .docx, .pdf, .xlsx, .md, .txt a .csv.",
  )
}

/** Poľudštený názov typu do hlášok a do záznamu. */
export const NAZOV_TYPU: Record<TypSuboru, string> = {
  markdown: "Markdown",
  docx: "Word (.docx)",
  pdf: "PDF",
  xlsx: "Excel (.xlsx)",
  text: "textový súbor",
}

/** Zjednotí konce riadkov a zahodí nezmyselné množstvo prázdnych. */
function upraceny(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

async function zDocx(data: Buffer): Promise<VysledokPrevodu> {
  const mammoth = (await import("mammoth")).default
  const TurndownService = (await import("turndown")).default

  const vysledok = await mammoth.convertToHtml({ buffer: data })
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  })
  const markdown = upraceny(turndown.turndown(vysledok.value))

  const upozornenia: string[] = []
  // Mammoth hlási, čo zahodil. Väčšinou sú to štýly bez významu, ale
  // obrázky a poznámky pod čiarou stoja za zmienku — v norme to býva text.
  if (vysledok.messages.some(m => /image/i.test(m.message))) {
    upozornenia.push("Dokument obsahoval obrázky — do Markdownu sa neprepísali.")
  }
  if (!markdown) upozornenia.push("Z dokumentu nevyšiel žiadny text.")

  return { markdown, sposob: "mammoth + turndown", upozornenia }
}

async function zPdf(data: Buffer): Promise<VysledokPrevodu> {
  // Legacy zostava beží v Node bez prehliadačových API.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const dokument = await pdfjs.getDocument({
    data: new Uint8Array(data),
    // Bez pracovného vlákna: vo funkcii je to jeden proces a vlastný worker
    // by sa aj tak nemal odkiaľ načítať.
    useWorkerFetch: false,
    useSystemFonts: false,
  }).promise

  const strany: string[] = []
  for (let i = 1; i <= dokument.numPages; i++) {
    const strana = await dokument.getPage(i)
    const obsah = await strana.getTextContent()
    const riadky: string[] = []
    let riadok = ""
    let poslednyY: number | null = null

    for (const polozka of obsah.items) {
      const p = polozka as { str?: string; transform?: number[]; hasEOL?: boolean }
      if (typeof p.str !== "string") continue
      const y = p.transform?.[5] ?? null
      // Nový riadok podľa zvislej súradnice: PDF nemá riadky, má polohy.
      if (poslednyY !== null && y !== null && Math.abs(y - poslednyY) > 2) {
        riadky.push(riadok.trim())
        riadok = ""
      }
      riadok += p.str
      if (p.hasEOL) {
        riadky.push(riadok.trim())
        riadok = ""
      }
      poslednyY = y
    }
    if (riadok.trim()) riadky.push(riadok.trim())
    strany.push(riadky.filter(Boolean).join("\n"))
  }

  const markdown = upraceny(strany.join("\n\n"))
  const upozornenia: string[] = []

  // Skenované PDF má strany a nemá text. Nepodsúvame OCR ticho: text, ktorý
  // vyzerá správne a nie je, je pri norme horší než chýbajúci dokument.
  const znakovNaStranu = markdown.length / Math.max(dokument.numPages, 1)
  if (markdown.length === 0) {
    throw new KonverziaError(
      "V tomto PDF nie je žiadny text — je to obrázok (sken). Prevod ho neprečíta. " +
      "V editore ho môžeš dať prepísať jazykovým modelom, alebo si vypýtaj od autora pôvodný súbor.",
    )
  }
  if (znakovNaStranu < 200) {
    upozornenia.push(
      `Na stranu vychádza len ${Math.round(znakovNaStranu)} znakov — časť dokumentu je zrejme obrázok. ` +
      "Porovnaj Markdown s originálom.",
    )
  }
  upozornenia.push(
    "PDF nemá nadpisy ani zoznamy, len polohu textu — členenie treba doplniť v editore.",
  )

  return { markdown, sposob: `pdfjs (${dokument.numPages} strán)`, upozornenia }
}

async function zXlsx(data: Buffer): Promise<VysledokPrevodu> {
  const XLSX = await import("xlsx")
  const zosit = XLSX.read(data, { type: "buffer" })

  const casti: string[] = []
  for (const nazov of zosit.SheetNames) {
    const harok = zosit.Sheets[nazov]
    const riadky = XLSX.utils.sheet_to_json<string[]>(harok, { header: 1, raw: false, defval: "" })
    if (riadky.length === 0) continue

    casti.push(`## ${nazov}`)
    const sirka = Math.max(...riadky.map(r => r.length))
    const bunka = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim()
    const doRiadku = (r: string[]) =>
      "| " + Array.from({ length: sirka }, (_, i) => bunka(r[i])).join(" | ") + " |"

    // Prvý riadok ako hlavička. Nie je to vždy pravda, ale tabuľka bez
    // hlavičky sa v Markdowne nevykreslí vôbec — a opraviť ju v editore je
    // jednoduchšie než dopisovať.
    casti.push(doRiadku(riadky[0]))
    casti.push("| " + Array.from({ length: sirka }, () => "---").join(" | ") + " |")
    for (const r of riadky.slice(1)) casti.push(doRiadku(r))
    casti.push("")
  }

  const markdown = upraceny(casti.join("\n"))
  return {
    markdown,
    sposob: `SheetJS (${zosit.SheetNames.length} hárkov)`,
    upozornenia: [
      "Prvý riadok každého hárka sa použil ako hlavička tabuľky — over, či to sedí.",
      "Vzorce sa prepísali ako hodnoty; zlúčené bunky sa rozpadli.",
    ],
  }
}

/** Prevedie nahratý súbor na Markdown. Vyhadzuje `KonverziaError` s návodom. */
export async function preved(
  nazov: string,
  data: Buffer,
): Promise<VysledokPrevodu & { typ: TypSuboru }> {
  const typ = urcTyp(nazov, data)

  switch (typ) {
    case "markdown":
    case "text": {
      const text = upraceny(data.toString("utf8"))
      if (!text) throw new KonverziaError("Súbor neobsahuje žiadny text.")
      return {
        typ,
        markdown: text,
        sposob: "bez prevodu",
        upozornenia: typ === "text"
          ? ["Text sa prevzal tak, ako bol — členenie na nadpisy treba doplniť v editore."]
          : [],
      }
    }
    case "docx": return { typ, ...(await zDocx(data)) }
    case "pdf": return { typ, ...(await zPdf(data)) }
    case "xlsx": return { typ, ...(await zXlsx(data)) }
  }
}
