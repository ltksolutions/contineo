/**
 * mailbox/forward.ts — e-mail, ktorý kolega preposlal na helpdesk.
 *
 * Kolega zo SFZ prepošle otázku klubu na helpdesk („Fwd: …"). Odosielateľom
 * je potom kolega a odpoveď z Continea by išla jemu, nie tomu, kto sa pýtal
 * (Ján 30. 10. 2026: 7 takých ticketov). Pýtajúcim sa preto stáva pôvodný
 * odosielateľ z hlavičky preposlanej správy.
 *
 * Zámerne úzko: len preposlanie (predmet), len od adresy z domény schránky
 * a len pôvodný odosielateľ **mimo** nej. Človek zvonku, ktorý prepošle
 * systémový e-mail ISSF, ostáva pýtajúcim sa sám — pýta sa on, nie issf@.
 */

import type { MailMessage } from "./types"

/** Predpony preposlania: Outlook, Gmail, Apple Mail, nemecký a francúzsky Outlook. */
const FORWARD_SUBJECT = /^\s*(fwd?|fw|wg|tr|pd|přep)\s*:/i
/** Riadok odosielateľa v hlavičke preposlanej správy. */
const FROM_LINE = /^\s*\**\s*(Od|From|Von|De)\s*:\**\s*(.+)$/i
const ADDRESS = /[^\s<>"'()[\]:]+@[^\s<>"'()[\]:]+\.[a-z]{2,}/i

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1).toLowerCase()

/**
 * Pôvodný odosielateľ preposlaného e-mailu, alebo `null`, ak správa nie je
 * preposlanie kolegom. `mailbox` je adresa schránky kanála — jej doména
 * určuje, kto je kolega.
 */
export function forwardedSender(m: MailMessage, mailbox: string): { address: string; name: string | null } | null {
  if (!m.from || m.outgoing || !FORWARD_SUBJECT.test(m.subject)) return null
  const own = domainOf(mailbox)
  if (domainOf(m.from.address) !== own) return null
  // Prvá hlavička „Od:" je preposlaná správa; ďalšie sú staršia história vlákna.
  for (const line of m.text.split("\n")) {
    const hit = FROM_LINE.exec(line)
    if (!hit) continue
    const address = ADDRESS.exec(hit[2])?.[0].toLowerCase()
    if (!address || domainOf(address) === own) return null
    // „Meno <adresa>", „Meno [mailto:adresa]", „<adresa<mailto:adresa>>" (Outlook do textu).
    const name = hit[2].split(/[<[]/)[0].replace(/["']/g, "").trim()
    return { address, name: name && !ADDRESS.test(name) ? name : null }
  }
  return null
}
