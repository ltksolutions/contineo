/**
 * /api/version — ktorá verzia aplikácie práve beží v produkcii.
 *
 * Otvorená stará karta posiela akcie verzii, z ktorej sa načítala (Vercel
 * tak chráni rozpracovanú stránku pred novým kódom). Ten istý mechanizmus
 * však 28. 9. 2026 odoslal pozvánku so starým textom hodinu po nasadení
 * nového. `VersionNotice` sa sem preto pýta obyčajným `fetch` — ten na
 * starú verziu pripnutý nie je — a keď sa revízia líši, ponúkne obnovenie.
 */

import { REVISION } from "@/lib/appVersion"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ revision: REVISION }, { headers: { "Cache-Control": "no-store" } })
}
