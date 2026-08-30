/**
 * onboarding.test.ts — platnosť verzie a znenie potvrdenia (Fáza 8, D24/D25/D28).
 *
 * Testuje sa to, čo rozhoduje o právnej hodnote záznamu: **ktorá verzia platí**
 * a **čo presne človek potvrdil**. Zápis do databázy sa netestuje — to je už len
 * `insertOne` a bez clustera by sme testovali mongodb driver.
 */
import { effectiveVersion } from "../src/lib/documents"
import type { DocumentRecord, Version } from "../src/lib/documents"
import { buildStatement, hashStatement } from "../src/lib/acknowledgements"
import { formatDate, normalizeLanguage, UI_LANGUAGES } from "../src/lib/i18n"

import { t } from "./helper"

const day = (r: number, m: number, d: number) => new Date(Date.UTC(r, m - 1, d))
const v = (p: Partial<Version>): Version => ({
  versionId: "v1", label: "1.0", effectiveFrom: day(2026, 1, 1),
  effectiveTo: null, isActive: true, ...p,
})
const doc = (versions: Version[]): DocumentRecord => ({ documentId: "d1", title: "Smernica", versions: versions })

const TODAY = day(2026, 6, 1)
const reason = (d: DocumentRecord) => { const r = effectiveVersion(d, TODAY); return r.ok ? "(platná)" : r.reason }

// ── čo neplatí a prečo ───────────────────────────────────────────────────────

t("bez verzií → ziadne-verzie", reason(doc([])) === "no-versions")
t("chýbajúce pole versions → ziadne-verzie",
  reason({ documentId: "d", title: "x" }) === "no-versions")
t("všetky archivované → vsetky-archivovane",
  reason(doc([v({ isActive: false })])) === "all-archived")

// Toto je podstatné pravidlo: verzia bez dátumu platnosti NEPLATÍ.
// Formulka obsahuje „platná od {dátum}" (D28) — bez dátumu sa nedá ani zložiť.
t("bez effectiveFrom → platnost-neurcena",
  reason(doc([v({ effectiveFrom: null })])) === "validity-not-set")

t("platnosť až o mesiac → este-neplati",
  reason(doc([v({ effectiveFrom: day(2026, 9, 1) })])) === "not-yet-effective")
t("platnosť skončila → uz-neplati",
  reason(doc([v({ effectiveTo: day(2026, 3, 1) })])) === "no-longer-effective")

// ── čo platí ─────────────────────────────────────────────────────────────────

const one = effectiveVersion(doc([v({})]), TODAY)
t("jedna otvorená verzia platí", one.ok)

const two = effectiveVersion(doc([
  v({ versionId: "stara", label: "1.0", effectiveFrom: day(2026, 1, 1), effectiveTo: day(2026, 4, 1) }),
  v({ versionId: "nova", label: "2.0", effectiveFrom: day(2026, 4, 1) }),
]), TODAY)
t("z dvoch znení platí to, ktoré je práve v platnosti",
  two.ok && two.version.versionId === "nova", JSON.stringify(two))

// Lex posterior (R3 v PRECEDENCIA_NORIEM): pri dvoch prekrývajúcich sa platí novšia.
const overlap = effectiveVersion(doc([
  v({ versionId: "starsia", effectiveFrom: day(2026, 1, 1) }),
  v({ versionId: "novsia", effectiveFrom: day(2026, 5, 1) }),
]), TODAY)
t("pri prekryve platí novšia (lex posterior)",
  overlap.ok && overlap.version.versionId === "novsia", JSON.stringify(overlap))

t("archivovaná verzia sa nevyberie, aj keď dátumy sedia", (() => {
  const r = effectiveVersion(doc([
    v({ versionId: "archiv", isActive: false }),
    v({ versionId: "ziva", effectiveFrom: day(2026, 2, 1) }),
  ]), TODAY)
  return r.ok && r.version.versionId === "ziva"
})())

t("historický dotaz vráti vtedy platné znenie", (() => {
  const d = doc([
    v({ versionId: "stara", effectiveFrom: day(2026, 1, 1), effectiveTo: day(2026, 4, 1) }),
    v({ versionId: "nova", effectiveFrom: day(2026, 4, 1) }),
  ])
  const r = effectiveVersion(d, day(2026, 2, 15))
  return r.ok && r.version.versionId === "stara"
})())

// Hranica: effectiveTo je vylučujúce, effectiveFrom zahŕňajúce.
t("v deň začiatku platnosti už verzia platí",
  effectiveVersion(doc([v({ effectiveFrom: TODAY })]), TODAY).ok)
t("v deň konca platnosti už verzia neplatí",
  !effectiveVersion(doc([v({ effectiveTo: TODAY })]), TODAY).ok)

// ── jazyk prostredia ─────────────────────────────────────────────────────────

t("dátum je deterministický, nezávislý od locale servera",
  formatDate(day(2026, 9, 1), "sk") === "1. 9. 2026", formatDate(day(2026, 9, 1), "sk"))
t("čeština má rovnaký tvar dátumu ako slovenčina",
  formatDate(day(2026, 9, 1), "cs") === "1. 9. 2026")
// V právnom texte nesmie byť pochybnosť, či 9/1 je september alebo január.
t("angličtina používa slovný mesiac, aby nebola nejednoznačnosť",
  formatDate(day(2026, 9, 1), "en") === "1 September 2026", formatDate(day(2026, 9, 1), "en"))

t("neznámy jazyk padá na slovenčinu, nie na angličtinu", normalizeLanguage("de") === "sk")
t("zvláda tvar sk-SK z prehliadača", normalizeLanguage("sk-SK") === "sk")
t("zvláda tvar cs_CZ z tabuľky", normalizeLanguage("cs_CZ") === "cs")
t("prázdny vstup padá na predvolený jazyk", normalizeLanguage(undefined) === "sk")

// ── znenie formulky (D28) ────────────────────────────────────────────────────

const TITLE = "Smernica o ochrane osobných údajov"
const statement = buildStatement(TITLE, "1.2", day(2026, 9, 1), "sk")

t("formulka hovorí o oboznámení, NIE o súhlase", /oboznámil/.test(statement) && !/súhlas/i.test(statement), statement)
t("formulka obsahuje záväzok dodržiavať", /zaväzujem sa ho dodržiavať/.test(statement))
t("formulka obsahuje názov dokumentu", statement.includes(TITLE))
t("formulka obsahuje označenie verzie", /verzia 1\.2/.test(statement))
t("formulka obsahuje dátum platnosti", statement.includes("1. 9. 2026"))

// Znenie v češtine a angličtine sa tu netestuje. **Preklady prostredia sú
// samostatná vec** a kontrolovať ich reťazec po reťazci znamená zopakovať
// slovník v druhom súbore — a potom ho udržiavať dvakrát. Testujeme funkciu:
// že sa vyberie správny jazyk, že fallback drží a že formulka nesie to,
// čo niesť musí (nižšie, pre všetky jazyky naraz).

// Nech je jazyk akýkoľvek, tri veci tam musia byť vždy — bez nich sa o rok
// nedá povedať, čo človek potvrdil.
for (const j of UI_LANGUAGES) {
  const z = buildStatement(TITLE, "1.2", day(2026, 9, 1), j)
  t(`[${j}] formulka nesie názov, verziu aj dátum`,
    z.includes(TITLE) && z.includes("1.2") && /2026/.test(z), z)
}

t("neznámy jazyk nespadne, vráti slovenskú formulku",
  buildStatement(TITLE, "1.2", day(2026, 9, 1), "de" as never) === statement)

// ── odtlačok znenia ──────────────────────────────────────────────────────────

const main = async () => {
  const a = await hashStatement(statement)
  const b = await hashStatement(statement)
  const c = await hashStatement(statement + " ")

  t("odtlačok je SHA-256 v hexa tvare", /^[0-9a-f]{64}$/.test(a), a)
  t("rovnaké znenie dá rovnaký odtlačok", a === b)
  t("zmena o jednu medzeru odtlačok zmení", a !== c)

}

await main()
