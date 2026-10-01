/**
 * Upozornenia k námietke podanej v aplikácii (ADR-012, D153).
 *
 * Do **zvončeka** všetkým s rolou `dpo` — aj tomu, kto námietku sám podal:
 * ako DPO o nej rozhoduje, takže upozornenie je pre jeho rolu, nie pre
 * jeho čin. Bez mena a znenia; veta len hovorí, že námietka čaká.
 *
 * **E-mail** ide všetkým s rolou `dpo` a na **kontaktnú adresu GDPR**
 * organizácie, každej adrese raz. Osoba dostane potvrdenie s dátumom
 * a znením. Zlyhanie e-mailu námietku nezruší — tá je už zapísaná a DPO ju
 * uvidí na `/dpo`; chyba ide do logu.
 */
import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, normalizeEmail, type Person } from "./persons"
import { DPO_ROLE } from "./dpo"
import { brandingView, type Tenant } from "./tenants"
import { send, objectionNoticeEmail, objectionReceiptEmail } from "./ecomail"
import { formatDate, normalizeLanguage, type UiLanguage } from "./i18n"
import { notifyPeople } from "./notifications"
import type { Objection } from "./objections"

/** Komu ide upozornenie: osoby s rolou `dpo` a kontakt GDPR, bez duplicít. */
export function objectionRecipients(
  dpos: Pick<Person, "email" | "language">[],
  contactEmail: string | null | undefined,
  defaultLanguage: UiLanguage,
): { email: string; language: UiLanguage }[] {
  const out = new Map<string, UiLanguage>()
  for (const p of dpos) out.set(normalizeEmail(p.email), normalizeLanguage(p.language ?? defaultLanguage))
  if (contactEmail && !out.has(normalizeEmail(contactEmail))) out.set(normalizeEmail(contactEmail), defaultLanguage)
  return [...out].map(([email, language]) => ({ email, language }))
}

export async function announceObjection(
  tenant: Tenant,
  objection: Objection,
  person: Pick<Person, "email" | "language">,
): Promise<void> {
  const host = tenant.hostnames[0]
  const branding = brandingView(tenant)
  const defaultLanguage = normalizeLanguage(tenant.defaultLanguage)
  const contactEmail = tenant.privacy?.contact?.email || null

  const dpos = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode: tenant.companyCode, roles: DPO_ROLE, status: { $ne: "inactive" } }, { projection: { id: 1, email: 1, language: 1 } })
    .toArray()

  // Zvonček nikdy nevyhodí výnimku (`notify`) — e-maily idú aj tak.
  await notifyPeople({ companyCode: tenant.companyCode, personIds: dpos.map(p => p.id), kind: "objectionSubmitted" })

  for (const r of objectionRecipients(dpos, contactEmail, defaultLanguage)) {
    try {
      await send({
        to: r.email,
        ...objectionNoticeEmail(
          `https://${host}/dpo#objections`, host, objection.personName,
          formatDate(objection.receivedAt, r.language), r.language, branding,
        ),
      })
    } catch (e) {
      console.error(`[objection] upozornenie na ${r.email} zlyhalo:`, e)
    }
  }

  const language = normalizeLanguage(person.language ?? defaultLanguage)
  try {
    await send({
      to: person.email,
      ...objectionReceiptEmail(
        host, formatDate(objection.receivedAt, language), objection.text, contactEmail, language, branding,
      ),
    })
  } catch (e) {
    console.error(`[objection] potvrdenie na ${person.email} zlyhalo:`, e)
  }
}
