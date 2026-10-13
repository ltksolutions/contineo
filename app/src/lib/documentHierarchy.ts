/**
 * documentHierarchy.ts — čo je čomu nadradený dokument (ADR-034, D219).
 *
 * Ján 13. 10. 2026: „Zákon je nadradený Stanovám… vedieť nastavovať, čo je
 * čomu nadradený dokument, podobne ako pri oddeleniach"; „nadradených
 * dokumentov môže byť viac". Preto nie strom, ale **sieť bez cyklov**:
 * dokument nesie `parentIds` (documentId nadradených) a manuál ISSF-04 môže
 * stáť pod Registračným aj Súťažným poriadkom.
 *
 * Čisté funkcie bez databázy — tie isté pravidlá používa formulár, zápis aj
 * kontrola súladu, a test ich overí bez Mongo.
 */

/** documentId → jeho nadradené (documentId). */
export type ParentsMap = Map<string, string[]>

export function parentsMapOf(docs: { documentId: string; parentIds?: string[] | null }[]): ParentsMap {
  return new Map(docs.map(d => [d.documentId, [...new Set((d.parentIds ?? []).filter(Boolean))]]))
}

/**
 * Všetci predkovia od najbližších — nadradené, ich nadradené… Každý raz,
 * aj keď vedie viac ciest. Cyklus v dátach (nemal by vzniknúť) nezacyklí.
 */
export function ancestorsOf(documentId: string, parents: ParentsMap): string[] {
  const out: string[] = []
  const seen = new Set([documentId])
  let level = parents.get(documentId) ?? []
  while (level.length) {
    const next: string[] = []
    for (const id of level) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
      next.push(...(parents.get(id) ?? []))
    }
    level = next
  }
  return out
}

/** Všetci potomkovia — dokumenty, ktorým je tento nadradený (aj cez iné). */
export function descendantsOf(documentId: string, parents: ParentsMap): string[] {
  const children = new Map<string, string[]>()
  for (const [child, ps] of parents) for (const p of ps) children.set(p, [...(children.get(p) ?? []), child])
  const out: string[] = []
  const seen = new Set([documentId])
  let level = children.get(documentId) ?? []
  while (level.length) {
    const next: string[] = []
    for (const id of level) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
      next.push(...(children.get(id) ?? []))
    }
    level = next
  }
  return out
}

/**
 * Prečo sa nadradené nedajú nastaviť — alebo `null`. Dokument nesmie byť
 * nadradený sám sebe ani cez iné (nadradený by bol zároveň jeho potomkom).
 */
export function parentsProblem(documentId: string, parentIds: string[], parents: ParentsMap): "hierarchy.self" | "hierarchy.cycle" | null {
  if (parentIds.includes(documentId)) return "hierarchy.self"
  const below = new Set(descendantsOf(documentId, parents))
  return parentIds.some(p => below.has(p)) ? "hierarchy.cycle" : null
}

/** Riadky prehľadu: koreň, pod ním podradené (dokument s viacerými nadradenými sa ukáže pod každým). */
export function hierarchyRows(ids: string[], parents: ParentsMap): { documentId: string; level: number; otherParents: string[] }[] {
  const known = new Set(ids)
  const children = new Map<string, string[]>()
  for (const id of ids) for (const p of parents.get(id) ?? []) if (known.has(p)) children.set(p, [...(children.get(p) ?? []), id])
  const roots = ids.filter(id => !(parents.get(id) ?? []).some(p => known.has(p)))
  const rows: { documentId: string; level: number; otherParents: string[] }[] = []
  const walk = (id: string, level: number, via: string | null, path: Set<string>) => {
    const others = (parents.get(id) ?? []).filter(p => p !== via && known.has(p))
    rows.push({ documentId: id, level, otherParents: others })
    for (const c of children.get(id) ?? []) if (!path.has(c)) walk(c, level + 1, id, new Set([...path, c]))
  }
  for (const r of roots) walk(r, 0, null, new Set([r]))
  return rows
}
