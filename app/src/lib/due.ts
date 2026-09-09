/**
 * due.ts — termín potvrdenia a stav povinnosti voči nemu (D61, D62, D63).
 *
 * **Termín je na pridelení, nie odvodený z prahu pripomienok.** Prah
 * `DEFAULT_DAYS` v `reminders.ts` je spúšťač prehľadu pre personalistu, nie
 * sľub daný človeku: kto potvrdí na pätnásty deň, nemá byť „po termíne",
 * keď mu nikto termín nedal. Rozhodnuté v `docs/ADR-004-termin-potvrdenia.md`.
 *
 * Tento súbor je zámerne **bez závislostí na databáze aj na pridelení**. Berie
 * dátum, odkedy povinnosť pre danú osobu beží, a vracia termín — takže sa dá
 * otestovať bez Mongo a bez toho, aby vznikol kruh v importoch
 * (`assignments.ts` odtiaľ berie typ, nie naopak).
 */

/**
 * Dva tvary termínu. **Jeden nestačí:**
 *
 *  - `date` je to, čo personalista obvykle chce („všetci do konferencie") a čo
 *    kreslí návrh. Má ale dieru: kto do oddelenia príde deň pred termínom,
 *    dostane na normu jeden deň.
 *  - `days` tú dieru nemá a sedí na D50 („úloha z oddelenia platí odo dňa
 *    príchodu"). Pri povinnosti z trasy je to jediný možný tvar — trasa
 *    pridelenie nemá, takže absolútny dátum nemá kam zapísať.
 */
export type Due =
  | { kind: "date"; at: Date }
  | { kind: "days"; days: number }

/** Koľko dní pred termínom sa už považuje za „blíži sa" (D63). */
export const SOON_DAYS = 5

/**
 * Stav povinnosti voči termínu. **Odvodený, nie uložený** — rovnaká zásada
 * ako D27: stav, ktorý sa zapíše, sa raz rozíde so skutočnosťou.
 */
export type DueState = "none" | "open" | "soon" | "over"

/** Celé dni. Termín je dátum, nie okamih — na hodinách nezáleží. */
const DAY = 24 * 60 * 60 * 1000

/** Polnoc v miestnom čase. Bez toho by „dnes" záviselo od hodiny behu. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY)
}

/**
 * Termín z dátumu, odkedy povinnosť beží.
 *
 * `null` znamená **bez termínu**, a to je platný stav, nie chyba: pridelenia
 * spred ADR-004 termín nemajú a dopísať im ho spätne by znamenalo vymyslieť
 * dátum, ktorý nikto nedal.
 */
export function dueFrom(start: Date, due: Due | null | undefined): Date | null {
  if (!due) return null
  if (due.kind === "date") return due.at
  if (!Number.isFinite(due.days)) return null
  return addDays(start, Math.max(0, Math.floor(due.days)))
}

/**
 * Koľko dní zostáva. Kladné číslo je „do termínu", nula je „dnes je termín",
 * záporné je „po termíne". Počíta sa v celých dňoch od polnoci k polnoci,
 * takže výsledok sa počas dňa nemení.
 */
export function daysLeft(due: Date, now: Date): number {
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY)
}

/**
 * Stav podľa D63.
 *
 * **Deň termínu patrí do `soon`, nie do `over`** — kto potvrdí v ten deň,
 * termín splnil. Toto je presne to miesto, kde sa dá o jeden deň pomýliť
 * a človek by dostal e-mail „ste po termíne" v deň, keď po ňom nie je.
 */
export function dueState(due: Date | null, now: Date): DueState {
  if (!due) return "none"
  const left = daysLeft(due, now)
  if (left < 0) return "over"
  if (left <= SOON_DAYS) return "soon"
  return "open"
}

/**
 * Má sa dnes pripomenúť, a ako? (ADR-004 §3.2 — eskalácia, nie opakovanie.)
 *
 * Pred termínom denne po dobu šiestich dní (D-5 … D-0): termín sa naozaj blíži
 * a je to ohraničené. Po termíne **D+1, D+3, D+7 a potom raz týždenne**, a od
 * D+7 aj personalistovi.
 *
 * Prečo nie denne aj po termíne, hoci to bolo v zadaní: `api/cron/overdue`
 * varuje, že denná pošta o tom istom sa prestane otvárať. Pri človeku je to
 * horšie než pri personalistovi — mesiac neprítomnosti by znamenal tridsať
 * e-mailov, pravidlo „do koša" a poškodené doručovanie domén organizácie.
 * Po termíne navyše problém nie je zabudnutie, ale organizácia; preto sa od
 * týždňa ozývame aj personalistovi. Rozhodnuté s Jánom Letkom 2026-09-09.
 */
export interface ReminderPlan {
  /** Poslať dnes osobe? */
  person: boolean
  /** Poslať dnes aj personalistovi (súhrn)? */
  hr: boolean
  /** Tón správy — pred termínom, alebo po ňom. */
  tone: "soon" | "over" | null
}

const NONE: ReminderPlan = { person: false, hr: false, tone: null }

/** Dni po termíne, kedy sa pripomína jednorazovo. Ďalej už len týždenne. */
const OVER_DAYS = [1, 3, 7]

export function reminderPlan(due: Date | null, now: Date): ReminderPlan {
  if (!due) return NONE
  const left = daysLeft(due, now)

  // Pred termínom: šesť dní vrátane dňa termínu.
  if (left >= 0) {
    return left <= SOON_DAYS ? { person: true, hr: false, tone: "soon" } : NONE
  }

  const over = -left
  if (OVER_DAYS.includes(over)) {
    // Od siedmeho dňa už nie je adresátom len človek.
    return { person: true, hr: over >= 7, tone: "over" }
  }
  // Potom raz týždenne — sedem, štrnásť, dvadsaťjeden… a vždy aj personalistovi.
  if (over > 7 && over % 7 === 0) return { person: true, hr: true, tone: "over" }
  return NONE
}
