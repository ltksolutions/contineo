/**
 * formatText.test.ts — rozobratie odpovede modelu na bloky.
 *
 * Vstupom je text, ktorý si nemôžeme overiť — výstup modelu nad cudzími
 * dokumentmi. Preto sú tu aj testy na to, čo sa stane pri poškodenom
 * formátovaní: useknutá odpoveď nesmie zmiznúť.
 */
import { rozdelInline, naBloky, ocistiCitaciu } from "../src/lib/formatText"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

const text = (b: ReturnType<typeof rozdelInline>) => b.map(u => u.text).join("")

// ── inline zvýraznenie ───────────────────────────────────────────────────────

t("obyčajný text zostane jedným úsekom",
  rozdelInline("Podľa čl. 78 platí").length === 1)

const tucne = rozdelInline("Podľa **čl. 78** platí")
t("tučný úsek sa vydelí", tucne.length === 3, JSON.stringify(tucne))
t("tučný úsek má správny druh", tucne[1].druh === "tucne" && tucne[1].text === "čl. 78")
t("text okolo sa zachová", text(tucne) === "Podľa čl. 78 platí", text(tucne))

const celyRiadok = rozdelInline("**Lehota podľa čl. 78:**")
t("celý riadok môže byť tučný",
  celyRiadok.length === 1 && celyRiadok[0].druh === "tucne",
  JSON.stringify(celyRiadok))

t("dva tučné úseky v jednom riadku",
  rozdelInline("**a** medzi **b**").filter(u => u.druh === "tucne").length === 2)

// Useknutá odpoveď: limit tokenov sa vyčerpal uprostred zvýraznenia.
const useknuty = rozdelInline("Text pokračuje **ale skončil")
t("nepárny oddeľovač nezožerie zvyšok textu",
  text(useknuty) === "Text pokračuje **ale skončil", text(useknuty))

t("prázdne ** sa nepovažuje za zvýraznenie",
  text(rozdelInline("a****b")) === "ab", text(rozdelInline("a****b")))

// ── bloky ────────────────────────────────────────────────────────────────────

const jeden = naBloky("Prvá veta.\nDruhá veta.")
t("riadky jedného odseku sa spoja", jeden.length === 1, String(jeden.length))
t("spájajú sa medzerou",
  jeden[0].druh === "odsek" && text(jeden[0].useky) === "Prvá veta. Druhá veta.",
  jeden[0].druh === "odsek" ? text(jeden[0].useky) : "")

t("prázdny riadok oddelí odseky",
  naBloky("Prvý.\n\nDruhý.").length === 2)

const sZoznamom = naBloky("Platí toto:\n\n- prvá vec\n- druhá vec\n\nZáver.")
t("odsek, zoznam a odsek", sZoznamom.length === 3,
  JSON.stringify(sZoznamom.map(b => b.druh)))
t("zoznam má dve položky",
  sZoznamom[1].druh === "zoznam" && sZoznamom[1].polozky.length === 2)
t("odrážka sa neberie ako súčasť textu",
  sZoznamom[1].druh === "zoznam" && text(sZoznamom[1].polozky[0]) === "prvá vec",
  sZoznamom[1].druh === "zoznam" ? text(sZoznamom[1].polozky[0]) : "")

const cislovany = naBloky("1. prvé\n2. druhé")
t("číslovaný zoznam sa rozpozná",
  cislovany[0].druh === "zoznam" && cislovany[0].cislovany === true)

t("zmena typu zoznamu založí nový",
  naBloky("- a\n1. b").length === 2)

t("odsadené pokračovanie patrí k odrážke",
  (() => {
    const b = naBloky("- prvá vec\n  pokračovanie")
    return b.length === 1 && b[0].druh === "zoznam" && text(b[0].polozky[0]) === "prvá vec pokračovanie"
  })())

t("zvýraznenie funguje aj v odrážke",
  (() => {
    const b = naBloky("- podľa **čl. 78**")
    return b[0].druh === "zoznam" && b[0].polozky[0].some(u => u.druh === "tucne")
  })())

t("prázdny vstup nedá nič", naBloky("").length === 0)
t("samé prázdne riadky nedajú nič", naBloky("\n\n\n").length === 0)

// Skutočný tvar odpovede z prvého behu proti živému Atlasu.
const skutocna = naBloky(
  "Na základe dokumentov nemôžem uviesť lehotu:\n\n" +
  "**Lehota podľa čl. 78 (zápis o stretnutí):**\n" +
  "Kapitán družstva má právo podať námietku.\n\n" +
  "**Náležitosti (čl. 86):**\n" +
  "Námietka obsahuje najmä tieto náležitosti."
)
t("skutočná odpoveď dá päť blokov", skutocna.length === 5,
  JSON.stringify(skutocna.map(b => b.druh)))
t("medzititulok je celý tučný",
  skutocna[1].druh === "odsek" &&
  skutocna[1].useky.length === 1 &&
  skutocna[1].useky[0].druh === "tucne")

// ── čistenie citácií ─────────────────────────────────────────────────────────

t("obyčajná citácia sa nemení",
  ocistiCitaciu("(3) Kapitán družstva je oprávnený podať námietku.") ===
  "(3) Kapitán družstva je oprávnený podať námietku.")

t("koncové zalomenie sa oreže",
  ocistiCitaciu("(3) Kapitán družstva podá námietku.\n") ===
  "(3) Kapitán družstva podá námietku.")

const sBreadcrumbom = ocistiCitaciu(
  "Súťažný poriadok futbalu SFZ › DESIATA ČASŤ › Článok 86 - Náležitosti námietky " +
  "(1) Námietka obsahuje najmä tieto náležitosti: a) označenie subjektu"
)
t("breadcrumb sa pri zobrazení skryje",
  sBreadcrumbom.startsWith("(1) Námietka obsahuje"), sBreadcrumbom.slice(0, 60))

t("citácia bez breadcrumbu s medzerou v texte zostane celá",
  ocistiCitaciu("Podľa čl. 3 › nasleduje výnimka (2) ktorá platí").length > 0)

for (const [ok, n] of R) console.log(`${ok ? "OK  " : "ZLE "}  ${n}`)
const zle = R.filter(([ok]) => !ok)
console.log("\n" + "=".repeat(56))
console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
process.exit(zle.length ? 1 : 0)
