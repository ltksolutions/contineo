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
// Druhý zápis, ktorý sa v normách SFZ vyskytuje častejšie: číslo článku
// stojí samo na riadku a názov je až na nasledujúcom.
//
//     Článok 1
//     Základné ustanovenia
//
// Bez tohto vzoru sa celý dokument zlial do jedného bloku „Úvodné
// ustanovenia“ a vyhľadávanie nemalo čoho chytiť. Osem z deviatich
// vzorových dokumentov používa práve tento tvar.
const CLANOK_SAM = /^Článok\s+(\d+[a-z]?)\s*$/
// Prílohy stoja MIMO číslovania článkov — vzory zmlúv, tabuľky poplatkov.
// Bez tohto vzoru by spadli pod posledný článok a citácia by klamala.
const PRILOHA = /^PR[ÍI]LOHA\s+č\.\s*(\d+[a-z]?)\s*[-–—]?\s*(.*)$/i
// Písmená v odsekoch — záchytný bod na delenie dlhých výpočtov (napr. definície).
const PISMENO = /^[a-záäčďéíĺľňóôŕšťúýž]\)\s/

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
export const PREDVOLENY_PROFIL = {
  slovoClanok: "Článok",
  slovoPriloha: "PRÍLOHA č.",
  /** Riadok opakovaný viac ráz je takmer isto hlavička alebo päta. */
  opakovaniHlavicky: 5,
  cielMinTokenov: 300,
  cielMaxTokenov: 800,
}

const escapuj = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Zostaví vzory pre daný profil.
 *
 * Volá sa raz na začiatku `chunkuj()`; funkcie si ich potom podávajú ďalej.
 * Modulová premenná to zámerne nie je — tá by pri dvoch tenantoch s rôznym
 * profilom znamenala, že výsledok závisí od poradia volaní.
 */
export function vzoryPreProfil(profil = {}) {
  const p = { ...PREDVOLENY_PROFIL, ...profil }
  const clanok = escapuj(p.slovoClanok)
  const priloha = escapuj(p.slovoPriloha)

  // Pri predvolenom slove sa berú **pôvodné konštanty**, nie znovu zostavený
  // vzor. Nie je to opatrnosť navyše: pôvodná PRÍLOHA má `[ÍI]`, takže chytí
  // aj zápis bez dĺžňa, a zostavený vzor by o to potichu prišiel. Predvolený
  // profil musí dať presne to členenie, aké dával doteraz.
  const jeVlastnyClanok = p.slovoClanok !== PREDVOLENY_PROFIL.slovoClanok
  const jeVlastnaPriloha = p.slovoPriloha !== PREDVOLENY_PROFIL.slovoPriloha

  return {
    profil: p,
    CLANOK: jeVlastnyClanok
      ? new RegExp(`^${clanok}\\s+(\\d+[a-z]?)\\s*[-–—]\\s*(.+)$`)
      : CLANOK,
    CLANOK_SAM: jeVlastnyClanok
      ? new RegExp(`^${clanok}\\s+(\\d+[a-z]?)\\s*$`)
      : CLANOK_SAM,
    PRILOHA: jeVlastnaPriloha
      ? new RegExp(`^${priloha}\\s*(\\d+[a-z]?)\\s*[-–—]?\\s*(.*)$`, "i")
      : PRILOHA,
    CAST,
    ODSEK,
    TABULKA_START,
    opakovaniHlavicky: p.opakovaniHlavicky,
    cielMin: Math.round(p.cielMinTokenov * ZNAKY_NA_TOKEN),
    cielMax: Math.round(p.cielMaxTokenov * ZNAKY_NA_TOKEN),
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
const TABULKA_START = /^(Tabuľka\s+č\.\s*\d+|\|)/i
const ODSEK = /^\((\d+)\)\s*(.*)$/
// Poznámka pod čiarou: "4a) Smernica…" — číslo BEZ otváracej zátvorky.
// Odlišuje sa tým od odseku "(4)" aj od písmena "a)".
const POZNAMKA = /^\d+[a-z]?\)\s+\S/
const CISLO_STRANY = /^\d+\s*\/\s*\d+$/
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
const STRANA = /^(Strana|Page)\s+\d+(\s+(z|of)\s+\d+)?$/i
const STRANA_Z = /^(z|of)\s+\d+$/i

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
function normalizuj(riadok) {
  return riadok
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")   // zero-width a spol.
    .replace(/\u00A0/g, " ")                        // nezlomiteľná medzera
    .trim()
}

export function ocisti(text, { nazovDokumentu, vzory } = {}) {
  const v = vzory ?? vzoryPreProfil()
  const vsetky = text.split(/\r?\n/)
  const odstranene = { hlavicka: 0, cisloStrany: 0, poznamka: 0, prazdne: 0 }

  // Riadky, ktoré sa opakujú viac než 5×, sú takmer isto hlavička alebo päta.
  const pocty = new Map()
  for (const r of vsetky) {
    const k = normalizuj(r)
    if (k.length > 10) pocty.set(k, (pocty.get(k) ?? 0) + 1)
  }
  const opakujuce = new Set(
    [...pocty].filter(([, n]) => n > v.opakovaniHlavicky).map(([k]) => k),
  )
  if (nazovDokumentu) opakujuce.add(nazovDokumentu.trim())

  const riadky = []
  let vPoznamke = false

  for (const raw of vsetky) {
    const r = normalizuj(raw)

    if (!r) { odstranene.prazdne++; vPoznamke = false; continue }
    if (CISLO_STRANY.test(r) || STRANA.test(r) || STRANA_Z.test(r)) {
      odstranene.cisloStrany++; vPoznamke = false; continue
    }
    if (opakujuce.has(r)) { odstranene.hlavicka++; vPoznamke = false; continue }

    // Poznámky pod čiarou — začínajú číslom bez zátvorky a často pokračujú
    // na ďalšom riadku. Vypadnú, kým nenarazíme na štruktúrny prvok.
    if (POZNAMKA.test(r)) { vPoznamke = true; odstranene.poznamka++; continue }
    if (vPoznamke) {
      if (v.CLANOK.test(r) || v.CLANOK_SAM.test(r) || v.CAST.test(r) || v.ODSEK.test(r)) {
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
export function parsujStrukturu(riadky, vzory) {
  const v = vzory ?? vzoryPreProfil()
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

  /**
   * Nájde názov, ktorý stojí na samostatnom riadku pod nadpisom.
   * Vráti { nadpis, dalsiIndex } alebo null, ak tam žiadny názov nie je.
   *
   * Prísne podmienky sú zámerné — radšej žiadny názov než nesprávny:
   * riadok nesmie byť iný štruktúrny prvok, nesmie byť dlhý ako veta
   * a nesmie končiť bodkou (to už je text, nie nadpis).
   */
  const nazovPodNadpisom = (i) => {
    for (let j = i + 1; j < riadky.length && j <= i + 2; j++) {
      const d = riadky[j]
      if (!d) continue
      if (v.CLANOK.test(d) || v.CLANOK_SAM.test(d) || v.CAST.test(d) ||
          v.PRILOHA.test(d) || v.ODSEK.test(d) || v.TABULKA_START.test(d)) return null
      if (d.length > 120 || /[.:;]$/.test(d)) return null
      // Poistka: prázdny alebo neviditeľný text nie je názov článku.
      const cisty = normalizuj(d)
      if (!cisty) continue
      return { nadpis: cisty, dalsiIndex: j }
    }
    return null
  }

  for (let i = 0; i < riadky.length; i++) {
    const r = riadky[i]
    const mPriloha = v.PRILOHA.exec(r)
    if (mPriloha) {
      vTabulke = false
      vPrilohach = true
      let nazovP = (mPriloha[2] || "").trim()
      if (!nazovP) {
        const n = nazovPodNadpisom(i)
        if (n) { nazovP = n.nadpis; i = n.dalsiIndex }
      }
      zacniClanok(mPriloha[1], nazovP || "Príloha", "priloha")
      continue
    }

    const mCast = v.CAST.exec(r)
    if (mCast && !vPrilohach) { vTabulke = false; cast = r; continue }

    const mClanok = v.CLANOK.exec(r)
    if (mClanok && !vPrilohach) { vTabulke = false; zacniClanok(mClanok[1], mClanok[2].trim()); continue }

    // „Článok N“ samostatne — názov hľadáme na nasledujúcom riadku.
    const mClanokSam = v.CLANOK_SAM.exec(r)
    if (mClanokSam && !vPrilohach) {
      vTabulke = false
      const n = nazovPodNadpisom(i)
      zacniClanok(mClanokSam[1], n ? n.nadpis : `Článok ${mClanokSam[1]}`)
      if (n) i = n.dalsiIndex
      continue
    }

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
  const v = meta.vzory ?? vzoryPreProfil()
  const bc = breadcrumb(meta.nazovDokumentu, j)
  const hlavicka = `${bc}\n\n`
  const ref = refJednotky(j)
  const priestor = v.cielMax - hlavicka.length

  const neprazdne = j.odseky.filter(o => textOdseku(o).trim())
  if (!neprazdne.length) return []

  const cely = neprazdne.map(textOdseku).join("\n")
  const uplny = neprazdne.length === 1 || (hlavicka.length + cely.length <= v.cielMax)

  // Zmestí sa celá? Nedeľ — je to najlepší možný chunk.
  if (hlavicka.length + cely.length <= v.cielMax) {
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
  const v = vzoryPreProfil(meta.profil)
  const { riadky, odstranene } = ocisti(text, { ...meta, vzory: v })
  const clanky = parsujStrukturu(riadky, v)

  const chunky = []
  for (const j of clanky) {
    for (const ch of chunkujJednotku(j, { ...meta, vzory: v })) {
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
