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
import { reminderPlan, daysLeft } from "./due"
import { getCollection } from "./mongodb"

/** Odkedy sa nepotvrdené považuje za meškajúce. Dva týždne (TODO I2). */
export const DEFAULT_DAYS = 14

/**
 * Prah pre „dať vedieť všetkým, ktorí nepotvrdili".
 *
 * Nula nie je zvláštny režim výpočtu — je to ten istý výpočet s prahom nula,
 * takže prejde aj povinnosť, ktorá vznikla dnes. Vďaka tomu má **konečne
 * cestu k e-mailu aj povinnosť z trasy**: pridelenie pri nej neexistuje, a
 * „dať vedieť" nad prideleniami ju preto nikdy neponúklo.
 *
 * Povinnosť **bez začiatku** sa nezahrnie ani tu. Bez `since` sa nedá
 * povedať, odkedy o nej človek vie, a jediné, čo by e-mail dosiahol, je
 * pripomenúť niečo, čo možno pripomenuté už bolo.
 */
export const NOTICE_DAYS = 0

/**
 * Prah z adresy alebo z formulára.
 *
 * Vlastná funkcia preto, že `Math.max(1, Number(raw) || DEFAULT_DAYS)` —
 * tvar, ktorý tu bol — mal **dve zábrany naraz**: jednotku ako dolnú hranicu
 * a `||`, cez ktoré nula prepadla na 14. Prah 0 sa tým nedal nastaviť vôbec
 * a povinnosti z trás zostali bez cesty k e-mailu.
 */
export function thresholdDays(raw: string | undefined, fallback = DEFAULT_DAYS): number {
  if (raw === undefined || raw.trim() === "") return fallback
  const n = Number(raw)
  // Nezmysel v adrese nemá tíško spadnúť na nulu — to by rozposlalo
  // e-maily všetkým namiesto meškajúcim.
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

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

// ── pripomienky podľa termínu (ADR-004) ──────────────────────────────────────

/**
 * Komu sa dnes ozvať kvôli **termínu**, a v akom tóne.
 *
 * Toto je iná vec než `overdue()` nad ním. Ten počíta meškanie od začiatku
 * povinnosti podľa prahu, ktorý si zvolí personalista, a slúži mu na prehľad.
 * Tu ide o termín, ktorý **niekto konkrétny zadal** pri prideľovaní — a preto
 * sa podľa neho smie písať priamo človeku.
 *
 * Kadencia je v `reminderPlan()` (D-5…D-0 denne, potom D+1, D+3, D+7 a ďalej
 * týždenne, od týždňa aj personalistovi). Zámerne **nie je** tu: je to čistá
 * funkcia nad dátumami a testuje sa bez databázy.
 */
export interface DueReminder {
  personId: string
  fullName: string
  email: string
  /** Povinnosti, na ktoré sa dnes ozývame. Jeden e-mail na človeka. */
  items: { duty: Duty; due: Date; daysLeft: number }[]
  /** Tón celej správy. Keď má človek oboje, rozhoduje to horšie. */
  tone: "soon" | "over"
  /** Má o tom dnes vedieť aj personalista? (Od siedmeho dňa po termíne.) */
  alsoHr: boolean
}

/**
 * Zoradí a zoskupí povinnosti s termínom, ktoré sa dnes majú pripomenúť.
 *
 * Čistá funkcia nad načítanými riadkami — `dueRemindersFor()` nižšie je jej
 * jediný databázový obal. Rovnaké delenie ako `overdueFrom()` / `overdue()`.
 */
export function dueRemindersFrom(rows: Duty[], asOf = new Date()): DueReminder[] {
  const groups = new Map<string, DueReminder>()

  for (const duty of rows) {
    // Potvrdené povinnosti vypadnú tu, nie až v šablóne: e-mail o niečom,
    // čo je hotové, je horší než žiadny.
    if (duty.acknowledgedAt) continue
    if (!duty.due) continue

    const plan = reminderPlan(duty.due, asOf)
    if (!plan.person || !plan.tone) continue

    const left = daysLeft(duty.due, asOf)
    const existing = groups.get(duty.personId)
    if (existing) {
      existing.items.push({ duty, due: duty.due, daysLeft: left })
      // Horší tón vyhráva: kto má jednu vec po termíne a druhú pred ním,
      // dostane správu „ste po termíne" — nie upokojujúce „blíži sa".
      if (plan.tone === "over") existing.tone = "over"
      existing.alsoHr = existing.alsoHr || plan.hr
      continue
    }
    groups.set(duty.personId, {
      personId: duty.personId,
      fullName: duty.fullName,
      email: duty.email,
      items: [{ duty, due: duty.due, daysLeft: left }],
      tone: plan.tone,
      alsoHr: plan.hr,
    })
  }

  for (const g of groups.values()) {
    // Najsúrnejšie hore — po termíne pred tým, čo sa blíži.
    g.items.sort((a, b) => a.daysLeft - b.daysLeft)
  }
  // Ľudia rovnako: kto je najhlbšie po termíne, je v prehľade prvý.
  return [...groups.values()].sort(
    (a, b) => a.items[0].daysLeft - b.items[0].daysLeft ||
      a.fullName.localeCompare(b.fullName),
  )
}

export async function dueRemindersFor(
  companyCode: string,
  asOf = new Date(),
): Promise<DueReminder[]> {
  return dueRemindersFrom(await duties(companyCode), asOf)
}

// ── jedna správa na človeka a deň ────────────────────────────────────────────

export const REMINDER_LOG_COLLECTION = "reminder_log"

/**
 * Deň v UTC ako `RRRR-MM-DD`. Kľúč, nie čas: dva behy crona v ten istý deň
 * majú byť ten istý deň aj vtedy, keď medzi nimi prejde pol dňa.
 */
export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/**
 * Pondelok toho týždňa, ako `RRRR-MM-DD`. Kľúč pre veci, ktoré majú chodiť
 * **raz za týždeň**, aj keď beh je denný — súhrn pre personalistu.
 */
export function weekKey(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
  // `getUTCDay()` je 0 pre nedeľu; posun na pondelok je preto 6, nie -1.
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1))
  return dayKey(d)
}

/**
 * Zaberie právo ozvať sa tomuto človeku dnes. `true` znamená „choď", `false`
 * „už sa mu dnes ozvalo".
 *
 * **Zapisuje sa pred odoslaním, nie po ňom.** Opačné poradie znie lákavo
 * (nezapíš, čo neodišlo), ale pri páde medzi odoslaním a zápisom by človek
 * dostal tú istú správu dvakrát. Takto v najhoršom prípade jedna správa
 * v jeden deň nepríde — a príde nasledujúci deň, lebo kadencia beží ďalej.
 * Dvakrát poslaná pripomienka je horšia než raz vynechaná.
 *
 * Jedinečnosť stráži index, nie kontrola pred zápisom: dva behy crona naraz
 * by sa v kontrole minuli.
 */
export async function claimReminder(
  companyCode: string,
  key: string,
  day: string,
): Promise<boolean> {
  const col = await getCollection(REMINDER_LOG_COLLECTION)
  try {
    await col.insertOne({ companyCode, key, day, at: new Date() } as never)
    return true
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: number }).code === 11000) return false
    // Iná chyba než duplicita: radšej sa neozvať, než sa ozvať dvakrát.
    console.error("[pripomienky] zápis o odoslaní zlyhal:", e)
    return false
  }
}
