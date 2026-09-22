/**
 * clientLabels.test.ts — do klientskeho komponentu nesmie ísť funkcia.
 *
 * ## Prečo tento test existuje
 *
 * `/library/new` je serverový komponent a posielal `KeyPreview`
 * (ten je `"use client"`) objekt `labels` s položkou `taken: t.keyTaken`.
 * `keyTaken` bol v `i18n.ts` **funkcia** `(id) => string`. Funkcia cez
 * hranicu server → klient neprejde: React ju odmietne serializovať a spadne
 * **celá stránka**, nie len tá jedna hláška.
 *
 * V produkcii to tak aj dopadlo — `digest 2684807689`, od 21. 9. 2026,
 * stránka nahrávania dokumentu vracala „A server error occurred".
 *
 * ## Prečo to nechytil TypeScript
 *
 * Z jeho pohľadu bolo všetko v poriadku: typ prop-u aj typ hodnoty sedeli.
 * Chyba vzniká až za behu, pri serializácii cez hranicu — a tú typový systém
 * nepozná. Preto to musí strážiť test, nie `tsc`.
 *
 * ## Čo test kontroluje
 *
 * Pravidlo, nie dva konkrétne prípady: **žiadny klientsky komponent nesmie
 * mať prop, ktorý vracia `string`.** Formátovacia funkcia je presne ten tvar,
 * ktorý sa do `labels` dostane zo slovníka. Obsluha udalosti sa tým nezasiahne
 * — tá vracia `void`, nie `string`.
 *
 * Keď test spadne: nerob z prop-u funkciu. Pošli **šablónu** so zástupným
 * znakom (`"… {id} …"`) a dosaď ju v klientovi cez `.replace()`.
 */

import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const KORENE = ["src/components", "src/app"]

function tsxSubory(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const cesta = join(dir, e.name)
    if (e.isDirectory()) return tsxSubory(cesta)
    return e.isFile() && e.name.endsWith(".tsx") ? [cesta] : []
  })
}

describe("klientske komponenty", () => {
  it("nemajú prop, ktorý vracia string — taký sa cez hranicu neprenesie", () => {
    const zle: string[] = []

    for (const koren of KORENE) {
      for (const subor of tsxSubory(koren)) {
        const zdroj = readFileSync(subor, "utf8")
        // `"use client"` musí byť na začiatku súboru, inak to nie je direktíva.
        if (!/^\s*["']use client["']/.test(zdroj)) continue

        zdroj.split("\n").forEach((riadok, i) => {
          // `=> string` v deklarácii typu. Obsluhy udalostí vracajú `void`
          // a komentáre (`*`, `//`) hovoria o pravidle, nie ho porušujú.
          const orezany = riadok.trim()
          if (orezany.startsWith("*") || orezany.startsWith("//")) return
          if (/=>\s*string\b/.test(riadok)) zle.push(`${subor}:${i + 1}  ${orezany}`)
        })
      }
    }

    expect(zle, `Pošli šablónu so zástupným znakom, nie funkciu:\n${zle.join("\n")}`).toEqual([])
  })
})
