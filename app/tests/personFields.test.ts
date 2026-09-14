/**
 * personFields.test.ts — meno, tituly, telefón, pracovisko (D83–D86).
 *
 * Sú to jediné pravidlá tejto zmeny, ktoré sa dajú pomýliť, a jediné, ktoré sa
 * dajú overiť bez clustera. Testuje sa to, čo rozhoduje o zápise: čo sa uloží,
 * čo sa odmietne a čo sa zámerne nechá prázdne.
 */

import { describe, it, expect } from "vitest"
import {
  composeFullName, displayName, splitFullName,
  normalizePhone, matchWorkplace, workplaceLabel,
} from "../src/lib/personFields"

describe("meno sa sklada", () => {
  it("z mena a priezviska", () => {
    expect(composeFullName("Ján", "Letko")).toBe("Ján Letko")
  })

  it("prazdna cast nenechá medzeru navyse", () => {
    expect(composeFullName("Ján", "")).toBe("Ján")
    expect(composeFullName("", "Letko")).toBe("Letko")
    expect(composeFullName("  Ján  ", "  Letko  ")).toBe("Ján Letko")
  })

  it("bez oboch casti je prazdne, nie medzera", () => {
    expect(composeFullName(undefined, undefined)).toBe("")
  })
})

describe("tituly su len na zobrazenie (D84)", () => {
  it("pred menom aj za menom", () => {
    expect(displayName({ fullName: "Ján Letko", titleBefore: "Ing.", titleAfter: "PhD." }))
      .toBe("Ing. Ján Letko, PhD.")
  })

  it("bez titulov ostava holé meno", () => {
    expect(displayName({ fullName: "Ján Letko" })).toBe("Ján Letko")
  })

  it("ciarka pribudne len k titulu za menom", () => {
    expect(displayName({ fullName: "Ján Letko", titleBefore: "Mgr." })).toBe("Mgr. Ján Letko")
    expect(displayName({ fullName: "Ján Letko", titleAfter: "CSc." })).toBe("Ján Letko, CSc.")
  })
})

describe("rozdelenie mena pre migraciu (D83)", () => {
  it("deli sa po prvej medzere, zlozene priezvisko ostava cele", () => {
    expect(splitFullName("Ján Letko")).toEqual({ givenName: "Ján", surname: "Letko" })
    expect(splitFullName("Anna Nováková Kováčová"))
      .toEqual({ givenName: "Anna", surname: "Nováková Kováčová" })
  })

  it("jedno slovo sa nerozdeli — radsej prazdno nez uhádnuté priezvisko", () => {
    expect(splitFullName("Cher")).toBeNull()
    expect(splitFullName("")).toBeNull()
    expect(splitFullName("   ")).toBeNull()
  })

  it("adresa namiesto mena sa tiez nerozdeli", () => {
    expect(splitFullName("jan.letko@futbalsfz.sk")).toBeNull()
  })
})

describe("telefon do E.164 (D86)", () => {
  it("cislo s nulou dostane predvolbu organizacie", () => {
    expect(normalizePhone("0905 123 456", "+421")).toEqual({ ok: true, value: "+421905123456" })
    expect(normalizePhone("0905 123 456", "+420")).toEqual({ ok: true, value: "+420905123456" })
  })

  it("predvolba organizacie sa na medzinárodny zapis nepouzije", () => {
    expect(normalizePhone("+420 777 123 456", "+421")).toEqual({ ok: true, value: "+420777123456" })
    expect(normalizePhone("00420777123456", "+421")).toEqual({ ok: true, value: "+420777123456" })
  })

  it("sposob zapisu nie je sucast cisla", () => {
    expect(normalizePhone("0905-123/456", "+421")).toEqual({ ok: true, value: "+421905123456" })
    expect(normalizePhone("(0905) 123 456", "+421")).toEqual({ ok: true, value: "+421905123456" })
  })

  it("bez predvolby sa krajina nehada", () => {
    // 905123456 moze byt slovensky mobil bez nuly aj skratene cislo odinakial.
    expect(normalizePhone("905123456", "+421")).toEqual({ ok: false, reason: "phone.noPrefix" })
  })

  it("co nie je cislo, sa neulozi", () => {
    expect(normalizePhone("+421 kdesi", "+421")).toEqual({ ok: false, reason: "phone.shape" })
    expect(normalizePhone("+4219", "+421")).toEqual({ ok: false, reason: "phone.shape" })
    expect(normalizePhone("0905123456789012345", "+421")).toEqual({ ok: false, reason: "phone.shape" })
  })

  it("prazdne je platne a znamena vyprazdnit", () => {
    expect(normalizePhone("", "+421")).toEqual({ ok: true, value: "" })
    expect(normalizePhone(undefined, "+421")).toEqual({ ok: true, value: "" })
  })

  it("chybajuca predvolba organizacie padne na +421", () => {
    expect(normalizePhone("0905123456")).toEqual({ ok: true, value: "+421905123456" })
    expect(normalizePhone("0905123456", "")).toEqual({ ok: true, value: "+421905123456" })
  })
})

describe("parovanie pracoviska na ciselnik (D85)", () => {
  const items = [
    { key: "bratislava", label: "Bratislava" },
    { key: "banska_bystrica", label: "Banská Bystrica" },
  ]

  it("paruje sa na kluc aj na popisku", () => {
    expect(matchWorkplace("bratislava", items)).toBe("bratislava")
    expect(matchWorkplace("Bratislava", items)).toBe("bratislava")
    expect(matchWorkplace("banska_bystrica", items)).toBe("banska_bystrica")
  })

  it("diakritika, velke pismena ani medzery nerozhoduju", () => {
    expect(matchWorkplace("Banská Bystrica", items)).toBe("banska_bystrica")
    expect(matchWorkplace("banska bystrica", items)).toBe("banska_bystrica")
    expect(matchWorkplace("  BANSKÁ BYSTRICA  ", items)).toBe("banska_bystrica")
  })

  it("nespárované vrati null — ciselnik sa importom nezaklada", () => {
    expect(matchWorkplace("Senec", items)).toBeNull()
    expect(matchWorkplace("BA", items)).toBeNull()
    expect(matchWorkplace("", items)).toBeNull()
    expect(matchWorkplace(undefined, items)).toBeNull()
  })

  it("popiska sa berie z ciselnika, inak sa ukaze kluc", () => {
    expect(workplaceLabel("banska_bystrica", items)).toBe("Banská Bystrica")
    expect(workplaceLabel("senec", items)).toBe("senec")
    expect(workplaceLabel(undefined, items)).toBe("")
  })
})
