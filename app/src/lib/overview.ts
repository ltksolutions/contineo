/**
 * overview.ts — zoznam dokumentov pre čitateľa (Prehľad a Knižnica na čítanie,
 * ADR-041 D270).
 *
 * **Nič sa tu nepočíta druhýkrát.** Povinnosti idú z `pendingForPerson()`,
 * kolá schvaľovania z `roundsWaitingFor()`, dokumenty z `readableDocuments()`
 * a predpisy zo `subscribedActs()` — z tých istých funkcií, ktoré kreslia
 * obrazovky, na ktoré Prehľad odkazuje. Panel, ktorý si svoje položky počíta
 * po svojom, sa raz rozíde s obrazovkou, na ktorú odkazuje.
 *
 * Okná „nové" a „expiruje" sú z `publishedAt` a `effectiveTo` na **znení**,
 * nie z `updatedAt` na dokumente: `updatedAt` sa mení aj pri oprave preklepu
 * v označení a „nové" by potom znamenalo „niekto sa toho dotkol". Dlaždice
 * KPI a panel Novinky, ktoré tieto okná kreslili, zanikli 26. 10. 2026
 * (D271); okná ostali ako chipy pri riadku.
 */

export const NEW_DAYS = 7
export const EXPIRING_DAYS = 30

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
