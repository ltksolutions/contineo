/**
 * formatText.test.ts — rozobratie odpovede modelu na bloky.
 *
 * Vstupom je text, ktorý si nemôžeme overiť — výstup modelu nad cudzími
 * dokumentmi. Preto sú tu aj testy na to, čo sa stane pri poškodenom
 * formátovaní: useknutá odpoveď nesmie zmiznúť.
 */
import { splitInline, toBlocks, cleanCitation, mergeCitations } from "../src/lib/formatText"

import { t } from "./helper"

const text = (b: ReturnType<typeof splitInline>) => b.map(u => u.text).join("")

// ── inline zvýraznenie ───────────────────────────────────────────────────────

t("obyčajný text zostane jedným úsekom",
  splitInline("Podľa čl. 78 platí").length === 1)

const bold = splitInline("Podľa **čl. 78** platí")
t("tučný úsek sa vydelí", bold.length === 3, JSON.stringify(bold))
t("tučný úsek má správny druh", bold[1].druh === "tucne" && bold[1].text === "čl. 78")
t("text okolo sa zachová", text(bold) === "Podľa čl. 78 platí", text(bold))

const wholeLine = splitInline("**Lehota podľa čl. 78:**")
t("celý riadok môže byť tučný",
  wholeLine.length === 1 && wholeLine[0].druh === "tucne",
  JSON.stringify(wholeLine))

t("dva tučné úseky v jednom riadku",
  splitInline("**a** medzi **b**").filter(u => u.druh === "tucne").length === 2)

// Useknutá odpoveď: limit tokenov sa vyčerpal uprostred zvýraznenia.
const truncated = splitInline("Text pokračuje **ale skončil")
t("nepárny oddeľovač nezožerie zvyšok textu",
  text(truncated) === "Text pokračuje **ale skončil", text(truncated))

t("prázdne ** sa nepovažuje za zvýraznenie",
  text(splitInline("a****b")) === "ab", text(splitInline("a****b")))

// ── bloky ────────────────────────────────────────────────────────────────────

const one = toBlocks("Prvá veta.\nDruhá veta.")
t("riadky jedného odseku sa spoja", one.length === 1, String(one.length))
t("spájajú sa medzerou",
  one[0].druh === "odsek" && text(one[0].segments) === "Prvá veta. Druhá veta.",
  one[0].druh === "odsek" ? text(one[0].segments) : "")

t("prázdny riadok oddelí odseky",
  toBlocks("Prvý.\n\nDruhý.").length === 2)

const withList = toBlocks("Platí toto:\n\n- prvá vec\n- druhá vec\n\nZáver.")
t("odsek, zoznam a odsek", withList.length === 3,
  JSON.stringify(withList.map(b => b.druh)))
t("zoznam má dve položky",
  withList[1].druh === "zoznam" && withList[1].items.length === 2)
t("odrážka sa neberie ako súčasť textu",
  withList[1].druh === "zoznam" && text(withList[1].items[0]) === "prvá vec",
  withList[1].druh === "zoznam" ? text(withList[1].items[0]) : "")

const numbered = toBlocks("1. prvé\n2. druhé")
t("číslovaný zoznam sa rozpozná",
  numbered[0].druh === "zoznam" && numbered[0].numbered === true)

t("zmena typu zoznamu založí nový",
  toBlocks("- a\n1. b").length === 2)

t("odsadené pokračovanie patrí k odrážke",
  (() => {
    const b = toBlocks("- prvá vec\n  pokračovanie")
    return b.length === 1 && b[0].druh === "zoznam" && text(b[0].items[0]) === "prvá vec pokračovanie"
  })())

t("zvýraznenie funguje aj v odrážke",
  (() => {
    const b = toBlocks("- podľa **čl. 78**")
    return b[0].druh === "zoznam" && b[0].items[0].some(u => u.druh === "tucne")
  })())

t("prázdny vstup nedá nič", toBlocks("").length === 0)
t("samé prázdne riadky nedajú nič", toBlocks("\n\n\n").length === 0)

// Skutočný tvar odpovede z prvého behu proti živému Atlasu.
const real = toBlocks(
  "Na základe dokumentov nemôžem uviesť lehotu:\n\n" +
  "**Lehota podľa čl. 78 (zápis o stretnutí):**\n" +
  "Kapitán družstva má právo podať námietku.\n\n" +
  "**Náležitosti (čl. 86):**\n" +
  "Námietka obsahuje najmä tieto náležitosti."
)
t("skutočná odpoveď dá päť blokov", real.length === 5,
  JSON.stringify(real.map(b => b.druh)))
t("medzititulok sa stane nadpisom",
  real[1].druh === "nadpis" && text(real[1].segments) === "Lehota podľa čl. 78 (zápis o stretnutí)",
  real[1].druh === "nadpis" ? text(real[1].segments) : real[1].druh)

// ── markdown nadpisy ─────────────────────────────────────────────────────────
//
// Model ich používa striedavo s tučnými medzititulkami, niekedy oboje
// v jednej odpovedi. Doslovné „## Hráči“ v texte vyzerá ako chyba systému.

const withHeading = toBlocks("## Hráči\n\nPo 5. napomenutí sa ukladá sankcia.")
t("## sa rozpozná ako nadpis",
  withHeading[0].druh === "nadpis", JSON.stringify(withHeading.map(b => b.druh)))
t("mriežky nezostanú v texte",
  withHeading[0].druh === "nadpis" && text(withHeading[0].segments) === "Hráči",
  withHeading[0].druh === "nadpis" ? text(withHeading[0].segments) : "")
t("úroveň nadpisu sa zachová",
  withHeading[0].druh === "nadpis" && withHeading[0].level === 2)

t("nadpis nepotrebuje prázdny riadok pod sebou",
  (() => {
    const b = toBlocks("## Hráči\nText hneď pod nadpisom.")
    return b.length === 2 && b[0].druh === "nadpis" && b[1].druh === "odsek"
  })())

t("# aj ### fungujú",
  toBlocks("# Prvá\n\n### Tretia").every(b => b.druh === "nadpis"))

t("uzavretý nadpis ## Text ## sa očistí",
  (() => {
    const b = toBlocks("## Hráči ##")
    return b[0].druh === "nadpis" && text(b[0].segments) === "Hráči"
  })())

t("mriežka bez medzery nie je nadpis",
  toBlocks("#hashtag nie je nadpis")[0].druh === "odsek")

t("zvýraznenie v nadpise funguje",
  (() => {
    const b = toBlocks("## Podľa **čl. 37**")
    return b[0].druh === "nadpis" && b[0].segments.some(u => u.druh === "tucne")
  })())

// Tučný riadok a ### znamenajú to isté — v jednej odpovedi sa nesmú
// zobraziť dvomi rôznymi spôsobmi.
t("tučný medzititulok je tiež nadpis",
  toBlocks("**Náležitosti (čl. 86):**")[0].druh === "nadpis")

// Dvojbodka patrí k vete pod nadpisom, nie k nadpisu. Model ju píše raz
// vnútri hviezdičiek, raz za nimi — výsledok musí byť rovnaký.
t("koncová dvojbodka sa z nadpisu oreže (vnútri hviezdičiek)",
  (() => {
    const b = toBlocks("**Náležitosti:**")
    return b[0].druh === "nadpis" && text(b[0].segments) === "Náležitosti"
  })())
t("koncová dvojbodka sa z nadpisu oreže (za hviezdičkami)",
  (() => {
    const b = toBlocks("**Náležitosti**:")
    return b[0].druh === "nadpis" && text(b[0].segments) === "Náležitosti"
  })())

// Skutočná odpoveď z rozhrania: model zmiešal oba tvary.
const mixed = toBlocks(
  "Podľa Disciplinárneho poriadku (čl. 37) sa tresty uplatňujú rozdielne.\n\n" +
  "## Hráči\n\n" +
  "Po 5. napomenutí pozastavenie výkonu športu.\n\n" +
  "**Členovia realizačného tímu:**\n" +
  "Po 3. napomenutí pozastavenie funkcie."
)
t("zmiešané tvary dajú päť blokov", mixed.length === 5,
  JSON.stringify(mixed.map(b => b.druh)))
t("oba tvary skončia ako nadpis",
  mixed.filter(b => b.druh === "nadpis").length === 2,
  JSON.stringify(mixed.map(b => b.druh)))

// ── čistenie citácií ─────────────────────────────────────────────────────────

t("obyčajná citácia sa nemení",
  cleanCitation("(3) Kapitán družstva je oprávnený podať námietku.") ===
  "(3) Kapitán družstva je oprávnený podať námietku.")

t("koncové zalomenie sa oreže",
  cleanCitation("(3) Kapitán družstva podá námietku.\n") ===
  "(3) Kapitán družstva podá námietku.")

const withBreadcrumb = cleanCitation(
  "Súťažný poriadok futbalu SFZ › DESIATA ČASŤ › Článok 86 - Náležitosti námietky " +
  "(1) Námietka obsahuje najmä tieto náležitosti: a) označenie subjektu"
)
t("breadcrumb sa pri zobrazení skryje",
  withBreadcrumb.startsWith("(1) Námietka obsahuje"), withBreadcrumb.slice(0, 60))

t("citácia bez breadcrumbu s medzerou v texte zostane celá",
  cleanCitation("Podľa čl. 3 › nasleduje výnimka (2) ktorá platí").length > 0)

// ── zlučovanie citácií ───────────────────────────────────────────────────────
//
// Model cituje ten istý úryvok pri každom tvrdení, ktoré sa oň opiera.
// V odpovedi o prestupe maloletého hráča ich bolo 19, z toho polovica
// doslovne rovnakých — pre hodnotiteľa je to šum.

const c = (t: string) => ({ citedText: t })

t("dve zhodné citácie sa zlúčia",
  mergeCitations([c("(2) Transfer maloletého hráča."), c("(2) Transfer maloletého hráča.")]).length === 1)

t("rôzne citácie zostanú obe",
  mergeCitations([c("(2) Transfer hráča."), c("(3) Iné znenie.")]).length === 2)

t("líšia sa len medzerami — zlúčia sa",
  mergeCitations([c("(2) Transfer  hráča."), c("(2) Transfer hráča.\n")]).length === 1)

t("poradie prvého výskytu sa zachová",
  (() => {
    const v = mergeCitations([c("prvá"), c("druhá"), c("prvá"), c("tretia")])
    return v.length === 3 && v[0].citedText === "prvá" && v[1].citedText === "druhá"
  })())

t("prázdna citácia sa zahodí",
  mergeCitations([c("   "), c("(1) Text.")]).length === 1)

// Rovnaký chunk odcitovaný v inom rozsahu sú DVE citácie, nie jedna —
// preto sa zlučuje podľa textu, nie podľa chunkIndex.
t("ten istý chunk v inom rozsahu sa nezlúči",
  mergeCitations([
    { chunkIndex: 4, citedText: "(2) Prvá veta." },
    { chunkIndex: 4, citedText: "(3) Druhá veta." },
  ]).length === 2)

t("breadcrumb nerozdelí inak zhodné citácie",
  mergeCitations([
    c("Poriadok › ČASŤ › Článok 20 (2) Transfer maloletého hráča."),
    c("(2) Transfer maloletého hráča."),
  ]).length === 1)

t("prázdny vstup dá prázdny výstup", mergeCitations([]).length === 0)

// Skutočný prípad z odpovede o prestupe: model odcitoval to isté miesto
// raz po vetu, raz s pokračovaním. Sú to dve citácie toho istého, nie dve
// rôzne — a hodnotiteľ ich číta dvakrát zbytočne.
const overlap = mergeCitations([
  c("(2) Transfer maloletého hráča je možné vykonať so súhlasom zástupcu."),
  c("(2) Transfer maloletého hráča je možné vykonať so súhlasom zástupcu. Transfer podľa predchádzajúcej vety je možné vykonať aj mimo územia kraja."),
])
t("kratšia citácia sa zlúči do dlhšej", overlap.length === 1, JSON.stringify(overlap))
t("zostane to dlhšie znenie",
  overlap[0].citedText.includes("mimo územia kraja"), overlap[0].citedText.slice(0, 70))

t("dlhšia pred kratšou dá ten istý výsledok",
  (() => {
    const v = mergeCitations([
      c("(2) Transfer hráča. Pokračovanie vety navyše."),
      c("(2) Transfer hráča."),
    ])
    return v.length === 1 && v[0].citedText.includes("Pokračovanie")
  })())

t("prekryv nezmení poradie ostatných",
  (() => {
    const v = mergeCitations([c("(1) Prvá."), c("(2) Druhá."), c("(1) Prvá. Dlhšia."), c("(3) Tretia.")])
    return v.length === 3 && v[0].citedText.includes("Dlhšia") && v[1].citedText === "(2) Druhá."
  })())

// Pozor na opačný extrém: dve rôzne ustanovenia sa NESMÚ zlúčiť len preto,
// že sa zhodujú v prvých slovách.
t("rôzne odseky s podobným začiatkom zostanú oddelené",
  mergeCitations([
    c("(2) Transfer maloletého hráča je možné so súhlasom zástupcu."),
    c("(3) Transfer maloletého hráča, ktorý nedovŕšil 15 rokov, je zakázaný."),
  ]).length === 2)

