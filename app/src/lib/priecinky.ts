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
 * Tvar je zámerne **ten istý ako pri útvaroch** (D49): strom s materializovanou
 * cestou na dokumente. Dva rôzne stromy s dvomi rôznymi pravidlami by nikto
 * neudržal v hlave a jeden z nich by sa začal správať inak.
 *
 * Rozdiel oproti útvarom je jeden a je vedomý: **cesta sa tu neukladá kvôli
 * čistej funkcii, ale kvôli dotazu.** Filter „tento priečinok aj s podriadenými"
 * je `{ folderPath: id }` — jeden index namiesto rekurzie pri každom zobrazení.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { zapisAudit } from "./audit"

export const PRIECINKY_COLLECTION = "cms_folders"

/** Rovnaká hranica ako pri útvaroch — a z rovnakého dôvodu (čitateľnosť). */
export const MAX_HLBKA = 6

export interface Priecinok {
  companyCode: string
  id: string
  nazov: string
  parentId: string | null
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export class PriecinokError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PriecinokError"
  }
}

export function deti(vsetky: Priecinok[], parentId: string | null): Priecinok[] {
  return vsetky
    .filter(p => (p.parentId ?? null) === parentId)
    .sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"))
}

/** Cesta od koreňa po daný priečinok vrátane. Nezacyklí sa ani na chybných dátach. */
export function cesta(vsetky: Priecinok[], id: string | null | undefined): Priecinok[] {
  if (!id) return []
  const podla = new Map(vsetky.map(p => [p.id, p]))
  const out: Priecinok[] = []
  let teraz = podla.get(id)
  let poistka = 0
  while (teraz && poistka++ < MAX_HLBKA + 2) {
    out.unshift(teraz)
    teraz = teraz.parentId ? podla.get(teraz.parentId) : undefined
  }
  return out
}

export function cestaIds(vsetky: Priecinok[], id: string | null | undefined): string[] {
  return cesta(vsetky, id).map(p => p.id)
}

export function podstrom(vsetky: Priecinok[], id: string): Set<string> {
  const out = new Set<string>([id])
  let rastie = true
  let poistka = 0
  while (rastie && poistka++ < MAX_HLBKA + 2) {
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

export function hlbka(vsetky: Priecinok[], id: string | null | undefined): number {
  return cesta(vsetky, id).length
}

/** Smie sa priečinok presunúť? Vracia dôvod, nie `false`. */
export function smieSaPresunut(
  vsetky: Priecinok[],
  id: string,
  novyParentId: string | null,
): string | null {
  if (!novyParentId) return null
  if (novyParentId === id) return "Priečinok nemôže byť nadriadený sám sebe."

  const pod = podstrom(vsetky, id)
  if (pod.has(novyParentId)) {
    return "Priečinok sa nedá presunúť do svojho vlastného podpriečinka — vznikol by kruh."
  }

  const hlbkaRodica = hlbka(vsetky, novyParentId)
  let najhlbsie = 1
  for (const p of vsetky) {
    if (pod.has(p.id)) najhlbsie = Math.max(najhlbsie, hlbka(vsetky, p.id) - hlbka(vsetky, id) + 1)
  }
  if (hlbkaRodica + najhlbsie > MAX_HLBKA) {
    return `Štruktúra by mala viac než ${MAX_HLBKA} úrovní.`
  }
  return null
}

export interface RiadokStromu {
  priecinok: Priecinok
  uroven: number
}

export function splostiStrom(vsetky: Priecinok[], parentId: string | null = null, uroven = 1): RiadokStromu[] {
  const out: RiadokStromu[] = []
  for (const p of deti(vsetky, parentId)) {
    out.push({ priecinok: p, uroven })
    if (uroven < MAX_HLBKA) out.push(...splostiStrom(vsetky, p.id, uroven + 1))
  }
  return out
}

// ── databáza ─────────────────────────────────────────────────────────────────

export async function vsetkyPriecinky(companyCode: string): Promise<Priecinok[]> {
  const col = await getCollection<Priecinok>(PRIECINKY_COLLECTION)
  return col.find({ companyCode }).toArray()
}

export async function zalozPriecinok(
  companyCode: string,
  nazov: string,
  parentId: string | null,
  aktor: string,
): Promise<Priecinok> {
  const meno = nazov.trim()
  if (!meno) throw new PriecinokError("Názov priečinka je povinný.")

  const vsetky = await vsetkyPriecinky(companyCode)
  if (parentId && !vsetky.some(p => p.id === parentId)) {
    throw new PriecinokError("Nadriadený priečinok neexistuje.")
  }
  if (hlbka(vsetky, parentId) + 1 > MAX_HLBKA) {
    throw new PriecinokError(`Štruktúra môže mať najviac ${MAX_HLBKA} úrovní.`)
  }
  if (deti(vsetky, parentId ?? null).some(p => p.nazov.toLowerCase() === meno.toLowerCase())) {
    throw new PriecinokError(`Na tejto úrovni už priečinok „${meno}" je.`)
  }

  const p: Priecinok = {
    companyCode,
    id: crypto.randomUUID(),
    nazov: meno,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: aktor,
  }
  const col = await getCollection<Priecinok>(PRIECINKY_COLLECTION)
  await col.insertOne(p as never)
  await zapisAudit({
    companyCode, predmet: "priecinok", akcia: "zalozene", aktor,
    cielId: p.id, cielPopis: meno,
  })
  return p
}

export async function premenujPriecinok(
  companyCode: string, id: string, nazov: string, aktor: string,
): Promise<void> {
  const meno = nazov.trim()
  if (!meno) throw new PriecinokError("Názov priečinka je povinný.")
  const col = await getCollection<Priecinok>(PRIECINKY_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  if (!pred) throw new PriecinokError("Taký priečinok tu nie je.")

  await col.updateOne({ companyCode, id }, { $set: { nazov: meno, updatedAt: new Date(), updatedBy: aktor } })
  await zapisAudit({
    companyCode, predmet: "priecinok", akcia: "premenovane", aktor,
    cielId: id, cielPopis: meno, zmeny: { nazov: { z: pred.nazov, na: meno } },
  })
}

export async function presunPriecinok(
  companyCode: string, id: string, novyParentId: string | null, aktor: string,
): Promise<void> {
  const vsetky = await vsetkyPriecinky(companyCode)
  const pred = vsetky.find(p => p.id === id)
  if (!pred) throw new PriecinokError("Taký priečinok tu nie je.")
  if (novyParentId && !vsetky.some(p => p.id === novyParentId)) {
    throw new PriecinokError("Nadriadený priečinok neexistuje.")
  }
  const preco = smieSaPresunut(vsetky, id, novyParentId)
  if (preco) throw new PriecinokError(preco)

  const col = await getCollection<Priecinok>(PRIECINKY_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: novyParentId ?? null, updatedAt: new Date(), updatedBy: aktor } },
  )
  const dotknutych = await prepocitajCesty(companyCode)
  await zapisAudit({
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
export async function zrusPriecinok(companyCode: string, id: string, aktor: string): Promise<void> {
  const vsetky = await vsetkyPriecinky(companyCode)
  if (deti(vsetky, id).length > 0) {
    throw new PriecinokError("Priečinok má podpriečinky — najprv ich presuňte alebo zrušte.")
  }
  const docs = await getCollection(DOCUMENTS_COLLECTION)
  const pocet = await docs.countDocuments({ companyCode, folderId: id })
  if (pocet > 0) {
    throw new PriecinokError(`V priečinku je ${pocet} dokumentov — najprv ich preraďte.`)
  }

  const col = await getCollection<Priecinok>(PRIECINKY_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  await col.deleteOne({ companyCode, id })
  await zapisAudit({
    companyCode, predmet: "priecinok", akcia: "zrusene", aktor,
    cielId: id, cielPopis: pred?.nazov ?? null,
  })
}

/** Prepočíta `folderPath` všetkým dokumentom organizácie. */
export async function prepocitajCesty(companyCode: string): Promise<number> {
  const vsetky = await vsetkyPriecinky(companyCode)
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const dokumenty = await col
    .find({ companyCode }, { projection: { documentId: 1, folderId: 1, folderPath: 1 } })
    .toArray()

  let zmenene = 0
  for (const d of dokumenty as unknown as { documentId: string; folderId?: string | null; folderPath?: string[] }[]) {
    const nova = cestaIds(vsetky, d.folderId)
    const stara = d.folderPath ?? []
    if (nova.length === stara.length && nova.every((x, i) => x === stara[i])) continue
    await col.updateOne({ companyCode, documentId: d.documentId }, { $set: { folderPath: nova } })
    zmenene++
  }
  return zmenene
}

/** Koľko dokumentov je priamo v priečinku a koľko aj s podpriečinkami. */
export async function pocty(
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
export async function zaradDokument(
  companyCode: string,
  documentId: string,
  folderId: string | null,
  aktor: string,
): Promise<void> {
  const vsetky = await vsetkyPriecinky(companyCode)
  if (folderId && !vsetky.some(p => p.id === folderId)) {
    throw new PriecinokError("Taký priečinok neexistuje.")
  }

  const col = await getCollection(DOCUMENTS_COLLECTION)
  const r = await col.updateOne(
    { companyCode, documentId },
    {
      $set: {
        folderId: folderId ?? null,
        folderPath: cestaIds(vsetky, folderId),
        updatedAt: new Date(),
        updatedBy: aktor,
      },
    },
  )
  if (!r.matchedCount) throw new PriecinokError("Taký dokument tu nie je.")
}
