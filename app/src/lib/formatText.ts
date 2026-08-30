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
  | { druh: "odsek"; useky: Segment[] }
  | { druh: "nadpis"; useky: Segment[]; uroven: number }
  | { druh: "zoznam"; polozky: Segment[][]; cislovany: boolean }

const ODRAZKA = /^\s*[-*•]\s+(.*)$/
const CISLO = /^\s*(\d+)[.)]\s+(.*)$/

/**
 * Riadok, ktorý je celý tučný, je medzititulok — model ho oddeľuje iba
 * zalomením, nie prázdnym riadkom. Keby sme sa držali prázdnych riadkov,
 * zlial by sa s odsekom pod sebou a odpoveď by stratila členenie práve tam,
 * kde ho čitateľ najviac potrebuje.
 */
const MEDZITITULOK = /^\*\*(?!\s)(.+?)\*\*[:：]?$/

/**
 * Markdown nadpis. Model ich používa striedavo s tučnými medzititulkami —
 * v tej istej odpovedi vedľa seba. Bez tohto vzoru sa v texte objavilo
 * doslovné „## Hráči“, čo vyzerá ako chyba systému.
 */
const NADPIS = /^(#{1,4})\s+(.+?)\s*#*$/

/**
 * Rozdelí riadok na bežné a tučné úseky.
 *
 * Nepárny počet oddeľovačov nechávame tak, ako prišiel — useknutá odpoveď
 * (vyčerpaný limit tokenov) končí uprostred a bolo by horšie zmiznúť
 * polovicu textu než ukázať jednu hviezdičku.
 */
export function splitInline(riadok: string): Segment[] {
  const useky: Segment[] = []
  let zvysok = riadok

  for (;;) {
    const zaciatok = zvysok.indexOf("**")
    if (zaciatok === -1) break

    const koniec = zvysok.indexOf("**", zaciatok + 2)
    if (koniec === -1) break                     // nepárny — ďalej nespracúvame

    const vnutro = zvysok.slice(zaciatok + 2, koniec)
    if (!vnutro) {                               // `****` nie je zvýraznenie
      zvysok = zvysok.slice(0, zaciatok) + zvysok.slice(koniec + 2)
      continue
    }

    if (zaciatok > 0) useky.push({ druh: "text", text: zvysok.slice(0, zaciatok) })
    useky.push({ druh: "tucne", text: vnutro })
    zvysok = zvysok.slice(koniec + 2)
  }

  if (zvysok) useky.push({ druh: "text", text: zvysok })
  return useky.length ? useky : [{ druh: "text", text: "" }]
}

/**
 * Rozloží celú odpoveď na odseky a zoznamy.
 *
 * Prázdny riadok oddeľuje odseky. Riadky vo vnútri odseku sa spájajú
 * medzerou — model zalamuje podľa svojho, nie podľa šírky okna.
 */
export function toBlocks(text: string): Block[] {
  const bloky: Block[] = []
  const riadky = text.split("\n")

  let odsek: string[] = []
  let zoznam: { polozky: string[]; cislovany: boolean } | null = null

  const zavriOdsek = () => {
    if (!odsek.length) return
    bloky.push({ druh: "odsek", useky: splitInline(odsek.join(" ")) })
    odsek = []
  }
  const zavriZoznam = () => {
    if (!zoznam) return
    bloky.push({
      druh: "zoznam",
      polozky: zoznam.polozky.map(splitInline),
      cislovany: zoznam.cislovany,
    })
    zoznam = null
  }

  for (const riadok of riadky) {
    const orezany = riadok.trim()

    if (!orezany) {
      zavriOdsek()
      zavriZoznam()
      continue
    }

    const nadpis = NADPIS.exec(orezany)
    if (nadpis) {
      zavriOdsek()
      zavriZoznam()
      bloky.push({
        druh: "nadpis",
        uroven: nadpis[1].length,
        useky: splitInline(nadpis[2]),
      })
      continue
    }

    const medzititulok = MEDZITITULOK.exec(orezany)
    if (medzititulok) {
      zavriOdsek()
      zavriZoznam()
      // Tučný riadok je významovo to isté, čo `###` — zjednotíme, aby sa
      // v jednej odpovedi nestriedali dva rôzne vzhľady toho istého.
      // Koncová dvojbodka patrí k vete pod nadpisom, nie k nadpisu; model
      // ju píše dnu aj von z hviezdičiek, takže sa orezáva tu.
      bloky.push({
        druh: "nadpis", uroven: 3,
        useky: [{ druh: "text", text: medzititulok[1].replace(/[:：]\s*$/, "") }],
      })
      continue
    }

    const odrazka = ODRAZKA.exec(riadok)
    const cislo = CISLO.exec(riadok)

    if (odrazka || cislo) {
      zavriOdsek()
      const cislovany = Boolean(cislo)
      const obsah = (odrazka?.[1] ?? cislo?.[2] ?? "").trim()
      // Zmena typu zoznamu uprostred = nový zoznam.
      if (zoznam && zoznam.cislovany !== cislovany) zavriZoznam()
      if (!zoznam) zoznam = { polozky: [], cislovany }
      zoznam.polozky.push(obsah)
      continue
    }

    // Pokračovanie odrážky (odsadený riadok pod ňou).
    if (zoznam && /^\s{2,}/.test(riadok)) {
      zoznam.polozky[zoznam.polozky.length - 1] += " " + orezany
      continue
    }

    zavriZoznam()
    odsek.push(orezany)
  }

  zavriOdsek()
  zavriZoznam()
  return bloky
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
  const sipka = t.lastIndexOf("›")
  if (sipka !== -1 && sipka < 250) {
    const zvysok = t.slice(sipka + 1).trim()
    // Za poslednou šípkou býva ešte označenie článku a jeho názov; odrežeme
    // až po prvý znak, ktorý začína samotné znenie — číslovaný odsek.
    const odsek = /\(\d+\)|\d+\.\s/.exec(zvysok)
    t = odsek ? zvysok.slice(odsek.index).trim() : zvysok
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
export function mergeCitations<T extends { citedText: string }>(citacie: T[]): T[] {
  const kluc = (t: string) => cleanCitation(t).replace(/\s+/g, " ").toLowerCase()

  const zostavajuce: { k: string; c: T }[] = []
  for (const c of citacie) {
    const k = kluc(c.citedText)
    if (!k) continue

    // Model tú istú pasáž niekedy odcituje kratšie a inde dlhšie — vtedy je
    // to jedno miesto, nie dve. Ponechá sa dlhšie znenie, lebo obsahuje aj
    // to kratšie; opačne by hodnotiteľ prišiel o časť kontextu.
    const prekryv = zostavajuce.findIndex(z => z.k.startsWith(k) || k.startsWith(z.k))
    if (prekryv === -1) {
      zostavajuce.push({ k, c })
    } else if (k.length > zostavajuce[prekryv].k.length) {
      // Dlhšie znenie nahradí kratšie, ale na PÔVODNOM mieste — poradie
      // citácií má zodpovedať poradiu tvrdení v odpovedi.
      zostavajuce[prekryv] = { k, c }
    }
  }
  return zostavajuce.map(z => z.c)
}
