/**
 * prepisLlm.ts — model ako **druhý krok, ktorý vyvolá človek** (D53).
 *
 * Prevod v aplikácii je prvý a je doslovný. Model sa volá len vtedy, keď sa
 * naň človek v editore pozrie a klikne — a jeho výsledok sa **nikdy neuloží
 * priamo**: uloží sa ako *návrh* vedľa konceptu, aby bolo čo porovnať.
 *
 * Prečo tak opatrne: norma je text, podľa ktorého ľudia konajú a ktorý
 * potvrdzujú. Model vie potichu preštylizovať vetu, zjednotiť „môže" a „musí"
 * alebo domyslieť chýbajúce slovo — a nikto si toho nemusí všimnúť, lebo
 * výsledok vyzerá lepšie než vstup. Tichý ústup na model po zlyhaní prevodu
 * je preto vylúčený.
 *
 * Dva režimy, obidva s tým istým zákazom v pokyne:
 *
 *  - **prečistenie** — na vstupe je náš Markdown, model má opraviť členenie
 *    a rozsypané riadky, nie znenie;
 *  - **prepis skenu** — na vstupe je PDF bez textovej vrstvy a model má
 *    prepísať, čo na stranách vidí.
 */

import Anthropic from "@anthropic-ai/sdk"
import { AppError } from "./appError"

/** Strop na jeden prepis. Dlhšia norma sa robí po častiach v editore. */
export const MAX_CHARS = 120_000

/** Skenované PDF sa posiela celé — nad týmto to nemá zmysel skúšať. */
export const MAX_PDF_BYTES = 24 * 1024 * 1024

export type RewriteMode = "clean" | "rewrite-scan"

export interface ModelDraft {
  text: string
  model: string
  mode: RewriteMode
  at: Date
}

export class RewriteError extends AppError {}

const INSTRUCTION = `Si prepisovač právnych a interných predpisov do Markdownu.

ZÁKAZ, ktorý je dôležitejší než výsledok:
- Neprepisuj, nepreštylizuj a neskracuj znenie. Ani jedno slovo.
- Nedopĺňaj, čo v texte nie je — ani vtedy, keď je zjavné, čo tam malo byť.
- Neopravuj gramatiku ani interpunkciu pôvodného textu.
- Nepridávaj úvod, zhrnutie ani vlastné poznámky.

ČO MÁŠ ROBIŤ:
- Obnov členenie: nadpisy (# ## ###), odseky, číslované a odrážkové zoznamy, tabuľky.
- Spoj riadky, ktoré patria do jednej vety a rozdelilo ich zalomenie strany.
- Odstráň hlavičky, päty a čísla strán, ktoré sa opakujú.
- Zachovaj číslovanie článkov a odsekov presne tak, ako je v pôvodine.

Odpovedz LEN samotným Markdownom, bez akéhokoľvek komentára pred ním či za ním.`

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new RewriteError(
      "rewrite.notConfigured",
      "Prepis modelom nie je nastavený — chýba ANTHROPIC_API_KEY. Prevod v aplikácii funguje ďalej.",
    )
  }
  return new Anthropic({ apiKey: key })
}

function model(): string {
  return process.env.CMS_PREPIS_MODEL ?? "claude-sonnet-4-5"
}

/** Zloží odpoveď z textových blokov a odreže obal ```markdown, keď ho pridá. */
function answerText(blocks: { type: string; text?: string }[]): string {
  const text = blocks
    .filter(b => b.type === "text" && typeof b.text === "string")
    .map(b => b.text as string)
    .join("")
    .trim()

  const wrapper = /^```(?:markdown|md)?\n([\s\S]*)\n```$/
  return (wrapper.exec(text)?.[1] ?? text).trim()
}

/** Prečistí členenie už prevedeného Markdownu. */
export async function cleanMarkdown(markdown: string): Promise<ModelDraft> {
  const input = (markdown ?? "").trim()
  if (!input) throw new RewriteError("rewrite.emptyInput", "Niet čo prečisťovať — text je prázdny.")
  if (input.length > MAX_CHARS) {
    throw new RewriteError(
      "rewrite.textTooLong",
      `Text má ${Math.round(input.length / 1000)} tisíc znakov, naraz sa dá poslať ${MAX_CHARS / 1000}. ` +
      "Rozdeľ ho a prečisti po častiach.",
      { thousands: Math.round(input.length / 1000), maxThousands: MAX_CHARS / 1000 },
    )
  }

  const answer = await client().messages.create({
    model: model(),
    max_tokens: 32_000,
    system: INSTRUCTION,
    messages: [{
      role: "user",
      content: [{ type: "text", text: `Uprav členenie tohto textu:\n\n${input}` }],
    }],
  })

  const text = answerText(answer.content as { type: string; text?: string }[])
  if (!text) throw new RewriteError("rewrite.emptyAnswer", "Model vrátil prázdnu odpoveď.")
  return { text, model: model(), mode: "clean", at: new Date() }
}

/** Prepíše skenované PDF, ktoré nemá textovú vrstvu. */
export async function rewritePdf(pdf: Buffer): Promise<ModelDraft> {
  if (!pdf?.byteLength) throw new RewriteError("rewrite.emptyFile", "Súbor je prázdny.")
  if (pdf.byteLength > MAX_PDF_BYTES) {
    throw new RewriteError(
      "rewrite.pdfTooLarge",
      `PDF má ${Math.round(pdf.byteLength / 1024 / 1024)} MB, naraz sa dá poslať ${MAX_PDF_BYTES / 1024 / 1024}. ` +
      "Rozdeľ ho na časti.",
      { mb: Math.round(pdf.byteLength / 1024 / 1024), maxMb: MAX_PDF_BYTES / 1024 / 1024 },
    )
  }

  const answer = await client().messages.create({
    model: model(),
    max_tokens: 32_000,
    system: INSTRUCTION,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
        },
        {
          type: "text",
          text: "Prepíš obsah tohto dokumentu do Markdownu. Je to sken — prepíš presne to, čo na stranách vidíš.",
        },
      ],
    }],
  })

  const text = answerText(answer.content as { type: string; text?: string }[])
  if (!text) throw new RewriteError("rewrite.modelReadNothing", "Model z dokumentu nič neprečítal.")
  return { text, model: model(), mode: "rewrite-scan", at: new Date() }
}
