/**
 * priecinky.ts — virtuálne priečinky knižnice (D56).
 *
 * Pri desiatich normách stačil zoznam. Pri stovke dokumentov je zoznam
 * zoradený podľa dátumu miesto, kde sa nič nenájde — a `sectionKey` je
 * identifikátor, nie usporiadanie.
 *
 * **Prečo „virtuálne":** nie je to úložisko. Súbory ležia v GridFS a text
 * v `documents`; priečinok je len zaradenie, ktoré sa dá kedykoľvek zmeniť
 * bez toho, aby sa čokoľvek presúvalo. Preto sa aj dokument z priečinka
 * odobrať dá — nezmizne, len prestane byť zaradený.
 *
 * Tvar je zámerne **ten istý ako pri oddelenieoch** (D49): strom s materializovanou
 * cestou na dokumente. Dva rôzne stromy s dvomi rôznymi pravidlami by nikto
 * neudržal v hlave a jeden z nich by sa začal správať inak.
 *
 * Rozdiel oproti oddelením je jeden a je vedomý: **cesta sa tu neukladá kvôli
 * čistej funkcii, ale kvôli dotazu.** Filter „tento priečinok aj s podriadenými"
 * je `{ folderPath: id }` — jeden index namiesto rekurzie pri každom zobrazení.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { writeAudit } from "./audit"

export const FOLDERS_COLLECTION = "cms_folders"

/** Rovnaká hranica ako pri oddelenieoch — a z rovnakého dôvodu (čitateľnosť). */
export const MAX_DEPTH = 6

export interface Folder {
  companyCode: string
  id: string
  nazov: string
  parentId: string | null
  /**
   * Poradie medzi súrodencami (D60).
   *
   * Rovnaké ako pri oddeleniach a z rovnakého dôvodu: priečinky knižnice sú
   * usporiadanie, ktoré si niekto premyslel — „Normy" pred „Internými
   * smernicami", nie naopak preto, že I je pred N. Chýbajúce poradie
   * znamená „zatiaľ neurčené" a vtedy rozhoduje názov, ako doteraz.
   */
  poradie?: number
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export class FolderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PriecinokError"
  }
}

/** Priame podpriečinky v poradí, ktoré určil človek; inak abecedne. */
export function children(all: Folder[], parentId: string | null): Folder[] {
  return all
    .filter(p => (p.parentId ?? null) === parentId)
    .sort((a, b) => {
      const pa = a.poradie, pb = b.poradie
      if (typeof pa === "number" && typeof pb === "number") return pa - pb
      if (typeof pa === "number") return -1
      if (typeof pb === "number") return 1
      return a.nazov.localeCompare(b.nazov, "sk")
    })
}

/** Cesta od koreňa po daný priečinok vrátane. Nezacyklí sa ani na chybných dátach. */
export function pathTo(all: Folder[], id: string | null | undefined): Folder[] {
  if (!id) return []
  const byId = new Map(all.map(p => [p.id, p]))
  const out: Folder[] = []
  let current = byId.get(id)
  let guard = 0
  while (current && guard++ < MAX_DEPTH + 2) {
    out.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return out
}

export function pathIdsTo(all: Folder[], id: string | null | undefined): string[] {
  return pathTo(all, id).map(p => p.id)
}

export function subtree(all: Folder[], id: string): Set<string> {
  const out = new Set<string>([id])
  let growing = true
  let guard = 0
  while (growing && guard++ < MAX_DEPTH + 2) {
    growing = false
    for (const p of all) {
      if (p.parentId && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id)
        growing = true
      }
    }
  }
  return out
}

export function depth(all: Folder[], id: string | null | undefined): number {
  return pathTo(all, id).length
}

/** Smie sa priečinok presunúť? Vracia dôvod, nie `false`. */
export function canMove(
  all: Folder[],
  id: string,
  newParentId: string | null,
): string | null {
  if (!newParentId) return null
  if (newParentId === id) return "Priečinok nemôže byť nadriadený sám sebe."

  const inside = subtree(all, id)
  if (inside.has(newParentId)) {
    return "Priečinok sa nedá presunúť do svojho vlastného podpriečinka — vznikol by kruh."
  }

  const parentDepth = depth(all, newParentId)
  let deepest = 1
  for (const p of all) {
    if (inside.has(p.id)) deepest = Math.max(deepest, depth(all, p.id) - depth(all, id) + 1)
  }
  if (parentDepth + deepest > MAX_DEPTH) {
    return `Štruktúra by mala viac než ${MAX_DEPTH} úrovní.`
  }
  return null
}

export interface FolderRow {
  priecinok: Folder
  uroven: number
}

export function flattenTree(all: Folder[], parentId: string | null = null, level = 1): FolderRow[] {
  const out: FolderRow[] = []
  for (const p of children(all, parentId)) {
    out.push({ priecinok: p, uroven: level })
    if (level < MAX_DEPTH) out.push(...flattenTree(all, p.id, level + 1))
  }
  return out
}

// ── databáza ─────────────────────────────────────────────────────────────────

export async function allFolders(companyCode: string): Promise<Folder[]> {
  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  return col.find({ companyCode }).toArray()
}

export async function createFolder(
  companyCode: string,
  name: string,
  parentId: string | null,
  actor: string,
): Promise<Folder> {
  const actorName = name.trim()
  if (!actorName) throw new FolderError("Názov priečinka je povinný.")

  const all = await allFolders(companyCode)
  if (parentId && !all.some(p => p.id === parentId)) {
    throw new FolderError("Nadriadený priečinok neexistuje.")
  }
  if (depth(all, parentId) + 1 > MAX_DEPTH) {
    throw new FolderError(`Štruktúra môže mať najviac ${MAX_DEPTH} úrovní.`)
  }
  if (children(all, parentId ?? null).some(p => p.nazov.toLowerCase() === actorName.toLowerCase())) {
    throw new FolderError(`Na tejto úrovni už priečinok „${actorName}" je.`)
  }

  const p: Folder = {
    companyCode,
    id: crypto.randomUUID(),
    nazov: actorName,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: actor,
  }
  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  await col.insertOne(p as never)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "zalozene", aktor: actor,
    cielId: p.id, cielPopis: actorName,
  })
  return p
}

export async function renameFolder(
  companyCode: string, id: string, name: string, actor: string,
): Promise<void> {
  const actorName = name.trim()
  if (!actorName) throw new FolderError("Názov priečinka je povinný.")
  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const before = await col.findOne({ companyCode, id })
  if (!before) throw new FolderError("Taký priečinok tu nie je.")

  await col.updateOne({ companyCode, id }, { $set: { nazov: actorName, updatedAt: new Date(), updatedBy: actor } })
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "premenovane", aktor: actor,
    cielId: id, cielPopis: actorName, zmeny: { nazov: { z: before.nazov, na: actorName } },
  })
}

export async function moveFolder(
  companyCode: string, id: string, newParentId: string | null, actor: string,
): Promise<void> {
  const all = await allFolders(companyCode)
  const before = all.find(p => p.id === id)
  if (!before) throw new FolderError("Taký priečinok tu nie je.")
  if (newParentId && !all.some(p => p.id === newParentId)) {
    throw new FolderError("Nadriadený priečinok neexistuje.")
  }
  const why = canMove(all, id, newParentId)
  if (why) throw new FolderError(why)

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: newParentId ?? null, updatedAt: new Date(), updatedBy: actor } },
  )
  const affectedCount = await recomputePaths(companyCode)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "presunute", aktor: actor,
    cielId: id, cielPopis: before.nazov,
    zmeny: { parentId: { z: before.parentId, na: newParentId ?? null } },
    poznamka: `prepočítané cesty ${affectedCount} dokumentom`,
  })
}

/**
 * Zruší priečinok. **Len prázdny** — inak by dokumenty odkazovali na niečo,
 * čo neexistuje, a zmizli by z každého filtra naraz.
 */
export async function deleteFolder(companyCode: string, id: string, actor: string): Promise<void> {
  const all = await allFolders(companyCode)
  if (children(all, id).length > 0) {
    throw new FolderError("Priečinok má podpriečinky — najprv ich presuňte alebo zrušte.")
  }
  const docs = await getCollection(DOCUMENTS_COLLECTION)
  const count = await docs.countDocuments({ companyCode, folderId: id })
  if (count > 0) {
    throw new FolderError(`V priečinku je ${count} dokumentov — najprv ich preraďte.`)
  }

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const before = await col.findOne({ companyCode, id })
  await col.deleteOne({ companyCode, id })
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "zrusene", aktor: actor,
    cielId: id, cielPopis: before?.nazov ?? null,
  })
}

/** Prepočíta `folderPath` všetkým dokumentom organizácie. */
export async function recomputePaths(companyCode: string): Promise<number> {
  const all = await allFolders(companyCode)
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = await col
    .find({ companyCode }, { projection: { documentId: 1, folderId: 1, folderPath: 1 } })
    .toArray()

  let changed = 0
  for (const d of documents as unknown as { documentId: string; folderId?: string | null; folderPath?: string[] }[]) {
    const next = pathIdsTo(all, d.folderId)
    const old = d.folderPath ?? []
    if (next.length === old.length && next.every((x, i) => x === old[i])) continue
    await col.updateOne({ companyCode, documentId: d.documentId }, { $set: { folderPath: next } })
    changed++
  }
  return changed
}

/** Koľko dokumentov je priamo v priečinku a koľko aj s podpriečinkami. */
export async function counts(
  companyCode: string,
): Promise<Map<string, { priamo: number; sPodriadenymi: number }>> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = await col
    .find({ companyCode }, { projection: { folderId: 1, folderPath: 1 } })
    .toArray()

  const out = new Map<string, { priamo: number; sPodriadenymi: number }>()
  const addTo = (id: string, key: "priamo" | "sPodriadenymi") => {
    const z = out.get(id) ?? { priamo: 0, sPodriadenymi: 0 }
    z[key]++
    out.set(id, z)
  }
  for (const d of documents as unknown as { folderId?: string | null; folderPath?: string[] }[]) {
    if (d.folderId) addTo(d.folderId, "priamo")
    for (const id of d.folderPath ?? []) addTo(id, "sPodriadenymi")
  }
  return out
}

/**
 * Zaradí dokument do priečinka (alebo ho vyradí pri `null`).
 *
 * Cesta sa zapisuje **v tom istom zápise**: rozdelené na dva by chvíľu platilo,
 * že dokument v priečinku je, ale filter „aj s podpriečinkami" ho nenájde.
 */
export async function assignDocument(
  companyCode: string,
  documentId: string,
  folderId: string | null,
  actor: string,
): Promise<void> {
  const all = await allFolders(companyCode)
  if (folderId && !all.some(p => p.id === folderId)) {
    throw new FolderError("Taký priečinok neexistuje.")
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { companyCode, documentId },
    {
      $set: {
        folderId: folderId ?? null,
        folderPath: pathIdsTo(all, folderId),
        updatedAt: new Date(),
        updatedBy: actor,
      },
    },
  )
  if (!r.matchedCount) throw new FolderError("Taký dokument tu nie je.")
}


/**
 * Posunie priečinok o jedno miesto medzi súrodencami (D60).
 *
 * Nikdy nemení nadriadený priečinok — na to je presun. Zlúčiť to do jedného
 * ťahania by znamenalo, že sa človek pri preusporadúvaní omylom prepadne
 * o úroveň nižšie.
 */
export async function shiftFolder(
  companyCode: string,
  id: string,
  direction: "hore" | "dole",
  actor: string,
): Promise<void> {
  const all = await allFolders(companyCode)
  const self = all.find(p => p.id === id)
  if (!self) throw new FolderError("Taký priečinok tu nie je.")

  const siblings = children(all, self.parentId ?? null)
  const from = siblings.findIndex(p => p.id === id)
  const to = direction === "hore" ? from - 1 : from + 1
  if (to < 0 || to >= siblings.length) return

  const sorted = [...siblings]
  const [picked] = sorted.splice(from, 1)
  sorted.splice(to, 0, picked)

  await saveFolderOrder(companyCode, sorted.map(p => p.id), actor)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "preusporiadane", aktor: actor,
    cielId: id, cielPopis: self.nazov,
    poznamka: `posunuté ${direction} medzi súrodencami`,
  })
}

/**
 * Zapíše poradie súrodencov podľa zoznamu identifikátorov.
 *
 * Prijíma **len priečinky s tým istým nadriadeným**: zoznam z prehliadača by
 * inak vedel prehádzať celý strom, a to je zmena štruktúry maskovaná ako
 * preusporiadanie.
 *
 * Prepisuje poradie celej úrovne, nie len dvoch dotknutých — časť súrodencov
 * nemusí mať poradie určené vôbec a bez prečíslovania by sa výsledok líšil od
 * toho, čo človek videl.
 */
export async function saveFolderOrder(
  companyCode: string,
  orderedIds: string[],
  actor: string,
): Promise<void> {
  const all = await allFolders(companyCode)
  const byId = new Map(all.map(p => [p.id, p]))

  const touched = orderedIds.map(x => byId.get(x))
  if (touched.some(p => p === undefined)) {
    throw new FolderError("Zoznam obsahuje priečinok, ktorý tu nie je.")
  }
  const parents = new Set(touched.map(p => p!.parentId ?? "koren"))
  if (parents.size > 1) {
    throw new FolderError("Preusporiadať sa dá len v rámci jednej úrovne.")
  }

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const current = new Date()
  for (const [i, x] of orderedIds.entries()) {
    await col.updateOne(
      { companyCode, id: x },
      { $set: { poradie: i, updatedAt: current, updatedBy: actor } },
    )
  }
}
