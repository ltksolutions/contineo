/**
 * GET /api/documents/[documentId]/pdf — PDF znenia alebo konceptu (ADR-011, D99).
 *
 *   · `?version=<versionId>` — PDF **zverejneného znenia**. Otvorí ho každý,
 *     kto smie vidieť dokument (`loadDocumentFor`, tie isté pravidlá ako
 *     stránka dokumentu). Je to to, čo ľudia potvrdzujú.
 *   · `?draft=1` — PDF **konceptu**. Správca obsahu, alebo **menovaný
 *     schvaľovateľ** kola, ktoré beží presne na tomto koncepte (PDF aj text,
 *     `draftIdentity`). Schvaľovateľ z kola na staršej podobe konceptu nové
 *     PDF nevidí — nerozhoduje o ňom.
 *
 * Doteraz originál otváral len správca obsahu (`/api/library/file`), takže
 * schvaľovateľ aj zamestnanec videli len text na vyhľadávanie.
 *
 * Posiela sa **prúdom** (strop 4,5 MB platí len pre odpoveď naraz, D98)
 * a súbor sa hľadá s `companyCode` v podmienke (D32). Identifikátor súboru
 * v adrese nie je — ide sa cez dokument, takže sa nedá skúšať po súboroch.
 */

import { onboardingContext } from "@/lib/session"
import { loadDocumentFor, DOCUMENTS_COLLECTION, type VersionFile } from "@/lib/documents"
import { openFileStream } from "@/lib/fileStore"
import { getCollection } from "@/lib/mongodb"
import { isContentManager } from "@/lib/library"
import { roundsForVersion } from "@/lib/approvalsDb"
import { documentDraftIdentity } from "@/lib/versionMeta"
import { canSeeDraftPdf } from "@/lib/approvals"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const ctx = await onboardingContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  // Neznáma doména aj cudzia organizácia: tvárime sa, že nič také nie je.
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const person = ctx.person
  const documentId = decodeURIComponent((await params).documentId)
  const url = new URL(req.url)

  let file: VersionFile | null = null

  if (url.searchParams.get("draft") === "1") {
    const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne(
      { companyCode: person.companyCode, documentId },
      { projection: { draftMarkdown: 1, draftPdf: 1, draftMeta: 1, draftTitle: 1 } },
    ) as { draftMarkdown?: string; draftPdf?: VersionFile | null; draftMeta?: Record<string, unknown> | null; draftTitle?: string | null } | null
    if (!doc?.draftPdf) return new Response(null, { status: 404 })
    const manager = isContentManager(person)
    const identity = documentDraftIdentity(doc)
    const rounds = manager ? [] : await roundsForVersion(person.companyCode, documentId, identity)
    if (!canSeeDraftPdf({ isContentManager: manager, email: person.email, rounds })) {
      return new Response(null, { status: 404 })
    }
    file = doc.draftPdf
  } else {
    const doc = await loadDocumentFor(person, documentId)
    const versionId = url.searchParams.get("version") ?? ""
    const version = doc?.versions?.find(v => v.versionId === versionId)
    if (!version?.pdf) return new Response(null, { status: 404 })
    file = version.pdf
  }

  const s = await openFileStream(person.companyCode, file.id)
  if (!s) return new Response(null, { status: 404 })

  return new Response(s.stream, {
    headers: {
      "Content-Type": "application/pdf",
      // `Content-Length` zámerne nie — odpoveď má zostať prúdom (D98).
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ETag: `"${file.sha256}"`,
    },
  })
}
