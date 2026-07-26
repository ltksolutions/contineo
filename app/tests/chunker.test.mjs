/**
 * chunker.test.mjs — testy chunkovania noriem. Bez siete a bez databázy.
 *     node tests/chunker.test.mjs
 */
import { chunkuj, ocisti, parsujStrukturu, odhadTokenov } from "../scripts/lib/chunker.mjs"

const R = []
const t = (n, ok, extra = "") => { R.push([ok, n]); console.log(`${ok ? "OK   " : "CHYBA"} ${n}` + (ok ? "" : `  → ${extra}`)) }

const NORMA = `Nejaký poriadok SFZ
schválený na zasadnutí výkonného výboru
1/3
PRVÁ ČASŤ - Všeobecné ustanovenia
Článok 1 - Základné ustanovenia
(1) Prvý odsek prvého článku.
(2) Druhý odsek prvého článku.
Nejaký poriadok SFZ
schválený na zasadnutí výkonného výboru
2/3
Článok 2 – Status hráča
(1) Hráč je buď amatér alebo profesionál.
1) Poznámka pod čiarou, ktorá sa má odstrániť.
pokračovanie poznámky na druhom riadku
DRUHÁ ČASŤ - Osobitné ustanovenia
Článok 3 - Vymedzenie pojmov
Na účely tohto poriadku sa rozumie
a) amatér - hráč bez zmluvy,
b) profesionál - hráč so zmluvou,
Nejaký poriadok SFZ
schválený na zasadnutí výkonného výboru
3/3
PRÍLOHA č. 1 - Vzor zmluvy
(1) Zmluvné strany sa dohodli na tomto.
PRÍLOHA č. 2 - Poplatky
(1) Poplatok za registráciu je 10 eur.`

// Hlavičky sa opakujú 3× — prah je >5, tak ich pridáme cez nazovDokumentu.
const { riadky, odstranene } = ocisti(NORMA, { nazovDokumentu: "Nejaký poriadok SFZ" })

t("čistenie: odstráni čísla strán", odstranene.cisloStrany === 3, String(odstranene.cisloStrany))
t("čistenie: odstráni opakovanú hlavičku", odstranene.hlavicka >= 3, String(odstranene.hlavicka))
t("čistenie: odstráni poznámku pod čiarou aj pokračovanie",
  odstranene.poznamka === 2, String(odstranene.poznamka))
t("čistenie: poznámka nezožrala ďalší článok",
  riadky.some(r => r.startsWith("DRUHÁ ČASŤ")), riadky.slice(0, 12).join(" | "))

const jednotky = parsujStrukturu(riadky)
const clanky = jednotky.filter(j => j.typ === "clanok")
const prilohy = jednotky.filter(j => j.typ === "priloha")

t("štruktúra: nájde 3 články", clanky.length === 3, String(clanky.length))
t("štruktúra: nájde 2 prílohy", prilohy.length === 2, String(prilohy.length))
t("štruktúra: článok s pomlčkou – sa rozpozná",
  clanky.some(c => c.cislo === "2" && c.nadpis === "Status hráča"),
  JSON.stringify(clanky.map(c => [c.cislo, c.nadpis])))
t("štruktúra: časť sa priradí článku",
  clanky.find(c => c.cislo === "3")?.cast?.startsWith("DRUHÁ ČASŤ"),
  String(clanky.find(c => c.cislo === "3")?.cast))
t("štruktúra: príloha NEDEDÍ časť (stojí mimo)",
  prilohy.every(p => p.cast === null), JSON.stringify(prilohy.map(p => p.cast)))

const { chunky, statistiky } = chunkuj(NORMA, { nazovDokumentu: "Nejaký poriadok SFZ" })

t("chunky: vzniknú", chunky.length >= 5, String(chunky.length))
t("chunky: článok má ref 'čl. N'",
  chunky.some(c => c.articleRef === "čl. 1"), JSON.stringify(chunky.map(c => c.articleRef)))
t("chunky: príloha má ref 'príloha č. N' — NIE 'čl.'",
  chunky.some(c => c.articleRef === "príloha č. 1")
  && !chunky.some(c => c.typ === "priloha" && String(c.articleRef).startsWith("čl.")),
  JSON.stringify(chunky.filter(c => c.typ === "priloha").map(c => c.articleRef)))
t("chunky: breadcrumb je v texte, nie len v metadátach",
  chunky.every(c => c.text.includes("›")), "chýba › v niektorom chunku")
t("chunky: breadcrumb obsahuje názov dokumentu",
  chunky.every(c => c.text.startsWith("Nejaký poriadok SFZ")))
t("chunky: breadcrumb prílohy hovorí 'Príloha', nie 'Článok'",
  chunky.filter(c => c.typ === "priloha").every(c => c.text.includes("Príloha č.")))
t("chunky: krátky úplný článok je označený ako úplná jednotka",
  chunky.filter(c => c.articleRef === "čl. 1").every(c => c.uplnaJednotka === true))
t("chunky: index je súvislý",
  chunky.every((c, i) => c.chunkIndex === i))
t("štatistiky: počíta prílohy", statistiky.priloh === 2, String(statistiky.priloh))

// ── delenie dlhého článku ────────────────────────────────────────────────
const dlhy = "Dokument\nČlánok 1 - Dlhý\n" +
  Array.from({ length: 40 }, (_, i) => `(${i + 1}) ${"Veta s nejakým obsahom. ".repeat(12)}`).join("\n")
const d = chunkuj(dlhy, { nazovDokumentu: "Dokument" })
t("dlhý článok sa rozdelí na viac chunkov", d.chunky.length > 1, String(d.chunky.length))
t("rozdelený článok NIE je označený ako úplný",
  d.chunky.every(c => c.uplnaJednotka === false))
t("rozdelené chunky majú rozsah odsekov v ref",
  d.chunky.some(c => /ods\. \d+[–-]\d+/.test(String(c.articleRef))),
  JSON.stringify(d.chunky.map(c => c.articleRef).slice(0, 4)))
t("žiadny chunk nie je nezmyselne veľký",
  d.chunky.every(c => odhadTokenov(c.text) < 1500),
  String(Math.max(...d.chunky.map(c => odhadTokenov(c.text)))))

// ── tabuľky sa NIKDY nedelia (D17) ───────────────────────────────────────
// Tabuľka zámerne dlhšia než limit — musí zostať v jednom chunku.
const riadkyTab = Array.from({ length: 60 },
  (_, i) => `z ${i + 1}. ligy 6.000 € 4.500 € 2.500 € 1.500 € 1.000 € 1.000 € 500 € 500 € 500 €`)
const sTabulkou = [
  "Predpis",
  "Článok 1 - S tabuľkou",
  "(1) Krátky úvodný odsek pred tabuľkou.",
  "(2) Tabuľka č. 1 – Odstupné",
  "do 1. do 2. do 3. do 4. do 5. do 6. do 7. do 8. do 9.",
  "ligy ligy ligy ligy ligy ligy ligy ligy ligy",
  ...riadkyTab,
  "(3) Odsek za tabuľkou, ktorý s ňou nesúvisí.",
].join("\n")

const tab = chunkuj(sTabulkou, { nazovDokumentu: "Predpis" })
const sTab = tab.chunky.filter(c => c.obsahujeTabulku)

t("tabuľka: rozpoznaná ako tabuľka", sTab.length === 1, String(sTab.length))
t("tabuľka: zostala v JEDNOM chunku aj nad limit",
  (sTab[0]?.text.match(/z \d+\. ligy/g) || []).length === 60,
  String((sTab[0]?.text.match(/z \d+\. ligy/g) || []).length))
t("tabuľka: hlavička ostala pri dátach",
  !!sTab[0] && sTab[0].text.includes("do 1.") && sTab[0].text.includes("ligy ligy"))
t("tabuľka: presahuje bežný limit — a to je v poriadku",
  odhadTokenov(sTab[0]?.text ?? "") > 800, String(odhadTokenov(sTab[0]?.text ?? "")))
t("tabuľka: odsek ZA tabuľkou je v inom chunku",
  tab.chunky.some(c => !c.obsahujeTabulku && c.text.includes("Odsek za tabuľkou")),
  JSON.stringify(tab.chunky.map(c => [c.chunkIndex, c.obsahujeTabulku])))
t("tabuľka: odsek PRED tabuľkou je v inom chunku",
  tab.chunky.some(c => !c.obsahujeTabulku && c.text.includes("Krátky úvodný odsek")))
t("štatistiky: počíta chunky s tabuľkou", tab.statistiky.sTabulkou === 1)

// markdownová tabuľka (|) sa rozpozná rovnako
const md = chunkuj([
  "Predpis", "Článok 1 - MD tabuľka", "(1) Text.",
  "| a | b |", "| --- | --- |", "| 1 | 2 |",
].join("\n"), { nazovDokumentu: "Predpis" })
t("tabuľka: markdownový tvar (|) sa rozpozná",
  md.chunky.some(c => c.obsahujeTabulku),
  JSON.stringify(md.chunky.map(c => c.obsahujeTabulku)))

// ── prázdny a degenerovaný vstup ─────────────────────────────────────────
t("prázdny vstup nespadne", chunkuj("", {}).chunky.length === 0)
t("text bez štruktúry dá aspoň jeden chunk",
  chunkuj("Len obyčajný text bez článkov.", { nazovDokumentu: "X" }).chunky.length === 1)

// ── dvojriadkový nadpis článku ────────────────────────────────────────────
// Osem z deviatich noriem SFZ píše "Článok N" a názov až na ďalšom riadku.
// Kým to chunker nevedel, celý dokument spadol do "Úvodné ustanovenia".
const dvoj = chunkuj([
  "Disciplinárny poriadok SFZ",
  "Úvodné ustanovenia (Článok 1 - 5)",
  "",
  "Článok 1",
  "Základné ustanovenia",
  "",
  "(1) Slovenský futbalový zväz je národný športový zväz.",
  "(2) Druhý odsek prvého článku.",
  "",
  "Článok 2",
  "Pôsobnosť poriadku",
  "",
  "(1) Tento poriadok sa vzťahuje na členov SFZ.",
].join("\n"), { nazovDokumentu: "Disciplinárny poriadok SFZ" })

t("dvojriadkový: rozpozná 2 články",
  dvoj.chunky.filter(c => /^čl\. \d/.test(c.articleRef ?? "")).length >= 2,
  JSON.stringify(dvoj.chunky.map(c => c.articleRef)))
t("dvojriadkový: názov z ďalšieho riadku sa použije ako nadpis",
  dvoj.chunky.some(c => c.heading === "Základné ustanovenia"),
  JSON.stringify(dvoj.chunky.map(c => c.heading)))
t("dvojriadkový: druhý článok má svoj názov",
  dvoj.chunky.some(c => c.heading === "Pôsobnosť poriadku"))
t("dvojriadkový: názov sa NEZOPAKUJE v tele chunku ako odsek",
  !dvoj.chunky.some(c => /^\(?\d*\)?\s*Základné ustanovenia\s*$/m.test(c.text.split("\n").slice(-1)[0] ?? "")))
t("dvojriadkový: nič neostalo v preambule okrem úvodu",
  dvoj.chunky.filter(c => c.heading === "Úvodné ustanovenia").length <= 1,
  JSON.stringify(dvoj.chunky.map(c => c.heading)))

// Text, ktorý VYZERÁ ako názov, ale je to veta -> nadpisom sa nestane
const veta = chunkuj([
  "Predpis",
  "Článok 3",
  "(1) Odsek začína hneď, žiadny názov tu nie je.",
].join("\n"), { nazovDokumentu: "Predpis" })
t("dvojriadkový: odsek sa nezneužije ako názov článku",
  veta.chunky.some(c => c.heading === "Článok 3"),
  JSON.stringify(veta.chunky.map(c => c.heading)))

// Oba tvary v jednom dokumente
const mix = chunkuj([
  "Predpis",
  "Článok 1 - S pomlčkou",
  "(1) Text prvého.",
  "Článok 2",
  "Bez pomlčky",
  "(1) Text druhého.",
].join("\n"), { nazovDokumentu: "Predpis" })
t("dvojriadkový: oba tvary naraz fungujú",
  mix.chunky.some(c => c.heading === "S pomlčkou") &&
  mix.chunky.some(c => c.heading === "Bez pomlčky"),
  JSON.stringify(mix.chunky.map(c => c.heading)))

// ── typ chunku ────────────────────────────────────────────────────────────
// Preambula (titulka, zoznam novelizácií, osnova) sa musí dať odlíšiť —
// vyhľadávanie ju preskakuje, lebo vytláčala z top-5 skutočné články.
t("typ: preambula je označená",
  dvoj.chunky.some(c => c.typ === "preambula"),
  JSON.stringify(dvoj.chunky.map(c => [c.heading, c.typ])))
t("typ: článok je označený ako clanok",
  dvoj.chunky.filter(c => /^čl\./.test(c.articleRef ?? "")).every(c => c.typ === "clanok"),
  JSON.stringify(dvoj.chunky.map(c => [c.articleRef, c.typ])))
t("typ: príloha je označená ako priloha",
  chunky.filter(c => /^príloha/.test(c.articleRef ?? "")).every(c => c.typ === "priloha"),
  JSON.stringify(chunky.map(c => [c.articleRef, c.typ])))

const zle = R.filter(([ok]) => !ok)
console.log("\n" + "=".repeat(60))
console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov prešlo`)
process.exit(zle.length ? 1 : 0)
