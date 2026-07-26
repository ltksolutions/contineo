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

const CAST = /^(PRVÁ|DRUHÁ|TRETIA|ŠTVRTÁ|PIATA|ŠIESTA|SIEDMA|ÔSMA|DEVIATA|DESIATA|JEDENÁSTA|DVANÁSTA)\s+ČASŤ\s*[-–—]?\s*(.*)$/
// Pozor na pomlčky: dokumenty miešajú "-" (U+002D) a "–" (U+2013).
const CLANOK = /^Článok\s+(\d+[a-z]?)\s*[-–—]\s*(.+)$/
// Prílohy stoja MIMO číslovania článkov — vzory zmlúv, tabuľky poplatkov.
// Bez tohto vzoru by spadli pod posledný článok a citácia by klamala.
const PRILOHA = /^PR[ÍI]LOHA\s+č\.\s*(\d+[a-z]?)\s*[-–—]?\s*(.*)$/i
// Písmená v odsekoch — záchytný bod na delenie dlhých výpočtov (napr. definície).
const PISMENO = /^[a-záäčďéíĺľňóôŕšťúýž]\)\s/

// Tabuľky. Otvára ich buď popis („Tabuľka č. 2 – Odstupné…“), alebo riadok
// markdownovej tabuľky. Zatvára ich až štruktúrny prvok — článok, časť,
// príloha alebo nový odsek.
//
// PRAVIDLO: tabuľka sa NIKDY nedelí medzi chunky. Dôvod je vecný — hlavičky
// prídu z PDF rozpadnuté na samostatné riadky („do 1. do 2. do 3.…“ a
// „ligy ligy ligy…“), takže polovica tabuľky bez hlavičky sú len čísla
// bez významu. Otázka „koľko je odstupné z 5. ligy do 3. ligy?“ by na nej
// zlyhala. Radšej väčší chunk než nezmyselný. (D17 v OPEN_DECISIONS.md)
const TABULKA_START = /^(Tabuľka\s+č\.\s*\d+|\|)/i
const ODSEK = /^\((\d+)\)\s*(.*)$/
// Poznámka pod čiarou: "4a) Smernica…" — číslo BEZ otváracej zátvorky.
// Odlišuje sa tým od odseku "(4)" aj od písmena "a)".
const POZNAMKA = /^\d+[a-z]?\)\s+\S/
const CISLO_STRANY = /^\d+\s*\/\s*\d+$/

// Cieľová veľkosť chunku. D1 hovorí 300–800 tokenov; v slovenčine vychádza
// zhruba 3,5 znaku na token, takže počítame v znakoch a je to len odhad.
const ZNAKY_NA_TOKEN = 3.5
export const CIEL_MIN = Math.round(300 * ZNAKY_NA_TOKEN)   // ~1050 znakov
export const CIEL_MAX = Math.round(800 * ZNAKY_NA_TOKEN)   // ~2800 znakov

export const odhadTokenov = (s) => Math.round(s.length / ZNAKY_NA_TOKEN)

// ── Čistenie ─────────────────────────────────────────────────────────────────

/**
 * Odstráni to, čo sa opakuje na každej strane — hlavičku, pätu, číslo strany.
 * Bez toho by sa do chunkov dostal šum, ktorý skresľuje embedding aj fulltext.
 *
 * Vracia { riadky, odstranene } — počty sa vypisujú v náhľade, aby bolo vidieť,
 * či čistenie nezožralo aj obsah.
 */
export function ocisti(text, { nazovDokumentu } = {}) {
  const vsetky = text.split(/\r?\n/)
  const odstranene = { hlavicka: 0, cisloStrany: 0, poznamka: 0, prazdne: 0 }

  // Riadky, ktoré sa opakujú viac než 5×, sú takmer isto hlavička alebo päta.
  const pocty = new Map()
  for (const r of vsetky) {
    const k = r.trim()
    if (k.length > 10) pocty.set(k, (pocty.get(k) ?? 0) + 1)
  }
  const opakujuce = new Set([...pocty].filter(([, n]) => n > 5).map(([k]) => k))
  if (nazovDokumentu) opakujuce.add(nazovDokumentu.trim())

  const riadky = []
  let vPoznamke = false

  for (const raw of vsetky) {
    const r = raw.trim()

    if (!r) { odstranene.prazdne++; vPoznamke = false; continue }
    if (CISLO_STRANY.test(r)) { odstranene.cisloStrany++; vPoznamke = false; continue }
    if (opakujuce.has(r)) { odstranene.hlavicka++; vPoznamke = false; continue }

    // Poznámky pod čiarou — začínajú číslom bez zátvorky a často pokračujú
    // na ďalšom riadku. Vypadnú, kým nenarazíme na štruktúrny prvok.
    if (POZNAMKA.test(r)) { vPoznamke = true; odstranene.poznamka++; continue }
    if (vPoznamke) {
      if (CLANOK.test(r) || CAST.test(r) || ODSEK.test(r)) {
        vPoznamke = false
      } else {
        odstranene.poznamka++
        continue
      }
    }

    riadky.push(r)
  }
  return { riadky, odstranene }
}

// ── Parsovanie štruktúry ─────────────────────────────────────────────────────

/**
 * Z očistených riadkov poskladá zoznam článkov aj s odsekmi.
 * Text pred prvým článkom (preambula) sa zachová ako pseudo-článok bez čísla.
 */
export function parsujStrukturu(riadky) {
  const clanky = []
  let cast = null
  let aktualny = null
  let vPrilohach = false

  const zacniClanok = (cislo, nadpis, typ = "clanok") => {
    aktualny = { cislo, nadpis, cast: typ === "priloha" ? null : cast, typ, odseky: [] }
    clanky.push(aktualny)
  }
  let vTabulke = false

  const pridajRiadok = (r) => {
    if (!aktualny) zacniClanok(null, "Úvodné ustanovenia", "preambula")
    if (TABULKA_START.test(r)) vTabulke = true
    const posledny = aktualny.odseky[aktualny.odseky.length - 1]
    if (posledny) {
      posledny.riadky.push(r)
      if (vTabulke) posledny.maTabulku = true
    } else {
      aktualny.odseky.push({ cislo: null, riadky: [r], maTabulku: vTabulke })
    }
  }

  for (const r of riadky) {
    const mPriloha = PRILOHA.exec(r)
    if (mPriloha) {
      vTabulke = false
      vPrilohach = true
      zacniClanok(mPriloha[1], (mPriloha[2] || "Príloha").trim(), "priloha")
      continue
    }

    const mCast = CAST.exec(r)
    if (mCast && !vPrilohach) { vTabulke = false; cast = r; continue }

    const mClanok = CLANOK.exec(r)
    if (mClanok && !vPrilohach) { vTabulke = false; zacniClanok(mClanok[1], mClanok[2].trim()); continue }

    const mOdsek = ODSEK.exec(r)
    if (mOdsek) {
      if (!aktualny) zacniClanok(null, "Úvodné ustanovenia", "preambula")
      // Nový odsek tabuľku zatvára — ale môže ju hneď aj otvoriť,
      // ak sa začína popisom typu „(2) Tabuľka č. 1 – Odstupné“.
      vTabulke = !!mOdsek[2] && TABULKA_START.test(mOdsek[2])
      aktualny.odseky.push({
        cislo: mOdsek[1],
        riadky: mOdsek[2] ? [mOdsek[2]] : [],
        maTabulku: vTabulke,
      })
      continue
    }

    pridajRiadok(r)
  }
  return clanky
}

// ── Skladanie chunkov ────────────────────────────────────────────────────────

const textOdseku = (o) => (o.cislo ? `(${o.cislo}) ` : "") + o.riadky.join(" ")

/** Referencia na citáciu — príloha sa cituje inak než článok. */
function refJednotky(j) {
  if (j.typ === "priloha") return j.cislo ? `príloha č. ${j.cislo}` : "príloha"
  return j.cislo ? `čl. ${j.cislo}` : null
}

/**
 * Breadcrumb ide do textu chunku, nielen do metadát — embedding vidí iba text,
 * takže bez neho by chunk stratil doménový kontext.
 */
function breadcrumb(nazovDokumentu, j) {
  const casti = [nazovDokumentu]
  if (j.cast) casti.push(j.cast)
  if (j.typ === "priloha") casti.push(`Príloha č. ${j.cislo} - ${j.nadpis}`)
  else casti.push(j.cislo ? `Článok ${j.cislo} - ${j.nadpis}` : j.nadpis)
  return casti.filter(Boolean).join(" › ")
}

/**
 * Rozdelí zoznam riadkov na skupiny. Prednostne láme na písmenách a), b), c) —
 * to sú prirodzené hranice vo výpočtoch a definíciách. Ak sa písmeno dlho
 * nevyskytne, zlomí núdzovo, aby chunk nenarástol donekonečna.
 */
function rozdelRiadky(riadky, maxZnakov) {
  const skupiny = []
  let akt = [], dlzka = 0
  for (const r of riadky) {
    const prekroci = akt.length && dlzka + r.length > maxZnakov
    if (prekroci && (PISMENO.test(r) || dlzka > maxZnakov * 1.5)) {
      skupiny.push(akt); akt = []; dlzka = 0
    }
    akt.push(r); dlzka += r.length + 1
  }
  if (akt.length) skupiny.push(akt)
  return skupiny
}

/**
 * Rozdelí jednotku (článok alebo prílohu) na chunky.
 * Krátka jednotka = jeden chunk; to je v poriadku, úplný krátky článok je
 * lepší chunk než umelo zlepený s cudzím obsahom.
 */
function chunkujJednotku(j, meta) {
  const bc = breadcrumb(meta.nazovDokumentu, j)
  const hlavicka = `${bc}\n\n`
  const ref = refJednotky(j)
  const priestor = CIEL_MAX - hlavicka.length

  const neprazdne = j.odseky.filter(o => textOdseku(o).trim())
  if (!neprazdne.length) return []

  const cely = neprazdne.map(textOdseku).join("\n")
  const uplny = neprazdne.length === 1 || (hlavicka.length + cely.length <= CIEL_MAX)

  // Zmestí sa celá? Nedeľ — je to najlepší možný chunk.
  if (hlavicka.length + cely.length <= CIEL_MAX) {
    return [{ text: hlavicka + cely, heading: j.nadpis, articleRef: ref,
              cast: j.cast, typ: j.typ, uplnaJednotka: true,
              obsahujeTabulku: neprazdne.some(o => o.maTabulku) }]
  }

  const chunky = []
  let davka = [], prve = null, posledne = null, dlzka = 0

  const uloz = () => {
    if (!davka.length) return
    let r = ref
    if (ref && j.typ !== "priloha" && prve) {
      r = posledne && posledne !== prve ? `${ref} ods. ${prve}–${posledne}` : `${ref} ods. ${prve}`
    }
    chunky.push({ text: hlavicka + davka.join("\n"), heading: j.nadpis,
                  articleRef: r, cast: j.cast, typ: j.typ, uplnaJednotka: false })
    davka = []; prve = null; posledne = null; dlzka = 0
  }

  for (const o of neprazdne) {
    const t = textOdseku(o)

    // Odsek s tabuľkou je nedeliteľný — radšej väčší chunk než tabuľka
    // bez hlavičky (D17). Uloží sa samostatne, nech nezhltne aj susedov.
    if (o.maTabulku) {
      uloz()
      chunky.push({
        text: hlavicka + t, heading: j.nadpis,
        articleRef: ref && o.cislo && j.typ !== "priloha" ? `${ref} ods. ${o.cislo}` : ref,
        cast: j.cast, typ: j.typ, uplnaJednotka: false, obsahujeTabulku: true,
      })
      continue
    }

    // Samotný odsek je dlhší než limit — rozlámeme ho na písmenách.
    if (t.length > priestor) {
      uloz()
      const predpona = o.cislo ? `(${o.cislo}) ` : ""
      for (const skupina of rozdelRiadky(o.riadky, priestor - predpona.length)) {
        chunky.push({
          text: hlavicka + predpona + skupina.join(" "),
          heading: j.nadpis,
          articleRef: ref && o.cislo && j.typ !== "priloha" ? `${ref} ods. ${o.cislo}` : ref,
          cast: j.cast, typ: j.typ, uplnaJednotka: false,
        })
      }
      continue
    }

    if (davka.length && dlzka + t.length > priestor) uloz()
    if (!davka.length) prve = o.cislo
    posledne = o.cislo ?? posledne
    davka.push(t); dlzka += t.length + 1
  }
  uloz()
  return zlucChvost(chunky, hlavicka.length)
}

/**
 * Zlúči osamelý chvost s predchádzajúcim chunkom.
 *
 * Pri delení dlhého článku často zvýši posledný odsek sám — napr. „čl. 8 ods. 24“
 * so 100 tokenmi. Taký úlomok je na vyhľadávanie slabý (málo kontextu) a zbytočne
 * drobí citácie. Ak sa zmestí k predchádzajúcemu, pripojíme ho a zlúčime referencie.
 */
function zlucChvost(chunky, dlzkaHlavicky) {
  if (chunky.length < 2) return chunky
  const posledny = chunky[chunky.length - 1]
  const predposledny = chunky[chunky.length - 2]

  // Heuristika: zlučujeme len naozaj drobné chvosty a pripúšťame mierne
  // prekročenie limitu. Väčší chunk je menšie zlo než osamelý úlomok, ale
  // nafukovať ho tiež netreba. Prah doladiť podľa výsledkov D9.
  const chvostJeMaly = odhadTokenov(posledny.text) < 150
  const telo = posledny.text.slice(dlzkaHlavicky)
  const zmestiSa = predposledny.text.length + telo.length <= CIEL_MAX * 1.15

  if (!chvostJeMaly || !zmestiSa) return chunky

  predposledny.text = predposledny.text + "\n" + telo
  predposledny.articleRef = zlucRef(predposledny.articleRef, posledny.articleRef)
  return chunky.slice(0, -1)
}

/** Z „čl. 8 ods. 15–23“ + „čl. 8 ods. 24“ spraví „čl. 8 ods. 15–24“. */
function zlucRef(a, b) {
  if (!a || !b || a === b) return a ?? b
  const vzor = /^(.*?)\s+ods\.\s+(\d+[a-z]?)(?:[–-](\d+[a-z]?))?$/
  const ma = vzor.exec(a), mb = vzor.exec(b)
  if (!ma || !mb || ma[1] !== mb[1]) return a
  const od = ma[2]
  const doo = mb[3] ?? mb[2]
  return `${ma[1]} ods. ${od}–${doo}`
}

export function chunkuj(text, meta = {}) {
  const { riadky, odstranene } = ocisti(text, meta)
  const clanky = parsujStrukturu(riadky)

  const chunky = []
  for (const j of clanky) {
    for (const ch of chunkujJednotku(j, meta)) {
      chunky.push({ ...ch, chunkIndex: chunky.length })
    }
  }

  const dlzky = chunky.map(c => odhadTokenov(c.text))
  return {
    chunky,
    statistiky: {
      riadkovPoOcisteni: riadky.length,
      odstranene,
      clankov: clanky.length,
      chunkov: chunky.length,
      tokenyMin: dlzky.length ? Math.min(...dlzky) : 0,
      tokenyMax: dlzky.length ? Math.max(...dlzky) : 0,
      tokenyPriemer: dlzky.length ? Math.round(dlzky.reduce((a, b) => a + b, 0) / dlzky.length) : 0,
      priloh: clanky.filter(c => c.typ === "priloha").length,
      sTabulkou: chunky.filter(c => c.obsahujeTabulku).length,
      nadLimit: dlzky.filter(d => d > 800).length,
      // Krátky ÚPLNY článok nie je problém — je to prirodzená sémantická
      // jednotka. Problém je len krátky ÚLOMOK rozdeleného článku.
      kratkeUlomky: chunky.filter(c => !c.uplnaJednotka && odhadTokenov(c.text) < 300).length,
      kratkeUplne: chunky.filter(c => c.uplnaJednotka && odhadTokenov(c.text) < 300).length,
    },
  }
}
