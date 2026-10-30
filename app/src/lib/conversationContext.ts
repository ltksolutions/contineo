/**
 * Predchádzajúce kolá rozhovoru vo widgete (Ján 30. 10. 2026: na
 * „Nesprávna odpoveď na predchádzajúcu otázku" model odpovedal naslepo,
 * lebo dostal len poslednú otázku).
 *
 * Kolá posiela prehliadač — sú to len údaje toho istého človeka o jeho
 * vlastnom rozhovore, nič, čo by mu dalo viac, než smie vidieť. Strop na
 * počet a dĺžku drží cenu a čas po prvý token; vlastné „odpovede" podstrčiť
 * vie, ale ovplyvní len odpoveď sebe.
 *
 * Na hľadanie idú len otázky (prepis na samostatnú otázku), do odpovede
 * otázky aj odpovede — model musí vedieť, na čo človek reaguje. Fakty
 * a citácie však len z dokumentov nájdených teraz: stará odpoveď mohla
 * byť práve tá chybná, na ktorú sa človek sťažuje.
 */

export interface PriorTurn {
  question: string
  answer: string
}

export const MAX_PRIOR_TURNS = 3
const MAX_QUESTION = 1000
const MAX_ANSWER = 2000

/** Overí a oreže kolá z požiadavky. Čokoľvek iné než text sa zahodí. */
export function parseHistory(raw: unknown): PriorTurn[] {
  if (!Array.isArray(raw)) return []
  const turns: PriorTurn[] = []
  for (const t of raw) {
    if (!t || typeof t !== "object") continue
    const { question, answer } = t as Record<string, unknown>
    if (typeof question !== "string" || !question.trim()) continue
    turns.push({
      question: question.trim().slice(0, MAX_QUESTION),
      answer: typeof answer === "string" ? answer.trim().slice(0, MAX_ANSWER) : "",
    })
  }
  return turns.slice(-MAX_PRIOR_TURNS)
}

/**
 * Záloha za prepis modelom (krátka otázka, vypnutý alebo pomalý prepis):
 * posledná predchádzajúca otázka pred novou — „a pre mládež?" samo osebe
 * nenájde nič.
 */
export function contextualQuery(query: string, history: PriorTurn[]): string {
  const last = history[history.length - 1]
  return last ? `${last.question} ${query}` : query
}

/** Predchádzajúce otázky do promptu prepisu, jedna na riadok. */
export function priorQuestions(history: PriorTurn[]): string {
  return history.map(t => `- ${t.question}`).join("\n")
}

/**
 * Text otázky pre model — rovnaký pre všetky adaptéry. Bez histórie
 * presne to, čo adaptéry posielali doteraz.
 */
export function questionText(query: string, history: PriorTurn[] = []): string {
  if (!history.length) return `Otázka: ${query}`
  const turns = history
    .map(t => `Otázka: ${t.question}` + (t.answer ? `\nOdpoveď: ${t.answer}` : ""))
    .join("\n\n")
  return (
    "Predchádzajúce kolá tohto rozhovoru — len na pochopenie, na čo otázka nadväzuje. " +
    "Nie sú zdrojom: fakty a citácie ber výlučne z dokumentov vyššie, aj keď im predchádzajúca odpoveď odporuje.\n\n" +
    `${turns}\n\n---\n\nOtázka: ${query}`
  )
}
