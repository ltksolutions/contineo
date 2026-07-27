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

const API = "https://api2.ecomailapp.cz/transactional/send-message"

export interface Sprava {
  komu: string
  predmet: string
  text: string
  html: string
}

export class EcomailChyba extends Error {}

export function konfiguracia() {
  return {
    kluc: process.env.ECOMAIL_API_KEY,
    odosielatel: process.env.EMAIL_ODOSIELATEL,
    menoOdosielatela: process.env.EMAIL_MENO_ODOSIELATELA ?? "Contineo",
  }
}

/**
 * Pošle jeden e-mail.
 *
 * Vyhadzuje výnimku, keď sa nepodarí. Tiché zlyhanie by znamenalo, že
 * hodnotiteľ čaká na odkaz, ktorý nikdy nepríde, a nikto sa to nedozvie.
 */
export async function posli(s: Sprava): Promise<void> {
  const { kluc, odosielatel, menoOdosielatela } = konfiguracia()

  if (!kluc || !odosielatel) {
    throw new EcomailChyba(
      "Chýba ECOMAIL_API_KEY alebo EMAIL_ODOSIELATEL — e-mail sa neodoslal."
    )
  }

  const odpoved = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", key: kluc },
    body: JSON.stringify({
      message: {
        subject: s.predmet,
        from_name: menoOdosielatela,
        from_email: odosielatel,
        reply_to: odosielatel,
        text: s.text,
        html: s.html,
        to: [{ email: s.komu }],
        // Sledovanie otvorení a preklikov pri prihlasovacom odkaze
        // vypíname zámerne. Preklikový proxy odkaz by navyše mohol odkaz
        // „spotrebovať" skôr než človek — antivírusy a náhľady v poštových
        // klientoch odkazy bežne otvárajú.
        options: { click_tracking: false, open_tracking: false },
      },
    }),
  })

  if (!odpoved.ok) {
    const detail = await odpoved.text().catch(() => "")
    throw new EcomailChyba(`Ecomail ${odpoved.status}: ${detail.slice(0, 300)}`)
  }

  // Ecomail vracia 200 aj vtedy, keď adresáta odmietol — treba pozrieť telo.
  const vysledok = await odpoved.json().catch(() => null)
  const odmietnutych = vysledok?.results?.total_rejected_recipients
  if (typeof odmietnutych === "number" && odmietnutych > 0) {
    throw new EcomailChyba(`Ecomail odmietol adresáta: ${s.komu}`)
  }
}

/** Text prihlasovacieho e-mailu. Vytiahnuté zvlášť, aby sa dal otestovať. */
export function prihlasovaciEmail(odkaz: string, hostitel: string): Omit<Sprava, "komu"> {
  const text = [
    "Prihlásenie do testovacieho rozhrania Contineo",
    "",
    "Kliknite na odkaz a budete prihlásení:",
    odkaz,
    "",
    "Odkaz platí 24 hodín a dá sa použiť raz.",
    "Ak ste o prihlásenie nežiadali, tento e-mail ignorujte.",
  ].join("\n")

  const html = `<!doctype html>
<html lang="sk"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161b22">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid rgba(20,28,42,.12);border-radius:12px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">Contineo</div>
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5c6675;margin-bottom:22px">Testovacie rozhranie</div>
    <p style="font-size:15.5px;line-height:1.65;margin:0 0 22px">
      Kliknutím sa prihlásite do rozhrania na overovanie odpovedí nad normami.
    </p>
    <a href="${odkaz}" style="display:inline-block;background:#232a35;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600">
      Prihlásiť sa
    </a>
    <p style="font-size:13px;line-height:1.6;color:#5c6675;margin:22px 0 0">
      Odkaz platí 24 hodín a dá sa použiť raz. Ak ste o prihlásenie nežiadali,
      tento e-mail ignorujte — bez kliknutia sa nič nestane.
    </p>
    <p style="font-size:12px;color:#5c6675;margin:18px 0 0;word-break:break-all">
      Ak odkaz nefunguje, skopírujte do prehliadača:<br>${odkaz}
    </p>
    <hr style="border:none;border-top:1px solid rgba(20,28,42,.12);margin:22px 0 14px">
    <div style="font-size:12px;color:#5c6675">${hostitel} · LTK Solutions</div>
  </div>
</body></html>`

  return { predmet: "Prihlásenie do Contineo", text, html }
}
