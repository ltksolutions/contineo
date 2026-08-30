/**
 * audit.ts — kto, čo a kedy zmenil (D51).
 *
 * Doteraz sa pri osobe aj pri organizácii zapisovalo `updatedBy` a
 * `updatedAt`. To odpovedá na otázku „kto to menil naposledy" a na nič viac:
 * kto komu udelil rolu `hr`, kto koho vyradil, kto vymenil tajomstvo Entry —
 * to sa po druhej zmene už nedalo zistiť.
 *
 * Pri systéme, ktorého celý zmysel je dokazovať oboznámenie s predpismi, je to
 * diera na nesprávnom mieste: **kto si vie zmeniť rolu, vie si zmeniť
 * publikum.** Potvrdenia sú neprepisovateľné (D24), ale bez stopy o tom, kto
 * mal kedy aké práva, sa nedá povedať, či bolo pridelenie oprávnené.
 *
 * ## Čo to nie je
 *
 * **Nie je to náhrada za `acknowledgements` ani za `assignments`.** Tie sú
 * dôkazom o obsahu — čo bolo pridelené a čo potvrdené — a nesú si vlastné
 * odtlačky. Audit je stopa o **správe**: o právach, prístupoch a nastaveniach.
 * Dva rôzne druhy dôkazu, dve rôzne kolekcie; zlúčiť ich by znamenalo, že sa
 * dôkaz o potvrdení dá zaplaviť záznamami o klikaní v nastaveniach.
 *
 * **Nie je to zdroj pravdy.** Stav je vždy v `persons` a `tenants`; audit
 * hovorí, ako sa tam dostal. Preto sa z neho nič nedopočítava.
 *
 * ## Prečo append-only a bez mazania
 *
 * Rovnaký dôvod ako pri potvrdeniach: záznam, ktorý sa dá prepísať, nie je
 * dôkaz. Preto tu nie je žiadna funkcia, ktorá by zapísané menila — a nebude.
 *
 * ## Tajomstvá
 *
 * Hodnoty sa zapisujú **len pri poliach, ktoré nie sú tajomstvo**. Pri
 * tajomstve (klientsky secret Entry, Google) sa zapíše, že sa zmenilo, a nič
 * viac. Audit, ktorý zbiera heslá, je sám o sebe únik — a bol by to únik
 * s dlhšou retenciou než to, čo chráni.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"

export const AUDIT_COLLECTION = "audit"

/** Čoho sa zmena týkala. Nie tabuľka — vec, ktorej človek rozumie. */
export type AuditSubject =
  | "person"
  | "department"
  | "document"
  | "folder"
  | "assignment"
  | "organisation"
  | "domain"
  | "signin-settings"
  | "tenant"

export interface AuditRecord {
  _id?: ObjectId
  /** Organizácia, ktorej sa zmena týka. Podľa nej sa aj číta (D32). */
  companyCode: string
  subject: AuditSubject
  /**
   * Čo sa stalo, slovesom: `created`, `changed`, `excluded`, `restored`,
   * `renamed`, `moved`, `deleted`, `assigned`, `revoked`, `notified`,
   * `verified`.
   */
  action: string
  /** Identifikátor dotknutej veci: `persons.id`, id oddelenia, `_id` pridelenia. */
  targetId: string | null
  /**
   * Ľudský popis cieľa v čase zmeny — meno osoby, názov oddelenia.
   *
   * Kópia, nie odkaz, z rovnakého dôvodu ako všade inde v tomto projekte:
   * osoba sa dá vyradiť a oddelenie zrušiť, a záznam „zrušil oddelenie 8f3a…" o rok
   * nepovie nikomu nič.
   */
  targetLabel: string | null
  /** Kto to spravil. Adresa, nie `persons.id` — čitateľná bez ďalšieho dotazu. */
  actor: string
  at: Date
  /**
   * Zmenené polia: staré a nové hodnoty. Pri tajomstvách len `{ zmenene: true }`.
   * Prázdne, keď akcia hodnoty nemá (napr. odoslanie oznámenia).
   */
  changes?: Record<string, { from?: unknown; to?: unknown }>
  /** Voľná poznámka — napr. dôvod pridelenia alebo počet adresátov. */
  note?: string
}

/** Polia, ktorých hodnoty sa do auditu nikdy nezapisujú. */
const SECRET_FIELDS = ["clientSecret", "secret", "tajomstvo", "password", "heslo", "token"]

function isSecretField(field: string): boolean {
  const p = field.toLowerCase()
  return SECRET_FIELDS.some(t => p.includes(t.toLowerCase()))
}

/**
 * Rozdiel dvoch stavov — len polia, ktoré sa naozaj zmenili.
 *
 * Zapisovať celý objekt by znamenalo, že v zázname o zmene jazyka je aj meno,
 * adresa a všetky skupiny; po roku sa v tom nedá nič nájsť a je to zbytočná
 * kópia osobných údajov. Preto len rozdiel.
 *
 * Porovnáva sa cez `JSON.stringify`, čo pri poliach závisí od poradia — a to
 * je tu **správne**: zmena poradia skupín je zmena zapísanej hodnoty a nech
 * je vidieť. Falošný záznam navyše je menšia škoda než zamlčaná zmena.
 */
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from?: unknown; to?: unknown }> {
  const out: Record<string, { from?: unknown; to?: unknown }> = {}
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])

  for (const k of keys) {
    const a = before?.[k]
    const b = after?.[k]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    out[k] = isSecretField(k) ? { to: "(zmenené)" } : { from: a ?? null, to: b ?? null }
  }
  return out
}

export interface NewAudit {
  companyCode: string
  subject: AuditSubject
  action: string
  actor: string
  targetId?: string | null
  targetLabel?: string | null
  changes?: Record<string, { from?: unknown; to?: unknown }>
  note?: string
}

/**
 * Zapíše záznam do auditu.
 *
 * **Nikdy nevyhadzuje.** Je to zámer, nie lenivosť: keby zlyhanie zápisu
 * zhodilo samotnú zmenu, jeden pokazený index v audite by zablokoval správu
 * osôb celej organizácii. Zlyhanie sa loguje — chýbajúci záznam je zlý stav,
 * ale nefunkčný portál je horší.
 *
 * Volá sa **po** úspešnej zmene, nie pred ňou. Opačné poradie by zapisovalo
 * zmeny, ktoré sa nestali.
 */
export async function writeAudit(from: NewAudit): Promise<void> {
  try {
    const col = await getCollection<AuditRecord>(AUDIT_COLLECTION)
    await col.insertOne({
      companyCode: from.companyCode,
      subject: from.subject,
      action: from.action,
      targetId: from.targetId ?? null,
      targetLabel: from.targetLabel ?? null,
      actor: from.actor,
      at: new Date(),
      ...(from.changes && Object.keys(from.changes).length > 0 ? { changes: from.changes } : {}),
      ...(from.note ? { note: from.note } : {}),
    } as AuditRecord)
  } catch (e) {
    console.error("[audit] záznam sa nepodarilo zapísať:", e)
  }
}

export interface AuditFilter {
  subject?: AuditSubject
  actor?: string
  targetId?: string
  /** Voľný text — hľadá v popise cieľa a v aktorovi. */
  search?: string
  limit?: number
}

/**
 * Záznamy organizácie, najnovšie hore.
 *
 * `companyCode` je vždy v podmienke, nikdy nie v kontrole nad ňou: audit
 * cudzej organizácie je presne ten druh údaja, ktorý sa nesmie dať vytiahnuť
 * uhádnutím identifikátora (D32).
 */
export async function auditRecords(
  companyCode: string,
  filter: AuditFilter = {},
): Promise<AuditRecord[]> {
  const col = await getCollection<AuditRecord>(AUDIT_COLLECTION)
  const q: Record<string, unknown> = { companyCode }

  if (filter.subject) q.subject = filter.subject
  if (filter.actor) q.actor = filter.actor
  if (filter.targetId) q.cielId = filter.targetId
  if (filter.search?.trim()) {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `.*`
    // prehľadalo všetko a `(` zhodilo dotaz.
    const safe = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    q.$or = [
      { targetLabel: { $regex: safe, $options: "i" } },
      { actor: { $regex: safe, $options: "i" } },
      { action: { $regex: safe, $options: "i" } },
    ]
  }

  // Strop je tu preto, že obrazovka bez neho o rok načíta desaťtisíce riadkov
  // a spadne práve vtedy, keď ju niekto otvorí kvôli kontrole.
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000)
  return col.find(q as never).sort({ at: -1 }).limit(limit).toArray()
}
