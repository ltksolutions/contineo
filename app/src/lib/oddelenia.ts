/**
 * oddelenia.ts — organizačná štruktúra ako strom (D49).
 *
 * Útvar bol dovtedy **voľný text** na osobe. Pri desiatich ľuďoch to stačilo;
 * pri stovke znamená, že „Legislatíva", „legislatíva" a „Legislat." sú tri
 * útvary a otázka „koľko ľudí má úsek" nemá odpoveď.
 *
 * **Oddelenie a skupina sú dve rôzne veci** a nesmú sa zlúčiť:
 *
 *   - **oddelenie** je *kam patrím* — miesto v štruktúre. Práve jedno, tak
 *     ako v organizačnej schéme.
 *   - **skupina** je *komu sa to posiela* — adresát. Koľko treba, naprieč
 *     oddeleniami (rozhodcovia, delegáti, štatutári).
 *
 * Zlúčiť ich by znamenalo, že normu pre rozhodcov nemožno poslať bez toho, aby
 * rozhodcovia boli oddelenie — čím prestane platiť, že oddelenie je štruktúra.
 *
 * ## Materializovaná cesta
 *
 * Osoba nesie okrem `departmentId` aj **`departmentPath`** — identifikátory
 * všetkých nadriadených oddelení od koreňa po seba. Je to zámerná duplicita
 * a stojí za vysvetlenie, lebo inde v tomto projekte sa odvodené hodnoty
 * neukladajú (D27).
 *
 * Dôvod: pridelenie normy „úseku a všetkému pod ním" musí vedieť rozhodnúť
 * `matchesAudience()`, a tá je **čistá funkcia bez databázy** — je to jediné
 * miesto s pravidlom príslušnosti a testuje sa bez clustera. Bez cesty na
 * osobe by musela dostať celý strom, čiže by prestala byť čistá, alebo by
 * vznikla druhá kópia pravidla.
 *
 * Cena je jasná a treba ju vedieť: **pri presune oddelenia sa cesty musia
 * prepočítať** všetkým osobám v podstrome. Robí to `prepocitajCesty()` a volá
 * sa to z každého miesta, ktoré stromom hýbe.
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, novaHistoriaUtvarov } from "./persons"
import type { Person } from "./persons"

export const ODDELENIA_COLLECTION = "departments"

/**
 * Najväčšia hĺbka stromu.
 *
 * Nie je to technický limit, je to limit čitateľnosti: pri šiestich úrovniach
 * má odsadenie vo výbere šírku, ktorá sa na telefóne už nezmestí, a nikto
 * v takom zozname nič nenájde. Kto potrebuje viac, má spravidla v strome
 * niečo, čo je v skutočnosti skupina.
 */
export const MAX_HLBKA = 6

export interface Oddelenie {
  companyCode: string
  /** Nemenné UUID. Názov sa mení, väzby na osobách nie. */
  id: string
  nazov: string
  /** `null` = koreňové oddelenie. */
  parentId: string | null
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export class OddelenieError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OddelenieError"
  }
}

// ── čisté pravidlá nad stromom ───────────────────────────────────────────────

/** Priame deti daného oddelenia, zoradené podľa názvu. */
export function deti(vsetky: Oddelenie[], parentId: string | null): Oddelenie[] {
  return vsetky
    .filter(o => (o.parentId ?? null) === parentId)
    .sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"))
}

/**
 * Cesta od koreňa po dané oddelenie vrátane neho.
 *
 * Prázdne pole, keď oddelenie neexistuje. **Nezacyklí sa** ani pri poškodených
 * dátach — počítadlo je poistka, nie ozdoba: cyklus v strome by inak zavesil
 * požiadavku a nikto by nevedel prečo.
 */
export function cesta(vsetky: Oddelenie[], id: string | null | undefined): Oddelenie[] {
  if (!id) return []
  const podla = new Map(vsetky.map(o => [o.id, o]))
  const out: Oddelenie[] = []
  let teraz = podla.get(id)
  let poistka = 0
  while (teraz && poistka++ < MAX_HLBKA + 2) {
    out.unshift(teraz)
    teraz = teraz.parentId ? podla.get(teraz.parentId) : undefined
  }
  return out
}

/** Identifikátory na ceste od koreňa po dané oddelenie vrátane neho. */
export function cestaIds(vsetky: Oddelenie[], id: string | null | undefined): string[] {
  return cesta(vsetky, id).map(o => o.id)
}

/** Celý podstrom vrátane samotného oddelenia. */
export function podstrom(vsetky: Oddelenie[], id: string): Set<string> {
  const out = new Set<string>([id])
  let rastie = true
  let poistka = 0
  while (rastie && poistka++ < MAX_HLBKA + 2) {
    rastie = false
    for (const o of vsetky) {
      if (o.parentId && out.has(o.parentId) && !out.has(o.id)) {
        out.add(o.id)
        rastie = true
      }
    }
  }
  return out
}

/** Hĺbka oddelenia. Koreň má 1. */
export function hlbka(vsetky: Oddelenie[], id: string | null | undefined): number {
  return cesta(vsetky, id).length
}

/**
 * Smie sa oddelenie presunúť pod nového rodiča?
 *
 * Dva dôvody, prečo nie, a oba by inak rozbili strom potichu: **presun pod
 * seba alebo pod vlastného potomka** vyrobí kruh, ktorý sa z databázy nedá
 * prečítať bez zacyklenia; **prekročenie hĺbky** vyrobí zoznam, v ktorom
 * nikto nič nenájde.
 */
export function smieSaPresunut(
  vsetky: Oddelenie[],
  id: string,
  novyParentId: string | null,
): string | null {
  if (!novyParentId) return null
  if (novyParentId === id) return "Oddelenie nemôže byť nadriadené samo sebe."

  const pod = podstrom(vsetky, id)
  if (pod.has(novyParentId)) {
    return "Oddelenie sa nedá presunúť pod svoje vlastné podriadené — vznikol by kruh."
  }

  // Hĺbka nového rodiča + najhlbšia vetva presúvaného podstromu.
  const hlbkaRodica = hlbka(vsetky, novyParentId)
  let najhlbsie = 1
  for (const o of vsetky) {
    if (pod.has(o.id)) {
      najhlbsie = Math.max(najhlbsie, hlbka(vsetky, o.id) - hlbka(vsetky, id) + 1)
    }
  }
  if (hlbkaRodica + najhlbsie > MAX_HLBKA) {
    return `Štruktúra by mala viac než ${MAX_HLBKA} úrovní. Hlbší strom sa vo výbere nedá prehľadne ukázať.`
  }
  return null
}

/** Strom sploštený do zoznamu s hĺbkou — na výber a na výpis. */
export interface RiadokStromu {
  oddelenie: Oddelenie
  uroven: number
}

export function splostiStrom(vsetky: Oddelenie[], parentId: string | null = null, uroven = 1): RiadokStromu[] {
  const out: RiadokStromu[] = []
  for (const o of deti(vsetky, parentId)) {
    out.push({ oddelenie: o, uroven })
    if (uroven < MAX_HLBKA) out.push(...splostiStrom(vsetky, o.id, uroven + 1))
  }
  return out
}

// ── databáza ─────────────────────────────────────────────────────────────────

export async function vsetkyOddelenia(companyCode: string): Promise<Oddelenie[]> {
  const col = await getCollection<Oddelenie>(ODDELENIA_COLLECTION)
  return col.find({ companyCode }).toArray()
}

export async function zalozOddelenie(
  companyCode: string,
  nazov: string,
  parentId: string | null,
  actor: string,
): Promise<Oddelenie> {
  const meno = nazov.trim()
  if (!meno) throw new OddelenieError("Názov oddelenia je povinný.")

  const vsetky = await vsetkyOddelenia(companyCode)
  if (parentId && !vsetky.some(o => o.id === parentId)) {
    throw new OddelenieError("Nadriadené oddelenie neexistuje.")
  }
  if (hlbka(vsetky, parentId) + 1 > MAX_HLBKA) {
    throw new OddelenieError(`Štruktúra môže mať najviac ${MAX_HLBKA} úrovní.`)
  }
  // Rovnaký názov pod tým istým rodičom je takmer vždy preklep alebo dvojité
  // odoslanie formulára — a dve oddelenia s rovnakým názvom vedľa seba sa
  // v zozname nedajú rozlíšiť.
  if (deti(vsetky, parentId).some(o => o.nazov.toLowerCase() === meno.toLowerCase())) {
    throw new OddelenieError(`Na tomto mieste už oddelenie „${meno}" je.`)
  }

  const o: Oddelenie = {
    companyCode,
    id: crypto.randomUUID(),
    nazov: meno,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: actor,
  }
  const col = await getCollection<Oddelenie>(ODDELENIA_COLLECTION)
  await col.insertOne(o as never)
  return o
}

export async function premenujOddelenie(
  companyCode: string,
  id: string,
  nazov: string,
  actor: string,
): Promise<void> {
  const meno = nazov.trim()
  if (!meno) throw new OddelenieError("Názov oddelenia je povinný.")
  const col = await getCollection<Oddelenie>(ODDELENIA_COLLECTION)
  const r = await col.updateOne(
    { companyCode, id },
    { $set: { nazov: meno, updatedAt: new Date(), updatedBy: actor } },
  )
  if (!r.matchedCount) throw new OddelenieError("Také oddelenie tu nie je.")
}

/**
 * Presunie oddelenie pod iného rodiča a **prepočíta cesty osobám**.
 *
 * Prepočet je tu, nie v volajúcom: keby sa naň dalo zabudnúť, pridelenie
 * „úseku a všetkému pod ním" by po presune tíško míňalo ľudí, ktorí tam
 * patria — a nikto by to nespojil s presunom spred mesiaca.
 */
export async function presunOddelenie(
  companyCode: string,
  id: string,
  novyParentId: string | null,
  actor: string,
): Promise<void> {
  const vsetky = await vsetkyOddelenia(companyCode)
  if (!vsetky.some(o => o.id === id)) throw new OddelenieError("Také oddelenie tu nie je.")
  if (novyParentId && !vsetky.some(o => o.id === novyParentId)) {
    throw new OddelenieError("Nadriadené oddelenie neexistuje.")
  }

  const preco = smieSaPresunut(vsetky, id, novyParentId)
  if (preco) throw new OddelenieError(preco)

  const col = await getCollection<Oddelenie>(ODDELENIA_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: novyParentId ?? null, updatedAt: new Date(), updatedBy: actor } },
  )
  await prepocitajCesty(companyCode)
}

/**
 * Zmaže oddelenie. **Len prázdne** — inak by ľudia aj podriadené oddelenia
 * zostali odkazovať na niečo, čo neexistuje, a zmizli by zo štruktúry bez
 * toho, aby to niekto videl.
 */
export async function zmazOddelenie(companyCode: string, id: string): Promise<void> {
  const vsetky = await vsetkyOddelenia(companyCode)
  if (deti(vsetky, id).length > 0) {
    throw new OddelenieError("Oddelenie má podriadené — najprv ich presuňte alebo zmažte.")
  }

  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const pocet = await personCol.countDocuments({ companyCode, departmentId: id })
  if (pocet > 0) {
    throw new OddelenieError(
      `Do oddelenia patrí ${pocet} ${pocet === 1 ? "osoba" : pocet < 5 ? "osoby" : "osôb"} — najprv ich preraďte.`,
    )
  }

  const col = await getCollection<Oddelenie>(ODDELENIA_COLLECTION)
  await col.deleteOne({ companyCode, id })
}

/**
 * Prepočíta `departmentPath` všetkým osobám organizácie.
 *
 * Volá sa po každej zmene tvaru stromu. Je to jediné miesto, kde sa
 * materializovaná cesta zapisuje — druhé by sa s ním rozišlo presne pri
 * reorganizácii, teda vtedy, keď na tom najviac záleží.
 */
export async function prepocitajCesty(companyCode: string): Promise<number> {
  const vsetky = await vsetkyOddelenia(companyCode)
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoby = await col
    .find({ companyCode }, { projection: { id: 1, departmentId: 1, departmentPath: 1, departmentHistory: 1 } })
    .toArray()

  let zmenene = 0
  for (const o of osoby) {
    const nova = cestaIds(vsetky, o.departmentId)
    const stara = o.departmentPath ?? []
    if (nova.length === stara.length && nova.every((x, i) => x === stara[i])) continue
    // Cesta sa zmenila presunom vetvy, nie presunom človeka — útvar má
    // rovnaký, takže sa **neotvára nový záznam histórie**, len sa opraví
    // cesta v tom otvorenom. Inak by presun vetvy vyzeral ako to, že do
    // svojho útvaru práve prišli všetci naraz.
    await col.updateOne(
      { companyCode, id: o.id },
      {
        $set: {
          departmentPath: nova,
          departmentHistory: novaHistoriaUtvarov(o.departmentHistory, o.departmentId ?? null, nova, new Date()),
        },
      } as never,
    )
    zmenene++
  }
  return zmenene
}

/** Koľko ľudí patrí priamo do oddelenia a koľko aj s podriadenými. */
export async function pocty(companyCode: string): Promise<Map<string, { priamo: number; sPodriadenymi: number }>> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoby = await col
    .find(
      { companyCode, status: { $ne: "inactive" } },
      { projection: { departmentId: 1, departmentPath: 1 } },
    )
    .toArray()

  const out = new Map<string, { priamo: number; sPodriadenymi: number }>()
  const pripocitaj = (id: string, kluc: "priamo" | "sPodriadenymi") => {
    const z = out.get(id) ?? { priamo: 0, sPodriadenymi: 0 }
    z[kluc]++
    out.set(id, z)
  }

  for (const o of osoby) {
    if (o.departmentId) pripocitaj(o.departmentId, "priamo")
    // Cesta obsahuje aj samotné oddelenie, takže „s podriadenými" vyjde
    // rovno z nej a netreba prechádzať strom.
    for (const id of o.departmentPath ?? []) pripocitaj(id, "sPodriadenymi")
  }
  return out
}

/**
 * Zaradí osobu do oddelenia (alebo ju vyradí, keď je `departmentId` `null`).
 *
 * Cestu zapisuje **v tom istom zápise** ako samotné zaradenie. Keby sa nechala
 * na neskorší prepočet, existoval by okamih, v ktorom osoba do oddelenia patrí,
 * ale pridelenie „útvaru a jeho podriadeným" sa jej netýka — a nikto by
 * neuhádol, prečo jednému človeku úloha nepribudla.
 */
export async function zaradOsobu(
  companyCode: string,
  personId: string,
  departmentId: string | null,
  actor: string,
): Promise<void> {
  const vsetky = await vsetkyOddelenia(companyCode)
  if (departmentId && !vsetky.some(o => o.id === departmentId)) {
    throw new OddelenieError("Také oddelenie neexistuje.")
  }

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoba = await col.findOne({ companyCode, id: personId })
  if (!osoba) throw new OddelenieError("Osoba sa nenašla.")

  const teraz = new Date()
  const novaCesta = cestaIds(vsetky, departmentId)
  await col.updateOne(
    { companyCode, id: personId },
    {
      $set: {
        departmentId: departmentId ?? null,
        departmentPath: novaCesta,
        departmentHistory: novaHistoriaUtvarov(
          osoba.departmentHistory, departmentId ?? null, novaCesta, teraz,
        ),
        updatedAt: teraz,
        updatedBy: actor,
      },
    } as never,
  )
}
