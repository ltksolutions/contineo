/**
 * notifications.ts — zvonček: čo sa v systéme stalo, keď sa človek nepozeral.
 *
 * ## Prečo táto kolekcia existuje až teraz
 *
 * `docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md` ju v auguste **zámerne
 * nezaložila** (D39, D40 = a) s jednou podmienkou: *„kolekcia `notifications`
 * vznikne až vtedy, keď bude existovať prvý skutočný odosielateľ takých
 * správ — inak by vznikla kolekcia bez odosielateľa a s ňou aj povinnosť
 * odôvodniť ju v O15/O16."*
 *
 * Tá podmienka je splnená: preindexovanie, prepis modelom, rozposielanie
 * pripomienok aj zverejnenie znenia sú v kóde a bežia. D39 a D40 sú tým
 * **prekonané**, nie obídené — zapísané je to v koncepcii.
 *
 * ## Čo tu zámerne nie je
 *
 * **Počty povinností.** „Na potvrdenie 3" už hovorí štítok v navigácii a je
 * tam, kde sa naň klikne. Zvonček, ktorý by to zopakoval, by bol druhé miesto
 * s tou istou pravdou — a tie sa raz rozídu. Zvonček nesie **udalosti**:
 * veci, ktoré sa stali raz a nezanechali stav, z ktorého by sa dali
 * dopočítať.
 *
 * ## Prečo sa neukladá hotový text
 *
 * Ukladá sa **druh a parametre**, veta sa skladá až pri čítaní. Je to opačne
 * než pri potvrdeniach, kde je `statementText` uložený doslovne — a ten
 * rozdiel je zámer: formulka potvrdenia je **dôkaz** a musí zostať presne tá,
 * pod ktorú sa človek podpísal. Upozornenie dôkaz nie je. Zamrznutý text by
 * len znamenal, že kto si prepne jazyk, číta staré oznamy po starom.
 *
 * Z rovnakého dôvodu sa neukladá ani odkaz: cesty sa menia a uložená adresa
 * zostarne ticho — nikto nedostane chybu, len prázdnu stránku.
 *
 * ## Retencia
 *
 * 90 dní, rovnako ako `reminder_log`. Je to záznam o tom, čo kto kedy videl,
 * teda osobný údaj o správaní; kolekcia bez retencie je presne to, pred čím
 * koncepcia varovala. Jedno číslo pre obe kolekcie znamená jedno pravidlo
 * v zázname o spracovateľských činnostiach namiesto dvoch.
 */

import type { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"

export const NOTIFICATIONS_COLLECTION = "notifications"

/** Koľko dní sa upozornenie drží. Zhodné s `reminder_log`. */
export const RETENTION_DAYS = 90

/**
 * Druhy udalostí v prvom kole (rozhodnutie Jána Letka, 2026-09-15).
 *
 * Tri z nich sú dnes **synchrónne** — človek na ne čaká a výsledok vidí hneď
 * na obrazovke. Zvonček im teda dnes nedáva novinku, ale históriu: miesto,
 * kam sa dá vrátiť. Hodnota narastie, keď sa tie operácie presunú na pozadie.
 * `remindersSent` je jediná, ktorú dnes naozaj nikto nevidí — rozposiela ju
 * cron.
 */
export type NotificationKind =
  | "reindexed"
  | "rewritten"
  | "remindersSent"
  | "versionPublished"

export interface NotificationParams {
  documentId?: string
  /** Kópia názvu v čase udalosti — dokument sa môže premenovať alebo zmiznúť. */
  documentTitle?: string
  versionLabel?: string
  /** Počet úsekov, odoslaných mailov — podľa druhu. */
  count?: number
}

export interface Notification {
  _id?: ObjectId
  companyCode: string
  /** Vždy konkrétna osoba: zvonček je osobný, nie organizačný. */
  personId: string
  kind: NotificationKind
  params: NotificationParams
  createdAt: Date
  /** `null`, kým je neprečítané. */
  readAt: Date | null
}

/**
 * Kam odkaz vedie. **Čistá funkcia** — skladá sa pri čítaní, neukladá sa.
 *
 * `null` znamená „bez odkazu", nie chybu: upozornenie bez cieľa je stále
 * platná správa.
 */
export function notificationHref(
  kind: NotificationKind,
  params: NotificationParams,
): string | null {
  const documentId = (params.documentId ?? "").trim()
  switch (kind) {
    case "reindexed":
    case "rewritten":
    case "versionPublished":
      return documentId ? `/library/${encodeURIComponent(documentId)}` : null
    case "remindersSent":
      return "/hr/reminders"
    default:
      // Neznámy druh nemá odkaz. Radšej nikam, než na obrazovku, ktorá
      // s udalosťou nesúvisí.
      return null
  }
}

/** Odkedy sa už maže. Oddelené od zápisu, aby sa dalo otestovať bez databázy. */
export function retentionCutoff(asOf: Date = new Date(), days = RETENTION_DAYS): Date {
  return new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Zapíše upozornenie. **Nikdy nevyhodí výnimku.**
 *
 * Je to zámer, nie lenivosť: upozornenie je správa *o* operácii, nie jej
 * súčasť. Keby zlyhaný zápis zhodil preindexovanie, pokazili by sme tú
 * operáciu preto, že sa nepodarilo povedať, že dobehla — presne naopak, než
 * na čo zvonček je.
 */
export async function notify(input: {
  companyCode: string
  personId: string
  kind: NotificationKind
  params?: NotificationParams
}): Promise<void> {
  const personId = (input.personId ?? "").trim()
  const companyCode = (input.companyCode ?? "").trim()
  if (!personId || !companyCode) return
  try {
    const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
    await col.insertOne({
      companyCode: companyCode,
      personId: personId,
      kind: input.kind,
      params: input.params ?? {},
      createdAt: new Date(),
      readAt: null,
    } as Notification)
  } catch (e) {
    console.error("[notifications] zapis upozornenia zlyhal:", e)
  }
}

/** To isté pre viac ľudí naraz — jeden zápis, nie N. */
export async function notifyPeople(input: {
  companyCode: string
  personIds: string[]
  kind: NotificationKind
  params?: NotificationParams
}): Promise<void> {
  const companyCode = (input.companyCode ?? "").trim()
  const ids = [...new Set((input.personIds ?? []).map(v => (v ?? "").trim()).filter(Boolean))]
  if (!companyCode || ids.length === 0) return
  const now = new Date()
  try {
    const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
    await col.insertMany(ids.map(personId => ({
      companyCode: companyCode,
      personId: personId,
      kind: input.kind,
      params: input.params ?? {},
      createdAt: now,
      readAt: null,
    })) as Notification[])
  } catch (e) {
    console.error("[notifications] hromadny zapis upozorneni zlyhal:", e)
  }
}

/**
 * Počet neprečítaných. Volá sa pri **každom** vykreslení hlavičky, takže je
 * to `countDocuments` nad zloženým indexom a nič viac — žiadne načítanie tela.
 *
 * Zlyhanie sa berie ako nula: hlavička sa nemá rozbiť preto, že sa nepodaril
 * dotaz na ozdobu.
 */
export async function unreadCount(companyCode: string, personId: string): Promise<number> {
  if (!companyCode?.trim() || !personId?.trim()) return 0
  try {
    const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
    return await col.countDocuments({ companyCode, personId, readAt: null } as never)
  } catch (e) {
    console.error("[notifications] pocet neprecitanych zlyhal:", e)
    return 0
  }
}

/** Posledné upozornenia osoby, najnovšie hore. */
export async function recentNotifications(
  companyCode: string,
  personId: string,
  limit = 50,
): Promise<Notification[]> {
  if (!companyCode?.trim() || !personId?.trim()) return []
  const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
  return col
    .find({ companyCode, personId } as never)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(200, limit)))
    .toArray()
}

/**
 * Označí všetko ako prečítané. Vracia počet zmenených.
 *
 * **Všetko naraz, nie po jednom.** Zvonček je zoznam, ktorý sa prečíta
 * pohľadom; klikať na každý riadok zvlášť by bola práca navyše za nič.
 */
export async function markAllRead(companyCode: string, personId: string): Promise<number> {
  if (!companyCode?.trim() || !personId?.trim()) return 0
  const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
  const r = await col.updateMany(
    { companyCode, personId, readAt: null } as never,
    { $set: { readAt: new Date() } },
  )
  return r.modifiedCount ?? 0
}

/**
 * Zmaže staršie než retencia. Naprieč organizáciami — je to prevádzková
 * údržba, nie pohľad zákazníka, a púšťa ju cron.
 */
export async function purgeExpired(asOf: Date = new Date()): Promise<number> {
  const col = await getCollection<Notification>(NOTIFICATIONS_COLLECTION)
  const r = await col.deleteMany({ createdAt: { $lt: retentionCutoff(asOf) } } as never)
  return r.deletedCount ?? 0
}
