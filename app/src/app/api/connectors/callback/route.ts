/**
 * GET /api/connectors/callback — návrat z prihlásenia ku konektoru
 * (ADR-029, D172).
 *
 * Server pošle `code` a `state`. Konektor sa nájde podľa `state` —
 * náhodného a jednorazového — nie podľa ničoho, čo by sa dalo do adresy
 * dopísať. Výmenu kódu za token a uloženie robí `finishAuthorization()`;
 * tu je len brána (správca organizácie) a presmerovanie späť so správou.
 * Cesta je chránená prihlásením ako každá iná — prehliadač nesie cookie.
 */

import { NextResponse, type NextRequest } from "next/server"
import { orgContext } from "@/lib/orgSettings"
import { finishAuthorization } from "@/lib/mcp/client"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"
import { connectorByPendingState } from "@/lib/connectors"
import { dictionary, errorText } from "@/lib/i18n"
import { AppError } from "@/lib/appError"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") return NextResponse.redirect(new URL("/", req.url))
  const back = (message: string, error = false) => {
    const q = new URLSearchParams({ msg: message })
    if (error) q.set("error", "1")
    return NextResponse.redirect(new URL(`/organisation/connectors?${q}`, req.url))
  }
  const language = ctx.person.language
  const code = req.nextUrl.searchParams.get("code") ?? ""
  const state = req.nextUrl.searchParams.get("state") ?? ""
  const denied = req.nextUrl.searchParams.get("error")
  if (denied) return back(`${denied}: ${req.nextUrl.searchParams.get("error_description") ?? ""}`.trim(), true)
  try {
    // Cudzia organizácia sa k cudziemu konektoru nedostane ani s platným `state` (D32).
    const pending = await connectorByPendingState(state)
    if (!pending || pending.companyCode !== ctx.tenant.companyCode) throw new AppError("connector.noPending", "Prihlásenie nebolo začaté alebo už vypršalo — skúste znova.")
    await finishAuthorization(state, code, await connectorCallbackUrl(), ctx.person.email)
  } catch (e) {
    if (!(e instanceof AppError)) console.error("[connector] návrat z prihlásenia zlyhal:", e)
    return back(errorText(e, language), true)
  }
  return back(dictionary(language).org.connectors.connected)
}
