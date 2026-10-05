/**
 * chunkingProfilesDb.ts — profil členenia pri dokumente (editor členenia, krok B;
 * ADR-027, D79; rozhodnutie Jána 5. 10. 2026 „A": len pomenované profily).
 *
 * Dokument nesie **iba kľúč** pomenovaného profilu. Keď mu žiadny nesadne,
 * vznikne nový pomenovaný profil — viditeľne, s menom, použiteľný aj pre
 * ďalšie dokumenty. Vlastné hodnoty na dokumente zámerne neexistujú (D79).
 *
 * **Existujúci profil sa tu neupravuje.** Zmena „Základného" by ticho zmenila
 * rez všetkých noriem, ktoré ho používajú — to nie je úprava jedného dokumentu.
 *
 * Nič sa nepreindexuje samo (D58): po zmene profilu ukáže stránka Členenie
 * „narezané starším spôsobom" a preindexovanie je samostatný krok.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { chunkingTenant } from "./libraryWrite"
import { saveTenant, clampChunking } from "./tenantAdmin"
import { slugifyKey } from "./slug"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { DEFAULT_PROFILE_KEY, type ChunkingProfile } from "./chunkingProfile"

export class ChunkingProfileError extends AppError {}

/** Kľúč z menovky, ktorý ešte nie je obsadený: `zakon`, `zakon_2`, … */
export function freeProfileKey(label: string, taken: string[]): string {
  const base = slugifyKey(label) || "profil"
  const padded = base.length < 2 ? `${base}_profil` : base
  if (!taken.includes(padded)) return padded
  for (let n = 2; ; n++) {
    const k = `${padded.slice(0, 56)}_${n}`
    if (!taken.includes(k)) return k
  }
}

/** Priradí dokumentu existujúci pomenovaný profil. */
export async function setDocumentChunkingProfile(
  companyCode: string,
  documentId: string,
  profileKey: string,
  actor: string,
): Promise<{ label: string }> {
  const tenant = await chunkingTenant(companyCode)
  const profiles = tenant?.chunkingProfiles ?? []
  const profile = profiles.find(p => p.key === profileKey)
  if (!profile) {
    throw new ChunkingProfileError("chunking.unknownProfile", `Profil členenia „${profileKey}" neexistuje.`, { value: profileKey })
  }
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }, { projection: { title: 1, chunkingProfile: 1 } }) as
    { title?: string; chunkingProfile?: string } | null
  if (!doc) throw new ChunkingProfileError("library.documentNotFound", "Taký dokument tu nie je.")
  const before = doc.chunkingProfile ?? DEFAULT_PROFILE_KEY
  if (before === profileKey) return { label: profile.label }

  await col.updateOne({ companyCode, documentId }, { $set: { chunkingProfile: profileKey } })
  await writeAudit({
    companyCode, subject: "document", action: "chunking-profile", actor,
    targetId: documentId, targetLabel: String(doc.title ?? documentId),
    changes: { chunkingProfile: { from: before, to: profileKey } },
  })
  return { label: profile.label }
}

/**
 * Založí nový pomenovaný profil z hodnôt skúšobného rezu a priradí ho
 * dokumentu. Hodnoty prejdú tým istým orezaním ako v nastavení organizácie
 * (`clampChunking`) — úsek na 20 alebo 5000 tokenov by vyhľadávanie pokazil.
 */
export async function createChunkingProfileForDocument(
  companyCode: string,
  documentId: string,
  label: string,
  values: Partial<ChunkingProfile>,
  actor: string,
): Promise<{ key: string; label: string }> {
  const name = label.trim()
  if (!name) throw new ChunkingProfileError("chunking.labelRequired", "Profil potrebuje názov.")
  const tenant = await chunkingTenant(companyCode)
  const existing = tenant?.chunkingProfiles ?? []
  if (existing.some(p => (p.label ?? "").trim().toLowerCase() === name.toLowerCase())) {
    throw new ChunkingProfileError("chunking.labelTaken", `Profil s názvom „${name}" už existuje — použite ho, alebo zvoľte iný názov.`, { value: name })
  }
  const key = freeProfileKey(name, existing.map(p => p.key))
  await saveTenant(companyCode, {
    chunkingProfiles: [...existing, { key, label: name, ...clampChunking(values) }],
  }, actor)
  await setDocumentChunkingProfile(companyCode, documentId, key, actor)
  return { key, label: name }
}
