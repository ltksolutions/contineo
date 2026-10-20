/**
 * slovLex.ts — čítanie predpisu zo Slov-Lexu a prevod na Markdown
 * (ADR-037, D241–D243).
 *
 * Hlavný portál www.slov-lex.sk je aplikácia v JavaScripte a bez neho vráti
 * len obal; nemá RSS ani API. Číta sa **statická verzia portálu**
 * static.slov-lex.sk, na ktorú hlavný portál sám odkazuje:
 *
 *   • história predpisu  `/static/SK/ZZ/<rok>/<číslo>/` — tabuľka znení
 *     s dátumom účinnosti od–do a číslom novely;
 *   • text znenia        `/static/SK/ZZ/<rok>/<číslo>/<YYYYMMDD>.html` —
 *     HTML so sémantickými triedami (`paragraf`, `odsek`, `pismeno`, `bod`,
 *     `priloha`, `poznamka`) a kotvami `#paragraf-58.odsek-1.pismeno-k`;
 *   • záväzné PDF        `/pdf/SK/ZZ/<rok>/<číslo>/ZZ_<rok>_<číslo>_<YYYYMMDD>.pdf`
 *     — stránka naň odkazuje cez `/static/pdf/…`, čo na statickom portáli
 *     vracia 404; skutočná cesta je bez `/static` (overené 20. 10. 2026).
 *
 * Čisté funkcie bez siete a databázy: sťahuje `webImport.ts`, test číta
 * ukážku `tests/fixtures/slov-lex-440-2015-20260101.html`. Vlastný malý
 * čítač HTML namiesto knižnice: značkovanie je generované a pravidelné
 * (vnorené `div` s triedou a `id`) a súbor má 1,4 MB — DOM celého
 * dokumentu netreba a závislosť navyše by nič nepridala.
 */

export const SLOV_LEX_ADAPTER = "slov-lex" as const
/** Verzia prevodu — vstupuje do pôvodu dokumentu; zvýši ju človek pri zmene výsledku. */
export const SLOV_LEX_ADAPTER_VERSION = "1"
export const SLOV_LEX_STATIC = "https://static.slov-lex.sk"
export const SLOV_LEX_PORTAL = "https://www.slov-lex.sk"

/** Predpis v Zbierke zákonov SR — identita je rok a číslo. */
export interface ActRef {
  year: number
  number: number
}

/**
 * Adresa alebo číslo predpisu → identita. Prijme adresu hlavného portálu
 * (`/pravne-predpisy/SK/ZZ/2015/440/`, aj s časovou verziou), statického
 * portálu (`/static/SK/ZZ/2015/440/20260101.html`), ELI (`/eli/zz/2015/440`),
 * identifikátor z pôvodu (`SK/ZZ/2015/440`) aj holé číslo „440/2015 Z. z.".
 */
export function parseActRef(input: string): ActRef | null {
  const s = input.trim()
  let m = /(?:^|\/)(?:SK\/ZZ|eli\/zz)\/(\d{4})\/(\d{1,4})(?:[/.?#]|$)/i.exec(s)
  if (m) return { year: Number(m[1]), number: Number(m[2]) }
  m = /^(\d{1,4})\s*\/\s*(\d{4})(?:\s*Z\.?\s*z\.?)?$/i.exec(s)
  if (m) return { year: Number(m[2]), number: Number(m[1]) }
  return null
}

/** Identifikátor predpisu v pôvode dokumentu (`source.externalId`). */
export const actId = (r: ActRef): string => `SK/ZZ/${r.year}/${r.number}`
/** Číslo predpisu, ako sa cituje: „440/2015 Z. z.". */
export const actNumber = (r: ActRef): string => `${r.number}/${r.year} Z. z.`
export const historyUrl = (r: ActRef): string => `${SLOV_LEX_STATIC}/static/SK/ZZ/${r.year}/${r.number}/`
export const versionUrl = (r: ActRef, timepoint: string): string => `${SLOV_LEX_STATIC}/static/SK/ZZ/${r.year}/${r.number}/${timepoint}.html`
export const pdfUrl = (r: ActRef, timepoint: string): string => `${SLOV_LEX_STATIC}/pdf/SK/ZZ/${r.year}/${r.number}/ZZ_${r.year}_${r.number}_${timepoint}.pdf`
/** Adresa pre človeka — hlavný portál, voliteľne konkrétne znenie. */
export const portalUrl = (r: ActRef, timepoint?: string): string =>
  `${SLOV_LEX_PORTAL}/pravne-predpisy/SK/ZZ/${r.year}/${r.number}/${timepoint ?? ""}`

/** Časová verzia `YYYYMMDD` → dátum (UTC polnoc, ako `effectiveFrom` z formulára). */
export function timepointDate(timepoint: string): Date {
  return new Date(`${timepoint.slice(0, 4)}-${timepoint.slice(4, 6)}-${timepoint.slice(6, 8)}`)
}
const dateKey = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, "")

/** Riadok histórie predpisu — jedno znenie. */
export interface HistoryRow {
  /** `YYYYMMDD` — časť adresy znenia. */
  timepoint: string
  /** `YYYY-MM-DD` */
  effectiveFrom: string
  /** `YYYY-MM-DD`; `null` pri znení, ktoré platí dodnes. */
  effectiveTo: string | null
  /** Novela, ktorou znenie vzniklo („354/2016 Z. z."); `null` pri pôvodnom. */
  amendment: string | null
}

const attr = (attrs: string, name: string): string | null => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? null

/**
 * Tabuľka histórie znení. „Vyhlásené znenie" bez účinnosti sa vynecháva —
 * nie je to znenie, ktoré by niekedy platilo. Zoradené od najstaršieho.
 */
export function parseHistory(html: string): HistoryRow[] {
  const out: HistoryRow[] = []
  for (const m of html.matchAll(/<tr class="effectivenessHistoryItem"([^>]*)>([\s\S]*?)<\/tr>/g)) {
    const from = attr(m[1], "data-ucinnostod")
    if (!from) continue
    const timepoint = attr(m[1], "data-iri")?.split("/").pop() ?? from.replace(/-/g, "")
    if (!/^\d{8}$/.test(timepoint)) continue
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => inlineText(c[1]))
    out.push({ timepoint, effectiveFrom: from, effectiveTo: attr(m[1], "data-ucinnostdo") || null, amendment: cells[2] || null })
  }
  return out.sort((a, b) => a.timepoint.localeCompare(b.timepoint))
}

/** Znenie účinné v daný deň — posledné, ktorého účinnosť už nastala. */
export function effectiveRow(rows: HistoryRow[], today: Date): HistoryRow | null {
  const key = dateKey(today)
  let found: HistoryRow | null = null
  for (const r of rows) if (r.timepoint <= key) found = r
  return found
}

/** Znenia po danej časovej verzii — aj tie, ktorých účinnosť ešte nenastala (D242). */
export function newerRows(rows: HistoryRow[], timepoint: string): HistoryRow[] {
  return rows.filter(r => r.timepoint > timepoint)
}

/** Biele znaky vrátane pevnej medzery na jednu medzeru. */
const collapse = (s: string): string => s.replace(/[\s\u00a0]+/g, " ").trim()

/** Text z kúska HTML bez značiek — pre bunky tabuľky histórie. */
function inlineText(html: string): string {
  return collapse(decodeEntities(html.replace(/<[^>]+>/g, " ")))
}

// ---------------------------------------------------------------------------
// Malý čítač HTML

interface El {
  tag: string
  attrs: Record<string, string>
  children: (El | string)[]
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"])

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0", ndash: "–", mdash: "—", sect: "§", hellip: "…",
  laquo: "«", raquo: "»", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", copy: "©", reg: "®", deg: "°", euro: "€",
}

export function decodeEntities(s: string): string {
  if (!s.includes("&")) return s
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** Koniec značky — `>` mimo úvodzoviek v atribútoch. */
function tagEnd(html: string, from: number): number {
  let quote: string | null = null
  for (let k = from + 1; k < html.length; k++) {
    const ch = html[k]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === "\"" || ch === "'") quote = ch
    else if (ch === ">") return k
  }
  return html.length - 1
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(/([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "")
  }
  return out
}

/**
 * HTML → strom prvkov. Zatvárajúca značka zatvorí najbližší otvorený prvok
 * toho mena; cudzia sa ignoruje, takže nevyvážený kus stránky prevod
 * nezhodí. Obsah `script` a `style` sa preskočí.
 */
export function parseHtml(html: string): El {
  const root: El = { tag: "#root", attrs: {}, children: [] }
  const stack: El[] = [root]
  const n = html.length
  const pushText = (t: string) => { if (t) stack[stack.length - 1].children.push(decodeEntities(t)) }
  let i = 0
  while (i < n) {
    const lt = html.indexOf("<", i)
    if (lt < 0) { pushText(html.slice(i)); break }
    if (lt > i) pushText(html.slice(i, lt))
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? n : e + 3; continue }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) { const e = html.indexOf(">", lt); i = e < 0 ? n : e + 1; continue }
    if (html.startsWith("</", lt)) {
      const e = html.indexOf(">", lt)
      const name = html.slice(lt + 2, e < 0 ? n : e).trim().toLowerCase()
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].tag === name) { stack.length = k; break }
      i = e < 0 ? n : e + 1
      continue
    }
    const end = tagEnd(html, lt)
    const raw = html.slice(lt + 1, end).trim()
    const selfClosing = raw.endsWith("/")
    const body = selfClosing ? raw.slice(0, -1) : raw
    const name = /^[a-zA-Z][\w:-]*/.exec(body)?.[0]
    if (!name) { pushText("<"); i = lt + 1; continue }
    const el: El = { tag: name.toLowerCase(), attrs: parseAttrs(body.slice(name.length)), children: [] }
    stack[stack.length - 1].children.push(el)
    i = end + 1
    if (el.tag === "script" || el.tag === "style") {
      const close = html.indexOf(`</${el.tag}`, i)
      i = close < 0 ? n : html.indexOf(">", close) + 1
      continue
    }
    if (!selfClosing && !VOID.has(el.tag)) stack.push(el)
  }
  return root
}

const classesOf = (e: El): string[] => (e.attrs.class ?? "").split(/\s+/).filter(Boolean)
const hasClass = (e: El, c: string): boolean => classesOf(e).includes(c)
const elements = (e: El): El[] => e.children.filter((c): c is El => typeof c !== "string")
const isGroup = (e: El): boolean => hasClass(e, "Skupina")
/** Druh skupiny — prvá trieda („paragraf", „odsek"). */
const groupKind = (e: El): string => classesOf(e)[0] ?? ""

function findById(e: El, id: string): El | null {
  for (const c of elements(e)) {
    if (c.attrs.id === id) return c
    const found = findById(c, id)
    if (found) return found
  }
  return null
}

function findClass(e: El, cls: string): El | null {
  for (const c of elements(e)) {
    if (hasClass(c, cls)) return c
    const found = findClass(c, cls)
    if (found) return found
  }
  return null
}

function findTag(e: El, tag: string, pred: (x: El) => boolean): El | null {
  for (const c of elements(e)) {
    if (c.tag === tag && pred(c)) return c
    const found = findTag(c, tag, pred)
    if (found) return found
  }
  return null
}

/** Text prvku s vnorenými riadkovými značkami; `br` je medzera, tabuľky a obrázky sa vynechajú. */
function inlineOf(e: El | string): string {
  if (typeof e === "string") return e
  if (e.tag === "br") return " "
  if (e.tag === "table" || e.tag === "img") return ""
  return e.children.map(inlineOf).join("")
}

const isBlock = (e: El): boolean => e.tag === "div" || e.tag === "table" || e.tag === "p" || e.tag === "ul" || e.tag === "ol"
const hasBlockChildren = (e: El): boolean => elements(e).some(isBlock)

// ---------------------------------------------------------------------------
// Prevod na Markdown

/** Druhy skupín, ktoré sú nadpisom nad paragrafmi; hĺbka určuje úroveň nadpisu. */
const STRUCTURAL = new Set(["clanok", "cast", "hlava", "oddiel", "diel", "skupinaParagrafov"])

class Writer {
  lines: string[] = []
  para(text: string) {
    const s = collapse(text)
    if (s) this.lines.push(s, "")
  }
  heading(level: number, text: string) {
    const s = collapse(text)
    if (s) this.lines.push(`${"#".repeat(Math.max(1, Math.min(level, 6)))} ${s}`, "")
  }
  table(rows: string[][]) {
    const width = Math.max(...rows.map(r => r.length), 0)
    if (!width) return
    const cell = (s: string) => collapse(s).replace(/\|/g, "\\|")
    const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? "")).join(" | ")} |`
    this.lines.push(line(rows[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`)
    for (const r of rows.slice(1)) this.lines.push(line(r))
    this.lines.push("")
  }
  text(): string {
    return this.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  }
}

function tableRows(table: El): string[][] {
  const rows: string[][] = []
  const walk = (e: El) => {
    for (const c of elements(e)) {
      if (c.tag === "tr") rows.push(elements(c).filter(x => x.tag === "td" || x.tag === "th").map(inlineOf))
      else walk(c)
    }
  }
  walk(table)
  return rows.filter(r => r.some(x => collapse(x)))
}

function childWithSuffix(e: El, suffix: string): El | null {
  return elements(e).find(c => classesOf(c).some(cls => cls.endsWith(suffix))) ?? null
}

/**
 * Skupina (`*.Skupina`) → Markdown. Štruktúra nad paragrafmi, paragraf
 * a príloha sú nadpisy; odsek, písmeno, bod a poznámka sú odseky
 * s označením na začiatku. Vnútri citátu (`citat` — text, ktorým novela
 * mení iný zákon) sa nadpisy nerobia, aby „§ 80ab" cudzieho zákona
 * nebol jednotkou rezu ani citáciou (ADR-035).
 */
function renderGroup(w: Writer, e: El, depth: number, quoted: boolean): void {
  const kind = groupKind(e)
  const label = childWithSuffix(e, "Oznacenie")
  const title = childWithSuffix(e, "Nadpis")
  const skip = new Set<El>([label, title].filter((x): x is El => Boolean(x)))
  const asHeading = !quoted && (STRUCTURAL.has(kind) || kind === "paragraf" || kind === "priloha")
  if (asHeading) {
    const parts = [label ? inlineOf(label) : "", title ? inlineOf(title) : ""].map(collapse).filter(Boolean)
    w.heading(2 + depth, parts.join(kind === "paragraf" ? " " : " — "))
    renderChildren(w, e, STRUCTURAL.has(kind) ? depth + 1 : depth, skip, quoted)
    return
  }
  const text = elements(e).find(c => hasClass(c, "text")) ?? null
  if (text) skip.add(text)
  const head = [label ? inlineOf(label) : "", title ? inlineOf(title) : "", text ? inlineOf(text) : ""].map(collapse).filter(Boolean)
  w.para(head.join(" "))
  renderChildren(w, e, depth, skip, quoted)
}

/** Deti prvku: skupiny, kontajnery (`text2`, `blokTextu`, `citat`), text a tabuľky. */
function renderChildren(w: Writer, e: El, depth: number, skip: Set<El>, quoted: boolean): void {
  let inline = ""
  const flush = () => { w.para(inline); inline = "" }
  for (const c of e.children) {
    if (typeof c === "string") { inline += c; continue }
    if (skip.has(c)) continue
    if (c.tag === "table") { flush(); w.table(tableRows(c)); continue }
    if (!isBlock(c)) { inline += inlineOf(c); continue }
    flush()
    const q = quoted || hasClass(c, "citat")
    if (isGroup(c)) renderGroup(w, c, depth, q)
    else if (hasBlockChildren(c)) renderChildren(w, c, depth, new Set(), q)
    else w.para(inlineOf(c))
  }
  flush()
}

/** Čo z HTML znenia vznikne. */
export interface ActVersion {
  /** „Zákon č. 440/2015 Z. z. o športe a o zmene a doplnení niektorých zákonov" */
  title: string
  /** „Zákon" — z označenia typu na portáli, pre kľúč dokumentu. */
  kind: string
  markdown: string
  /** `YYYY-MM-DD` z hlavičky znenia; `null`, keď chýba. */
  effectiveFrom: string | null
  /** Záväzné PDF znenia na statickom portáli. */
  pdfUrl: string
}

/** „ZÁKON" → „Zákon"; prázdne → „Predpis". */
function kindLabel(typ: string): string {
  const s = collapse(typ).toLowerCase()
  return s ? s[0].toUpperCase() + s.slice(1) : "Predpis"
}

/**
 * Stránka znenia → názov, Markdown a údaje o znení. Chýbajúci koreň
 * predpisu je chyba (`Error`), nie prázdny dokument — keď portál zmení
 * značkovanie, má to zlyhať nahlas.
 */
export function parseVersion(html: string, ref: ActRef, timepoint: string): ActVersion {
  const root = parseHtml(html)
  const predpis = findById(root, "predpis")
  if (!predpis) throw new Error("slov-lex: v stránke nie je blok predpisu (id=\"predpis\")")

  const direct = (cls: string) => elements(predpis).find(c => hasClass(c, cls)) ?? null
  const typ = direct("predpisTyp")
  const datum = direct("predpisDatum")
  const nadpis = direct("predpisNadpis")
  const oznacenie = direct("predpisOznacenie")
  const intro = direct("text")
  const kind = kindLabel(typ ? inlineOf(typ) : "")
  const title = collapse(`${kind} č. ${actNumber(ref)} ${nadpis ? inlineOf(nadpis) : ""}`)

  const w = new Writer()
  w.heading(1, title)
  w.para([typ, datum, nadpis].map(x => (x ? inlineOf(x) : "")).join(" "))
  if (intro) w.para(inlineOf(intro))
  renderChildren(w, predpis, 0, new Set([typ, datum, nadpis, oznacenie, intro].filter((x): x is El => Boolean(x))), false)

  const prilohy = findById(root, "prilohy")
  if (prilohy) renderChildren(w, prilohy, 0, new Set(), false)
  const poznamky = findById(root, "poznamky")
  if (poznamky) {
    w.heading(2, "Poznámky pod čiarou")
    renderChildren(w, poznamky, 1, new Set(), false)
  }

  const header = findClass(root, "ucinnost_header")
  const effectiveFrom = header?.attrs["data-from"] || null
  // Odkaz na PDF je v stránke cez `/static/pdf/…`; na statickom portáli
  // existuje len `/pdf/…` — preto sa predpona odstráni.
  const pdfLink = findTag(root, "a", a => /\/pdf\/.*\.pdf$/i.test(a.attrs.href ?? "") && !/\/pdf\/prilohy\//.test(a.attrs.href ?? ""))
  const pdfPath = pdfLink?.attrs.href?.replace(/^\/static(?=\/pdf\/)/, "")
  const pdf = pdfPath && pdfPath.startsWith("/") ? `${SLOV_LEX_STATIC}${pdfPath}` : pdfUrl(ref, timepoint)

  return { title, kind, markdown: w.text(), effectiveFrom, pdfUrl: pdf }
}
