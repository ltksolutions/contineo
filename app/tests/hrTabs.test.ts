/**
 * hrTabs.test.ts — podmenu sekcie Pridelené dokumenty
 * (ZAKLAD-podmenu-a-akcie, ZAKLAD-podmenu-tabview, 2. 10. 2026).
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

const hr = vi.hoisted(() => ({ on: true }))
vi.mock("@/lib/hr", () => ({ isHr: () => hr.on }))

import HrTabs from "../src/components/HrTabs"
import type { Person } from "../src/lib/persons"

const render = (current: string) =>
  renderToStaticMarkup(createElement(HrTabs, { current, person: {} as Person, language: "sk" }))

describe("HrTabs", () => {
  it("päť položiek v poradí, v kapsule", () => {
    const html = render("/hr")
    expect([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]))
      .toEqual(["/hr", "/hr/overview", "/hr/reminders", "/hr/tracks", "/hr/evidence"])
    expect(html).toMatch(/^<nav class="tabs" aria-label="Časti sekcie"><span class="tabs-bar">/)
  })

  it("vybraná je najdlhšia zhoda — na Výkaze nie aj Pridelenia", () => {
    const html = render("/hr/overview")
    expect(html.match(/is-active/g)).toHaveLength(1)
    expect(html).toMatch(/class="tab is-active"[^>]*href="\/hr\/overview"/)
  })

  it("správca obsahu bez roly personalistu podmenu nemá", () => {
    hr.on = false
    expect(render("/hr/tracks")).toBe("")
  })
})
