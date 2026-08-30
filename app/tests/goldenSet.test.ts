/**
 * sada.test.ts — prekryv hodnotiteľov a miera zhody (D9, otvorený bod E5).
 *
 * Jadro veci je jedno pravidlo: pri otázke, ktorú majú posúdiť dvaja, sa
 * cudzí posudok NESMIE ukázať skôr, než sa človek vyjadrí sám. Keby ho
 * videl, merali by sme, či prvému uveril — a to je iná otázka než či sa
 * zhodnú. Preto sú tu testy aj na to, čo sa NEMÁ stať.
 */
import { inOverlap, agreement } from "../src/lib/goldenSet"
import type { GoldenQuestion, QuestionState } from "../src/lib/goldenSet"

import { t } from "./helper"

const question = (u: Partial<GoldenQuestion> = {}): GoldenQuestion => ({
  id: "D9-001", originalText: "Otázka?", editedText: null,
  excluded: false, exclusionReason: null,
  searchMode: "hybrid", sectionKey: "sutazny_poriadok", companyCode: "SFZ",
  accessLevel: "public", precedenceRule: null, trapType: null,
  expectedBehaviour: "answer", goldChunkIds: [],
  ...u,
})

const verdict = (who: string, correct: 0 | 1 | null): QuestionState => ({
  correct: correct, hallucination: 0, reviewer: who, at: new Date(),
})

// ── ktoré otázky idú dvom ────────────────────────────────────────────────────

t("bežná otázka ide jednému", !inOverlap(question()))
t("otázka na precedenciu ide dvom", inOverlap(question({ precedenceRule: "R1" })))
t("pasca ide dvom", inOverlap(question({ trapType: "out_of_domain" })))
t("pasca aj precedencia naraz ide dvom",
  inOverlap(question({ precedenceRule: "R3", trapType: "historical_version" })))

// ── miera zhody ──────────────────────────────────────────────────────────────

const z = (v: [string, QuestionState[]][]) => agreement(new Map(v))

t("jeden posudok sa neráta — nie je s čím porovnávať",
  z([["D9-001", [verdict("a@x.sk", 1)]]]).porovnatelnych === 0)

t("dvaja rovnako = zhoda",
  (() => {
    const v = z([["D9-001", [verdict("a@x.sk", 1), verdict("b@x.sk", 1)]]])
    return v.porovnatelnych === 1 && v.zhodnych === 1 && v.sporne.length === 0
  })())

t("dvaja rozdielne = nezhoda",
  (() => {
    const v = z([["D9-001", [verdict("a@x.sk", 1), verdict("b@x.sk", 0)]]])
    return v.porovnatelnych === 1 && v.zhodnych === 0 && v.sporne[0] === "D9-001"
  })())

t("traja, jeden sa líši = nezhoda",
  z([["D9-001", [verdict("a@x.sk", 1), verdict("b@x.sk", 1), verdict("c@x.sk", 0)]]])
    .sporne.length === 1)

t("zhoda na nesprávnosti je tiež zhoda",
  z([["D9-001", [verdict("a@x.sk", 0), verdict("b@x.sk", 0)]]]).zhodnych === 1)

const mixed = z([
  ["D9-001", [verdict("a@x.sk", 1), verdict("b@x.sk", 1)]],
  ["D9-002", [verdict("a@x.sk", 1), verdict("b@x.sk", 0)]],
  ["D9-003", [verdict("a@x.sk", 0)]],                        // len jeden
  ["D9-004", [verdict("a@x.sk", 0), verdict("b@x.sk", 0)]],
])
t("porovnávajú sa len otázky s dvomi posudkami", mixed.porovnatelnych === 3)
t("zhodné sa spočítajú", mixed.zhodnych === 2)
t("sporné sa vymenujú", mixed.sporne.join(",") === "D9-002", mixed.sporne.join(","))
t("sporné sú zoradené",
  z([
    ["D9-050", [verdict("a@x.sk", 1), verdict("b@x.sk", 0)]],
    ["D9-010", [verdict("a@x.sk", 1), verdict("b@x.sk", 0)]],
  ]).sporne.join(",") === "D9-010,D9-050")

t("prázdny vstup nespadne", z([]).porovnatelnych === 0)

