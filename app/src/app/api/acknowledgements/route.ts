/**
 * POST /api/acknowledgements — zápis potvrdenia.
 *
 * Z požiadavky sa berie **len `documentId`**. Verziu, znenie aj jazyk určuje
 * server (D24, D28): keby sa verzia brala z tela požiadavky, dal by sa poslať
 * `versionId` staršieho znenia a potvrdiť niečo iné, než bolo na obrazovke.
 *
 * IP a `User-Agent` sa ukladajú do záznamu — bez nich má potvrdenie výrazne
 * slabšiu dôkaznú hodnotu. Sú to osobné údaje a patria do záznamu o spracúvaní
 * (`docs/GDPR_DATA_PROTECTION.md`, otvorené body O15 a O16).
 */

import { NextResponse } from "next/server"
import { onboardingContext } from "@/lib/session"
import { acknowledge } from "@/lib/acknowledgements"

export const dynamic = "force-dynamic"

/**
 * Adresa klienta spoza reverznej proxy. Prvá položka `x-forwarded-for` je
 * pôvodný klient; ďalšie sú proxy, ktorými prešiel.
 */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip")
}

export async function POST(request: Request) {
  // Tenant sa overuje aj tu, nielen na stránke. Zápis potvrdenia je jediné
  // miesto, kde vzniká auditný záznam, a ten nesmie vzniknúť pod hlavičkou
  // organizácie, ku ktorej potvrdzujúci nepatrí — volanie API stránku obchádza.
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") {
    return NextResponse.json({ ok: false, reason: "unknown-host" }, { status: 404 })
  }
  if (ctx.state === "not-signed-in") {
    return NextResponse.json({ ok: false, reason: "not-signed-in" }, { status: 401 })
  }
  if (ctx.state === "not-in-tenant") {
    return NextResponse.json({ ok: false, reason: "not-in-tenant" }, { status: 403 })
  }
  const person = ctx.person

  let documentId: unknown
  try {
    documentId = (await request.json())?.documentId
  } catch {
    documentId = undefined
  }
  if (typeof documentId !== "string" || documentId.length === 0) {
    return NextResponse.json({ ok: false, reason: "document-not-found" }, { status: 400 })
  }

  const result = await acknowledge(
    {
      personId: person.id,
      email: person.email,
      fullName: person.fullName,
      companyCode: person.companyCode,
      language: person.language,
      departmentId: person.departmentId ?? null,
    },
    documentId,
    {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
      trackId: null,
    }
  )

  if (!result.ok) {
    // „Už potvrdené" nie je chyba používateľa — má to za sebou a treba mu to
    // povedať, nie mu ukázať chybu servera. Preto 409, nie 500.
    const status = result.reason === "already-acknowledged" ? 409
      : result.reason === "write-failed" ? 500 : 400
    return NextResponse.json({ ok: false, reason: result.reason }, { status })
  }

  return NextResponse.json({ ok: true, id: result.id, statement: result.statement })
}
