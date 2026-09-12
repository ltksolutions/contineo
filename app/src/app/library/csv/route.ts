/**
 * GET /library/csv — zoznam dokumentov ako CSV.
 *
 * Exportuje sa **ten istý zoznam a s tými istými filtrami**, aký je na
 * obrazovke: `readFilters()` → `libraryList()` → `sortRows()`, teda tá istá
 * cesta, nie druhý dotaz s podobnými podmienkami. Výkaz, ktorý sa nezhoduje
 * s obrazovkou, je horší než žiadny.
 *
 * **Bez stránkovania, zámerne.** Na obrazovke je strana, v exporte celý
 * vyfiltrovaný výsledok: kto si vyfiltruje osem dokumentov, chce osem, a kto
 * nefiltruje nič, chce všetko — nie prvých dvadsať.
 *
 * Prístup sa overuje aj tu. To, že odkaz visí na chránenej stránke, nie je
 * kontrola prístupu — adresu si vie napísať ktokoľvek.
 */

import { libraryContext } from "@/lib/library"
import { libraryList } from "@/lib/libraryRead"
import { readFilters, currentSort, sortRows } from "@/lib/libraryFilters"
import { toCsv } from "@/lib/csv"
import type { RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }

  /*
   * Adresa sa prepisuje do toho istého tvaru, aký číta obrazovka.
   * Viachodnotový facet je **opakovaný kľúč**, takže `getAll()` a nie `get()` —
   * inak by export z troch označených značiek videl jednu.
   */
  const url = new URL(request.url)
  const raw: RawQuery = {}
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key)
    raw[key] = all.length > 1 ? all : all[0]
  }

  const filters = readFilters(raw)
  const sort = currentSort(filters)
  const rows = sortRows(
    await libraryList(ctx.tenant.companyCode, {
      search: filters.search,
      status: filters.status,
      priecinok: filters.folder,
      category: filters.category,
      language: filters.language,
      accessLevel: filters.accessLevel,
      tag: filters.tag,
      conditions: filters.conditions,
      match: filters.match,
    }),
    sort.key,
    sort.dir,
  )

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "")

  const csv = toCsv(rows, [
    { label: "documentId", value: r => r.documentId },
    { label: "title", value: r => r.title },
    { label: "sectionKey", value: r => r.sectionKey },
    { label: "folderTrail", value: r => (r.folderTrail ?? []).join(" / ") },
    { label: "category", value: r => r.category ?? "" },
    { label: "status", value: r => r.status },
    { label: "processingState", value: r => r.processingState },
    { label: "effectiveVersion", value: r => r.effectiveLabel },
    /*
     * ISO, nie miestny formát. Výkaz sa otvára v tabuľkovom procesore a dátum
     * v tvare „12. 9. 2026" sa v ňom zoradí ako text — teda zle.
     */
    { label: "effectiveFrom", value: r => iso(r.effectiveFrom) },
    { label: "versionCount", value: r => String(r.versionCount) },
    { label: "language", value: r => r.language ?? "" },
    { label: "accessLevel", value: r => r.accessLevel ?? "" },
    { label: "tags", value: r => r.tags.join(" ") },
    { label: "updatedAt", value: r => iso(r.updatedAt) },
    { label: "updatedBy", value: r => r.updatedBy ?? "" },
  ])

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kniznica-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
