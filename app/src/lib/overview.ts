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
