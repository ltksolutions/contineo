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
export function children(vsetky: Folder[], parentId: string | null): Folder[] {
  return vsetky
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
export function pathTo(vsetky: Folder[], id: string | null | undefined): Folder[] {
  if (!id) return []
  const podla = new Map(vsetky.map(p => [p.id, p]))
  const out: Folder[] = []
  let teraz = podla.get(id)
  let poistka = 0
  while (teraz && poistka++ < MAX_DEPTH + 2) {
    out.unshift(teraz)
    teraz = teraz.parentId ? podla.get(teraz.parentId) : undefined
  }
  return out
}

export function pathIdsTo(vsetky: Folder[], id: string | null | undefined): string[] {
  return pathTo(vsetky, id).map(p => p.id)
}

export function subtree(vsetky: Folder[], id: string): Set<string> {
  const out = new Set<string>([id])
  let rastie = true
  let poistka = 0
  while (rastie && poistka++ < MAX_DEPTH + 2) {
    rastie = false
    for (const p of vsetky) {
      if (p.parentId && out.has(p.parentId) && !out.has(p.id)) {
        out.add(p.id)
        rastie = true
      }
    }
  }
  return out
}

export function depth(vsetky: Folder[], id: string | null | undefined): number {
  return pathTo(vsetky, id).length
}

/** Smie sa priečinok presunúť? Vracia dôvod, nie `false`. */
export function canMove(
  vsetky: Folder[],
  id: string,
  novyParentId: string | null,
): string | null {
  if (!novyParentId) return null
  if (novyParentId === id) return "Priečinok nemôže byť nadriadený sám sebe."

  const pod = subtree(vsetky, id)
  if (pod.has(novyParentId)) {
    return "Priečinok sa nedá presunúť do svojho vlastného podpriečinka — vznikol by kruh."
  }

  const hlbkaRodica = depth(vsetky, novyParentId)
  let najhlbsie = 1
  for (const p of vsetky) {
    if (pod.has(p.id)) najhlbsie = Math.max(najhlbsie, depth(vsetky, p.id) - depth(vsetky, id) + 1)
  }
  if (hlbkaRodica + najhlbsie > MAX_DEPTH) {
    return `Štruktúra by mala viac než ${MAX_DEPTH} úrovní.`
  }
  return null
}

export interface FolderRow {
  priecinok: Folder
  uroven: number
}

export function flattenTree(vsetky: Folder[], parentId: string | null = null, uroven = 1): FolderRow[] {
  const out: FolderRow[] = []
  for (const p of children(vsetky, parentId)) {
    out.push({ priecinok: p, uroven })
    if (uroven < MAX_DEPTH) out.push(...flattenTree(vsetky, p.id, uroven + 1))
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
  nazov: string,
  parentId: string | null,
  aktor: string,
): Promise<Folder> {
  const meno = nazov.trim()
  if (!meno) throw new FolderError("Názov priečinka je povinný.")

  const vsetky = await allFolders(companyCode)
  if (parentId && !vsetky.some(p => p.id === parentId)) {
    throw new FolderError("Nadriadený priečinok neexistuje.")
  }
  if (depth(vsetky, parentId) + 1 > MAX_DEPTH) {
    throw new FolderError(`Štruktúra môže mať najviac ${MAX_DEPTH} úrovní.`)
  }
  if (children(vsetky, parentId ?? null).some(p => p.nazov.toLowerCase() === meno.toLowerCase())) {
    throw new FolderError(`Na tejto úrovni už priečinok „${meno}" je.`)
  }

  const p: Folder = {
    companyCode,
    id: crypto.randomUUID(),
    nazov: meno,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: aktor,
  }
  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  await col.insertOne(p as never)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "zalozene", aktor,
    cielId: p.id, cielPopis: meno,
  })
  return p
}

export async function renameFolder(
  companyCode: string, id: string, nazov: string, aktor: string,
): Promise<void> {
  const meno = nazov.trim()
  if (!meno) throw new FolderError("Názov priečinka je povinný.")
  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  if (!pred) throw new FolderError("Taký priečinok tu nie je.")

  await col.updateOne({ companyCode, id }, { $set: { nazov: meno, updatedAt: new Date(), updatedBy: aktor } })
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "premenovane", aktor,
    cielId: id, cielPopis: meno, zmeny: { nazov: { z: pred.nazov, na: meno } },
  })
}

export async function moveFolder(
  companyCode: string, id: string, novyParentId: string | null, aktor: string,
): Promise<void> {
  const vsetky = await allFolders(companyCode)
  const pred = vsetky.find(p => p.id === id)
  if (!pred) throw new FolderError("Taký priečinok tu nie je.")
  if (novyParentId && !vsetky.some(p => p.id === novyParentId)) {
    throw new FolderError("Nadriadený priečinok neexistuje.")
  }
  const preco = canMove(vsetky, id, novyParentId)
  if (preco) throw new FolderError(preco)

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: novyParentId ?? null, updatedAt: new Date(), updatedBy: aktor } },
  )
  const dotknutych = await recomputePaths(companyCode)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "presunute", aktor,
    cielId: id, cielPopis: pred.nazov,
    zmeny: { parentId: { z: pred.parentId, na: novyParentId ?? null } },
    poznamka: `prepočítané cesty ${dotknutych} dokumentom`,
  })
}

/**
 * Zruší priečinok. **Len prázdny** — inak by dokumenty odkazovali na niečo,
 * čo neexistuje, a zmizli by z každého filtra naraz.
 */
export async function deleteFolder(companyCode: string, id: string, aktor: string): Promise<void> {
  const vsetky = await allFolders(companyCode)
  if (children(vsetky, id).length > 0) {
    throw new FolderError("Priečinok má podpriečinky — najprv ich presuňte alebo zrušte.")
  }
  const docs = await getCollection(DOCUMENTS_COLLECTION)
  const pocet = await docs.countDocuments({ companyCode, folderId: id })
  if (pocet > 0) {
    throw new FolderError(`V priečinku je ${pocet} dokumentov — najprv ich preraďte.`)
  }

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  await col.deleteOne({ companyCode, id })
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "zrusene", aktor,
    cielId: id, cielPopis: pred?.nazov ?? null,
  })
}

/** Prepočíta `folderPath` všetkým dokumentom organizácie. */
export async function recomputePaths(companyCode: string): Promise<number> {
  const vsetky = await allFolders(companyCode)
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const dokumenty = await col
    .find({ companyCode }, { projection: { documentId: 1, folderId: 1, folderPath: 1 } })
    .toArray()

  let zmenene = 0
  for (const d of dokumenty as unknown as { documentId: string; folderId?: string | null; folderPath?: string[] }[]) {
    const nova = pathIdsTo(vsetky, d.folderId)
    const stara = d.folderPath ?? []
    if (nova.length === stara.length && nova.every((x, i) => x === stara[i])) continue
    await col.updateOne({ companyCode, documentId: d.documentId }, { $set: { folderPath: nova } })
    zmenene++
  }
  return zmenene
}

/** Koľko dokumentov je priamo v priečinku a koľko aj s podpriečinkami. */
export async function counts(
  companyCode: string,
): Promise<Map<string, { priamo: number; sPodriadenymi: number }>> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const dokumenty = await col
    .find({ companyCode }, { projection: { folderId: 1, folderPath: 1 } })
    .toArray()

  const out = new Map<string, { priamo: number; sPodriadenymi: number }>()
  const pripocitaj = (id: string, kluc: "priamo" | "sPodriadenymi") => {
    const z = out.get(id) ?? { priamo: 0, sPodriadenymi: 0 }
    z[kluc]++
    out.set(id, z)
  }
  for (const d of dokumenty as unknown as { folderId?: string | null; folderPath?: string[] }[]) {
    if (d.folderId) pripocitaj(d.folderId, "priamo")
    for (const id of d.folderPath ?? []) pripocitaj(id, "sPodriadenymi")
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
  aktor: string,
): Promise<void> {
  const vsetky = await allFolders(companyCode)
  if (folderId && !vsetky.some(p => p.id === folderId)) {
    throw new FolderError("Taký priečinok neexistuje.")
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { companyCode, documentId },
    {
      $set: {
        folderId: folderId ?? null,
        folderPath: pathIdsTo(vsetky, folderId),
        updatedAt: new Date(),
        updatedBy: aktor,
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
  smer: "hore" | "dole",
  aktor: string,
): Promise<void> {
  const vsetky = await allFolders(companyCode)
  const ja = vsetky.find(p => p.id === id)
  if (!ja) throw new FolderError("Taký priečinok tu nie je.")

  const surodenci = children(vsetky, ja.parentId ?? null)
  const kde = surodenci.findIndex(p => p.id === id)
  const kam = smer === "hore" ? kde - 1 : kde + 1
  if (kam < 0 || kam >= surodenci.length) return

  const zoradene = [...surodenci]
  const [vybraty] = zoradene.splice(kde, 1)
  zoradene.splice(kam, 0, vybraty)

  await saveFolderOrder(companyCode, zoradene.map(p => p.id), aktor)
  await writeAudit({
    companyCode, predmet: "priecinok", akcia: "preusporiadane", aktor,
    cielId: id, cielPopis: ja.nazov,
    poznamka: `posunuté ${smer} medzi súrodencami`,
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
  idVPoradi: string[],
  aktor: string,
): Promise<void> {
  const vsetky = await allFolders(companyCode)
  const podla = new Map(vsetky.map(p => [p.id, p]))

  const dotknute = idVPoradi.map(x => podla.get(x))
  if (dotknute.some(p => p === undefined)) {
    throw new FolderError("Zoznam obsahuje priečinok, ktorý tu nie je.")
  }
  const rodicia = new Set(dotknute.map(p => p!.parentId ?? "koren"))
  if (rodicia.size > 1) {
    throw new FolderError("Preusporiadať sa dá len v rámci jednej úrovne.")
  }

  const col = await getCollection<Folder>(FOLDERS_COLLECTION)
  const teraz = new Date()
  for (const [i, x] of idVPoradi.entries()) {
    await col.updateOne(
      { companyCode, id: x },
      { $set: { poradie: i, updatedAt: teraz, updatedBy: aktor } },
    )
  }
}
