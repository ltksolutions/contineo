/**
 * mailbox/types.ts — schránka helpdesku cez adaptér (ADR-028, D162).
 *
 * Rovnaký princíp ako ADR-001: abstrakčnou hranicou je **naše vlastné
 * rozhranie**, nie drôtový formát Graphu ani IMAP-u. Volajúci (synchronizácia,
 * ťažba histórie, odoslanie odpovede) poznajú len tieto tri operácie a tvar
 * správy; ktorý adaptér za nimi stojí, rozhoduje nastavenie kanála.
 *
 * Adaptéry:
 *   • `graph` — Microsoft 365 cez Microsoft Graph (`graph.ts`), aplikačné
 *     oprávnenia zúžené na schránku kanála;
 *   • `imap`  — bežné služby; vznikne s prvým zákazníkom, ktorý ho má
 *     (rovnaký dôvod ako ADR-027 krok 2). Dnes len kľúč v číselníku.
 */

export type MailboxKind = "graph" | "imap"

/** Správa tak, ako ju vidí zvyšok aplikácie — bez HTML, bez obsahu príloh. */
export interface MailMessage {
  /** Identifikátor správy u poskytovateľa (Graph `id`, IMAP UID). */
  id: string
  /** `Message-ID` z hlavičky — stabilný naprieč poskytovateľmi; odkazuje sa naň ticket. */
  internetMessageId: string | null
  /** Vlákno (Graph `conversationId`; IMAP z `References`). */
  threadRef: string
  from: { address: string; name: string | null } | null
  to: { address: string; name: string | null }[]
  subject: string
  /** Čistý text (HTML → text). */
  text: string
  receivedAt: Date
  /** Odišla zo schránky kanála (odpoveď helpdesku), nie zvonku. */
  outgoing: boolean
  /** Len názov a veľkosť — obsah príloh sa neukladá (D163). */
  attachments: { name: string; bytes: number }[]
}

export interface MailboxPage {
  messages: MailMessage[]
  /** Značka pre ďalšie volanie; ukladá sa na kanáli. */
  cursor: string | null
  /** Sú ešte ďalšie stránky v tomto kole? */
  more: boolean
}

export interface MailboxAdapter {
  readonly kind: MailboxKind
  /** Adresa schránky, z ktorej sa čítajú a odosielajú správy. */
  readonly address: string
  /**
   * Nové a zmenené správy od značky. `cursor: null` začne odznova (prvé
   * spustenie alebo vypršaná značka) — ale len od `since`, nie od začiatku
   * schránky: 15 rokov histórie by inak prvé kolá prechádzali týždne
   * a všetko by zahodili (7. 10. 2026). Vracia stránku a novú značku.
   */
  listNew(cursor: string | null, since: Date): Promise<MailboxPage>
  /**
   * História na ťažbu FAQ (D165): posledných `limit` správ bez ohľadu na
   * značku, najnovšie prvé. Nič sa nikam neukladá.
   */
  listRecent(limit: number): Promise<MailMessage[]>
  /** Odpoveď vo vlákne z adresy schránky. Vracia `internetMessageId` odoslanej správy, ak ho poskytovateľ vráti. */
  reply(messageId: string, text: string): Promise<{ messageId: string | null }>
  /** Nová správa z adresy schránky — pre ticket z chatu, ktorý vlákno v schránke nemá (D163). */
  send(to: string, subject: string, text: string): Promise<{ messageId: string | null }>
  /** Overenie spojenia: prihlásenie a čítanie schránky. Vyhadzuje `MailboxError`. */
  verify(): Promise<{ address: string; displayName: string | null }>
}

/** HTML → čistý text. Zámerne jednoduché: hľadáme otázky a odpovede, nie vernú kópiu. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(style|script)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .split("\n").map(l => l.replace(/[ \t]{2,}/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Odstrihne citovanú históriu z odpovede („Od: … Odoslané: …", „On … wrote:",
 * riadky s `>`), aby jedna správa niesla len to, čo v nej človek napísal.
 */
export function stripQuotedHistory(text: string): string {
  return splitQuotedHistory(text).text
}

/**
 * Rozdelí e-mail na nový text a citovanú históriu (od „Od:/From:",
 * „Pôvodná správa", „On … wrote:" nižšie, plus riadky s `>`). História sa
 * nezahadzuje: pri odpovedi na korešpondenciu spred prvej synchronizácie
 * je v nej celá otázka — 7. 10. 2026 ticket ukázal len „Nech sa páči: <adresa>"
 * a o čo ide, bolo len v citácii.
 */
export function splitQuotedHistory(text: string): { text: string; quoted: string } {
  const lines = text.split("\n")
  const cut = lines.findIndex(l =>
    /^\s*(-{2,}\s*)?(Od|From|Von|De):\s.+/i.test(l)
    || /^\s*-{3,}\s*(Pôvodná správa|Original Message|Původní zpráva)\s*-{3,}/i.test(l)
    || /^\s*(On|Dňa|Dne) .+ (wrote|napísal\(a\)|napísal|napsal\(a\)|napsal):\s*$/i.test(l),
  )
  const head = cut >= 0 ? lines.slice(0, cut) : lines
  const isQuote = (l: string) => /^\s*>/.test(l)
  const tidy = (xs: string[]) => xs.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  return {
    text: tidy(head.filter(l => !isQuote(l))),
    quoted: tidy([...head.filter(isQuote), ...(cut >= 0 ? lines.slice(cut) : [])]),
  }
}
