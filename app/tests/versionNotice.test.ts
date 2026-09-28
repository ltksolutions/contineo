/**
 * versionNotice.test.ts — /api/version vracia revíziu, ktorá beží; hláška
 * sa bez revízie (lokálny beh) nezobrazí a v troch jazykoch má text.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { GET } from "../src/app/api/version/route"
import VersionNotice from "../src/components/VersionNotice"
import { dictionary } from "../src/lib/i18n"

describe("verzia", () => {
  it("/api/version: revízia a bez cache", async () => {
    const r = GET()
    expect(r.headers.get("Cache-Control")).toBe("no-store")
    expect(await r.json()).toHaveProperty("revision")
  })
  it("hláška sa na začiatku nekreslí; texty v troch jazykoch", () => {
    expect(renderToStaticMarkup(createElement(VersionNotice, { text: "x", reload: "y" }))).toBe("")
    for (const l of ["sk", "cs", "en"] as const) expect(dictionary(l).versionNotice.reload).toBeTruthy()
  })
})
