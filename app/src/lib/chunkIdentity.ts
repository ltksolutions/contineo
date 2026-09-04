/**
 * chunkovanie.ts — identita textu a identita členenia (D57).
 *
 * ## Prečo to bolo treba rozdeliť
 *
 * `versionId` sa dovtedy počítal **z výsledných chunkov**. Malo to dobrý
 * dôvod: keď sa opravil chunker, obsah súborov sa nezmenil, import všetko
 * preskočil a v databáze zostalo staré zlé členenie. Hash z chunkov to
 * vyriešil.
 *
 * Lenže na `versionId` sa viažu **potvrdenia** a `trackProgress()` počíta
 * „hotovo" ako *je táto verzia potvrdená*. Takže vyladenie chunkera by
 * stovke ľudí ukázalo, že normu nemajú potvrdenú — ich staré potvrdenia by
 * ukazovali na verziu, ktorá už neplatí, a nikto by to nespojil so zmenou
 * členenia. Tichá škoda presne toho druhu, ktorá sa hľadá mesiace.
 *
 * Príčinou bolo, že jedno číslo nieslo dve rôzne veci:
 *
 *   - **text normy** je právny artefakt — ľudia ho potvrdzujú, mení sa novelou;
 *   - **členenie na úseky** je technický artefakt vyhľadávania — mení sa vtedy,
 *     keď zlepšíme algoritmus, a s obsahom normy nemá nič spoločné.
 *
 * ## Ako to je teraz
 *
 * | | z čoho sa počíta | čo sa naň viaže |
 * |---|---|---|
 * | `versionId` | **len text znenia** | potvrdenia, pridelenia, trasy |
 * | `chunkingId` | verzia chunkera + profil + výsledné úseky | `document_chunks` |
 *
 * **Označenie, dátum platnosti ani citácia do `versionId` nevstupujú.** Je to
 * zámer: preklep v označení sa musí dať opraviť bez toho, aby sa rozbili
 * potvrdenia. Sú to údaje *o* verzii, nie jej identita.
 *
 * Preindexovanie tak vymení úseky pri tom istom `versionId` a `versions[]` sa
 * ani nedotkne. A keďže `chunkingId` nesie aj profil a verziu chunkera, stále
 * platí to, čo pôvodné riešenie zabezpečovalo: po zmene členenia je vidieť,
 * že sa preindexovať treba.
 */

import { createHash } from "node:crypto"
import type { Chunk } from "./chunker.mjs"

/**
 * Verzia chunkovacieho algoritmu.
 *
 * **Zvyšuje ju človek**, keď zmení `chunker.mjs` tak, že to zmení výsledok.
 * Odvodiť sa to nedá — hash zdrojáku by sa menil aj po oprave komentára
 * a preindexoval by celý systém pre nič.
 */
export const CHUNKER_VERSION = 1

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16)

/**
 * Odtlačok **textu** znenia. Nič iné doň nevstupuje.
 *
 * Normalizuje sa len to, čo je neviditeľné: konce riadkov a biele miesta na
 * koncoch. Inak by ten istý text uložený z Windows a z Macu vyzeral ako dve
 * rôzne znenia — a tým aj ako dve rôzne povinnosti.
 */
export function textFingerprint(markdown: string): string {
  const normalized = (markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim()
  return hash(normalized)
}

/**
 * Odtlačok **členenia**: čím sa rezalo a čo z toho vyšlo.
 *
 * Hashuje sa presne to, čo sa zapíše do `document_chunks` — rovnaká zásada
 * ako predtým pri `versionId`, a z rovnakého dôvodu: dvakrát nás doplatilo,
 * že sa hashovalo niečo iné, než sa ukladá, a zmena sa neprejavila.
 */
export function chunkingFingerprint(
  chunks: Pick<Chunk, "chunkIndex" | "text" | "heading" | "articleRef" | "typ">[],
  profile: unknown,
): string {
  return hash(JSON.stringify({
    verzia: CHUNKER_VERSION,
    profil: profile,
    chunky: chunks.map(ch => ({
      i: ch.chunkIndex,
      t: ch.text,
      h: ch.heading,
      a: ch.articleRef ?? null,
      typ: ch.typ ?? "clanok",
    })),
  }))
}

/**
 * Treba dokument preindexovať?
 *
 * `true` aj vtedy, keď `chunkingId` chýba — tak vyzerajú dokumenty spred
 * zavedenia rozdelenia a preindexovať ich treba práve preto.
 */
export function needsReindex(
  stored: string | null | undefined,
  current: string,
): boolean {
  return !stored || stored !== current
}
