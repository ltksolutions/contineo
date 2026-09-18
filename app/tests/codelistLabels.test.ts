/**
 * codelistLabels.test.ts — každý vlastný číselník má popisky vo všetkých jazykoch.
 *
 * `t.org.codelists.labels` je `Record<string, …>`, takže typová kontrola mlčí,
 * keď k `CUSTOM_CODELISTS` pribudne druh bez popisku — a obrazovka
 * `/organisation?tab=codelists` potom padá na `labels[name].name`.
 * Presne to sa stalo s `workplace` (pribudol s D85): stránka vracala 500
 * a zhodila celé nastavenie číselníkov. Tento test to chytí pri builde,
 * nie u zákazníka.
 */
import { describe, it, expect } from "vitest"
import { CUSTOM_CODELISTS } from "../src/lib/codelists"
import { dictionary, UI_LANGUAGES } from "../src/lib/i18n"

describe("popisky vlastných číselníkov", () => {
  for (const language of UI_LANGUAGES) {
    it(`jazyk ${language} má názov a nápovedu pre každý číselník`, () => {
      const labels = dictionary(language).org.codelists.labels
      for (const name of CUSTOM_CODELISTS) {
        expect(labels[name], `chýba popisok pre "${name}"`).toBeDefined()
        expect(labels[name].name).toBeTruthy()
        expect(labels[name].hint).toBeTruthy()
      }
    })
  }
})
