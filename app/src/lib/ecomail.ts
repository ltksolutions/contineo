/**
 * ecomail.ts — odosielanie prihlasovacích e-mailov.
 *
 * Ecomail je česká služba, takže z hľadiska ADR-002 ide o spracovanie
 * v EÚ. Nejde tadiaľ obsah noriem ani otázky — len e-mailová adresa
 * hodnotiteľa a jednorazový odkaz.
 *
 * Rozhranie: POST https://api2.ecomailapp.cz/transactional/send-message
 * s hlavičkou `key`. Vyžaduje platený účet a overenú odosielaciu doménu.
 */

import { dictionary } from "./i18n"
import type { UiLanguage } from "./i18n"

const API = "https://api2.ecomailapp.cz/transactional/send-message"

export interface Message {
  to: string
  subject: string
  text: string
  html: string
}

export class EcomailError extends Error {}

export function config() {
  return {
    key: process.env.ECOMAIL_API_KEY,
    sender: process.env.EMAIL_ODOSIELATEL,
    senderName: process.env.EMAIL_MENO_ODOSIELATELA ?? "Contineo",
  }
}

/**
 * Pošle jeden e-mail.
 *
 * Vyhadzuje výnimku, keď sa nepodarí. Tiché zlyhanie by znamenalo, že
 * hodnotiteľ čaká na odkaz, ktorý nikdy nepríde, a nikto sa to nedozvie.
 */
export async function send(s: Message): Promise<void> {
  const { key, sender, senderName } = config()

  if (!key || !sender) {
    throw new EcomailError(
      "Chýba ECOMAIL_API_KEY alebo EMAIL_ODOSIELATEL — e-mail sa neodoslal."
    )
  }

  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", key: key },
    body: JSON.stringify({
      message: {
        subject: s.subject,
        from_name: senderName,
        from_email: sender,
        reply_to: sender,
        text: s.text,
        html: s.html,
        to: [{ email: s.to }],
        // Sledovanie otvorení a preklikov pri prihlasovacom odkaze
        // vypíname zámerne. Preklikový proxy odkaz by navyše mohol odkaz
        // „spotrebovať" skôr než človek — antivírusy a náhľady v poštových
        // klientoch odkazy bežne otvárajú.
        options: { click_tracking: false, open_tracking: false },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new EcomailError(`Ecomail ${response.status}: ${detail.slice(0, 300)}`)
  }

  // Ecomail vracia 200 aj vtedy, keď adresáta odmietol — treba pozrieť telo.
  const result = await response.json().catch(() => null)
  const rejected = result?.results?.total_rejected_recipients
  if (typeof rejected === "number" && rejected > 0) {
    throw new EcomailError(`Ecomail odmietol adresáta: ${s.to}`)
  }
}

/**
 * Text prihlasovacieho e-mailu. Vytiahnuté zvlášť, aby sa dal otestovať.
 *
 * Jazyk je jazyk **prostredia** osoby (`persons.language`) — je to prvá vec,
 * ktorú človek uvidí, ešte pred prihlásením. Keď osobu nepoznáme, platí
 * slovenčina; zlý jazyk je nepríjemnosť, neodoslaný e-mail sú zavreté dvere.
 */
export interface SignInBranding {
  displayName: string
  /** **Absolútna** adresa. V e-maile relatívna cesta nemá k čomu byť relatívna. */
  logoUrl?: string
  accentColor?: string
}

export function signInEmail(
  link: string,
  host: string,
  language: UiLanguage = "sk",
  branding?: SignInBranding
): Omit<Message, "to"> {
  const s = dictionary(language).email

  // Bez tenanta zostáva značka dodávateľa — je to stále lepšie než prázdna
  // hlavička. S tenantom sa e-mail tvári ako správa od organizácie.
  const organisation = branding?.displayName ?? "Contineo"
  const accent = branding?.accentColor ?? "#232a35"

  // Obrázky v e-mailoch sú štandardne blokované, takže logo nesmie niesť
  // informáciu — názov organizácie je vedľa neho ako text a `alt` je prázdny,
  // aby sa pri zablokovanom obrázku nezobrazil dvakrát.
  const logo = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" width="34" height="34" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0">`
    : ""

  const text = [
    s.heading(organisation),
    "",
    s.intro,
    link,
    "",
    s.validity,
  ].join("\n")

  const html = `<!doctype html>
<html lang="${language}"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(20,28,42,.12);border-radius:12px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">${logo}<span style="vertical-align:middle">${organisation}</span></div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:22px">${s.subtitle}</div>
    <p style="font-size:15.5px;line-height:1.65;margin:0 0 22px">
      ${s.intro}
    </p>
    <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600">
      ${s.button}
    </a>
    <p style="font-size:13px;line-height:1.6;color:#5c6675;margin:22px 0 0">
      ${s.validity}
    </p>
    <p style="font-size:12px;color:#5c6675;margin:18px 0 0;word-break:break-all">
      ${s.fallbackNote}<br>${link}
    </p>
    <hr style="border:none;border-top:1px solid rgba(20,28,42,.12);margin:22px 0 14px">
    <div style="font-size:12px;color:#5c6675">${host} · LTK Solutions</div>
  </div>
</body></html>`

  return { subject: s.subject(organisation), text, html }
}
