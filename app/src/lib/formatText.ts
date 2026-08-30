/**
 * formatText.ts — rozobratie odpovede modelu na zobraziteľné bloky.
 *
 * Model vracia ľahký markdown: tučné medzititulky, odrážky, číslované body.
 * Bez spracovania sa v odpovedi zjavia hviezdičky a hodnotiteľ ich číta ako
 * chybu systému, nie ako formátovanie.
 *
 * Zámerne to nerobíme knižnicou ani cez `dangerouslySetInnerHTML`. Vstupom
 * je výstup jazykového modelu nad cudzími dokumentmi — teda text, ktorý si
 * nemôžeme overiť. Preto sa tu z neho robí dátová štruktúra a React ju
 * vykreslí ako obyčajné uzly. Nič sa nikdy nestane HTML.
 *
 * Modul je čistý TypeScript bez JSX, aby sa dal testovať bez prehliadača.
 */

export type Segment =
  | { druh: "text"; text: string }
  | { druh: "tucne"; text: string }

export type Block =
  | { druh: "odsek"; segments: Segment[] }
  | { druh: "nadpis"; segments: Segment[]; level: number }
  | { druh: "zoznam"; items: Segment[][]; numbered: boolean }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/

/**
 * Riadok, ktorý je celý tučný, je medzititulok — model ho oddeľuje iba
 * zalomením, nie prázdnym riadkom. Keby sme sa držali prázdnych riadkov,
 * zlial by sa s odsekom pod sebou a odpoveď by stratila členenie práve tam,
 * kde ho čitateľ najviac potrebuje.
 */
const SUBHEADING = /^\*\*(?!\s)(.+?)\*\*[:：]?$/

/**
 * Markdown nadpis. Model ich používa striedavo s tučnými medzititulkami —
 * v tej istej odpovedi vedľa seba. Bez tohto vzoru sa v texte objavilo
 * doslovné „## Hráči“, čo vyzerá ako chyba systému.
 */
const HEADING = /^(#{1,4})\s+(.+?)\s*#*$/

/**
 * Rozdelí riadok na bežné a tučné úseky.
 *
 * Nepárny počet oddeľovačov nechávame tak, ako prišiel — useknutá odpoveď
 * (vyčerpaný limit tokenov) končí uprostred a bolo by horšie zmiznúť
 * polovicu textu než ukázať jednu hviezdičku.
 */
export function splitInline(line: string): Segment[] {
  const segments: Segment[] = []
  let rest = line

  for (;;) {
    const start = rest.indexOf("**")
    if (start === -1) break

    const end = rest.indexOf("**", start + 2)
    if (end === -1) break                     // nepárny — ďalej nespracúvame

    const inner = rest.slice(start + 2, end)
    if (!inner) {                               // `****` nie je zvýraznenie
      rest = rest.slice(0, start) + rest.slice(end + 2)
      continue
    }

    if (start > 0) segments.push({ druh: "text", text: rest.slice(0, start) })
    segments.push({ druh: "tucne", text: inner })
    rest = rest.slice(end + 2)
  }

  if (rest) segments.push({ druh: "text", text: rest })
  return segments.length ? segments : [{ druh: "text", text: "" }]
}

/**
 * Rozloží celú odpoveď na odseky a zoznamy.
 *
 * Prázdny riadok oddeľuje odseky. Riadky vo vnútri odseku sa spájajú
 * medzerou — model zalamuje podľa svojho, nie podľa šírky okna.
 */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.split("\n")

  let paragraph: string[] = []
  let list: { items: string[]; numbered: boolean } | null = null

  const closeParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ druh: "odsek", segments: splitInline(paragraph.join(" ")) })
    paragraph = []
  }
  const closeList = () => {
    if (!list) return
    blocks.push({
      druh: "zoznam",
      items: list.items.map(splitInline),
      numbered: list.numbered,
    })
    list = null
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      closeParagraph()
      closeList()
      continue
    }

    const heading = HEADING.exec(trimmed)
    if (heading) {
      closeParagraph()
      closeList()
      blocks.push({
        druh: "nadpis",
        level: heading[1].length,
        segments: splitInline(heading[2]),
      })
      continue
    }

    const subheading = SUBHEADING.exec(trimmed)
    if (subheading) {
      closeParagraph()
      closeList()
      // Tučný riadok je významovo to isté, čo `###` — zjednotíme, aby sa
      // v jednej odpovedi nestriedali dva rôzne vzhľady toho istého.
      // Koncová dvojbodka patrí k vete pod nadpisom, nie k nadpisu; model
      // ju píše dnu aj von z hviezdičiek, takže sa orezáva tu.
      blocks.push({
        druh: "nadpis", level: 3,
        segments: [{ druh: "text", text: subheading[1].replace(/[:：]\s*$/, "") }],
      })
      continue
    }

    const bullet = BULLET.exec(line)
    const number = NUMBERED.exec(line)

    if (bullet || number) {
      closeParagraph()
      const numbered = Boolean(number)
      const content = (bullet?.[1] ?? number?.[2] ?? "").trim()
      // Zmena typu zoznamu uprostred = nový zoznam.
      if (list && list.numbered !== numbered) closeList()
      if (!list) list = { items: [], numbered: numbered }
      list.items.push(content)
      continue
    }

    // Pokračovanie odrážky (odsadený riadok pod ňou).
    if (list && /^\s{2,}/.test(line)) {
      list.items[list.items.length - 1] += " " + trimmed
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  closeParagraph()
  closeList()
  return blocks
}

/**
 * Očistí doslovnú citáciu na zobrazenie.
 *
 * Dve veci: chunker vkladá do textu navigačný breadcrumb (D17), takže model
 * ho niekedy odcituje spolu s normou — a citovaný úsek býva ukončený
 * zalomením, po ktorom v úvodzovkách zostane medzera.
 *
 * Breadcrumb sa iba skryje pri zobrazení. Neodstraňujeme ho zo zdroja:
 * v kontexte modelu má zmysel, lebo hovorí, z ktorej časti predpisu úryvok
 * pochádza.
 */
export function cleanCitation(text: string): string {
  let t = text.trim()

  // Breadcrumb má tvar „Dokument › Časť › Článok — " a stojí na začiatku.
  const arrow = t.lastIndexOf("›")
  if (arrow !== -1 && arrow < 250) {
    const rest = t.slice(arrow + 1).trim()
    // Za poslednou šípkou býva ešte označenie článku a jeho názov; odrežeme
    // až po prvý znak, ktorý začína samotné znenie — číslovaný odsek.
    const paragraph = /\(\d+\)|\d+\.\s/.exec(rest)
    t = paragraph ? rest.slice(paragraph.index).trim() : rest
  }

  return t.replace(/\s+$/, "")
}

/**
 * Zlúči citácie, ktoré ukazujú na to isté miesto.
 *
 * Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera —
 * pri dlhej odpovedi ich tak vznikne devätnásť, z toho polovica doslovne
 * rovnakých. Pre hodnotiteľa je to šum: musí ich prechádzať očami a hľadať,
 * ktoré sú naozaj rôzne.
 *
 * Zlučujeme podľa očisteného textu, nie podľa `chunkIndex` — ten istý chunk
 * môže byť odcitovaný v rôznych rozsahoch a to sú rôzne citácie.
 */
export function mergeCitations<T extends { citedText: string }>(citations: T[]): T[] {
  const key = (t: string) => cleanCitation(t).replace(/\s+/g, " ").toLowerCase()

  const remaining: { k: string; c: T }[] = []
  for (const c of citations) {
    const k = key(c.citedText)
    if (!k) continue

    // Model tú istú pasáž niekedy odcituje kratšie a inde dlhšie — vtedy je
    // to jedno miesto, nie dve. Ponechá sa dlhšie znenie, lebo obsahuje aj
    // to kratšie; opačne by hodnotiteľ prišiel o časť kontextu.
    const overlap = remaining.findIndex(z => z.k.startsWith(k) || k.startsWith(z.k))
    if (overlap === -1) {
      remaining.push({ k, c })
    } else if (k.length > remaining[overlap].k.length) {
      // Dlhšie znenie nahradí kratšie, ale na PÔVODNOM mieste — poradie
      // citácií má zodpovedať poradiu tvrdení v odpovedi.
      remaining[overlap] = { k, c }
    }
  }
  return remaining.map(z => z.c)
}
