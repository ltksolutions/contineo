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
  | { druh: "odkaz"; text: string; href: string }

export type Block =
  | { druh: "odsek"; segments: Segment[] }
  | { druh: "nadpis"; segments: Segment[]; level: number }
  | { druh: "zoznam"; items: Segment[][]; numbered: boolean }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/

/**
 * Odsek normy — `(1)`, `(2)`, `(3)` na začiatku riadku.
 *
 * **Prečo vlastné pravidlo.** Ten istý rozklad vykresľuje aj text predpisu
 * (obrazovky potvrdenia, schvaľovania a detailu dokumentu). V norme stoja
 * odseky na susedných riadkoch **bez prázdneho riadku medzi nimi** — a bez
 * tohto pravidla by sa zliali do jedného odstavca, lebo riadky v odseku sa
 * spájajú medzerou. Pri právnom texte je to neprijateľné: „(1)" a „(2)" sú
 * dve samostatné povinnosti, nie jedna veta.
 *
 * Číslo **zostáva v texte**, nerobí sa z neho číslovaný zoznam. Odsek `(4a)`
 * aj preskočené číslovanie po novele sú v normách bežné a `<ol>` by ich
 * prečíslovalo — citácia by potom ukazovala na iný odsek, než na aký sa
 * odvoláva človek.
 */
const NORM_PARAGRAPH = /^\(\d+[a-z]?\)\s/

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
 * Odkaz v tvare `[text](/cesta)`.
 *
 * **Len vnútorné cesty.** Vzor vyžaduje `/` hneď na začiatku a druhý `/`
 * zakazuje (`(?!\/)`) — bez toho by prešlo `//cudzi.web`, čo prehliadač číta
 * ako adresu s dedeným protokolom, teda ako cestu von. Prvá verzia vzoru to
 * pustila a odhalil to až test;
 * takže `https://…`, `javascript:` ani `//cudzi.web` sem neprejdú. Nie je to
 * opatrnosť navyše: tým istým rozoberaním prechádza **výstup jazykového modelu
 * nad cudzími dokumentmi** (`Answer.tsx`). Keby vzor pustil ľubovoľnú adresu,
 * model by vedel vyrobiť klikací odkaz kamkoľvek a človek by ho videl
 * v rozhraní zväzu ako jeho vlastný.
 *
 * Kto raz bude chcieť odkazovať von, nech to spraví samostatným druhom
 * segmentu s viditeľným označením, nie rozšírením tohto vzoru.
 */
const LINK = /\[([^\]\n]+)\]\((\/(?!\/)[^)\s]*)\)/

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
    // Odkaz sa hľadá pred zvýraznením: `[**takto**](/x)` má byť odkaz
    // s tučným textom, nie tučný text s hranatými zátvorkami okolo.
    const link = LINK.exec(rest)
    const start = rest.indexOf("**")

    if (link && (start === -1 || link.index < start)) {
      if (link.index > 0) segments.push({ druh: "text", text: rest.slice(0, link.index) })
      segments.push({ druh: "odkaz", text: link[1], href: link[2] })
      rest = rest.slice(link.index + link[0].length)
      continue
    }

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
  // Delenie na všetky tvary konca riadku, nielen `\n`. Uložené znenie
  // predpisu má `\r\n` (prišlo z Wordu a PDF) a osamotené `\r` na konci
  // riadku by vzory odrážok a číslovaných bodov **nerozpoznali**: `.` v nich
  // nezahŕňa znak konca riadku a `\r` ním je. Číslovaný zoznam sa tak zlial
  // do jedného odseku. Nadpisy fungovali, lebo tie sa hľadajú v orezanom
  // riadku — a práve preto to z kódu nebolo vidieť, len z obrazovky.
  const lines = text.split(/\r\n|\r|\n/)

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

    // Nový odsek normy uzavrie predchádzajúci, aj keď medzi nimi nie je
    // prázdny riadok. Text sa nemení — číslo zostáva jeho súčasťou.
    if (NORM_PARAGRAPH.test(trimmed)) {
      closeParagraph()
      closeList()
      paragraph.push(trimmed)
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
  return groupCitations(citations).unique
}

/**
 * `mergeCitations()` aj s tým, **ktorá pôvodná citácia skončila v ktorej
 * zlúčenej** — značka `[n]` v texte (ASK-odpoved-dva-stlpce) nesie číslo
 * zlúčenej citácie, nie poradie udalosti. `numberOf[i]` je číslo (od 1)
 * pre `citations[i]`, 0 pre citáciu bez textu.
 */
export function groupCitations<T extends { citedText: string }>(citations: T[]): { unique: T[]; numberOf: number[] } {
  const key = (t: string) => cleanCitation(t).replace(/\s+/g, " ").toLowerCase()

  const remaining: { k: string; c: T }[] = []
  const numberOf: number[] = []
  for (const c of citations) {
    const k = key(c.citedText)
    if (!k) {
      numberOf.push(0)
      continue
    }

    // Model tú istú pasáž niekedy odcituje kratšie a inde dlhšie — vtedy je
    // to jedno miesto, nie dve. Ponechá sa dlhšie znenie, lebo obsahuje aj
    // to kratšie; opačne by hodnotiteľ prišiel o časť kontextu.
    const overlap = remaining.findIndex(z => z.k.startsWith(k) || k.startsWith(z.k))
    if (overlap === -1) {
      remaining.push({ k, c })
      numberOf.push(remaining.length)
    } else {
      if (k.length > remaining[overlap].k.length) {
        // Dlhšie znenie nahradí kratšie, ale na PÔVODNOM mieste — poradie
        // citácií má zodpovedať poradiu tvrdení v odpovedi.
        remaining[overlap] = { k, c }
      }
      numberOf.push(overlap + 1)
    }
  }
  return { unique: remaining.map(z => z.c), numberOf }
}

/* ── Značky citácií v texte (ASK-odpoved-dva-stlpce, Q1) ───────────────── */

/**
 * Zarážky vložené do textu pred rozkladom na bloky: začiatok citovanej vety
 * a značka na jej konci. Znaky zo súkromnej oblasti Unicode — v texte modelu
 * sa neobjavia a `toBlocks()` ich nechá tak, ako sú; `FormattedText` z nich
 * vykreslí `<button class="cite">` a zvýraznenie vety.
 */
export const CITE_START = "\uE002"
export const CITE_MARK = "\uE000"
export const CITE_CLOSE = "\uE001"
export const CITE_TOKEN = /\uE002([\d,]+)\uE001|\uE000([\d,]+)\uE001/g

/**
 * Koniec vety: `.`, `!` alebo `?` (za nimi smú byť úvodzovky, zátvorka
 * a `**`), potom medzera a veľké písmeno, úvodzovka, zátvorka — alebo koniec
 * riadku či textu. Veľké písmeno za medzerou je podmienka kvôli skratkám:
 * „čl. 18 ods. 2", „napr. v" koniec vety nie sú, a v predpisoch sú všade.
 */
const SENTENCE_END = /[.!?]["“”»)*]*(?=[ \t]+["„“(]?[\p{Lu}]|[ \t]*(?:\n|$))/gu

function sentenceEnds(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(SENTENCE_END)) out.push(m.index! + m[0].length)
  // Koniec riadku bez bodky (položka zoznamu, nadpis) je tiež koniec.
  for (const m of text.matchAll(/\n/g)) out.push(m.index!)
  return [...new Set(out)].sort((a, b) => a - b)
}

/**
 * Kam patrí značka citácie, ktorá prišla pri dĺžke textu `at`.
 *
 * Citácia prichádza zo streamu tesne pri vete, o ktorú sa opiera — raz
 * pred jej textom, raz hneď za ním. Keď text pred `at` končí vetou, patrí
 * značka tam; inak na najbližší koniec vety za `at`. Keď veta ešte nie je
 * dopísaná, stojí značka na konci textu.
 */
export function citationEnd(text: string, at: number): number {
  const pos = Math.max(0, Math.min(at, text.length))
  const ends = sentenceEnds(text)
  let back = pos
  while (back > 0 && /[ \t]/.test(text[back - 1])) back--
  if (ends.includes(back) && back > 0) return back
  return ends.find(e => e >= pos && e > 0) ?? text.length
}

/**
 * Začiatok vety, ktorá končí na `end` — za predošlým koncom vety alebo
 * riadku. Preskočí odrážku, číslo položky, `#` nadpisu a `**` na začiatku
 * riadku, aby zarážka nerozbila rozklad na bloky.
 */
export function sentenceStart(text: string, end: number): number {
  const ends = sentenceEnds(text).filter(e => e < end)
  let start = ends.length ? ends[ends.length - 1] : 0
  if (text[start] === "\n") start++
  while (start < end && /[ \t]/.test(text[start])) start++
  const lineStart = start === 0 || text[start - 1] === "\n"
  if (lineStart) {
    const prefix = /^(?:#{1,4}\s+|[-*•]\s+|\d+[.)]\s+|\(\d+[a-z]?\)\s)?(?:\*\*)?/.exec(text.slice(start, end))
    if (prefix) start += prefix[0].length
  }
  return Math.min(start, end)
}

/**
 * Vloží do textu zarážky citácií — začiatok vety a značku s číslami na jej
 * konci. Citácie bez `at` (uložená odpoveď) značku nedostanú. Viac citácií
 * pri tej istej vete má jednu skupinu značiek.
 */
export function markCitations<T extends { citedText: string; at?: number }>(text: string, citations: T[]): string {
  const { numberOf } = groupCitations(citations)
  const byEnd = new Map<number, Set<number>>()
  citations.forEach((c, i) => {
    if (typeof c.at !== "number" || !numberOf[i]) return
    const end = citationEnd(text, c.at)
    if (!byEnd.has(end)) byEnd.set(end, new Set())
    byEnd.get(end)!.add(numberOf[i])
  })
  if (byEnd.size === 0) return text

  const inserts: { pos: number; token: string }[] = []
  for (const [end, set] of byEnd) {
    const nums = [...set].sort((a, b) => a - b).join(",")
    inserts.push({ pos: sentenceStart(text, end), token: `${CITE_START}${nums}${CITE_CLOSE}` })
    inserts.push({ pos: end, token: `${CITE_MARK}${nums}${CITE_CLOSE}` })
  }
  // Odzadu, aby vložené zarážky neposunuli pozície tých pred nimi. Pri
  // rovnakej pozícii ide značka konca pred začiatok ďalšej vety.
  inserts.sort((a, b) => b.pos - a.pos || (a.token.startsWith(CITE_START) ? -1 : 1))
  let out = text
  for (const { pos, token } of inserts) out = out.slice(0, pos) + token + out.slice(pos)
  return out
}
