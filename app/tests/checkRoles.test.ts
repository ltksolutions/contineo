/**
 * checkRoles.test.ts — `scripts/check.mjs` má vlastnú kópiu známych rolí
 * (beží bez TypeScriptu). Bez tohto testu sa nová rola dopísala len do
 * `ASSIGNABLE_ROLES` a kontrola ju potom hlásila ako neznámu — `dpo`,
 * `learning-admin` a `helpdesk` (11. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ASSIGNABLE_ROLES } from "../src/lib/people"
import { PLATFORM_ROLE } from "../src/lib/admin"

describe("npm run check pozná všetky roly z kódu", () => {
  it("ZNAME_ROLE v check.mjs = ASSIGNABLE_ROLES + PLATFORM_ROLE", () => {
    const src = readFileSync(join(__dirname, "../scripts/check.mjs"), "utf8")
    const m = src.match(/const ZNAME_ROLE = new Set\(\[([^\]]*)\]\)/)
    expect(m, "ZNAME_ROLE sa v check.mjs nenašiel").toBeTruthy()
    const inScript = [...m![1].matchAll(/"([^"]+)"/g)].map(x => x[1]).sort()
    expect(inScript).toEqual([...ASSIGNABLE_ROLES, PLATFORM_ROLE].sort())
  })
})
