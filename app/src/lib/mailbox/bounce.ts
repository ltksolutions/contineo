/**
 * bounce.ts — rozpozná správu o nedoručení (Ján 8. 10. 2026).
 *
 * Návrat od poštového servera („Undelivered Mail Returned to Sender",
 * „Nedoručiteľné: …") nie je otázka človeka a ticket z neho nemá vznikať.
 * Graph nečítame s hlavičkami (`Auto-Submitted`, `multipart/report`),
 * preto sa rozhoduje podľa odosielateľa a predmetu — oboje je pri
 * návratoch ustálené: `mailer-daemon`, `postmaster`, `MicrosoftExchange…`
 * a predpony, ktoré pridáva server alebo Outlook v jazyku schránky.
 * Odchádzajúca správa (odpoveď helpdesku) návratom nikdy nie je.
 */

import type { MailMessage } from "./types"

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-delivery-subsystem|microsoftexchange[0-9a-f]{20,})@/i

const BOUNCE_SUBJECT = new RegExp(
  "^(" + [
    "undeliver(ed|able)",
    "delivery status notification",
    "delivery (has )?failed",
    "mail delivery (failed|failure|system)",
    "returned mail",
    "failure notice",
    "nedoručiteľné",
    "nedoručitelné",
    "nedoručená správa",
    "nedoručená zpráva",
  ].join("|") + ")",
  "i",
)

export function isBounce(m: Pick<MailMessage, "from" | "subject" | "outgoing">): boolean {
  if (m.outgoing) return false
  const from = m.from?.address ?? ""
  return BOUNCE_SENDER.test(from) || BOUNCE_SUBJECT.test(m.subject.trim())
}
