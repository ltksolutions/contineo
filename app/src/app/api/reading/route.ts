/**
 * POST /api/reading — čas strávený nad znením.
 *
 * Z požiadavky sa berie `documentId` a `seconds`. **Verziu určuje server**,
 * rovnako ako pri potvrdení — inak by sa dal čas pripísať staršiemu zneniu,
 * než ktoré je na obrazovke.
 *
 * Odpoveď je zámerne chudobná: `{ ok: true }` aj vtedy, keď sa zápis
 * nepodaril. Je to meranie bez následku a klient s neúspechom nič nerobí —
 * jediné, čo by chyba spôsobila, je červený riadok v konzole človeka, ktorý
 * len číta smernicu.
 */

import { NextResponse } from "next/server"
import { onboardingContext } from "@/lib/session"
import { loadDocumentFor, effectiveVersion } from "@/lib/documents"
import { recordReading } from "@/lib/readingTime"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  if (ctx.state === "not-signed-in") {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  if (ctx.state === "not-in-tenant") {
    return NextResponse.json({ ok: false }, { status: 403 })
  }
  const person = ctx.person

  let body: { documentId?: unknown; seconds?: unknown } = {}
  try {
    body = (await request.json()) ?? {}
  } catch {
    // Prázdne telo pri `sendBeacon()` z odchádzajúcej karty nie je nič
    // neobvyklé — nie je to chyba, len sa nič nezapíše.
  }
  const documentId = body.documentId
  const seconds = body.seconds
  if (typeof documentId !== "string" || typeof seconds !== "number") {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Načítanie **pre osobu** (D32): bez toho by sa uhádnutím `documentId` dalo
  // zistiť, aké smernice má iná organizácia — stačilo by pozerať sa, kedy
  // odpoveď nie je 404.
  const doc = await loadDocumentFor(person, documentId)
  if (!doc) return NextResponse.json({ ok: false }, { status: 404 })

  const effective = effectiveVersion(doc)
  if (!effective.ok) return NextResponse.json({ ok: true })

  await recordReading({
    companyCode: person.companyCode,
    personId: person.id,
    documentId: doc.documentId,
    versionId: effective.version.versionId,
    seconds,
  })

  return NextResponse.json({ ok: true })
}
