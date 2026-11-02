/**
 * documentAliases.ts — starý identifikátor dokumentu → nový (ADR-044).
 *
 * Migrácia `scripts/migrate_document_uuid.mjs` dala každému dokumentu kľúč
 * UUID a prepísala `documentId` vo všetkých kolekciách. Odkazy **mimo
 * databázy** však prepísať nejde: e-maily, ktoré už odišli, záložky,
 * história v klientoch MCP. Preto si migrácia pre každý dokument zapíše
 * dvojicu starý → nový do `document_id_aliases` a tu sa podľa nej prekladá.
 *
 * Dvojica sa nemaže — o rok bude e-mail s odkazom stále v niečej schránke.
 */

import { getCollection } from "./mongodb"

export const DOCUMENT_ALIASES_COLLECTION = "document_id_aliases"

export interface DocumentAlias {
  companyCode: string
  oldId: string
  newId: string
  migratedAt: Date
}

/** Identifikátor v tvare ADR-043/044 — `sfz:` a 32 hexadecimálnych znakov. */
const UUID_DOCUMENT_ID = /^[a-z0-9]+:[0-9a-f]{32}$/

/**
 * Môže to byť starý identifikátor? Len vtedy sa oplatí pýtať databázy —
 * nový tvar alias nikdy nemá, a `/library/new` či `/library/import` nie sú
 * identifikátory vôbec (chýba dvojbodka).
 */
export function mayBeOldDocumentId(id: string): boolean {
  return id.includes(":") && !UUID_DOCUMENT_ID.test(id)
}

/** Nový identifikátor pre starý, alebo `null`. Organizácia v podmienke (D32). */
export async function resolveDocumentAlias(companyCode: string, oldId: string): Promise<string | null> {
  if (!companyCode || !mayBeOldDocumentId(oldId)) return null
  const col = await getCollection<DocumentAlias>(DOCUMENT_ALIASES_COLLECTION)
  const hit = await col.findOne({ companyCode, oldId: oldId.toLowerCase() }, { projection: { newId: 1 } })
  return hit?.newId ?? null
}

/**
 * Cesty, v ktorých druhý segment je `documentId`. Vracia rozklad, aby sa dala
 * poskladať tá istá cesta s novým identifikátorom (`/library/<id>/edit`).
 */
const DOCUMENT_PATH = /^\/(library|documents|api\/documents)\/([^/]+)(\/.*)?$/

export function documentIdInPath(pathname: string): { prefix: string; id: string; rest: string } | null {
  const m = DOCUMENT_PATH.exec(pathname)
  if (!m) return null
  let id: string
  try { id = decodeURIComponent(m[2]) } catch { return null }
  return mayBeOldDocumentId(id) ? { prefix: m[1], id, rest: m[3] ?? "" } : null
}
