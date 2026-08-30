/**
 * chunker.mjs — štruktúrne chunkovanie slovenských noriem (rozhodnutie D1).
 *
 * Vstup: Markdown z markitdown (v praxi čistý text — markitdown z týchto PDF
 * nadpisy nevyrába, takže štruktúru musíme rozpoznať zo vzorov).
 *
 * Štruktúra predpisov SFZ:
 *     PRVÁ ČASŤ - Všeobecné ustanovenia         ← časť
 *     Článok 1 - Základné ustanovenia           ← článok (aj s pomlčkou –)
 *     (1) Text odseku…                          ← odsek
 *     a) písmeno…                               ← písmeno
 *
 * Chunkuje sa po článkoch. Dlhý článok sa rozdelí po odsekoch, aby sa zmestil
 * do cieľového rozsahu. Každý chunk nesie breadcrumb (dokument → časť → článok),
 * lebo bez neho embedding stráca kontext — „(3) Profesionál je hráč, ktorý…“
 * sama o sebe nepovie, z ktorého predpisu pochádza.
 */

// ── Vzory ────────────────────────────────────────────────────────────────────

const PART = /^(PRVÁ|DRUHÁ|TRETIA|ŠTVRTÁ|PIATA|ŠIESTA|SIEDMA|ÔSMA|DEVIATA|DESIATA|JEDENÁSTA|DVANÁSTA)\s+ČASŤ\s*[-–—]?\s*(.*)$/
// Pozor na pomlčky: dokumenty miešajú "-" (U+002D) a "–" (U+2013).
const ARTICLE = /^Článok\s+(\d+[a-z]?)\s*[-–—]\s*(.+)$/
// Druhý zápis, ktorý sa v normách SFZ vyskytuje častejšie: číslo článku
// stojí samo na riadku a názov je až na nasledujúcom.
//
//     Článok 1
//     Základné ustanovenia
//
// Bez tohto vzoru sa celý dokument zlial do jedného bloku „Úvodné
// ustanovenia“ a vyhľadávanie nemalo čoho chytiť. Osem z deviatich
// vzorových dokumentov používa práve tento tvar.
const ARTICLE_ALONE = /^Článok\s+(\d+[a-z]?)\s*$/
// Prílohy stoja MIMO číslovania článkov — vzory zmlúv, tabuľky poplatkov.
// Bez tohto vzoru by spadli pod posledný článok a citácia by klamala.
const ANNEX = /^PR[ÍI]LOHA\s+č\.\s*(\d+[a-z]?)\s*[-–—]?\s*(.*)$/i
// Písmená v odsekoch — záchytný bod na delenie dlhých výpočtov (napr. definície).
const LETTER = /^[a-záäčďéíĺľňóôŕšťúýž]\)\s/

// ── Profil členenia (D58) ────────────────────────────────────────────────────
//
// Vzory vyššie sú predvolené a odladené na normách SFZ. Iná organizácia môže
// mať predpisy členené na `§` alebo na `Bod`, a bez toho by sa jej dokument
// zlial do jedného bloku.
//
// **Konfiguruje sa slovom, nie regulárnym výrazom.** Vzor od zákazníka je
// jednak vec, ktorú nikto neodladí, jednak spôsob, ako jedným zápisom zavesiť
// spracovanie celého dokumentu. Slovo sa escapuje a vzor okolo neho zostáva
// náš.

/** Predvolený profil — presne to správanie, aké mal chunker predtým. */
export const DEFAULT_PROFILE = {
  slovoClanok: "Článok",
  slovoPriloha: "PRÍLOHA č.",
  /** Riadok opakovaný viac ráz je takmer isto hlavička alebo päta. */
  opakovaniHlavicky: 5,
  cielMinTokenov: 300,
  cielMaxTokenov: 800,
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Zostaví vzory pre daný profil.
 *
 * Volá sa raz na začiatku `chunkuj()`; funkcie si ich potom podávajú ďalej.
 * Modulová premenná to zámerne nie je — tá by pri dvoch tenantoch s rôznym
 * profilom znamenala, že výsledok závisí od poradia volaní.
 */
export function patternsForProfile(profile = {}) {
  const p = { ...DEFAULT_PROFILE, ...profile }
  const article = escapeRegex(p.slovoClanok)
  const annex = escapeRegex(p.slovoPriloha)

  // Pri predvolenom slove sa berú **pôvodné konštanty**, nie znovu zostavený
  // vzor. Nie je to opatrnosť navyše: pôvodná PRÍLOHA má `[ÍI]`, takže chytí
  // aj zápis bez dĺžňa, a zostavený vzor by o to potichu prišiel. Predvolený
  // profil musí dať presne to členenie, aké dával doteraz.
  const customArticle = p.slovoClanok !== DEFAULT_PROFILE.slovoClanok
  const customAnnex = p.slovoPriloha !== DEFAULT_PROFILE.slovoPriloha

  return {
    profil: p,
    CLANOK: customArticle
      ? new RegExp(`^${article}\\s+(\\d+[a-z]?)\\s*[-–—]\\s*(.+)$`)
      : ARTICLE,
    CLANOK_SAM: customArticle
      ? new RegExp(`^${article}\\s+(\\d+[a-z]?)\\s*$`)
      : ARTICLE_ALONE,
    PRILOHA: customAnnex
      ? new RegExp(`^${annex}\\s*(\\d+[a-z]?)\\s*[-–—]?\\s*(.*)$`, "i")
      : ANNEX,
    CAST: PART,
    ODSEK: PARAGRAPH,
    TABULKA_START: TABLE_START,
    opakovaniHlavicky: p.opakovaniHlavicky,
    cielMin: Math.round(p.cielMinTokenov * CHARS_PER_TOKEN),
    cielMax: Math.round(p.cielMaxTokenov * CHARS_PER_TOKEN),
  }
}

// Tabuľky. Otvára ich buď popis („Tabuľka č. 2 – Odstupné…“), alebo riadok
// markdownovej tabuľky. Zatvára ich až štruktúrny prvok — článok, časť,
// príloha alebo nový odsek.
//
// PRAVIDLO: tabuľka sa NIKDY nedelí medzi chunky. Dôvod je vecný — hlavičky
// prídu z PDF rozpadnuté na samostatné riadky („do 1. do 2. do 3.…“ a
// „ligy ligy ligy…“), takže polovica tabuľky bez hlavičky sú len čísla
// bez významu. Otázka „koľko je odstupné z 5. ligy do 3. ligy?“ by na nej
// zlyhala. Radšej väčší chunk než nezmyselný. (D17 v OPEN_DECISIONS.md)
const TABLE_START = /^(Tabuľka\s+č\.\s*\d+|\|)/i
const PARAGRAPH = /^\((\d+)\)\s*(.*)$/
// Poznámka pod čiarou: "4a) Smernica…" — číslo BEZ otváracej zátvorky.
// Odlišuje sa tým od odseku "(4)" aj od písmena "a)".
const FOOTNOTE = /^\d+[a-z]?\)\s+\S/
const PAGE_NUMBER = /^\d+\s*\/\s*\d+$/
/**
 * Číslovanie strán. PDF ho vypľuje v dvoch tvaroch a treba pokryť oba:
 *
 *   celé na jednom riadku          rozpadnuté na viac riadkov
 *   ─────────────────────          ──────────────────────────
 *     Strana 2 z 49                  Strana 1
 *                                    (prázdny)
 *                                     z 16
 *
 * Prvý tvar tu spočiatku chýbal — vzor vyžadoval, aby riadok končil číslom,
 * takže „Strana 2 z 49" prešlo do textu chunku. Prejavilo sa to až v UI:
 * model úryvok odcitoval aj s číslovaním a citácia začínala slovami
 * „Strana 17 z 49 (6) V majstrovskej súťaži…". Text bol pritom správny —
 * čo je presne ten druh chyby, ktorý poškodí dôveru viac než zjavný pád.
 */
const PAGE = /^(Strana|Page)\s+\d+(\s+(z|of)\s+\d+)?$/i
const PAGE_OF = /^(z|of)\s+\d+$/i

// Cieľová veľkosť chunku. D1 hovorí 300–800 tokenov; v slovenčine vychádza
// zhruba 3,5 znaku na token, takže počítame v znakoch a je to len odhad.
const CHARS_PER_TOKEN = 3.5
export const TARGET_MIN = Math.round(300 * CHARS_PER_TOKEN)   // ~1050 znakov
export const TARGET_MAX = Math.round(800 * CHARS_PER_TOKEN)   // ~2800 znakov

export const estimateTokens = (s) => Math.round(s.length / CHARS_PER_TOKEN)

// ── Čistenie ─────────────────────────────────────────────────────────────────

/**
 * Odstráni to, čo sa opakuje na každej strane — hlavičku, pätu, číslo strany.
 * Bez toho by sa do chunkov dostal šum, ktorý skresľuje embedding aj fulltext.
 *
 * Vracia { riadky, odstranene } — počty sa vypisujú v náhľade, aby bolo vidieť,
 * či čistenie nezožralo aj obsah.
 */
/**
 * Odstráni neviditeľné znaky a orežе riadok.
 *
 * PDF ich do textu zanáša celkom bežne — najmä U+200B (zero-width space)
 * a U+FEFF (BOM). Riadok, ktorý obsahuje len takýto znak, vyzerá prázdny,
 * ale `!r` ho neodhalí. V Rokovacom poriadku sa vďaka tomu takýto riadok
 * stal „názvom" článku 3 a v citácii svietil prázdny nadpis.
 *
 * Nezlomiteľnú medzeru (U+00A0) meníme na obyčajnú — vnútri vety je
 * v poriadku, ale sama osebe riadok tiež nenapĺňa.
 */
function normalizeLine(line) {
  return line
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")   // zero-width a spol.
    .replace(/\u00A0/g, " ")                        // nezlomiteľná medzera
    .trim()
}

export function clean(text, { nazovDokumentu, vzory } = {}) {
  const v = vzory ?? patternsForProfile()
  const allLines = text.split(/\r?\n/)
  const removed = { hlavicka: 0, cisloStrany: 0, poznamka: 0, prazdne: 0 }

  // Riadky, ktoré sa opakujú viac než 5×, sú takmer isto hlavička alebo päta.
  const counts = new Map()
  for (const r of allLines) {
    const k = normalizeLine(r)
    if (k.length > 10) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const repeated = new Set(
    [...counts].filter(([, n]) => n > v.opakovaniHlavicky).map(([k]) => k),
  )
  if (nazovDokumentu) repeated.add(nazovDokumentu.trim())

  const lines = []
  let inFootnote = false

  for (const raw of allLines) {
    const r = normalizeLine(raw)

    if (!r) { removed.prazdne++; inFootnote = false; continue }
    if (PAGE_NUMBER.test(r) || PAGE.test(r) || PAGE_OF.test(r)) {
      removed.cisloStrany++; inFootnote = false; continue
    }
    if (repeated.has(r)) { removed.hlavicka++; inFootnote = false; continue }

    // Poznámky pod čiarou — začínajú číslom bez zátvorky a často pokračujú
    // na ďalšom riadku. Vypadnú, kým nenarazíme na štruktúrny prvok.
    if (FOOTNOTE.test(r)) { inFootnote = true; removed.poznamka++; continue }
    if (inFootnote) {
      if (v.CLANOK.test(r) || v.CLANOK_SAM.test(r) || v.CAST.test(r) || v.ODSEK.test(r)) {
        inFootnote = false
      } else {
        removed.poznamka++
        continue
      }
    }

    lines.push(r)
  }
  return { riadky: lines, odstranene: removed }
}

// ── Parsovanie štruktúry ─────────────────────────────────────────────────────

/**
 * Z očistených riadkov poskladá zoznam článkov aj s odsekmi.
 * Text pred prvým článkom (preambula) sa zachová ako pseudo-článok bez čísla.
 */
export function parseStructure(lines, vzory) {
  const v = vzory ?? patternsForProfile()
  const articles = []
  let part = null
  let currentArticle = null
  let inAnnexes = false

  const startArticle = (number, heading, kind = "clanok") => {
    currentArticle = { cislo: number, nadpis: heading, cast: kind === "priloha" ? null : part, typ: kind, odseky: [] }
    articles.push(currentArticle)
  }
  let inTable = false

  const pushLine = (r) => {
    if (!currentArticle) startArticle(null, "Úvodné ustanovenia", "preambula")
    if (TABLE_START.test(r)) inTable = true
    const last = currentArticle.odseky[currentArticle.odseky.length - 1]
    if (last) {
      last.riadky.push(r)
      if (inTable) last.maTabulku = true
    } else {
      currentArticle.odseky.push({ cislo: null, riadky: [r], maTabulku: inTable })
    }
  }

  /**
   * Nájde názov, ktorý stojí na samostatnom riadku pod nadpisom.
   * Vráti { nadpis, dalsiIndex } alebo null, ak tam žiadny názov nie je.
   *
   * Prísne podmienky sú zámerné — radšej žiadny názov než nesprávny:
   * riadok nesmie byť iný štruktúrny prvok, nesmie byť dlhý ako veta
   * a nesmie končiť bodkou (to už je text, nie nadpis).
   */
  const nameUnderHeading = (i) => {
    for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
      const d = lines[j]
      if (!d) continue
      if (v.CLANOK.test(d) || v.CLANOK_SAM.test(d) || v.CAST.test(d) ||
          v.PRILOHA.test(d) || v.ODSEK.test(d) || v.TABULKA_START.test(d)) return null
      if (d.length > 120 || /[.:;]$/.test(d)) return null
      // Poistka: prázdny alebo neviditeľný text nie je názov článku.
      const tidy = normalizeLine(d)
      if (!tidy) continue
      return { nadpis: tidy, dalsiIndex: j }
    }
    return null
  }

  for (let i = 0; i < lines.length; i++) {
    const r = lines[i]
    const mAnnex = v.PRILOHA.exec(r)
    if (mAnnex) {
      inTable = false
      inAnnexes = true
      let annexName = (mAnnex[2] || "").trim()
      if (!annexName) {
        const n = nameUnderHeading(i)
        if (n) { annexName = n.nadpis; i = n.dalsiIndex }
      }
      startArticle(mAnnex[1], annexName || "Príloha", "priloha")
      continue
    }

    const mPart = v.CAST.exec(r)
    if (mPart && !inAnnexes) { inTable = false; part = r; continue }

    const mArticle = v.CLANOK.exec(r)
    if (mArticle && !inAnnexes) { inTable = false; startArticle(mArticle[1], mArticle[2].trim()); continue }

    // „Článok N“ samostatne — názov hľadáme na nasledujúcom riadku.
    const mArticleAlone = v.CLANOK_SAM.exec(r)
    if (mArticleAlone && !inAnnexes) {
      inTable = false
      const n = nameUnderHeading(i)
      startArticle(mArticleAlone[1], n ? n.nadpis : `Článok ${mArticleAlone[1]}`)
      if (n) i = n.dalsiIndex
      continue
    }

    const mParagraph = PARAGRAPH.exec(r)
    if (mParagraph) {
      if (!currentArticle) startArticle(null, "Úvodné ustanovenia", "preambula")
      // Nový odsek tabuľku zatvára — ale môže ju hneď aj otvoriť,
      // ak sa začína popisom typu „(2) Tabuľka č. 1 – Odstupné“.
      inTable = !!mParagraph[2] && TABLE_START.test(mParagraph[2])
      currentArticle.odseky.push({
        cislo: mParagraph[1],
        riadky: mParagraph[2] ? [mParagraph[2]] : [],
        maTabulku: inTable,
      })
      continue
    }

    pushLine(r)
  }
  return articles
}

// ── Skladanie chunkov ────────────────────────────────────────────────────────

const paragraphText = (o) => (o.cislo ? `(${o.cislo}) ` : "") + o.riadky.join(" ")

/** Referencia na citáciu — príloha sa cituje inak než článok. */
function unitRef(j) {
  if (j.typ === "priloha") return j.cislo ? `príloha č. ${j.cislo}` : "príloha"
  return j.cislo ? `čl. ${j.cislo}` : null
}

/**
 * Breadcrumb ide do textu chunku, nielen do metadát — embedding vidí iba text,
 * takže bez neho by chunk stratil doménový kontext.
 */
function breadcrumb(nazovDokumentu, j) {
  const parts = [nazovDokumentu]
  if (j.cast) parts.push(j.cast)
  if (j.typ === "priloha") parts.push(`Príloha č. ${j.cislo} - ${j.nadpis}`)
  else parts.push(j.cislo ? `Článok ${j.cislo} - ${j.nadpis}` : j.nadpis)
  return parts.filter(Boolean).join(" › ")
}

/**
 * Rozdelí zoznam riadkov na skupiny. Prednostne láme na písmenách a), b), c) —
 * to sú prirodzené hranice vo výpočtoch a definíciách. Ak sa písmeno dlho
 * nevyskytne, zlomí núdzovo, aby chunk nenarástol donekonečna.
 */
function splitLines(lines, maxChars) {
  const groups = []
  let currentGroup = [], length = 0
  for (const r of lines) {
    const exceeds = currentGroup.length && length + r.length > maxChars
    if (exceeds && (LETTER.test(r) || length > maxChars * 1.5)) {
      groups.push(currentGroup); currentGroup = []; length = 0
    }
    currentGroup.push(r); length += r.length + 1
  }
  if (currentGroup.length) groups.push(currentGroup)
  return groups
}

/**
 * Rozdelí jednotku (článok alebo prílohu) na chunky.
 * Krátka jednotka = jeden chunk; to je v poriadku, úplný krátky článok je
 * lepší chunk než umelo zlepený s cudzím obsahom.
 */
function chunkUnit(j, meta) {
  const v = meta.vzory ?? patternsForProfile()
  const bc = breadcrumb(meta.nazovDokumentu, j)
  const header = `${bc}\n\n`
  const ref = unitRef(j)
  const space = v.cielMax - header.length

  const nonEmpty = j.odseky.filter(o => paragraphText(o).trim())
  if (!nonEmpty.length) return []

  const whole = nonEmpty.map(paragraphText).join("\n")
  const complete = nonEmpty.length === 1 || (header.length + whole.length <= v.cielMax)

  // Zmestí sa celá? Nedeľ — je to najlepší možný chunk.
  if (header.length + whole.length <= v.cielMax) {
    return [{ text: header + whole, heading: j.nadpis, articleRef: ref,
              cast: j.cast, typ: j.typ, uplnaJednotka: true,
              obsahujeTabulku: nonEmpty.some(o => o.maTabulku) }]
  }

  const chunks = []
  let batch = [], first = null, lastPart = null, length = 0

  const push = () => {
    if (!batch.length) return
    let r = ref
    if (ref && j.typ !== "priloha" && first) {
      r = lastPart && lastPart !== first ? `${ref} ods. ${first}–${lastPart}` : `${ref} ods. ${first}`
    }
    chunks.push({ text: header + batch.join("\n"), heading: j.nadpis,
                  articleRef: r, cast: j.cast, typ: j.typ, uplnaJednotka: false })
    batch = []; first = null; lastPart = null; length = 0
  }

  for (const o of nonEmpty) {
    const t = paragraphText(o)

    // Odsek s tabuľkou je nedeliteľný — radšej väčší chunk než tabuľka
    // bez hlavičky (D17). Uloží sa samostatne, nech nezhltne aj susedov.
    if (o.maTabulku) {
      push()
      chunks.push({
        text: header + t, heading: j.nadpis,
        articleRef: ref && o.cislo && j.typ !== "priloha" ? `${ref} ods. ${o.cislo}` : ref,
        cast: j.cast, typ: j.typ, uplnaJednotka: false, obsahujeTabulku: true,
      })
      continue
    }

    // Samotný odsek je dlhší než limit — rozlámeme ho na písmenách.
    if (t.length > space) {
      push()
      const prefix = o.cislo ? `(${o.cislo}) ` : ""
      for (const group of splitLines(o.riadky, space - prefix.length)) {
        chunks.push({
          text: header + prefix + group.join(" "),
          heading: j.nadpis,
          articleRef: ref && o.cislo && j.typ !== "priloha" ? `${ref} ods. ${o.cislo}` : ref,
          cast: j.cast, typ: j.typ, uplnaJednotka: false,
        })
      }
      continue
    }

    if (batch.length && length + t.length > space) push()
    if (!batch.length) first = o.cislo
    lastPart = o.cislo ?? lastPart
    batch.push(t); length += t.length + 1
  }
  push()
  return mergeTail(chunks, header.length)
}

/**
 * Zlúči osamelý chvost s predchádzajúcim chunkom.
 *
 * Pri delení dlhého článku často zvýši posledný odsek sám — napr. „čl. 8 ods. 24“
 * so 100 tokenmi. Taký úlomok je na vyhľadávanie slabý (málo kontextu) a zbytočne
 * drobí citácie. Ak sa zmestí k predchádzajúcemu, pripojíme ho a zlúčime referencie.
 */
function mergeTail(chunks, headerLength) {
  if (chunks.length < 2) return chunks
  const last = chunks[chunks.length - 1]
  const secondLast = chunks[chunks.length - 2]

  // Heuristika: zlučujeme len naozaj drobné chvosty a pripúšťame mierne
  // prekročenie limitu. Väčší chunk je menšie zlo než osamelý úlomok, ale
  // nafukovať ho tiež netreba. Prah doladiť podľa výsledkov D9.
  const tailIsSmall = estimateTokens(last.text) < 150
  const body = last.text.slice(headerLength)
  const fits = secondLast.text.length + body.length <= TARGET_MAX * 1.15

  if (!tailIsSmall || !fits) return chunks

  secondLast.text = secondLast.text + "\n" + body
  secondLast.articleRef = mergeRef(secondLast.articleRef, last.articleRef)
  return chunks.slice(0, -1)
}

/** Z „čl. 8 ods. 15–23“ + „čl. 8 ods. 24“ spraví „čl. 8 ods. 15–24“. */
function mergeRef(a, b) {
  if (!a || !b || a === b) return a ?? b
  const pattern = /^(.*?)\s+ods\.\s+(\d+[a-z]?)(?:[–-](\d+[a-z]?))?$/
  const ma = pattern.exec(a), mb = pattern.exec(b)
  if (!ma || !mb || ma[1] !== mb[1]) return a
  const od = ma[2]
  const toNo = mb[3] ?? mb[2]
  return `${ma[1]} ods. ${od}–${toNo}`
}

export function chunkText(text, meta = {}) {
  const v = patternsForProfile(meta.profil)
  const { riadky: lines, odstranene: removed } = clean(text, { ...meta, vzory: v })
  const articles = parseStructure(lines, v)

  const chunks = []
  for (const j of articles) {
    for (const ch of chunkUnit(j, { ...meta, vzory: v })) {
      chunks.push({ ...ch, chunkIndex: chunks.length })
    }
  }

  const lengths = chunks.map(c => estimateTokens(c.text))
  return {
    chunky: chunks,
    statistiky: {
      riadkovPoOcisteni: lines.length,
      odstranene: removed,
      clankov: articles.length,
      chunkov: chunks.length,
      tokenyMin: lengths.length ? Math.min(...lengths) : 0,
      tokenyMax: lengths.length ? Math.max(...lengths) : 0,
      tokenyPriemer: lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
      priloh: articles.filter(c => c.typ === "priloha").length,
      sTabulkou: chunks.filter(c => c.obsahujeTabulku).length,
      nadLimit: lengths.filter(d => d > 800).length,
      // Krátky ÚPLNY článok nie je problém — je to prirodzená sémantická
      // jednotka. Problém je len krátky ÚLOMOK rozdeleného článku.
      kratkeUlomky: chunks.filter(c => !c.uplnaJednotka && estimateTokens(c.text) < 300).length,
      kratkeUplne: chunks.filter(c => c.uplnaJednotka && estimateTokens(c.text) < 300).length,
    },
  }
}
