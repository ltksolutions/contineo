/**
 * POST /api/acknowledgements — zápis potvrdenia.
 *
 * Z požiadavky sa berie **len `documentId`**. Verziu, znenie aj jazyk určuje
 * server (D24, D28): keby sa verzia brala z tela požiadavky, dal by sa poslať
 * `versionId` staršieho znenia a potvrdiť niečo iné, než bolo na obrazovke.
 *
 * **Obrazovka dokumentu toto API už nevolá** — potvrdzuje serverovou akciou
 * (`documents/[documentId]/actions.ts`), aby to fungovalo aj bez JavaScriptu.
 * Route zostáva pre programový prístup a obe cesty volajú tú istú
 * `acknowledge()`, takže pravidlá okolo záznamu sú na jednom mieste.
 *
 * Z tela sa navyše prijíma nepovinný `track` — kľúč trasy, z ktorej človek
 * dokument otvoril. Overuje sa (`trackForDocument()`), lebo je to tvrdenie
 * klienta; neplatný sa ticho zahodí.
 *
 * IP a `User-Agent` sa ukladajú do záznamu — bez nich má potvrdenie výrazne
 * slabšiu dôkaznú hodnotu. Sú to osobné údaje a patria do záznamu o spracúvaní
 * (`docs/GDPR_DATA_PROTECTION.md`, otvorené body O15 a O16).
 */

import { NextResponse } from "next/server"
import { onboardingContext } from "@/lib/session"
import { acknowledge } from "@/lib/acknowledgements"
import { trackForDocument } from "@/lib/tracks"
import { clientIp } from "@/lib/requestMeta"
import { sameOrigin } from "@/lib/sameOrigin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  // Pôvod pred čímkoľvek iným (CSRF): zapisuje sa **dôkazné potvrdenie**
  // (D24) a cookie prihláseného by poslal aj formulár z cudzej stránky —
  // napríklad z inej organizácie na tej istej doméne `*.contineo.app`,
  // kam `SameSite=Lax` nesiaha. Viď `lib/sameOrigin.ts`.
  if (!sameOrigin(request.headers)) return new Response(null, { status: 403 })

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
  let track: unknown
  try {
    const body = await request.json()
    documentId = body?.documentId
    track = body?.track
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
      ip: clientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      // Rovnako ako v serverovej akcii: kľúč trasy je tvrdenie klienta,
      // takže sa overuje. Obe cesty musia zapisovať ten istý údaj rovnako.
      trackId: await trackForDocument(person, typeof track === "string" ? track : null, documentId),
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
