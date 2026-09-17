/**
 * Logo organizácie.
 *
 * **Verejné, zámerne.** Prihlasovacia stránka nesie logo a načítava ho ďalšou
 * požiadavkou, ktorá v tej chvíli ešte nie je prihlásená. Jediné, čo obrázok
 * prezradí, je že tá organizácia tu má portál — a to prezradí už samotná
 * doména. Proxy má `/api/brand/` medzi verejnými cestami z toho istého
 * dôvodu ako predtým `/tenants/`. **Len na doméne tej organizácie** (D90).
 *
 * Pamäť je dlhá a nemenná, lebo **verzia je v adrese**: nové logo dostane inú
 * adresu a ukáže sa okamžite. Bez toho by sa obrázok sťahoval pri každom
 * načítaní stránky pre nič.
 */

import { loadBrand } from "@/lib/branding"
import { currentTenant } from "@/lib/session"
import { platformContext } from "@/lib/admin"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  let z
  // Logo vydané správcovi platformy nesmie ísť do zdieľanej pamäte CDN —
  // ďalší, neprihlásený návštevník tej istej adresy by ho dostal z nej.
  let viaPlatform = false
  try {
    // Logo sa vydá len organizácii, ktorej patrí doména (D90). Do 2026-09-17
    // sa vydalo podľa kódu v adrese na ktorejkoľvek doméne — portál LTK tak
    // ukázal logo SFZ a prezradil, že organizácia existuje. Iný kód sa tvári
    // ako neexistujúci, rovnako ako cudzí dokument.
    //
    // Jediná výnimka je správa platformy (D41, D42): prihlásený `platform-admin`
    // na doméne dodávateľa vidí v detaile tenanta jeho logo. Logo je prehľadový
    // údaj, nie obsah — a obe podmienky (rola aj doména) musia platiť naraz.
    const wanted = decodeURIComponent(code).toUpperCase()
    const tenant = await currentTenant()
    if (!tenant) return new Response(null, { status: 404 })
    if (tenant.companyCode.toUpperCase() !== wanted) {
      const platform = await platformContext()
      if (platform.state !== "ready") return new Response(null, { status: 404 })
      viaPlatform = true
    }
    z = await loadBrand(wanted)
  } catch (e) {
    console.error("[znacka] načítanie zlyhalo:", e)
    return new Response(null, { status: 500 })
  }
  if (!z) return new Response(null, { status: 404 })

  // `z.data` príde z ovládača ako Binary; `buffer` je surové bajty.
  const bytes = (z.data as unknown as { buffer?: Uint8Array }).buffer ?? z.data

  return new Response(new Uint8Array(bytes as Uint8Array), {
    headers: {
      "Content-Type": z.contentType,
      "Content-Length": String(z.bajtov),
      "Cache-Control": viaPlatform ? "private, no-store" : "public, max-age=31536000, immutable",
      // Obrázok nie je stránka a nemá sa dať vložiť do cudzieho rámu ani
      // spustiť ako dokument.
      "X-Content-Type-Options": "nosniff",
    },
  })
}
