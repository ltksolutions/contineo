/**
 * onboarding.test.ts — platnosť verzie a znenie potvrdenia (Fáza 8, D24/D25/D28).
 *
 * Testuje sa to, čo rozhoduje o právnej hodnote záznamu: **ktorá verzia platí**
 * a **čo presne človek potvrdil**. Zápis do databázy sa netestuje — to je už len
 * `insertOne` a bez clustera by sme testovali mongodb driver.
 */
import { platnaVerzia } from "../src/lib/dokumenty"
import type { Dokument, Verzia } from "../src/lib/dokumenty"
import { zneniePotvrdenia, slovenskyDatum, odtlacokZnenia } from "../src/lib/potvrdenia"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

const den = (r: number, m: number, d: number) => new Date(Date.UTC(r, m - 1, d))
const v = (p: Partial<Verzia>): Verzia => ({
  versionId: "v1", label: "1.0", effectiveFrom: den(2026, 1, 1),
  effectiveTo: null, isActive: true, ...p,
})
const dok = (verzie: Verzia[]): Dokument => ({ documentId: "d1", title: "Smernica", versions: verzie })

const DNES = den(2026, 6, 1)
const dovod = (d: Dokument) => { const r = platnaVerzia(d, DNES); return r.ok ? "(platná)" : r.dovod }

// ── čo neplatí a prečo ───────────────────────────────────────────────────────

t("bez verzií → ziadne-verzie", dovod(dok([])) === "ziadne-verzie")
t("chýbajúce pole versions → ziadne-verzie",
  dovod({ documentId: "d", title: "x" }) === "ziadne-verzie")
t("všetky archivované → vsetky-archivovane",
  dovod(dok([v({ isActive: false })])) === "vsetky-archivovane")

// Toto je podstatné pravidlo: verzia bez dátumu platnosti NEPLATÍ.
// Formulka obsahuje „platná od {dátum}" (D28) — bez dátumu sa nedá ani zložiť.
t("bez effectiveFrom → platnost-neurcena",
  dovod(dok([v({ effectiveFrom: null })])) === "platnost-neurcena")

t("platnosť až o mesiac → este-neplati",
  dovod(dok([v({ effectiveFrom: den(2026, 9, 1) })])) === "este-neplati")
t("platnosť skončila → uz-neplati",
  dovod(dok([v({ effectiveTo: den(2026, 3, 1) })])) === "uz-neplati")

// ── čo platí ─────────────────────────────────────────────────────────────────

const jedna = platnaVerzia(dok([v({})]), DNES)
t("jedna otvorená verzia platí", jedna.ok)

const dve = platnaVerzia(dok([
  v({ versionId: "stara", label: "1.0", effectiveFrom: den(2026, 1, 1), effectiveTo: den(2026, 4, 1) }),
  v({ versionId: "nova", label: "2.0", effectiveFrom: den(2026, 4, 1) }),
]), DNES)
t("z dvoch znení platí to, ktoré je práve v platnosti",
  dve.ok && dve.verzia.versionId === "nova", JSON.stringify(dve))

// Lex posterior (R3 v PRECEDENCIA_NORIEM): pri dvoch prekrývajúcich sa platí novšia.
const prekryv = platnaVerzia(dok([
  v({ versionId: "starsia", effectiveFrom: den(2026, 1, 1) }),
  v({ versionId: "novsia", effectiveFrom: den(2026, 5, 1) }),
]), DNES)
t("pri prekryve platí novšia (lex posterior)",
  prekryv.ok && prekryv.verzia.versionId === "novsia", JSON.stringify(prekryv))

t("archivovaná verzia sa nevyberie, aj keď dátumy sedia", (() => {
  const r = platnaVerzia(dok([
    v({ versionId: "archiv", isActive: false }),
    v({ versionId: "ziva", effectiveFrom: den(2026, 2, 1) }),
  ]), DNES)
  return r.ok && r.verzia.versionId === "ziva"
})())

t("historický dotaz vráti vtedy platné znenie", (() => {
  const d = dok([
    v({ versionId: "stara", effectiveFrom: den(2026, 1, 1), effectiveTo: den(2026, 4, 1) }),
    v({ versionId: "nova", effectiveFrom: den(2026, 4, 1) }),
  ])
  const r = platnaVerzia(d, den(2026, 2, 15))
  return r.ok && r.verzia.versionId === "stara"
})())

// Hranica: effectiveTo je vylučujúce, effectiveFrom zahŕňajúce.
t("v deň začiatku platnosti už verzia platí",
  platnaVerzia(dok([v({ effectiveFrom: DNES })]), DNES).ok)
t("v deň konca platnosti už verzia neplatí",
  !platnaVerzia(dok([v({ effectiveTo: DNES })]), DNES).ok)

// ── znenie formulky (D28) ────────────────────────────────────────────────────

t("dátum je deterministický, nezávislý od locale servera",
  slovenskyDatum(den(2026, 9, 1)) === "1. 9. 2026", slovenskyDatum(den(2026, 9, 1)))

const znenie = zneniePotvrdenia("Smernica o ochrane osobných údajov", "1.2", den(2026, 9, 1))

t("formulka hovorí o oboznámení, NIE o súhlase", /oboznámil/.test(znenie) && !/súhlas/i.test(znenie), znenie)
t("formulka obsahuje záväzok dodržiavať", /zaväzujem sa ho dodržiavať/.test(znenie))
t("formulka obsahuje názov dokumentu", znenie.includes("Smernica o ochrane osobných údajov"))
t("formulka obsahuje označenie verzie", /verzia 1\.2/.test(znenie))
t("formulka obsahuje dátum platnosti", znenie.includes("1. 9. 2026"))

// ── odtlačok znenia ──────────────────────────────────────────────────────────

const hlavne = async () => {
  const a = await odtlacokZnenia(znenie)
  const b = await odtlacokZnenia(znenie)
  const c = await odtlacokZnenia(znenie + " ")

  t("odtlačok je SHA-256 v hexa tvare", /^[0-9a-f]{64}$/.test(a), a)
  t("rovnaké znenie dá rovnaký odtlačok", a === b)
  t("zmena o jednu medzeru odtlačok zmení", a !== c)

  for (const [ok, n] of R) console.log(`${ok ? "OK  " : "ZLE "}  ${n}`)
  const zle = R.filter(([ok]) => !ok)
  console.log("\n" + "=".repeat(56))
  console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
  process.exit(zle.length ? 1 : 0)
}

hlavne()
