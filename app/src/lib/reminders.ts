/**
 * reminders.ts — kto mešká s potvrdením a komu sa dá pripomenúť.
 *
 * **Nič sa tu neposiela.** Táto vrstva len spočíta, kto mešká; odoslanie je
 * samostatné rozhodnutie človeka na obrazovke, presne ako pri prideleniach
 * (`/hr/[id]/notify`). Naplánovaná úloha smie *upozorniť HR*, nie rozposlať
 * stovku e-mailov — jedna chyba v podmienke by sa inak prejavila až tým, že
 * sa ozve sto nahnevaných ľudí.
 *
 * **Meškanie sa počíta od `since`**, ktoré skladá `hrReport.ts`: pri pridelení
 * od jeho dátumu, pri trase odkedy má človek prístup. Povinnosť bez začiatku
 * (starý záznam bez dátumov) sa za meškajúcu **nepovažuje** — radšej niekoho
 * neupozorniť než mu vyčítať omeškanie, ktoré sa nedá doložiť.
 */

import { duties, type Duty } from "./hrReport"

/** Odkedy sa nepotvrdené považuje za meškajúce. Dva týždne (TODO I2). */
export const DEFAULT_DAYS = 14

const DAY = 24 * 60 * 60 * 1000

export interface Overdue {
  duty: Duty
  /** Celé dni od začiatku povinnosti. */
  days: number
}

export function overdueFrom(rows: Duty[], days = DEFAULT_DAYS, asOf = new Date()): Overdue[] {
  const out: Overdue[] = []
  for (const duty of rows) {
    if (duty.acknowledgedAt) continue
    if (!duty.since) continue
    const elapsed = Math.floor((asOf.getTime() - duty.since.getTime()) / DAY)
    if (elapsed < days) continue
    out.push({ duty, days: elapsed })
  }
  // Najdlhšie meškanie hore — s tým sa treba zaoberať prvým.
  return out.sort((a, b) => b.days - a.days || a.duty.fullName.localeCompare(b.duty.fullName))
}

export async function overdue(companyCode: string, days = DEFAULT_DAYS): Promise<Overdue[]> {
  return overdueFrom(await duties(companyCode), days)
}

export interface PersonReminder {
  personId: string
  fullName: string
  email: string
  /** Čo všetko tej osobe chýba. Zoradené rovnako ako `overdue()`. */
  items: Overdue[]
  /** Najdlhšie meškanie z jej položiek — podľa neho sa zoznam radí. */
  worstDays: number
}

/**
 * Zoskupí meškania po ľuďoch.
 *
 * **Jeden e-mail na človeka, nie na povinnosť.** Kto mešká so štyrmi
 * smernicami, dostane jednu správu so štyrmi riadkami; štyri samostatné
 * e-maily v jednej minúte vyzerajú ako pokazený systém a človek ich
 * prestane čítať — čím prestane fungovať aj pripomínanie samo.
 */
export function byPersonReminder(rows: Overdue[]): PersonReminder[] {
  const groups = new Map<string, PersonReminder>()
  for (const row of rows) {
    const existing = groups.get(row.duty.personId)
    if (existing) {
      existing.items.push(row)
      existing.worstDays = Math.max(existing.worstDays, row.days)
      continue
    }
    groups.set(row.duty.personId, {
      personId: row.duty.personId,
      fullName: row.duty.fullName,
      email: row.duty.email,
      items: [row],
      worstDays: row.days,
    })
  }
  return [...groups.values()]
    .sort((a, b) => b.worstDays - a.worstDays || a.fullName.localeCompare(b.fullName))
}
