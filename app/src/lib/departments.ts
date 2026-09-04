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
import { AppError, type Reason } from "./appError"

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
  name: string
  /** `null` = koreňové oddelenie. */
  parentId: string | null
  /**
   * Poradie medzi súrodencami (D60).
   *
   * Organizačná schéma nie je abecedný zoznam: prezident stojí nad výkonným
   * výborom bez ohľadu na to, ako sa volajú. Chýbajúce poradie znamená
   * „zatiaľ neurčené" — vtedy rozhoduje názov, ako doteraz.
   */
  order?: number
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export class DepartmentError extends AppError {}

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
export function children(all: Department[], parentId: string | null): Department[] {
  return all
    .filter(o => (o.parentId ?? null) === parentId)
    .sort((a, b) => {
      const pa = a.order, pb = b.order
      if (typeof pa === "number" && typeof pb === "number") return pa - pb
      if (typeof pa === "number") return -1
      if (typeof pb === "number") return 1
      return a.name.localeCompare(b.name, "sk")
    })
}

/**
 * Cesta od koreňa po dané oddelenie vrátane neho.
 *
 * Prázdne pole, keď oddelenie neexistuje. **Nezacyklí sa** ani pri poškodených
 * dátach — počítadlo je poistka, nie ozdoba: cyklus v strome by inak zavesil
 * požiadavku a nikto by nevedel prečo.
 */
export function pathTo(all: Department[], id: string | null | undefined): Department[] {
  if (!id) return []
  const byId = new Map(all.map(o => [o.id, o]))
  const out: Department[] = []
  let current = byId.get(id)
  let guard = 0
  while (current && guard++ < MAX_DEPTH + 2) {
    out.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return out
}

/** Identifikátory na ceste od koreňa po dané oddelenie vrátane neho. */
export function pathIdsTo(all: Department[], id: string | null | undefined): string[] {
  return pathTo(all, id).map(o => o.id)
}

/** Celý podstrom vrátane samotného oddelenia. */
export function subtree(all: Department[], id: string): Set<string> {
  const out = new Set<string>([id])
  let growing = true
  let guard = 0
  while (growing && guard++ < MAX_DEPTH + 2) {
    growing = false
    for (const o of all) {
      if (o.parentId && out.has(o.parentId) && !out.has(o.id)) {
        out.add(o.id)
        growing = true
      }
    }
  }
  return out
}

/** Hĺbka oddelenia. Koreň má 1. */
export function depth(all: Department[], id: string | null | undefined): number {
  return pathTo(all, id).length
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
  all: Department[],
  id: string,
  newParentId: string | null,
): Reason | null {
  if (!newParentId) return null
  if (newParentId === id) return { code: "department.selfParent" }

  const inside = subtree(all, id)
  if (inside.has(newParentId)) return { code: "department.ownSubtree" }

  // Hĺbka nového rodiča + najhlbšia vetva presúvaného podstromu.
  const parentDepth = depth(all, newParentId)
  let deepest = 1
  for (const o of all) {
    if (inside.has(o.id)) {
      deepest = Math.max(deepest, depth(all, o.id) - depth(all, id) + 1)
    }
  }
  if (parentDepth + deepest > MAX_DEPTH) {
    return { code: "department.wouldExceedDepth", params: { max: MAX_DEPTH } }
  }
  return null
}

/** Strom sploštený do zoznamu s hĺbkou — na výber a na výpis. */
export interface DepartmentRow {
  department: Department
  level: number
}

export function flattenTree(all: Department[], parentId: string | null = null, level = 1): DepartmentRow[] {
  const out: DepartmentRow[] = []
  for (const o of children(all, parentId)) {
    out.push({ department: o, level: level })
    if (level < MAX_DEPTH) out.push(...flattenTree(all, o.id, level + 1))
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
  name: string,
  parentId: string | null,
  actor: string,
): Promise<Department> {
  const actorName = name.trim()
  if (!actorName) throw new DepartmentError("department.nameRequired", "Názov oddelenia je povinný.")

  const all = await allDepartments(companyCode)
  if (parentId && !all.some(o => o.id === parentId)) {
    throw new DepartmentError("department.parentMissing", "Nadriadené oddelenie neexistuje.")
  }
  if (depth(all, parentId) + 1 > MAX_DEPTH) {
    throw new DepartmentError(
      "department.tooDeep",
      `Štruktúra môže mať najviac ${MAX_DEPTH} úrovní.`,
      { max: MAX_DEPTH },
    )
  }
  // Rovnaký názov pod tým istým rodičom je takmer vždy preklep alebo dvojité
  // odoslanie formulára — a dve oddelenia s rovnakým názvom vedľa seba sa
  // v zozname nedajú rozlíšiť.
  if (children(all, parentId).some(o => o.name.toLowerCase() === actorName.toLowerCase())) {
    throw new DepartmentError(
      "department.duplicateName",
      `Na tomto mieste už oddelenie „${actorName}" je.`,
      { name: actorName },
    )
  }

  const o: Department = {
    companyCode,
    id: crypto.randomUUID(),
    name: actorName,
    parentId: parentId ?? null,
    createdAt: new Date(),
    createdBy: actor,
  }
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  await col.insertOne(o as never)
  await writeAudit({
    companyCode, subject: "department", action: "created", actor: actor,
    targetId: o.id, targetLabel: o.name,
    changes: { parentId: { to: o.parentId } },
  })
  return o
}

export async function renameDepartment(
  companyCode: string,
  id: string,
  name: string,
  actor: string,
): Promise<void> {
  const actorName = name.trim()
  if (!actorName) throw new DepartmentError("department.nameRequired", "Názov oddelenia je povinný.")
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const before = await col.findOne({ companyCode, id })
  if (!before) throw new DepartmentError("department.notFound", "Také oddelenie tu nie je.")

  await col.updateOne(
    { companyCode, id },
    { $set: { name: actorName, updatedAt: new Date(), updatedBy: actor } },
  )
  await writeAudit({
    companyCode, subject: "department", action: "renamed", actor: actor,
    targetId: id, targetLabel: actorName,
    changes: { name: { from: before.name, to: actorName } },
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
  newParentId: string | null,
  actor: string,
): Promise<void> {
  const all = await allDepartments(companyCode)
  if (!all.some(o => o.id === id)) throw new DepartmentError("department.notFound", "Také oddelenie tu nie je.")
  if (newParentId && !all.some(o => o.id === newParentId)) {
    throw new DepartmentError("department.parentMissing", "Nadriadené oddelenie neexistuje.")
  }

  const why = canMove(all, id, newParentId)
  // Dôvod je kód, nie veta — text sa skladá až na obrazovke.
  if (why) throw new DepartmentError(why.code, "Presun sa nedá spraviť.", why.params)

  const before = all.find(o => o.id === id)!
  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  await col.updateOne(
    { companyCode, id },
    { $set: { parentId: newParentId ?? null, updatedAt: new Date(), updatedBy: actor } },
  )
  const affectedCount = await recomputePaths(companyCode)
  await writeAudit({
    companyCode, subject: "department", action: "moved", actor: actor,
    targetId: id, targetLabel: before.name,
    changes: { parentId: { from: before.parentId, to: newParentId ?? null } },
    // Presun mení, koho sa týkajú pridelenia celého podstromu. Počet je tu
    // preto, aby bolo pri kontrole vidieť rozsah, nielen fakt zmeny.
    note: `prepočítané cesty ${affectedCount} osobám`,
  })
}

/**
 * Zmaže oddelenie. **Len prázdne** — inak by ľudia aj podriadené oddelenia
 * zostali odkazovať na niečo, čo neexistuje, a zmizli by zo štruktúry bez
 * toho, aby to niekto videl.
 */
export async function deleteDepartment(companyCode: string, id: string, actor: string): Promise<void> {
  const all = await allDepartments(companyCode)
  if (children(all, id).length > 0) {
    throw new DepartmentError("department.hasChildren", "Oddelenie má podriadené — najprv ich presuňte alebo zmažte.")
  }

  const personCol = await getCollection<Person>(PERSONS_COLLECTION)
  const count = await personCol.countDocuments({ companyCode, departmentId: id })
  if (count > 0) {
    throw new DepartmentError(
      "department.hasPeople",
      `Do oddelenia patrí ${count} ${count === 1 ? "osoba" : count < 5 ? "osoby" : "osôb"} — najprv ich preraďte.`,
      { count },
    )
  }

  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const before = await col.findOne({ companyCode, id })
  await col.deleteOne({ companyCode, id })
  await writeAudit({
    companyCode, subject: "department", action: "deleted", actor: actor,
    targetId: id, targetLabel: before?.name ?? null,
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
  const all = await allDepartments(companyCode)
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find({ companyCode }, { projection: { id: 1, departmentId: 1, departmentPath: 1, departmentHistory: 1 } })
    .toArray()

  let changed = 0
  for (const o of people) {
    const next = pathIdsTo(all, o.departmentId)
    const old = o.departmentPath ?? []
    if (next.length === old.length && next.every((x, i) => x === old[i])) continue
    // Cesta sa zmenila presunom vetvy, nie presunom človeka — oddelenie má
    // rovnaký, takže sa **neotvára nový záznam histórie**, len sa opraví
    // cesta v tom otvorenom. Inak by presun vetvy vyzeral ako to, že do
    // svojho oddelenia práve prišli všetci naraz.
    await col.updateOne(
      { companyCode, id: o.id },
      {
        $set: {
          departmentPath: next,
          departmentHistory: newDepartmentHistory(o.departmentHistory, o.departmentId ?? null, next, new Date()),
        },
      } as never,
    )
    changed++
  }
  return changed
}

/** Koľko ľudí patrí direct do oddelenia a koľko aj s podriadenými. */
export async function counts(companyCode: string): Promise<Map<string, { direct: number; withDescendants: number }>> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find(
      { companyCode, status: { $ne: "inactive" } },
      { projection: { departmentId: 1, departmentPath: 1 } },
    )
    .toArray()

  const out = new Map<string, { direct: number; withDescendants: number }>()
  const addTo = (id: string, key: "direct" | "withDescendants") => {
    const z = out.get(id) ?? { direct: 0, withDescendants: 0 }
    z[key]++
    out.set(id, z)
  }

  for (const o of people) {
    if (o.departmentId) addTo(o.departmentId, "direct")
    // Cesta obsahuje aj samotné oddelenie, takže „s podriadenými" vyjde
    // rovno z nej a netreba prechádzať strom.
    for (const id of o.departmentPath ?? []) addTo(id, "withDescendants")
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
  const all = await allDepartments(companyCode)
  if (departmentId && !all.some(o => o.id === departmentId)) {
    throw new DepartmentError("department.notFound", "Také oddelenie neexistuje.")
  }

  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const person = await col.findOne({ companyCode, id: personId })
  if (!person) throw new DepartmentError("department.personNotFound", "Osoba sa nenašla.")

  const current = new Date()
  const newPath = pathIdsTo(all, departmentId)
  await col.updateOne(
    { companyCode, id: personId },
    {
      $set: {
        departmentId: departmentId ?? null,
        departmentPath: newPath,
        departmentHistory: newDepartmentHistory(
          person.departmentHistory, departmentId ?? null, newPath, current,
        ),
        updatedAt: current,
        updatedBy: actor,
      },
    } as never,
  )
  await writeAudit({
    companyCode, subject: "person", action: "changed", actor: actor,
    targetId: personId, targetLabel: person.fullName,
    changes: { departmentId: { from: person.departmentId ?? null, to: departmentId ?? null } },
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
  direction: "up" | "down",
  actor: string,
): Promise<void> {
  const all = await allDepartments(companyCode)
  const self = all.find(o => o.id === id)
  if (!self) throw new DepartmentError("department.notFound", "Také oddelenie tu nie je.")

  const siblings = children(all, self.parentId ?? null)
  const from = siblings.findIndex(o => o.id === id)
  const to = direction === "up" ? from - 1 : from + 1
  if (to < 0 || to >= siblings.length) return

  const sorted = [...siblings]
  const [picked] = sorted.splice(from, 1)
  sorted.splice(to, 0, picked)

  await saveOrder(companyCode, sorted.map(o => o.id), actor)
  await writeAudit({
    companyCode, subject: "department", action: "reordered", actor: actor,
    targetId: id, targetLabel: self.name,
    note: `posunuté ${direction} medzi súrodencami`,
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
  orderedIds: string[],
  actor: string,
): Promise<void> {
  const all = await allDepartments(companyCode)
  const byId = new Map(all.map(o => [o.id, o]))

  const touched = orderedIds.map(x => byId.get(x)).filter(o => o !== undefined)
  if (touched.length !== orderedIds.length) {
    throw new DepartmentError("department.orderUnknown", "Zoznam obsahuje oddelenie, ktoré tu nie je.")
  }
  const parents = new Set(touched.map(o => o!.parentId ?? "koren"))
  if (parents.size > 1) {
    throw new DepartmentError("department.orderSameLevel", "Preusporiadať sa dá len v rámci jednej úrovne.")
  }

  const col = await getCollection<Department>(DEPARTMENTS_COLLECTION)
  const current = new Date()
  for (const [i, x] of orderedIds.entries()) {
    await col.updateOne(
      { companyCode, id: x },
      { $set: { order: i, updatedAt: current, updatedBy: actor } },
    )
  }
}
