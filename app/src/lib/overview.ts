/**
 * overview.ts — čísla a zoznamy pre Prehľad (`docs/design/README.md`, časť 2).
 *
 * **Nič sa tu nepočíta druhýkrát.** Povinnosti idú z `pendingForPerson()`,
 * kolá schvaľovania z `roundsWaitingFor()` — z tých istých funkcií, ktoré
 * kreslia widget a obrazovku schvaľovateľa. Dlaždica, ktorá si svoje číslo
 * počíta po svojom, sa raz rozíde s obrazovkou, na ktorú odkazuje, a človek
 * bude mať pravdu, keď povie „to nesedí".
 *
 * Dve dlaždice návrhu potrebujú vlastný dotaz, lebo sa nedali odvodiť
 * z ničoho existujúceho: „nové za 7 dní" a „expiruje do 30 dní". Obe sú
 * o dokumentoch, nie o osobe, a obe sa počítajú **z rovnakého zdroja ako
 * knižnica** — z `versions[]`, nie z `updatedAt` na dokumente. `updatedAt` sa
 * mení aj pri oprave preklepu v označení a „nové" by potom znamenalo
 * „niekto sa toho dotkol".
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type Version } from "./documents"

export const NEW_DAYS = 7
export const EXPIRING_DAYS = 30

export interface LibraryNews {
  documentId: string
  title: string
  versionLabel: string
  publishedAt: Date
  category?: string
}

export interface ExpiringVersion {
  documentId: string
  title: string
  versionLabel: string
  effectiveTo: Date
}

interface RawDoc {
  documentId: unknown
  title?: unknown
  category?: unknown
  status?: unknown
  versions?: Version[]
}

async function publishedDocs(companyCode: string): Promise<RawDoc[]> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  return col
    .find(
      { companyCode, status: "published" },
      {
        projection: {
          documentId: 1, title: 1, category: 1, status: 1,
          "versions.versionId": 1, "versions.label": 1, "versions.isActive": 1,
          "versions.publishedAt": 1, "versions.effectiveTo": 1,
        },
      },
    )
    .toArray() as unknown as RawDoc[]
}

/**
 * Znenia zverejnené za posledných `NEW_DAYS` dní, najnovšie hore.
 *
 * Počíta sa `publishedAt` na **znení**, nie `updatedAt` na dokumente: nové
 * znenie je nová vec na prečítanie, oprava preklepu v označení nie.
 */
export async function libraryNews(
  companyCode: string,
  asOf = new Date(),
  days = NEW_DAYS,
): Promise<LibraryNews[]> {
  const hranica = asOf.getTime() - days * 24 * 60 * 60 * 1000
  const out: LibraryNews[] = []

  for (const d of await publishedDocs(companyCode)) {
    for (const v of d.versions ?? []) {
      const at = v.publishedAt ? new Date(v.publishedAt) : null
      if (!at || at.getTime() < hranica || at.getTime() > asOf.getTime()) continue
      out.push({
        documentId: String(d.documentId),
        title: String(d.title ?? d.documentId),
        versionLabel: v.label,
        publishedAt: at,
        ...(d.category ? { category: String(d.category) } : {}),
      })
    }
  }
  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

/**
 * Znenia, ktorým sa do `EXPIRING_DAYS` dní končí platnosť.
 *
 * **Len tie, ktoré platia teraz.** Znenie s `effectiveTo` v minulosti už
 * neexpiruje — už vypršalo, a to je iná veta. Archivované (`isActive: false`)
 * sa nerátajú vôbec: skončili tým, že ich nahradilo novšie, nie časom.
 */
export async function expiringVersions(
  companyCode: string,
  asOf = new Date(),
  days = EXPIRING_DAYS,
): Promise<ExpiringVersion[]> {
  const hranica = asOf.getTime() + days * 24 * 60 * 60 * 1000
  const out: ExpiringVersion[] = []

  for (const d of await publishedDocs(companyCode)) {
    for (const v of d.versions ?? []) {
      if (!v.isActive || !v.effectiveTo) continue
      const to = new Date(v.effectiveTo)
      if (to.getTime() < asOf.getTime() || to.getTime() > hranica) continue
      out.push({
        documentId: String(d.documentId),
        title: String(d.title ?? d.documentId),
        versionLabel: v.label,
        effectiveTo: to,
      })
    }
  }
  return out.sort((a, b) => a.effectiveTo.getTime() - b.effectiveTo.getTime())
}

/** Dokument knižnice v paneli „Čo máte k dispozícii" — posledné zverejnené znenie. */
export interface RecentDocument {
  documentId: string
  title: string
  versionLabel: string
  publishedAt: Date
}

/**
 * Posledných `limit` zverejnených dokumentov, každý raz, podľa najnovšie
 * zverejneného znenia. Na rozdiel od noviniek bez časovej hranice: panel
 * hovorí, **čo v knižnici je**, nie čo sa v nej za týždeň zmenilo —
 * organizácia s desiatimi starými normami nemá vidieť prázdny panel.
 */
export function pickRecent(docs: RawDoc[], limit: number, asOf = new Date()): RecentDocument[] {
  const out: RecentDocument[] = []
  for (const d of docs) {
    let latest: { label: string; at: Date } | null = null
    for (const v of d.versions ?? []) {
      const at = v.publishedAt ? new Date(v.publishedAt) : null
      if (!at || at.getTime() > asOf.getTime()) continue
      if (!latest || at.getTime() > latest.at.getTime()) latest = { label: v.label, at }
    }
    if (!latest) continue
    out.push({ documentId: String(d.documentId), title: String(d.title ?? d.documentId), versionLabel: latest.label, publishedAt: latest.at })
  }
  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, limit)
}

export async function recentLibrary(companyCode: string, limit: number, asOf = new Date()): Promise<{ recent: RecentDocument[]; total: number }> {
  const docs = await publishedDocs(companyCode)
  return { recent: pickRecent(docs, limit, asOf), total: docs.length }
}

/**
 * Jeden riadok zoznamu dokumentov pre čitateľa (ADR-041, D270): dokument
 * knižnice alebo odoberaný predpis z katalógu, bez ohľadu na to, odkiaľ
 * prišiel. Jediné členenie je druh (`category`); predpis má pevne `zakon`.
 */
export interface ReaderDocumentRow {
  key: string
  kind: "document" | "law"
  title: string
  /** Kľúč číselníka `category`; `null` pri dokumente bez druhu. */
  category: string | null
  versionLabel: string | null
  effectiveFrom: Date
  /** Platné znenie zverejnené za posledných `NEW_DAYS` dní. */
  isNew: boolean
  /** Platnosť znenia končí do `EXPIRING_DAYS` dní. */
  expiring: boolean
  href: string
  askHref: string
}

/** Druh predpisu z katalógu v číselníku `category` (ADR-034: Zákon je druh). */
export const LAW_CATEGORY = "zakon"

/**
 * Zlúči platné dokumenty knižnice a odoberané predpisy do jedného zoznamu,
 * najnovšie znenie prvé. Čistá funkcia — Prehľad a Knižnica na čítanie
 * z nej kreslia to isté, len inak zoradené a orezané.
 */
export function mergeReaderDocuments(
  docs: { documentId: string; title: string; category: string | null; versionLabel: string; effectiveFrom: Date; effectiveTo: Date | null; publishedAt: Date | null }[],
  acts: { actId: string; title: string; current: { effectiveFrom: Date } | null }[],
  asOf = new Date(),
): ReaderDocumentRow[] {
  const newSince = asOf.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000
  const expiringUntil = asOf.getTime() + EXPIRING_DAYS * 24 * 60 * 60 * 1000
  const rows: ReaderDocumentRow[] = docs.map(d => ({
    key: `doc:${d.documentId}`,
    kind: "document",
    title: d.title,
    category: d.category,
    versionLabel: d.versionLabel,
    effectiveFrom: d.effectiveFrom,
    isNew: Boolean(d.publishedAt && d.publishedAt.getTime() >= newSince && d.publishedAt.getTime() <= asOf.getTime()),
    expiring: Boolean(d.effectiveTo && d.effectiveTo.getTime() > asOf.getTime() && d.effectiveTo.getTime() <= expiringUntil),
    href: `/documents/${encodeURIComponent(d.documentId)}`,
    askHref: `/ask?${new URLSearchParams({ src: "library", doc: d.documentId }).toString()}`,
  }))
  for (const a of acts) {
    // Predpis bez znenia účinného dnes (len vyhlásené na neskôr) sa čitateľovi neponúka — nemal by čo čítať.
    if (!a.current) continue
    rows.push({
      key: `law:${a.actId}`,
      kind: "law",
      title: a.title,
      category: LAW_CATEGORY,
      versionLabel: null,
      effectiveFrom: a.current.effectiveFrom,
      isNew: false,
      expiring: false,
      href: `/documents/law/${a.actId}`,
      askHref: `/ask?${new URLSearchParams({ src: "slov-lex" }).toString()}`,
    })
  }
  return rows.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || a.title.localeCompare(b.title, "sk"))
}
