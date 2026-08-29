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
 * **„Odkedy to čaká" pribudlo v rozsahu B** a má presne jeden zdroj:
 * `assignments.assignedAt` (D37). Kde pridelenie nie je — norma sa človeka
 * týka len cez trasu — zostáva `assignedAt: null` a widget o čase mlčí.
 * Náhradný čas by bol horší než žiadny: `effectiveFrom` je právna platnosť
 * (norma platná od 2019 nie je „čaká od 2019") a `publishedAt` je nepovinné.
 */

import { trackProgress } from "./tracks"
import { loadDocumentFor, effectiveVersion } from "./documents"
import { acknowledgedVersionIds } from "./acknowledgements"
import { assignmentsForPerson } from "./assignments"
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
   * Čas na **zoradenie**. Nie je to to isté ako `assignedAt`: zoradiť treba
   * aj to, čo pridelenie nemá.
   */
  sortAt: Date | null
  /**
   * Kedy bola úloha pridelená. `null` znamená **nevie sa**, nie „dávno" —
   * a widget vtedy nenapíše nič. Radšej mlčať než ukázať dátum, ktorý
   * znamená niečo iné než to, čo je pri ňom napísané.
   */
  assignedAt: Date | null
  /** Pridelené až po predchádzajúcom prihlásení (D39). */
  isNew: boolean
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

/** Je pridelenie novšie než predchádzajúce prihlásenie? (D39) */
export function isNewFor(person: Pick<Person, "previousLoginAt">, assignedAt: Date | null): boolean {
  if (!assignedAt) return false
  // Kto tu ešte nikdy nebol, má nové všetko — a zvýrazniť človeku pri prvom
  // vstupe úplne celý zoznam nie je informácia, je to šum.
  if (!person.previousLoginAt) return false
  return assignedAt > person.previousLoginAt
}

/**
 * Zdroj „nepotvrdené normy".
 *
 * Skladá sa z dvoch pôvodov, ale je to **jeden zdroj** a jedna identita
 * položky (dokument): norma pridelená skupine, ktorá je zároveň krokom trasy,
 * je jedna úloha, nie dve.
 *
 *   1. **trasa** — `trackProgress()`, ten istý odvodený stav, aký ukazuje
 *      `/dokumenty`. Druhý výpočet toho istého by sa raz rozišiel, a rozišiel
 *      by sa práve pri novej verzii (D27);
 *   2. **pridelenie** — `assignments`, teda to, čo niekto niekomu vedome
 *      uložil (D37). Norma sa tak dá poslať aj mimo trasy, bez toho, aby
 *      musela vzniknúť umelá trasa pre jednu smernicu.
 */
export const acknowledgementSource: PendingSource = {
  key: "acknowledgement",
  async collect(person) {
    const t = dictionary(person.language).pending

    const [tracks, assignments] = await Promise.all([
      trackProgress(person),
      assignmentsForPerson({
        companyCode: person.companyCode,
        email: person.email,
        groups: person.groups,
        tracks: person.tracks,
        departmentPath: person.departmentPath,
      }),
    ])

    // Najskoršie pridelenie danej verzie. Keď tú istú normu človek dostane
    // cez skupinu aj cez trasu, visí mu odvtedy, nie od druhého pridelenia.
    const pridelene = new Map<string, Date>()
    for (const a of assignments) {
      const doteraz = pridelene.get(a.subject.versionId)
      if (!doteraz || a.assignedAt < doteraz) pridelene.set(a.subject.versionId, a.assignedAt)
    }

    const items = new Map<string, PendingItem>()
    let blockedCount = 0

    for (const track of tracks) {
      for (const step of track.steps) {
        if (step.blocked) { blockedCount += 1; continue }
        if (step.done) continue
        const assignedAt = step.versionId ? pridelene.get(step.versionId) ?? null : null
        items.set(step.documentId, {
          source: "acknowledgement",
          // Kľúčom je dokument, nie krok: ten istý dokument môže byť krokom
          // v dvoch trasách a človek ho má potvrdiť raz, nie dvakrát.
          id: step.documentId,
          title: step.title,
          href: `/dokumenty/${encodeURIComponent(step.documentId)}`,
          // Text druhého riadka skladá **zdroj**, nie widget: len zdroj vie,
          // čo jeho `detail` znamená. Helpdesk tam raz bude mať číslo tiketu.
          detail: step.versionLabel ? t.version(step.versionLabel) : undefined,
          sortAt: assignedAt ?? step.effectiveFrom,
          assignedAt,
          isNew: isNewFor(person, assignedAt),
        })
      }
    }

    // Pridelenia mimo trás. Tie, ktoré už v zozname sú, sa preskočia —
    // pridelenie nemá zdvojiť úlohu, ktorú trasa už ukazuje.
    const nepokryte = assignments.filter(a => !items.has(a.subject.documentId))
    if (nepokryte.length > 0) {
      const potvrdene = await acknowledgedVersionIds(
        person.id,
        nepokryte.map(a => a.subject.versionId),
      )

      for (const a of nepokryte) {
        if (potvrdene.has(a.subject.versionId)) continue

        // Pridelené znenie sa musí dať aj potvrdiť. Keď medzitým pribudlo
        // novšie, `/dokumenty/…` ukáže to novšie a potvrdenie by sa viazalo
        // na inú verziu — úloha by z widgetu nikdy nezmizla. Vtedy je to vec
        // pre HR (prideliť nové znenie), nie úloha pre človeka.
        const doc = await loadDocumentFor(person, a.subject.documentId)
        const platna = doc ? effectiveVersion(doc) : null
        if (!doc || !platna?.ok || platna.version.versionId !== a.subject.versionId) {
          blockedCount += 1
          continue
        }

        items.set(a.subject.documentId, {
          source: "acknowledgement",
          id: a.subject.documentId,
          title: doc.title,
          href: `/dokumenty/${encodeURIComponent(a.subject.documentId)}`,
          detail: t.version(a.subject.versionLabel),
          sortAt: a.assignedAt,
          assignedAt: a.assignedAt,
          isNew: isNewFor(person, a.assignedAt),
        })
      }
    }

    return { items: [...items.values()], blockedCount }
  },
}

/** Zdroje v poradí, v akom sa pýtajú. */
export const PENDING_SOURCES: PendingSource[] = [acknowledgementSource]

/**
 * Zlúči položky rovnakej identity. Ponechá prvú a **nechá si najstarší
 * `sortAt`** — keď je tá istá norma v dvoch trasách, platí, odkedy sa jej
 * najskôr týkala. Rovnako pri `assignedAt`; príznak „nové" prežije, keď je
 * nová aspoň jedna z ciest, ktorými sa k človeku dostala.
 */
export function dedupe(items: PendingItem[]): PendingItem[] {
  const out = new Map<string, PendingItem>()
  for (const item of items) {
    const key = `${item.source}:${item.id}`
    const seen = out.get(key)
    // Kópia, nie pôvodný objekt: zlučovanie nemá prepisovať to, čo mu zdroj
    // podal — volajúci by dostal späť zmenené vstupy a nevedel prečo.
    if (!seen) { out.set(key, { ...item }); continue }
    if (item.sortAt && (!seen.sortAt || item.sortAt < seen.sortAt)) seen.sortAt = item.sortAt
    if (item.assignedAt && (!seen.assignedAt || item.assignedAt < seen.assignedAt)) {
      seen.assignedAt = item.assignedAt
    }
    seen.isNew = seen.isNew || item.isNew
  }
  return [...out.values()]
}

/**
 * Zoradí položky. Najnovšie hore, položky bez dátumu na koniec.
 *
 * Pri pridelených úlohách je to poradie „naposledy pridelené hore", čo je
 * to, čo človek čaká. Pri normách bez pridelenia zostáva `effectiveFrom` —
 * dočasné riešenie, ktoré prestane byť potrebné, keď bude prideľovanie
 * jedinou cestou, ako sa úloha k človeku dostane.
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
  /** Koľko z nich pribudlo od predchádzajúceho prihlásenia (D39). */
  newCount: number
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
    newCount: items.filter(i => i.isNew).length,
  }
}
