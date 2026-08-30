/**
 * csv.test.ts — čítanie a písanie CSV pre skripty onboardingu.
 *
 * Testuje sa to, čo naozaj príde z Excelu a čo sa dá ľahko pokaziť: BOM na
 * začiatku, bodkočiarka ako oddeľovač v slovenskom locale, úvodzovky okolo
 * poľa s oddeľovačom vnútri a hlavičky s diakritikou.
 *
 * Nie je to kozmetika — keď sa hlavička netrafí, import ticho preskočí stĺpec
 * a stovka ľudí príde o útvar alebo o jazyk.
 */
import { describe, it, expect } from "vitest"
import { parseCsv, parseLine, detectSeparator, normalizeHeader, toCsv } from "../scripts/lib/csv.mjs"

describe("rozpoznanie oddeľovača", () => {
  it("bodkočiarka vyhrá, keď je jej v hlavičke viac (Excel v SK locale)", () => {
    expect(detectSeparator("email;meno;útvar")).toBe(";")
  })
  it("čiarka pri bežnom CSV", () => {
    expect(detectSeparator("email,meno,útvar")).toBe(",")
  })
  it("jediný stĺpec nespadne", () => {
    expect(detectSeparator("email")).toBe(",")
  })
})

describe("normalizácia hlavičiek", () => {
  it("zhodí diakritiku a veľké písmená", () => {
    expect(normalizeHeader("Útvar")).toBe("utvar")
  })
  it("zahodí medzery a podčiarkovníky", () => {
    expect(normalizeHeader("Dátum  nástupu")).toBe("datumnastupu")
    expect(normalizeHeader("company_code")).toBe("companycode")
  })
})

describe("rozobratie riadku", () => {
  it("pole v úvodzovkách smie obsahovať oddeľovač", () => {
    expect(parseLine('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"])
  })
  it("zdvojené úvodzovky sú jedny", () => {
    expect(parseLine('"a""b"', ",")).toEqual(['a"b'])
  })
  it("prázdne polia zostanú prázdne, nie zmiznú", () => {
    expect(parseLine("a,,c", ",")).toEqual(["a", "", "c"])
  })
})

describe("parseCsv", () => {
  it("zvládne BOM, bodkočiarku aj diakritiku naraz", () => {
    const text = "﻿E-mail;Meno;Útvar\r\njan@sfz.sk;Ján Novák;Legislatíva\r\n"
    const { rows, headers } = parseCsv(text)
    expect(headers).toEqual(["email", "meno", "utvar"])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ email: "jan@sfz.sk", meno: "Ján Novák", utvar: "Legislatíva" })
  })

  it("prázdne riadky na konci sa nepočítajú ako osoby", () => {
    expect(parseCsv("email\na@b.sk\n\n\n").rows).toHaveLength(1)
  })

  it("prázdny súbor nespadne", () => {
    expect(parseCsv("").rows).toEqual([])
  })

  it("chýbajúca bunka na konci riadku je prázdny reťazec, nie undefined", () => {
    const { rows } = parseCsv("email;meno;utvar\na@b.sk;Ján\n")
    expect(rows[0].utvar).toBe("")
  })
})

describe("toCsv", () => {
  const columns = [{ label: "Meno", value: (r: any) => r.meno }]

  it("začína BOM, aby Excel na Windows nezobrazil paškvil", () => {
    expect(toCsv([], columns).startsWith("﻿")).toBe(true)
  })

  it("hodnotu s oddeľovačom uzavrie do úvodzoviek", () => {
    expect(toCsv([{ meno: "Novák; Ján" }], columns)).toContain('"Novák; Ján"')
  })

  it("úvodzovky vo vnútri zdvojí", () => {
    expect(toCsv([{ meno: 'Ján "Jano"' }], columns)).toContain('"Ján ""Jano"""')
  })

  it("null a undefined sú prázdne, nie „null“", () => {
    expect(toCsv([{ meno: null }], columns)).not.toContain("null")
  })
})
