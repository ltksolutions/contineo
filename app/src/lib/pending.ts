/**
 * pending.ts — „čo čaká na mňa" ako jeden zoznam z viacerých zdrojov (D36).
 *
 * Úloha sa **odvodzuje**, neukladá sa (D27). Tento modul nič nezapisuje;
 * pýta sa zdrojov a skladá z nich jeden zoznam v jednom tvare.
 *
 * **Prečo register a nie priame volanie z widgetu:** zdroje budú pribúdať —
 * kurácia, helpdesk (Fáza 4b). Keby sa widget pýtal každého modulu zvlášť,
 * každý ďalší by znamenal ďalšiu vetvu v komponente, ktorý má len vypísať
 * zoznam. Widget preto nevie nič o normách ani tiketoch.
 *
 * **Čo tu zámerne NIE JE: „odkedy to čaká".** Poctivo to vie povedať až
 * pridelenie (`assignments.assignedAt`, D37 — rozsah B). Dovtedy by sa musel
 * použiť náhradný čas: `effectiveFrom` je právna platnosť (norma platná od
 * 2019 by nebola „nová" ani pri prvom stretnutí) a `publishedAt` je
 * nepovinné. Radšej nesľúbiť nič, než ukázať číslo, ktoré znamená niečo iné,
 * než čo pri ňom bude napísané. Z toho istého dôvodu tu nie je ani príznak
 * „nové" (D39) — počíta sa voči prideleniu, ktoré ešte neexistuje.
 */

import { trackProgress } from "./tracks"
import { dictionary } from "./i18n"
import type { Person } from "./persons"

export type PendingSourceKey = "acknowledgement" | "curation" | "helpdesk"

export interface PendingItem {
  source: PendingSourceKey
  /**
   * Stabilný kľúč **v rámci zdroja**. Dvojica `source + id` je identita
   * položky — podľa nej sa zlučujú duplicity.
   */
  id: string
  title: string
  href: string
  /** Druhý riadok pod názvom. Krátky, inak sa na telefóne zalomí na tri. */
  detail?: string
  /**
   * Čas na **zoradenie**, nie na zobrazenie. Nikde sa neukazuje ako „čaká
   * od…", lebo to by nebola pravda (viď hlavička modulu).
   */
  sortAt: Date | null
}

/** Čo zdroj vráti: položky **a** to, čo sa započítať nedá. */
export interface PendingResult {
  items: PendingItem[]
  /**
   * Koľko vecí zdroj vedome vynechal, lebo s nimi človek nemôže pohnúť
   * (napr. dokument bez platného znenia). Widget o nich povie jednou vetou,
   * ale nedá ich medzi úlohy — úloha, ktorá sa nedá splniť, nie je úloha.
   */
  blockedCount: number
}

export interface PendingSource {
  key: PendingSourceKey
  collect(person: Person): Promise<PendingResult>
}

/**
 * Zdroj „nepotvrdené normy" nad existujúcim `trackProgress()`.
 *
 * Nepočíta nič nové: berie ten istý odvodený stav, ktorý ukazuje `/dokumenty`.
 * Druhý výpočet toho istého by sa raz rozišiel — a rozišiel by sa práve pri
 * novej verzii, teda vtedy, keď na správnosti najviac záleží (D27).
 */
export const acknowledgementSource: PendingSource = {
  key: "acknowledgement",
  async collect(person) {
    const tracks = await trackProgress(person)
    // Text druhého riadka skladá **zdroj**, nie widget: len zdroj vie, čo
    // jeho `detail` znamená. Helpdesk tam raz bude mať číslo tiketu, nie verziu.
    const t = dictionary(person.language).pending
    const items: PendingItem[] = []
    let blockedCount = 0

    for (const track of tracks) {
      for (const step of track.steps) {
        if (step.blocked) { blockedCount += 1; continue }
        if (step.done) continue
        items.push({
          source: "acknowledgement",
          // Kľúčom je dokument, nie krok: ten istý dokument môže byť krokom
          // v dvoch trasách a človek ho má potvrdiť raz, nie dvakrát.
          id: step.documentId,
          title: step.title,
          href: `/dokumenty/${encodeURIComponent(step.documentId)}`,
          detail: step.versionLabel ? t.version(step.versionLabel) : undefined,
          sortAt: step.effectiveFrom,
        })
      }
    }

    return { items, blockedCount }
  },
}

/** Zdroje v poradí, v akom sa pýtajú. Rozsah A má zatiaľ jediný. */
export const PENDING_SOURCES: PendingSource[] = [acknowledgementSource]

/**
 * Zlúči položky rovnakej identity. Ponechá prvú a **nechá si najstarší
 * `sortAt`** — keď je tá istá norma v dvoch trasách, platí, odkedy sa jej
 * najskôr týkala.
 */
export function dedupe(items: PendingItem[]): PendingItem[] {
  const out = new Map<string, PendingItem>()
  for (const item of items) {
    const key = `${item.source}:${item.id}`
    const seen = out.get(key)
    // Kópia, nie pôvodný objekt: zlučovanie nemá prepisovať to, čo mu zdroj
    // podal — volajúci by dostal späť zmenené vstupy a nevedel prečo.
    if (!seen) { out.set(key, { ...item }); continue }
    if (item.sortAt && (!seen.sortAt || item.sortAt < seen.sortAt)) {
      seen.sortAt = item.sortAt
    }
  }
  return [...out.values()]
}

/**
 * Zoradí položky. Najnovšie znenie hore, položky bez dátumu na koniec.
 *
 * **Toto poradie je dočasné a vie sa to o ňom.** Bez pridelenia sa nedá
 * povedať, čo tu visí najdlhšie; najnovšia norma je aspoň najpravdepodobnejší
 * dôvod, prečo je tu človek dnes. V rozsahu B ho nahradí `assignedAt`.
 */
export function sortItems(items: PendingItem[]): PendingItem[] {
  return [...items].sort((a, b) => {
    if (a.sortAt && b.sortAt) return b.sortAt.getTime() - a.sortAt.getTime()
    if (a.sortAt) return -1
    if (b.sortAt) return 1
    return a.title.localeCompare(b.title, "sk")
  })
}

export interface PendingOverview {
  items: PendingItem[]
  /** Počet **všetkých** položiek, aj tých, ktoré sa do widgetu nezmestili. */
  total: number
  blockedCount: number
}

/**
 * Zoznam pre jednu osobu.
 *
 * Zdroje sa pýtajú súbežne — jeden pomalý zdroj nemá spomaliť úvodnú stránku
 * o svoju latenciu navyše. Zdroj, ktorý zlyhá, **zoznam nezhodí**: ostatné sa
 * ukážu a chyba ide do logu. Prázdny widget kvôli výpadku helpdesku by
 * človeku povedal „nič nečaká", čo je horšie než neúplný zoznam.
 */
export async function pendingForPerson(
  person: Person,
  sources: PendingSource[] = PENDING_SOURCES,
): Promise<PendingOverview> {
  const results = await Promise.all(
    sources.map(async source => {
      try {
        return await source.collect(person)
      } catch (e) {
        console.error(`[pending] zdroj "${source.key}" zlyhal:`, e)
        return { items: [], blockedCount: 0 } satisfies PendingResult
      }
    }),
  )

  const items = sortItems(dedupe(results.flatMap(r => r.items)))
  return {
    items,
    total: items.length,
    blockedCount: results.reduce((a, r) => a + r.blockedCount, 0),
  }
}
