/**
 * dokumenty.ts — verzie dokumentu a to, ktorá z nich platí (D25, D6).
 *
 * `documents` dnes verziu **prepisuje**: import nastaví `versionId` navrch
 * a predchádzajúce znenie sa z dokumentu stratí (chunky sa archivujú, dokument
 * nie). Kým išlo o vyhľadávanie, stačilo to — hľadá sa v platnom znení.
 *
 * Pri potvrdzovaní noriem to nestačí. Otázka pri audite neznie „potvrdil to?",
 * ale „potvrdil **to znenie**, ktoré platilo v čase, keď podľa neho mal
 * konať?". Bez histórie verzií je záznam o potvrdení právne bezcenný.
 *
 * Preto `versions[]` — v cieľovom tvare, aký potrebuje CMS
 * (`docs/CMS_KONCEPCIA.md` A.3), nie v zjednodušenom. Verzovanie pritom nie je
 * potreba onboardingu: je to povinnosť celého systému, lebo `documents` je
 * spoločné úložisko pre obsah zo všetkých vstupných kanálov (D25).
 */

import { getCollection } from "./mongodb"

export const KOLEKCIA_DOKUMENTY = "documents"

export interface Verzia {
  /** Nemenné. Zhodné s `document_chunks.versionId` — chunk patrí verzii. */
  versionId: string
  /** Ľudské označenie: „1.2", „novela 2026". */
  label: string

  /**
   * Právna platnosť (D6) — oddelená od „technicky najnovšia verzia".
   * `null` znamená **platnosť neurčená**, nie „platí odjakživa".
   */
  effectiveFrom: Date | null
  effectiveTo: Date | null

  isActive: boolean
  contentHash?: string
  changeNote?: string

  /**
   * Vypĺňa **človek**, nikdy sa neodvodzuje z diffu (D30). Oprava preklepu
   * a nová povinnosť vyzerajú v porovnaní podobne; systém to rozhodnúť nevie
   * a nemá.
   */
  requiresReacknowledgement?: boolean

  publishedAt?: Date
  publishedBy?: string
}

/** Len tá časť `documents`, ktorú potrebuje onboarding. */
export interface Dokument {
  documentId: string
  title: string
  companyCode?: string
  accessLevel?: "public" | "internal"
  /**
   * Základný jazyk, v ktorom je dokument napísaný (číselník `language`).
   * **Nie je to jazyk prostredia** — nič neprekladáme; dokument v inom jazyku
   * je samostatný dokument, nie preklad. Viď `jazyky.ts`.
   */
  language?: string
  versions?: Verzia[]
  /** Ponechané kvôli dokumentom naimportovaným pred zavedením `versions[]`. */
  versionId?: string
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
}

/** Prečo dokument nemá platné znenie — aby sa dalo povedať niečo konkrétne. */
export type DovodBezVerzie =
  | "ziadne-verzie"
  | "platnost-neurcena"
  | "vsetky-archivovane"
  | "este-neplati"
  | "uz-neplati"

export type VysledokPlatnosti =
  | { ok: true; verzia: Verzia }
  | { ok: false; dovod: DovodBezVerzie }

/**
 * Ktorá verzia platí k dátumu (predvolene dnes).
 *
 * Pravidlá sú z D6: `isActive` + `effectiveFrom/To`, pri viacerých vyhovujúcich
 * platí tá s najneskorším `effectiveFrom` (lex posterior, R3
 * v `docs/PRECEDENCIA_NORIEM.md`).
 *
 * **Verzia bez `effectiveFrom` neplatí.** Nie je to prísnosť pre prísnosť:
 * kurátor jej platnosť ešte neurčil (D25 — obsah z kanála prichádza
 * `isActive:false` a dátum mu dáva človek), a hlavne — znenie potvrdzovacej
 * formulky obsahuje „platná od {dátum}" (D28). Bez dátumu sa formulka nedá
 * ani zostaviť, takže potvrdiť takú verziu by znamenalo potvrdiť niečo,
 * čo sa nedá zapísať.
 *
 * Čistá funkcia bez databázy — je to jediné miesto s netriviálnymi pravidlami
 * a jediné, ktoré sa dá otestovať bez clustera.
 */
export function platnaVerzia(dok: Dokument, kDatumu: Date = new Date()): VysledokPlatnosti {
  const verzie = dok.versions ?? []
  if (verzie.length === 0) return { ok: false, dovod: "ziadne-verzie" }

  const aktivne = verzie.filter(v => v.isActive)
  if (aktivne.length === 0) return { ok: false, dovod: "vsetky-archivovane" }

  const sPlatnostou = aktivne.filter(v => v.effectiveFrom instanceof Date)
  if (sPlatnostou.length === 0) return { ok: false, dovod: "platnost-neurcena" }

  const vyhovujuce = sPlatnostou.filter(v =>
    (v.effectiveFrom as Date).getTime() <= kDatumu.getTime() &&
    (v.effectiveTo == null || v.effectiveTo.getTime() > kDatumu.getTime())
  )

  if (vyhovujuce.length === 0) {
    // Rozlíšenie „ešte" vs „už" je pre človeka na druhej strane podstatné:
    // prvé znamená počkaj, druhé znamená hľadaj novšie znenie.
    const najskorsi = Math.min(...sPlatnostou.map(v => (v.effectiveFrom as Date).getTime()))
    return { ok: false, dovod: najskorsi > kDatumu.getTime() ? "este-neplati" : "uz-neplati" }
  }

  const najnovsia = vyhovujuce.reduce((a, b) =>
    (a.effectiveFrom as Date).getTime() >= (b.effectiveFrom as Date).getTime() ? a : b
  )
  return { ok: true, verzia: najnovsia }
}

/** Načíta dokument. `null`, keď taký nie je. */
export async function nacitajDokument(documentId: string): Promise<Dokument | null> {
  const col = await getCollection<Dokument>(KOLEKCIA_DOKUMENTY)
  return col.findOne({ documentId })
}

/**
 * Pridá verziu do histórie. **Nikdy neprepisuje existujúcu** (D25).
 *
 * Idempotentné podľa `versionId`: opakovaný beh toho istého importu históriu
 * nezdvojí. Predchádzajúcej platnej verzii sa doplní `effectiveTo` len vtedy,
 * keď nová verzia platnosť má — inak by sa dokument ocitol bez platného
 * znenia kvôli niečomu, čo ešte nikto neschválil.
 */
export async function pridajVerziu(documentId: string, v: Verzia): Promise<void> {
  const col = await getCollection<Dokument>(KOLEKCIA_DOKUMENTY)

  const uz = await col.findOne({ documentId, "versions.versionId": v.versionId })
  if (uz) return

  if (v.effectiveFrom instanceof Date) {
    await col.updateOne(
      { documentId },
      { $set: { "versions.$[stara].effectiveTo": v.effectiveFrom } },
      {
        arrayFilters: [{
          "stara.effectiveTo": null,
          "stara.versionId": { $ne: v.versionId },
        }],
      }
    )
  }

  await col.updateOne({ documentId }, { $push: { versions: v } })
}
