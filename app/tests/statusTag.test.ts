/**
 * statusTag.test.ts — farba pilulky stavu (KNIZNICA.md, úloha 1).
 *
 * Jedno pravidlo, ktoré sa pokazí ticho: neznámy stav nesmie dostať cudziu
 * farbu — farba nesie význam a hodnota, ktorú nepoznáme, si žiadny
 * nezaslúžila.
 */
import { describe, it, expect } from "vitest"
import { statusTagClass } from "../src/lib/libraryRead"

describe("farba pilulky stavu", () => {
  it("známe stavy majú svoju farbu", () => {
    expect(statusTagClass("published")).toBe("tag tag--published")
    expect(statusTagClass("in-review")).toBe("tag tag--review")
    expect(statusTagClass("draft")).toBe("tag tag--draft")
    expect(statusTagClass("expired")).toBe("tag tag--expired")
    expect(statusTagClass("archived")).toBe("tag tag--archived")
  })

  it("neznámy stav spadne na tichú sivú", () => {
    expect(statusTagClass("čokoľvek")).toBe("tag")
    expect(statusTagClass("")).toBe("tag")
  })
})
