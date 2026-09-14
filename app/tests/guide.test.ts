/**
 * guide.test.ts — Návod nesmie odkazovať inam, než kam sa dá kliknúť.
 *
 * Návod je jediný text v systéme, ktorý hovorí „kliknite sem". Keď sa
 * obrazovka premenuje alebo presunie, odkaz v ňom stíchne — a mlčky: nikto
 * nedostane chybu, len prázdnu stránku. Preto sa cesty v texte porovnávajú
 * so **skutočným adresárom** `src/app`, nie so zoznamom, ktorý by sa musel
 * udržiavať vedľa toho prvého.
 */

import { describe, it, expect } from "vitest"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { GUIDE_SK } from "../src/content/guide"
import { toBlocks } from "../src/lib/formatText"

/** Segmenty prvej úrovne v `src/app` — teda to, čo môže stáť za prvým `/`. */
const routes = new Set(
  readdirSync(join(import.meta.dirname, "..", "src", "app"), { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith("_"))
    .map(e => e.name)
)

/** Odkazy v texte — cez ten istý rozklad, ktorý ich aj vykreslí. */
function links(text: string): string[] {
  const found: string[] = []
  for (const b of toBlocks(text)) {
    const segments = b.druh === "zoznam" ? b.items.flat() : b.segments
    for (const u of segments) if (u.druh === "odkaz") found.push(u.href)
  }
  return found
}

describe("Návod", () => {
  it("má text", () => {
    expect(GUIDE_SK.length).toBeGreaterThan(1000)
  })

  it("má všetky štyri sekcie, ktoré sľubuje", () => {
    const headings = toBlocks(GUIDE_SK)
      .filter(b => b.druh === "nadpis")
      .map(b => b.segments.map(u => u.text).join(""))
    expect(headings.length).toBe(4)
  })

  it("odkazuje aspoň na jednu obrazovku", () => {
    expect(links(GUIDE_SK).length).toBeGreaterThan(0)
  })

  it("každý odkaz vedie na existujúcu obrazovku", () => {
    for (const href of links(GUIDE_SK)) {
      // Parameter (`?tab=…`) sa odreže — o záložkách rozhoduje stránka sama.
      const first = href.split(/[?#]/)[0].split("/").filter(Boolean)[0]
      // Prázdne = odkaz na domovskú stránku, tá existuje vždy.
      if (!first) continue
      expect({ href, existuje: routes.has(first) }).toEqual({ href, existuje: true })
    }
  })

  it("neodkazuje von z aplikácie", () => {
    // Poistka je vo vzore v `formatText.ts`; tu sa kontroluje, že sa o ňu
    // nikto nepokúsil oprieť inak — napríklad `[text](https://…)`, ktoré by
    // sa v Návode vykreslilo ako obyčajný text a čitateľ by nevedel prečo.
    expect(GUIDE_SK).not.toMatch(/\]\((?!\/[^/])/)
  })
})
