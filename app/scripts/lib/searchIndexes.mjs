/**
 * searchIndexes.mjs — definície oboch search indexov nad `document_chunks`
 * na **jednom mieste** (ADR-001, `docs/ATLAS_SETUP.md`).
 *
 * Číta ich `atlas_init.mjs` (zakladá a upravuje indexy), `atlas_check.mjs`
 * (overuje živý stav) a test `tests/searchIndexes.test.mjs`, ktorý stráži,
 * že každé pole, podľa ktorého `mongoSearch.ts` filtruje, v indexe naozaj je.
 * Filter na pole, ktoré index nepozná, nezlyhá — vráti prázdny výsledok bez
 * chyby, a to je najhorší druh chyby v hľadaní.
 *
 * ## Zmena 2026-09-29 (plán „znenia v indexe", krok 3; `docs/TODO.md`)
 *
 * - **+ `versionId`** — identita znenia; hľadanie „k dátumu" (krok 4)
 *   filtruje na znenia platné v daný deň, ktoré vypočíta z `documents`.
 * - **+ `superseded`** — nahradené členenie toho istého znenia
 *   (`chunkSuperseded.ts`, krok 2); filtruje sa `superseded: false`.
 * - **− `sectionKey`** — nemal ho žiadny úsek (krok 0) a hľadanie podľa neho
 *   nikdy nefiltrovalo.
 *
 * ## Zmena 2026-09-29, krok 4
 *
 * - **+ `sourceType`** — overené odpovede (`"qa"`) nemajú znenie; hľadanie
 *   ich berie len pri otázke na dnešok, a na to ich musí vedieť odlíšiť.
 *   Druhov zdrojov bude pribúdať, preto pole, nie príznak.
 */

export const COLLECTION = "document_chunks"
export const VECTOR_INDEX = process.env.VECTOR_INDEX ?? "rag_vector_index"
export const TEXT_INDEX = process.env.TEXT_INDEX ?? "rag_text_index"

/** Polia, podľa ktorých sa smie filtrovať — rovnaké v oboch indexoch. */
export const FILTER_PATHS = ["companyCode", "accessLevel", "scope", "isActive", "language", "versionId", "superseded", "sourceType"]

/**
 * Vektorový index s automatickým embeddingom. `path` ukazuje na **textové**
 * pole — vektory si Atlas generuje a drží sám (`docs/ATLAS_SETUP.md`).
 */
export function vectorDefinition(model = process.env.EMBEDDING_MODEL ?? "voyage-4", path = process.env.VECTOR_PATH ?? "text") {
  return {
    fields: [
      { type: "autoEmbed", modality: "text", path, model },
      ...FILTER_PATHS.map(p => ({ type: "filter", path: p })),
    ],
  }
}

const TOKEN = { type: "token" }

export const TEXT_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      text: { type: "string", analyzer: "lucene.standard" },
      heading: { type: "string", analyzer: "lucene.standard" },
      articleRef: { type: "string", analyzer: "lucene.keyword" },
      companyCode: TOKEN,
      accessLevel: TOKEN,
      scope: TOKEN,
      language: TOKEN,
      versionId: TOKEN,
      sourceType: TOKEN,
      isActive: { type: "boolean" },
      superseded: { type: "boolean" },
    },
  },
}

/** Požadované definície podľa názvu indexu. */
export function wantedIndexes() {
  return [
    { name: VECTOR_INDEX, type: "vectorSearch", definition: vectorDefinition() },
    { name: TEXT_INDEX, type: "search", definition: TEXT_DEFINITION },
  ]
}

/**
 * Líši sa živá definícia od požadovanej? Porovnáva sa význam, nie poradie:
 * polia vektorového indexu ako množina, mapovanie ako objekt s zoradenými
 * kľúčmi. Atlas do živej definície dopĺňa predvolené hodnoty, preto sa
 * porovnávajú len kľúče, ktoré uvádzame my.
 */
export function definitionDiff(live, wanted) {
  if (!live) return { differs: true, added: ["(index neexistuje)"], removed: [] }
  if (Array.isArray(wanted.fields)) {
    const key = f => JSON.stringify(Object.keys(f).sort().map(k => [k, f[k]]))
    const pick = (f, like) => Object.fromEntries(Object.keys(like).map(k => [k, f[k]]))
    const wantedKeys = wanted.fields.map(key)
    const liveKeys = (live.fields ?? []).map(f => {
      const like = wanted.fields.find(w => w.type === f.type && w.path === f.path) ?? f
      return key(pick(f, like))
    })
    const label = k => { const o = Object.fromEntries(JSON.parse(k)); return `${o.type}:${o.path}` }
    const added = wantedKeys.filter(k => !liveKeys.includes(k)).map(label)
    const removed = liveKeys.filter(k => !wantedKeys.includes(k)).map(label)
    return { differs: added.length + removed.length > 0, added, removed }
  }
  const wantedFields = wanted.mappings?.fields ?? {}
  const liveFields = live.mappings?.fields ?? {}
  const same = (a, b) => JSON.stringify(Object.keys(a ?? {}).sort().map(k => [k, a[k]])) ===
    JSON.stringify(Object.keys(a ?? {}).sort().map(k => [k, b?.[k]]))
  const added = Object.keys(wantedFields).filter(k => !(k in liveFields) || !same(wantedFields[k], liveFields[k]))
  const removed = Object.keys(liveFields).filter(k => !(k in wantedFields))
  const dynamicDiffers = Boolean(wanted.mappings?.dynamic) !== Boolean(live.mappings?.dynamic)
  return {
    differs: added.length + removed.length > 0 || dynamicDiffers,
    added: [...added, ...(dynamicDiffers ? ["mappings.dynamic"] : [])],
    removed,
  }
}
