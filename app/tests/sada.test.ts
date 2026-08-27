/**
 * sada.test.ts — prekryv hodnotiteľov a miera zhody (D9, otvorený bod E5).
 *
 * Jadro veci je jedno pravidlo: pri otázke, ktorú majú posúdiť dvaja, sa
 * cudzí posudok NESMIE ukázať skôr, než sa človek vyjadrí sám. Keby ho
 * videl, merali by sme, či prvému uveril — a to je iná otázka než či sa
 * zhodnú. Preto sú tu testy aj na to, čo sa NEMÁ stať.
 */
import { vPrekryve, zhoda } from "../src/lib/sada"
import type { OtazkaSady, StavOtazky } from "../src/lib/sada"

import { t } from "./helper"

const otazka = (u: Partial<OtazkaSady> = {}): OtazkaSady => ({
  id: "D9-001", povodneZnenie: "Otázka?", upraveneZnenie: null,
  vyradena: false, dovodVyradenia: null,
  searchMode: "hybrid", sectionKey: "sutazny_poriadok", companyCode: "SFZ",
  accessLevel: "public", precedenceRule: null, trapType: null,
  expectedBehaviour: "answer", goldChunkIds: [],
  ...u,
})

const posudok = (kto: string, spravna: 0 | 1 | null): StavOtazky => ({
  spravna, halucinacia: 0, hodnotitel: kto, kedy: new Date(),
})

// ── ktoré otázky idú dvom ────────────────────────────────────────────────────

t("bežná otázka ide jednému", !vPrekryve(otazka()))
t("otázka na precedenciu ide dvom", vPrekryve(otazka({ precedenceRule: "R1" })))
t("pasca ide dvom", vPrekryve(otazka({ trapType: "out_of_domain" })))
t("pasca aj precedencia naraz ide dvom",
  vPrekryve(otazka({ precedenceRule: "R3", trapType: "historical_version" })))

// ── miera zhody ──────────────────────────────────────────────────────────────

const z = (v: [string, StavOtazky[]][]) => zhoda(new Map(v))

t("jeden posudok sa neráta — nie je s čím porovnávať",
  z([["D9-001", [posudok("a@x.sk", 1)]]]).porovnatelnych === 0)

t("dvaja rovnako = zhoda",
  (() => {
    const v = z([["D9-001", [posudok("a@x.sk", 1), posudok("b@x.sk", 1)]]])
    return v.porovnatelnych === 1 && v.zhodnych === 1 && v.sporne.length === 0
  })())

t("dvaja rozdielne = nezhoda",
  (() => {
    const v = z([["D9-001", [posudok("a@x.sk", 1), posudok("b@x.sk", 0)]]])
    return v.porovnatelnych === 1 && v.zhodnych === 0 && v.sporne[0] === "D9-001"
  })())

t("traja, jeden sa líši = nezhoda",
  z([["D9-001", [posudok("a@x.sk", 1), posudok("b@x.sk", 1), posudok("c@x.sk", 0)]]])
    .sporne.length === 1)

t("zhoda na nesprávnosti je tiež zhoda",
  z([["D9-001", [posudok("a@x.sk", 0), posudok("b@x.sk", 0)]]]).zhodnych === 1)

const zmiesane = z([
  ["D9-001", [posudok("a@x.sk", 1), posudok("b@x.sk", 1)]],
  ["D9-002", [posudok("a@x.sk", 1), posudok("b@x.sk", 0)]],
  ["D9-003", [posudok("a@x.sk", 0)]],                        // len jeden
  ["D9-004", [posudok("a@x.sk", 0), posudok("b@x.sk", 0)]],
])
t("porovnávajú sa len otázky s dvomi posudkami", zmiesane.porovnatelnych === 3)
t("zhodné sa spočítajú", zmiesane.zhodnych === 2)
t("sporné sa vymenujú", zmiesane.sporne.join(",") === "D9-002", zmiesane.sporne.join(","))
t("sporné sú zoradené",
  z([
    ["D9-050", [posudok("a@x.sk", 1), posudok("b@x.sk", 0)]],
    ["D9-010", [posudok("a@x.sk", 1), posudok("b@x.sk", 0)]],
  ]).sporne.join(",") === "D9-010,D9-050")

t("prázdny vstup nespadne", z([]).porovnatelnych === 0)

