/**
 * /.well-known/oauth-protected-resource/mcp — ten istý dokument ako bez
 * prípony; RFC 9728 § 3 dovoľuje klientovi hľadať metadáta s cestou
 * zdroja za `well-known`, a práve túto adresu nesie hlavička 401 z `/mcp`.
 *
 * `dynamic` sa musí deklarovať tu — Next ho z re-exportu neprečíta.
 */

export { GET, OPTIONS } from "../route"

export const dynamic = "force-dynamic"
