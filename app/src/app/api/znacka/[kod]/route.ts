/**
 * Logo organizácie.
 *
 * **Verejné, zámerne.** Prihlasovacia stránka nesie logo a načítava ho ďalšou
 * požiadavkou, ktorá v tej chvíli ešte nie je prihlásená. Jediné, čo obrázok
 * prezradí, je že tá organizácia tu má portál — a to prezradí už samotná
 * doména. Middleware má `/api/znacka/` medzi verejnými cestami z toho istého
 * dôvodu ako predtým `/tenants/`.
 *
 * Pamäť je dlhá a nemenná, lebo **verzia je v adrese**: nové logo dostane inú
 * adresu a ukáže sa okamžite. Bez toho by sa obrázok sťahoval pri každom
 * načítaní stránky pre nič.
 */

import { nacitajZnacku } from "@/lib/branding"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kod: string }> },
) {
  const { kod } = await params

  let z
  try {
    z = await nacitajZnacku(decodeURIComponent(kod))
  } catch (e) {
    console.error("[znacka] načítanie zlyhalo:", e)
    return new Response(null, { status: 500 })
  }
  if (!z) return new Response(null, { status: 404 })

  // `z.data` príde z ovládača ako Binary; `buffer` je surové bajty.
  const bajty = (z.data as unknown as { buffer?: Uint8Array }).buffer ?? z.data

  return new Response(new Uint8Array(bajty as Uint8Array), {
    headers: {
      "Content-Type": z.contentType,
      "Content-Length": String(z.bajtov),
      "Cache-Control": "public, max-age=31536000, immutable",
      // Obrázok nie je stránka a nemá sa dať vložiť do cudzieho rámu ani
      // spustiť ako dokument.
      "X-Content-Type-Options": "nosniff",
    },
  })
}
