/**
 * sameOrigin.ts — prišla požiadavka z našej vlastnej stránky?
 *
 * Serverové akcie Nextu pôvod kontrolujú samy. **Cesty (`route.ts`) nie**:
 * prehliadač prihláseného správcu pošle cookie aj na `POST` z cudzej stránky,
 * a tá by tak vedela napríklad zapisovať súbory do úložiska (CSRF). Preto
 * každá cesta, ktorá zapisuje, overí hlavičku `Origin` proti hostiteľovi.
 *
 * Porovnáva sa s `x-forwarded-host` pred `host` — za proxy Vercelu je
 * pôvodný hostiteľ tam (rovnako ako `requestHostname()` v `session.ts`).
 * Chýbajúci `Origin` sa **odmieta**: moderné prehliadače ho pri `POST`
 * posielajú vždy, takže jeho absencia nie je bežný človek.
 */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin")
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (!origin || !host) return false
  try {
    return new URL(origin).host.toLowerCase() === host.split(",")[0].trim().toLowerCase()
  } catch {
    return false
  }
}
