/**
 * oddelenia.ts — organizačná štruktúra ako strom (D49).
 *
 * Oddelenie bol dovtedy **voľný text** na osobe. Pri desiatich ľuďoch to stačilo;
 * pri stovke znamená, že „Legislatíva", „legislatíva" a „Legislat." sú tri
 * oddelenia a otázka „koľko ľudí má úsek" nemá odpoveď.
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
import { writeAudit } from "./audit"
import { PERSONS_COLLECTION, newDepartmentHistory } from "./persons"
import type { Person } from "./persons"

export const DEPARTMENTS_COLLECTION = "departments"

/**
 * Najväčšia hĺbka stromu.
 *
 * Nie je to technický limit, je to limit čitateľnosti: pri šiestich úrovniach
 * má odsadenie vo výbere šírku, ktorá sa na telefóne už nezmestí, a nikto
 * v takom zozname nič nenájde. Kto potrebuje viac, má spravidla v strome
 * niečo, čo je v skutočnosti skupina.
 */
export const MAX_DEPTH = 6

export interface Department {
  companyCode: string
  /** Nemenné UUID. Názov sa mení, väzby na osobách nie. */
  id: string
  nazov: string
  /** `null` = koreňové oddelenie. */
  parentId: string | null
  /**
   * Poradie medzi súrodencami (D60).
   *
   * Organizačná schéma nie je abecedný zoznam: prezident stojí nad výkonným
   * výborom bez ohľadu na to, ako sa volajú. Chýbajúce poradie znamená
   * „zatiaľ neurčené" — vtedy rozhoduje názov, ako doteraz.
   */
  poradie?: number
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export class DepartmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OddelenieError"
  }
}

// ── čisté pravidlá nad stromom ───────────────────────────────────────────────

/** Priame deti daného oddelenia, zoradené podľa názvu. */
/**
 * Priami podriadení, v poradí, ktoré určil človek.
 *
 * Bez určeného poradia rozhoduje názov — to je rozumné východisko a zároveň
 * to znamená, že sa nemuselo nič migrovať. Kto raz poradie určí, ten ho má;
 * ostatní zostanú abecedne za ním. Miešaný stav je zámerný: prinútiť
 * organizáciu očíslovať celý strom skôr, než presunie jednu položku, by
 * bolo horšie než dočasná nedôslednosť.
 */
export function children(vsetky: Department[], parentId: string | null): Department[] {
  return vsetky
    .filter(o => (o.parentId ?? null) === parentId)
    .sort((a, b) => {
      const pa = a.poradie, pb = b.poradie
      if (typeof pa === "number" && typeof pb === "number") return pa - pb
      if (typeof pa === "number") return -1
      if (typeof pb === "number") return 1
      return a.nazov.localeCompare(b.nazov, "sk")
    })
}

/**
 * Cesta od koreňa po dané oddelenie vrátane neho.
 *
 * Prázdne pole, keď oddelenie neexistuje. **Nezacyklí sa** ani pri poškodených
 * dátach — počítadlo je poistka, nie ozdoba: cyklus v strome by inak zavesil
 * požiadavku a nikto by nevedel prečo.
 */
export function pathTo(vsetky: Department[], id: string | null | undefined): Department[] {
  if (!id) return []
  const podla = new Map(vsetky.map(o => [o.id, o]))
  const out: Department[] = []
  let teraz = podla.get(id)
  let poistka = 0
  while (teraz && poistka++ < MAX_DEPTH + 2) {
    out.unshift(teraz)
    teraz = teraz.parentId ? podla.get(teraz.parentId) : undefined
  }
  return out
}

/** Identifikátory na ceste od koreňa po dané oddelenie vrátane neho. */
export function pathIdsTo(vsetky: Department[], id: string | null | undefined): string[] {
  return pathTo(vsetky, id).map(o => o.id)
}

/** Celý podstrom vrátane samotného oddelenia. */
export function subtree(vsetky: Department[], id: string): Set<string> {
  const out = new Set<string>([id])
  let rastie = true
  let poistka = 0
  while (rastie && poistka++ < MAX_DEPTH + 2) {
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
export function depth(vsetky: Department[], id: string | null | undefined): number {
  return pathTo(vsetky, id).length
}

/**
 * Smie sa oddelenie presunúť pod nového rodiča?
 *
 * Dva dôvody, prečo nie, a oba by inak rozbili strom potichu: **presun pod
 * seba alebo pod vlastného potomka** vyrobí kruh, ktorý sa z databázy nedá
 * prečítať bez zacyklenia; **prekročenie hĺbky** vyrobí zoznam, v ktorom
 * nikto nič nenájde.
 */
export function canMove(
  vsetky: Department[],
  id: string,
  novyParentId: string | null,
): string | null {
  if (!novyParentId) return null
  if (novyParentId === id) return "Oddelenie nemôže byť nadriadené samo sebe."

  const pod = subtree(vsetky, id)
  if (pod.has(novyParentId)) {
    return "Oddelenie sa nedá presunúť pod svoje vlastné podriadené — vznikol by kruh."
  }

  // Hĺbka nového rodiča + najhlbšia vetva presúvaného podstromu.
  const hlbkaRodica = depth(vsetky, novyParentId)
  let najhlbsie = 1
  for (const o of vsetky) {
    if (pod.has(o.id)) {
      najhlbsie = Math.max(najhlbsie, depth(vsetky, o.id) - depth(vsetky, id) + 1)
    }
  }
  if (hlbkaRodica + najhlbsie > MAX_DEPTH) {
    return `Štruktúra by mala viac než ${MAX_DEPTH} úrovní. Hlbší strom sa vo výbere nedá prehľadne ukázať.`
  }
  return null
}

/** Strom sploštený do zoznamu s hĺbkou — na výber a na výpis. */
export interface DepartmentRow {
  oddelenie: Department
  uroven: number
}

export function flattenTree(vsetky: Department[], parentId: string | null = null, uroven = 1): DepartmentRow[] {
  const out: DepartmentRow[] = []
  for (const o of children(vsetky, parentId)) {
    out.push({ oddelenie: o, uroven })
    if (uroven < MAX_DEPTH) out.push(...flattenTree(vsetky, o.id, uroven + 1))
  }
  return out
}

// ── databáza ─────────────────────────────────────────────────────────────────

export async function allDepartments(companyCode: string): Promise<Department[]> {
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  return col.find({ companyCode }).toArray()
}

export async function createDepartment(
  companyCode: string,
  nazov: string,
  parentId: string | null,
  actor: string,
): Promise<Department> {
  const meno = nazov.trim()
  if (!meno) throw new DepartmentError("Názov oddelenia je povinný.")

  const vsetky = await allDepartments(companyCode)
  if (parentId && !vsetky.some(o => o.id === parentId)) {
    throw new DepartmentError("Nadriadené oddelenie neexistuje.")
  }
  if (depth(vsetky, parentId) + 1 > MAX_DEPTH) {
    throw new DepartmentError(`Štruktúra môže mať najviac ${MAX_DEPTH} úrovní.`)
  }
  // Rovnaký názov pod tým istým rodičom je takmer vždy preklep alebo dvojité
  // odoslanie formulára — a dve oddelenia s rovnakým názvom vedľa seba sa
  // v zozname nedajú rozlíšiť.
  if (children(vsetky, parentId).some(o => o.nazov.toLowerCase() === meno.toLowerCase())) {
    throw new DepartmentError(`Na tomto mieste už oddelenie „${meno}" je.`)
  }

  const o: Department = {
    companyCode,
    id: crypto.randomUUID(),
    nazov: meno,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: actor,
  }
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  await col.insertOne(o as never)
  await writeAudit({
    companyCode, predmet: "oddelenie", akcia: "zalozene", aktor: actor,
    cielId: o.id, cielPopis: o.nazov,
    zmeny: { parentId: { na: o.parentId } },
  })
  return o
}

export async function renameDepartment(
  companyCode: string,
  id: string,
  nazov: string,
  actor: string,
): Promise<void> {
  const meno = nazov.trim()
  if (!meno) throw new DepartmentError("Názov oddelenia je povinný.")
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  if (!pred) throw new DepartmentError("Také oddelenie tu nie je.")

  await col.updateOne(
    { companyCode, id },
    { $set: { nazov: meno, updatedAt: new Date(), updatedBy: actor } },
  )
  await writeAudit({
    companyCode, predmet: "oddelenie", akcia: "premenovane", aktor: actor,
    cielId: id, cielPopis: meno,
    zmeny: { nazov: { z: pred.nazov, na: meno } },
  })
}

/**
 * Presunie oddelenie pod iného rodiča a **prepočíta cesty osobám**.
 *
 * Prepočet je tu, nie v volajúcom: keby sa naň dalo zabudnúť, pridelenie
 * „úseku a všetkému pod ním" by po presune tíško míňalo ľudí, ktorí tam
 * patria — a nikto by to nespojil s presunom spred mesiaca.
 */
export async function moveDepartment(
  companyCode: string,
  id: string,
  novyParentId: string | null,
  actor: string,
): Promise<void> {
  const vsetky = await allDepartments(companyCode)
  if (!vsetky.some(o => o.id === id)) throw new DepartmentError("Také oddelenie tu nie je.")
  if (novyParentId && !vsetky.some(o => o.id === novyParentId)) {
    throw new DepartmentError("Nadriadené oddelenie neexistuje.")
  }

  const preco = canMove(vsetky, id, novyParentId)
  if (preco) throw new DepartmentError(preco)

  const pred = vsetky.find(o => o.id === id)!
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: novyParentId ?? null, updatedAt: new Date(), updatedBy: actor } },
  )
  const dotknutych = await recomputePaths(companyCode)
  await writeAudit({
    companyCode, predmet: "oddelenie", akcia: "presunute", aktor: actor,
    cielId: id, cielPopis: pred.nazov,
    zmeny: { parentId: { z: pred.parentId, na: novyParentId ?? null } },
    // Presun mení, koho sa týkajú pridelenia celého podstromu. Počet je tu
    // preto, aby bolo pri kontrole vidieť rozsah, nielen fakt zmeny.
    poznamka: `prepočítané cesty ${dotknutych} osobám`,
  })
}

/**
 * Zmaže oddelenie. **Len prázdne** — inak by ľudia aj podriadené oddelenia
 * zostali odkazovať na niečo, čo neexistuje, a zmizli by zo štruktúry bez
 * toho, aby to niekto videl.
 */
export async function deleteDepartment(companyCode: string, id: string, actor: string): Promise<void> {
  const vsetky = await allDepartments(companyCode)
  if (children(vsetky, id).length > 0) {
    throw new DepartmentError("Oddelenie má podriadené — najprv ich presuňte alebo zmažte.")
  }

  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const pocet = await personCol.countDocuments({ companyCode, departmentId: id })
  if (pocet > 0) {
    throw new DepartmentError(
      `Do oddelenia patrí ${pocet} ${pocet === 1 ? "osoba" : pocet < 5 ? "osoby" : "osôb"} — najprv ich preraďte.`,
    )
  }

  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const pred = await col.findOne({ companyCode, id })
  await col.deleteOne({ companyCode, id })
  await writeAudit({
    companyCode, predmet: "oddelenie", akcia: "zrusene", aktor: actor,
    cielId: id, cielPopis: pred?.nazov ?? null,
  })
}

/**
 * Prepočíta `departmentPath` všetkým osobám organizácie.
 *
 * Volá sa po každej zmene tvaru stromu. Je to jediné miesto, kde sa
 * materializovaná cesta zapisuje — druhé by sa s ním rozišlo presne pri
 * reorganizácii, teda vtedy, keď na tom najviac záleží.
 */
export async function recomputePaths(companyCode: string): Promise<number> {
  const vsetky = await allDepartments(companyCode)
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoby = await col
    .find({ companyCode }, { projection: { id: 1, departmentId: 1, departmentPath: 1, departmentHistory: 1 } })
    .toArray()

  let zmenene = 0
  for (const o of osoby) {
    const nova = pathIdsTo(vsetky, o.departmentId)
    const stara = o.departmentPath ?? []
    if (nova.length === stara.length && nova.every((x, i) => x === stara[i])) continue
    // Cesta sa zmenila presunom vetvy, nie presunom človeka — oddelenie má
    // rovnaký, takže sa **neotvára nový záznam histórie**, len sa opraví
    // cesta v tom otvorenom. Inak by presun vetvy vyzeral ako to, že do
    // svojho oddelenia práve prišli všetci naraz.
    await col.updateOne(
      { companyCode, id: o.id },
      {
        $set: {
          departmentPath: nova,
          departmentHistory: newDepartmentHistory(o.departmentHistory, o.departmentId ?? null, nova, new Date()),
        },
      } as never,
    )
    zmenene++
  }
  return zmenene
}

/** Koľko ľudí patrí priamo do oddelenia a koľko aj s podriadenými. */
export async function counts(companyCode: string): Promise<Map<string, { priamo: number; sPodriadenymi: number }>> {
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
 * ale pridelenie „oddelenia a jeho podriadeným" sa jej netýka — a nikto by
 * neuhádol, prečo jednému človeku úloha nepribudla.
 */
export async function assignPerson(
  companyCode: string,
  personId: string,
  departmentId: string | null,
  actor: string,
): Promise<void> {
  const vsetky = await allDepartments(companyCode)
  if (departmentId && !vsetky.some(o => o.id === departmentId)) {
    throw new DepartmentError("Také oddelenie neexistuje.")
  }

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const osoba = await col.findOne({ companyCode, id: personId })
  if (!osoba) throw new DepartmentError("Osoba sa nenašla.")

  const teraz = new Date()
  const novaCesta = pathIdsTo(vsetky, departmentId)
  await col.updateOne(
    { companyCode, id: personId },
    {
      $set: {
        departmentId: departmentId ?? null,
        departmentPath: novaCesta,
        departmentHistory: newDepartmentHistory(
          osoba.departmentHistory, departmentId ?? null, novaCesta, teraz,
        ),
        updatedAt: teraz,
        updatedBy: actor,
      },
    } as never,
  )
  await writeAudit({
    companyCode, predmet: "osoba", akcia: "zmenene", aktor: actor,
    cielId: personId, cielPopis: osoba.fullName,
    zmeny: { departmentId: { z: osoba.departmentId ?? null, na: departmentId ?? null } },
  })
}


/**
 * Prehodí oddelenie o jedno miesto hore alebo dole **medzi súrodencami** (D60).
 *
 * Nikdy nemení nadriadené oddelenie — na to je presun. Sú to dve rôzne veci
 * a zlúčiť ich do jedného ťahania by znamenalo, že sa človek pri
 * preusporadúvaní omylom prepadne o úroveň nižšie.
 *
 * Prepisuje poradie **celej úrovne**, nie len dvoch dotknutých: časť
 * súrodencov nemusí mať poradie určené vôbec a bez prečíslovania by sa
 * výsledok líšil od toho, čo človek videl.
 */
export async function shiftDepartment(
  companyCode: string,
  id: string,
  smer: "hore" | "dole",
  aktor: string,
): Promise<void> {
  const vsetky = await allDepartments(companyCode)
  const ja = vsetky.find(o => o.id === id)
  if (!ja) throw new DepartmentError("Také oddelenie tu nie je.")

  const surodenci = children(vsetky, ja.parentId ?? null)
  const kde = surodenci.findIndex(o => o.id === id)
  const kam = smer === "hore" ? kde - 1 : kde + 1
  if (kam < 0 || kam >= surodenci.length) return

  const zoradene = [...surodenci]
  const [vybrate] = zoradene.splice(kde, 1)
  zoradene.splice(kam, 0, vybrate)

  await saveOrder(companyCode, zoradene.map(o => o.id), aktor)
  await writeAudit({
    companyCode, predmet: "oddelenie", akcia: "preusporiadane", aktor,
    cielId: id, cielPopis: ja.nazov,
    poznamka: `posunuté ${smer} medzi súrodencami`,
  })
}

/**
 * Zapíše poradie súrodencov podľa zoznamu identifikátorov.
 *
 * Prijíma **len oddelenia s tým istým nadriadeným** — zoznam z prehliadača
 * by inak vedel prepísať poradie naprieč celým stromom, a to je zmena
 * štruktúry maskovaná ako preusporiadanie.
 */
export async function saveOrder(
  companyCode: string,
  idVPoradi: string[],
  aktor: string,
): Promise<void> {
  const vsetky = await allDepartments(companyCode)
  const podla = new Map(vsetky.map(o => [o.id, o]))

  const dotknute = idVPoradi.map(x => podla.get(x)).filter(o => o !== undefined)
  if (dotknute.length !== idVPoradi.length) {
    throw new DepartmentError("Zoznam obsahuje oddelenie, ktoré tu nie je.")
  }
  const rodicia = new Set(dotknute.map(o => o!.parentId ?? "koren"))
  if (rodicia.size > 1) {
    throw new DepartmentError("Preusporiadať sa dá len v rámci jednej úrovne.")
  }

  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const teraz = new Date()
  for (const [i, x] of idVPoradi.entries()) {
    await col.updateOne(
      { companyCode, id: x },
      { $set: { poradie: i, updatedAt: teraz, updatedBy: aktor } },
    )
  }
}
