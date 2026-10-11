/**
 * backgroundKick.ts — ďalší kúsok behu na pozadí hneď, nie až o päť minút.
 *
 * Ján 11. 10. 2026: „prečo potrebujeme cron, nevieme to spraviť, aby sa po
 * skončení časti hneď spustila ďalšia?" Dlhý beh (kontrola súladu) sa delí na
 * kúsky, lebo funkcia na Verceli žije najviac 300 s. Kúsok po skončení
 * zavolá svoju vlastnú adresu a tá hneď vráti 202 — prácu robí v `after()`,
 * takže volajúci nečaká na celý ďalší kúsok a reťaz nenarastá.
 *
 * **Cron ostáva ako poistka**, nie ako motor: keď sa reťaz pretrhne (pád
 * funkcie, nasadenie uprostred behu), beh zdvihne najneskôr o päť minút.
 * Súbeh reťaze a cronu stráži zámok kúska (`leaseUntil`).
 */

/** Zavolá internú adresu behu s tajomstvom cronu. Nikdy nevyhodí. */
export async function kick(origin: string, path: string): Promise<void> {
  const secret = process.env.CRON_SECRET
  if (!secret || !origin) return
  try {
    await fetch(new URL(path, origin), {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    // Reťaz sa pretrhla — beh dokončí cron. Nie je to chyba behu.
    console.warn(`[kick] ${path} sa nepodarilo zavolať:`, e)
  }
}

/** Adresa, na ktorej beží táto požiadavka — pre server action z hlavičiek. */
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return ""
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.endsWith(".localhost") ? "http" : "https")
  return `${proto}://${host}`
}
