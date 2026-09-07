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

/**
 * Text do HTML e-mailu.
 *
 * Názov dokumentu aj dôvod píše človek a môžu obsahovať `&`, `<` alebo
 * úvodzovky — bez ošetrenia by sa e-mail rozsypal. Nie je to obrana proti
 * útoku (píše to personalista vlastnej organizácie), je to obrana proti
 * ampersandu v názve normy.
 */
function escapujHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export interface Message {
  to: string
  subject: string
  text: string
  html: string
}

export class EcomailError extends Error {}

/**
 * Prvá neprázdna premenná z prostredia.
 *
 * **Prázdny reťazec nie je hodnota.** `process.env.X ?? "predvoľba"` na neho
 * nesiahne, lebo `??` chytá len `undefined` a `null` — a `vercel env pull`
 * zapisuje nenastavené premenné práve ako `X=`. Predvoľba by sa tak potichu
 * prebila prázdnom a prejavilo by sa to až za behu.
 */
function env(...names: string[]): string | undefined {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim()
    if (value) return value
  }
  return undefined
}

/**
 * Premenné pre odosielateľa sa **preložili, nie premenovali**: kód číta
 * najprv anglickú, a keď nie je, starú slovenskú. Bez toho by nasadenie
 * spadlo v okamihu medzi zmenou kódu a zmenou premennej vo Verceli.
 */
export function config() {
  return {
    key: env("ECOMAIL_API_KEY"),
    sender: env("EMAIL_SENDER", "EMAIL_ODOSIELATEL"),
    senderName: env("EMAIL_SENDER_NAME", "EMAIL_MENO_ODOSIELATELA") ?? "Contineo",
  }
}

/**
 * Adresa odosielateľa pre prihlasovacie e-maily.
 *
 * Rovnaká hodnota ako v `config()`, ale s vlastnou predvoľbou: prihlásenie
 * musí odísť aj vtedy, keď premenná chýba, inak sa nikto nedostane dnu.
 */
export function emailSender(): string {
  return config().sender ?? "noreply@contineo.app"
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
      "Chýba ECOMAIL_API_KEY alebo EMAIL_SENDER — e-mail sa neodoslal."
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

/**
 * E-mail „bolo vám pridelené…".
 *
 * Nesie **dôvod, ktorý napísal človek** (D30, D37). Bez neho by to bola ďalšia
 * automatická správa, ktorú si ľudia po treťom raze odfiltrujú; s ním je to
 * veta, z ktorej sa dá pochopiť, prečo to niekto poslal, a či to treba čítať
 * dnes alebo o týždeň.
 *
 * **Odkaz vedie na dokument, nie na prihlásenie.** Kto nie je prihlásený,
 * dostane prihlasovaciu obrazovku a po prihlásení sa vráti sem — to už systém
 * vie. Posielať do e-mailu prihlasovací odkaz by znamenalo vyrobiť druhý
 * jednorazový vstup do systému kvôli oznámeniu, ktoré nič nepotvrdzuje.
 *
 * Text neobsahuje nič z obsahu normy okrem názvu. Do schránky, ktorá môže byť
 * súkromná alebo firemná mimo našej správy, nepatrí obsah interného predpisu.
 */
export function assignmentEmail(
  odkaz: string,
  host: string,
  dokument: { title: string; versionLabel: string; effectiveFrom: string },
  dovod: string,
  language: UiLanguage = "sk",
  branding?: SignInBranding,
): Omit<Message, "to"> {
  const s = dictionary(language).assignmentEmail
  const organisation = branding?.displayName ?? "Contineo"
  const accent = branding?.accentColor ?? "#232a35"

  const logo = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" width="34" height="34" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0">`
    : ""

  const verzia = s.versionLine(dokument.versionLabel, dokument.effectiveFrom)

  const text = [
    s.intro,
    "",
    dokument.title,
    verzia,
    "",
    `${s.reasonLabel}: ${dovod}`,
    "",
    odkaz,
    "",
    s.note,
  ].join("\n")

  const html = `<!doctype html>
<html lang="${language}"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(20,28,42,.12);border-radius:12px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">${logo}<span style="vertical-align:middle">${escapujHtml(organisation)}</span></div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:22px">${escapujHtml(s.subtitle)}</div>
    <p style="font-size:15.5px;line-height:1.65;margin:0 0 16px">${escapujHtml(s.intro)}</p>
    <div style="border-left:3px solid ${accent};padding:2px 0 2px 14px;margin:0 0 20px">
      <div style="font-size:16.5px;font-weight:700;line-height:1.4">${escapujHtml(dokument.title)}</div>
      <div style="font-size:13.5px;color:#5c6675;margin-top:3px">${escapujHtml(verzia)}</div>
    </div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:5px">${escapujHtml(s.reasonLabel)}</div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${escapujHtml(dovod)}</p>
    <a href="${odkaz}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600">
      ${escapujHtml(s.button)}
    </a>
    <p style="font-size:13px;line-height:1.6;color:#5c6675;margin:22px 0 0">${escapujHtml(s.note)}</p>
    <hr style="border:none;border-top:1px solid rgba(20,28,42,.12);margin:22px 0 14px">
    <div style="font-size:12px;color:#5c6675">${escapujHtml(host)} · LTK Solutions</div>
  </div>
</body></html>`

  return { subject: s.subject(organisation), text, html }
}

/**
 * Pripomienka — **jedna správa na človeka**, nie na povinnosť.
 *
 * Kto mešká so štyrmi smernicami, dostane jeden e-mail so štyrmi riadkami.
 * Štyri samostatné správy v jednej minúte vyzerajú ako pokazený systém
 * a človek ich prestane čítať — čím prestane fungovať aj pripomínanie samo.
 *
 * Odkaz vedie na **zoznam**, nie na konkrétny dokument: keď má človek za
 * sebou viac úloh, jeden odkaz na „čo ma čaká" je použiteľnejší než tri
 * odkazy, z ktorých si má vybrať.
 */
export function reminderEmail(
  link: string,
  host: string,
  items: { title: string; versionLabel: string; days: number }[],
  language: UiLanguage = "sk",
  branding?: SignInBranding,
): Omit<Message, "to"> {
  const s = dictionary(language).reminderEmail
  const organisation = branding?.displayName ?? "Contineo"
  const accent = branding?.accentColor ?? "#232a35"

  const logo = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" width="34" height="34" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0">`
    : ""

  const line = (i: { title: string; versionLabel: string; days: number }) =>
    `${i.title} — ${s.itemLine(i.versionLabel, i.days)}`

  const text = [
    s.intro(items.length),
    "",
    ...items.map(line),
    "",
    link,
    "",
    s.note,
  ].join("\n")

  const rows = items.map(i => `
    <div style="border-left:3px solid ${accent};padding:2px 0 2px 14px;margin:0 0 14px">
      <div style="font-size:16px;font-weight:700;line-height:1.4">${escapujHtml(i.title)}</div>
      <div style="font-size:13.5px;color:#5c6675;margin-top:3px">${escapujHtml(s.itemLine(i.versionLabel, i.days))}</div>
    </div>`).join("")

  const html = `<!doctype html>
<html lang="${language}"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(20,28,42,.12);border-radius:12px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">${logo}<span style="vertical-align:middle">${escapujHtml(organisation)}</span></div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:22px">${escapujHtml(s.subtitle)}</div>
    <p style="font-size:15.5px;line-height:1.65;margin:0 0 18px">${escapujHtml(s.intro(items.length))}</p>
    ${rows}
    <a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600;margin-top:8px">
      ${escapujHtml(s.button)}
    </a>
    <p style="font-size:13px;line-height:1.6;color:#5c6675;margin:22px 0 0">${escapujHtml(s.note)}</p>
    <hr style="border:none;border-top:1px solid rgba(20,28,42,.12);margin:22px 0 14px">
    <div style="font-size:12px;color:#5c6675">${escapujHtml(host)} · LTK Solutions</div>
  </div>
</body></html>`

  return { subject: s.subject(organisation), text, html }
}

/**
 * Hromadná pozvánka — **bez tokenu** (rozhodnuté 2026-09-06).
 *
 * Nesie obyčajný odkaz na prihlasovaciu stránku. Prihlasovací odkaz
 * s jednorazovým tokenom by pri stovke adries naraz zlyhal dvakrát:
 * platí 24 hodín, takže časť vyprší skôr, než si to niekto prečíta, a
 * poštové brány (M365 Safe Links) odkazy predberajú a token spotrebujú
 * ešte pred človekom — máme to zaznamenané z 2026-08-28.
 *
 * Človek si teda odkaz vyžiada sám na stránke. O jedno kliknutie viac,
 * zato funguje vždy.
 */
export function inviteEmail(
  signInUrl: string,
  host: string,
  language: UiLanguage = "sk",
  branding?: SignInBranding,
): Omit<Message, "to"> {
  const s = dictionary(language).inviteEmail
  const organisation = branding?.displayName ?? "Contineo"
  const accent = branding?.accentColor ?? "#232a35"

  const logo = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" width="34" height="34" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0">`
    : ""

  const text = [s.intro(organisation), "", s.how, signInUrl, "", s.note].join("\n")

  const html = `<!doctype html>
<html lang="${language}"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(20,28,42,.12);border-radius:12px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">${logo}<span style="vertical-align:middle">${escapujHtml(organisation)}</span></div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:22px">${escapujHtml(s.subtitle)}</div>
    <p style="font-size:15.5px;line-height:1.65;margin:0 0 16px">${escapujHtml(s.intro(organisation))}</p>
    <p style="font-size:15px;line-height:1.65;margin:0 0 22px">${escapujHtml(s.how)}</p>
    <a href="${signInUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600">
      ${escapujHtml(s.button)}
    </a>
    <p style="font-size:13px;line-height:1.6;color:#5c6675;margin:22px 0 0">${escapujHtml(s.note)}</p>
    <hr style="border:none;border-top:1px solid rgba(20,28,42,.12);margin:22px 0 14px">
    <div style="font-size:12px;color:#5c6675">${escapujHtml(host)} · LTK Solutions</div>
  </div>
</body></html>`

  return { subject: s.subject(organisation), text, html }
}
