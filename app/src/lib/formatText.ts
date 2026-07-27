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

export type Usek =
  | { druh: "text"; text: string }
  | { druh: "tucne"; text: string }

export type Blok =
  | { druh: "odsek"; useky: Usek[] }
  | { druh: "zoznam"; polozky: Usek[][]; cislovany: boolean }

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
 * Rozdelí riadok na bežné a tučné úseky.
 *
 * Nepárny počet oddeľovačov nechávame tak, ako prišiel — useknutá odpoveď
 * (vyčerpaný limit tokenov) končí uprostred a bolo by horšie zmiznúť
 * polovicu textu než ukázať jednu hviezdičku.
 */
export function rozdelInline(riadok: string): Usek[] {
  const useky: Usek[] = []
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
export function naBloky(text: string): Blok[] {
  const bloky: Blok[] = []
  const riadky = text.split("\n")

  let odsek: string[] = []
  let zoznam: { polozky: string[]; cislovany: boolean } | null = null

  const zavriOdsek = () => {
    if (!odsek.length) return
    bloky.push({ druh: "odsek", useky: rozdelInline(odsek.join(" ")) })
    odsek = []
  }
  const zavriZoznam = () => {
    if (!zoznam) return
    bloky.push({
      druh: "zoznam",
      polozky: zoznam.polozky.map(rozdelInline),
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

    const medzititulok = MEDZITITULOK.exec(orezany)
    if (medzititulok) {
      zavriOdsek()
      zavriZoznam()
      bloky.push({ druh: "odsek", useky: [{ druh: "tucne", text: medzititulok[1] }] })
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
export function ocistiCitaciu(text: string): string {
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
