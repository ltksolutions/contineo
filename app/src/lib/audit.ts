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
export type AuditPredmet =
  | "osoba"
  | "utvar"
  | "dokument"
  | "priecinok"
  | "pridelenie"
  | "organizacia"
  | "domena"
  | "prihlasenie-nastavenie"
  | "tenant"

export interface AuditZaznam {
  _id?: ObjectId
  /** Organizácia, ktorej sa zmena týka. Podľa nej sa aj číta (D32). */
  companyCode: string
  predmet: AuditPredmet
  /**
   * Čo sa stalo, slovesom: `zalozene`, `zmenene`, `vyradene`, `vratene`,
   * `premenovane`, `presunute`, `zrusene`, `pridelene`, `odvolane`,
   * `oznamene`, `overene`.
   */
  akcia: string
  /** Identifikátor dotknutej veci: `persons.id`, id útvaru, `_id` pridelenia. */
  cielId: string | null
  /**
   * Ľudský popis cieľa v čase zmeny — meno osoby, názov útvaru.
   *
   * Kópia, nie odkaz, z rovnakého dôvodu ako všade inde v tomto projekte:
   * osoba sa dá vyradiť a útvar zrušiť, a záznam „zrušil útvar 8f3a…" o rok
   * nepovie nikomu nič.
   */
  cielPopis: string | null
  /** Kto to spravil. Adresa, nie `persons.id` — čitateľná bez ďalšieho dotazu. */
  aktor: string
  kedy: Date
  /**
   * Zmenené polia: staré a nové hodnoty. Pri tajomstvách len `{ zmenene: true }`.
   * Prázdne, keď akcia hodnoty nemá (napr. odoslanie oznámenia).
   */
  zmeny?: Record<string, { z?: unknown; na?: unknown }>
  /** Voľná poznámka — napr. dôvod pridelenia alebo počet adresátov. */
  poznamka?: string
}

/** Polia, ktorých hodnoty sa do auditu nikdy nezapisujú. */
const TAJOMSTVA = ["clientSecret", "secret", "tajomstvo", "password", "heslo", "token"]

function jeTajomstvo(pole: string): boolean {
  const p = pole.toLowerCase()
  return TAJOMSTVA.some(t => p.includes(t.toLowerCase()))
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
export function rozdiel(
  pred: Record<string, unknown> | null | undefined,
  po: Record<string, unknown> | null | undefined,
): Record<string, { z?: unknown; na?: unknown }> {
  const out: Record<string, { z?: unknown; na?: unknown }> = {}
  const kluce = new Set([...Object.keys(pred ?? {}), ...Object.keys(po ?? {})])

  for (const k of kluce) {
    const a = pred?.[k]
    const b = po?.[k]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    out[k] = jeTajomstvo(k) ? { na: "(zmenené)" } : { z: a ?? null, na: b ?? null }
  }
  return out
}

export interface NovyAudit {
  companyCode: string
  predmet: AuditPredmet
  akcia: string
  aktor: string
  cielId?: string | null
  cielPopis?: string | null
  zmeny?: Record<string, { z?: unknown; na?: unknown }>
  poznamka?: string
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
export async function zapisAudit(z: NovyAudit): Promise<void> {
  try {
    const col = await getCollection<AuditZaznam>(AUDIT_COLLECTION)
    await col.insertOne({
      companyCode: z.companyCode,
      predmet: z.predmet,
      akcia: z.akcia,
      cielId: z.cielId ?? null,
      cielPopis: z.cielPopis ?? null,
      aktor: z.aktor,
      kedy: new Date(),
      ...(z.zmeny && Object.keys(z.zmeny).length > 0 ? { zmeny: z.zmeny } : {}),
      ...(z.poznamka ? { poznamka: z.poznamka } : {}),
    } as AuditZaznam)
  } catch (e) {
    console.error("[audit] záznam sa nepodarilo zapísať:", e)
  }
}

export interface AuditFilter {
  predmet?: AuditPredmet
  aktor?: string
  cielId?: string
  /** Voľný text — hľadá v popise cieľa a v aktorovi. */
  hladat?: string
  limit?: number
}

/**
 * Záznamy organizácie, najnovšie hore.
 *
 * `companyCode` je vždy v podmienke, nikdy nie v kontrole nad ňou: audit
 * cudzej organizácie je presne ten druh údaja, ktorý sa nesmie dať vytiahnuť
 * uhádnutím identifikátora (D32).
 */
export async function auditZaznamy(
  companyCode: string,
  filter: AuditFilter = {},
): Promise<AuditZaznam[]> {
  const col = await getCollection<AuditZaznam>(AUDIT_COLLECTION)
  const q: Record<string, unknown> = { companyCode }

  if (filter.predmet) q.predmet = filter.predmet
  if (filter.aktor) q.aktor = filter.aktor
  if (filter.cielId) q.cielId = filter.cielId
  if (filter.hladat?.trim()) {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `.*`
    // prehľadalo všetko a `(` zhodilo dotaz.
    const bezpecne = filter.hladat.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    q.$or = [
      { cielPopis: { $regex: bezpecne, $options: "i" } },
      { aktor: { $regex: bezpecne, $options: "i" } },
      { akcia: { $regex: bezpecne, $options: "i" } },
    ]
  }

  // Strop je tu preto, že obrazovka bez neho o rok načíta desaťtisíce riadkov
  // a spadne práve vtedy, keď ju niekto otvorí kvôli kontrole.
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000)
  return col.find(q as never).sort({ kedy: -1 }).limit(limit).toArray()
}
