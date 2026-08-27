/**
 * potvrdenia.ts — auditný záznam „oboznámil som sa" (kolekcia `acknowledgements`, D24).
 *
 * Jadro Fázy 8. Tri veci, ktoré sa tu nesmú pokaziť:
 *
 * 1. **Záznam je nemenný.** Kolekcia je append-only: potvrdenie sa nikdy
 *    neprepisuje ani nemaže. Odvolanie či oprava je **nový** záznam, ktorý
 *    ukazuje na starý cez `supersedes`. Auditný záznam, ktorý sa dá upraviť,
 *    nie je auditný záznam.
 *
 * 2. **Nesie odtlačky, nie odkazy.** `email`, `fullName`, `documentTitle`,
 *    `versionLabel` sa ukladajú aj vtedy, keď sú inde v databáze. Záznam musí
 *    byť čitateľný o tri roky, keď sa človek volá inak, dokument sa premenoval
 *    a trasa už neexistuje. Záznam, ktorý na vysvetlenie potrebuje `$lookup`
 *    do štyroch kolekcií, ktoré sa medzitým zmenili, nie je dôkaz — je to
 *    hypotéza.
 *
 * 3. **Verziu určuje server.** Nikdy nie to, čo poslal prehliadač. Inak by sa
 *    dal poslať `versionId` starého znenia a potvrdiť niečo iné, než bolo na
 *    obrazovke.
 *
 * Znenie formulky je rozhodnutie D28 — oboznámenie a záväzok, nie súhlas.
 * Pri vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez
 * ohľadu na to, či s ňou niekto súhlasí.
 *
 * **Jazyk.** Prostredie je viacjazyčné, obsah nie (`jazyky.ts`). Znenie formulky
 * sa preto skladá v jazyku **človeka**, kým dokument si nesie svoj vlastný.
 * Záznam ukladá oboje — `language` (v čom potvrdzoval) aj `documentLanguage`
 * (v čom je smernica). Bez toho sa pri audite nedá odpovedať na otázku, či
 * český rozhodca potvrdzoval slovenský text; a to je otázka, ktorá príde.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { nacitajDokument, platnaVerzia } from "./dokumenty"
import type { Verzia } from "./dokumenty"
import { datum, slovnik, normalizujJazyk } from "./jazyky"
import type { JazykUI } from "./jazyky"

export const KOLEKCIA_POTVRDENIA = "acknowledgements"

/** Odvolanie a oprava sú nové záznamy, nie úprava starého. */
export type TypZaznamu = "acknowledgement" | "revocation" | "correction"

export interface Potvrdenie {
  _id?: ObjectId
  type: TypZaznamu
  companyCode: string

  // KTO — s odtlačkom údajov v čase potvrdenia
  personId: string
  email: string
  fullName: string

  // ČO — s odtlačkom údajov v čase potvrdenia
  documentId: string
  versionId: string
  documentTitle: string
  versionLabel: string
  effectiveFrom: Date
  /** Jazyk, v ktorom je napísaná samotná smernica. */
  documentLanguage: string | null

  // ČÍM — doslovné znenie, nie odkaz naň
  statementText: string
  statementHash: string
  /** Jazyk prostredia, v ktorom človek formulku videl a potvrdil. */
  language: JazykUI

  // KEDY a ODKIAĽ
  acknowledgedAt: Date
  ip: string | null
  userAgent: string | null

  // KONTEXT
  trackId: string | null
  /** `import` je pripravené pre prípadné historické záznamy z iného systému. */
  origin: "portal" | "import"
  supersedes: ObjectId | null

  createdAt: Date
}

/**
 * Znenie potvrdzovacej formulky (D28) v jazyku prostredia.
 *
 * Ukladá sa doslovne, takže neskoršia úprava formulácie **nemení staré
 * záznamy** — a rovnako platí, že zmena jazyka rozhrania nemení, čo človek
 * kedysi potvrdil. Preto je text v zázname, nie odkaz naň.
 */
export function zneniePotvrdenia(
  nazov: string,
  label: string,
  platnaOd: Date,
  jazyk: JazykUI = "sk"
): string {
  return slovnik(jazyk).potvrdenie(nazov, label, datum(platnaOd, jazyk))
}

/** SHA-256 znenia — na rýchle porovnanie, nie ako náhrada textu. */
export async function odtlacokZnenia(text: string): Promise<string> {
  const bajty = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(bajty)].map(b => b.toString(16).padStart(2, "0")).join("")
}

/** Kto potvrdzuje — údaje sa do záznamu skopírujú, nie prepoja. */
export interface Potvrdzujuci {
  personId: string
  email: string
  fullName: string
  companyCode: string
  /** Jazyk prostredia z `persons.language`. Neznámy padá na slovenčinu. */
  language?: string
}

export type VysledokPotvrdenia =
  | { ok: true; id: string; znenie: string; verzia: Verzia }
  | { ok: false; dovod: "dokument-neexistuje" | "bez-platnej-verzie" | "uz-potvrdene" | "zapis-zlyhal"; detail?: string }

/**
 * Zapíše potvrdenie. **Verziu si server načíta sám** — z požiadavky sa berie
 * len to, ktorý dokument sa potvrdzuje.
 *
 * Poradie krokov je bezpečnostné, nie kozmetické:
 *   1. načítaj dokument a urči platnú verziu na serveri,
 *   2. zlož znenie z názvu, `label` a `effectiveFrom`,
 *   3. zapíš záznam,
 *   4. až potom povedz klientovi „hotovo".
 */
export async function potvrd(
  kto: Potvrdzujuci,
  documentId: string,
  kontext: { ip?: string | null; userAgent?: string | null; trackId?: string | null } = {}
): Promise<VysledokPotvrdenia> {
  const dok = await nacitajDokument(documentId)
  if (!dok) return { ok: false, dovod: "dokument-neexistuje" }

  const platna = platnaVerzia(dok)
  if (!platna.ok) return { ok: false, dovod: "bez-platnej-verzie", detail: platna.dovod }

  const v = platna.verzia
  const platnaOd = v.effectiveFrom as Date
  const jazyk = normalizujJazyk(kto.language)
  const znenie = zneniePotvrdenia(dok.title, v.label, platnaOd, jazyk)
  const teraz = new Date()

  const zaznam: Potvrdenie = {
    type: "acknowledgement",
    companyCode: kto.companyCode,
    personId: kto.personId,
    email: kto.email,
    fullName: kto.fullName,
    documentId: dok.documentId,
    versionId: v.versionId,
    documentTitle: dok.title,
    versionLabel: v.label,
    effectiveFrom: platnaOd,
    documentLanguage: dok.language ?? null,
    statementText: znenie,
    statementHash: await odtlacokZnenia(znenie),
    language: jazyk,
    acknowledgedAt: teraz,
    ip: kontext.ip ?? null,
    userAgent: kontext.userAgent ?? null,
    trackId: kontext.trackId ?? null,
    origin: "portal",
    supersedes: null,
    createdAt: teraz,
  }

  try {
    const col = await getCollection<Potvrdenie>(KOLEKCIA_POTVRDENIA)
    const r = await col.insertOne(zaznam)
    return { ok: true, id: String(r.insertedId), znenie, verzia: v }
  } catch (e) {
    // Unikátny index odmietne druhé potvrdenie tej istej verzie. Nie je to
    // chyba používateľa — už to má za sebou a treba mu to povedať, nie
    // zobraziť chybu servera.
    if ((e as { code?: number }).code === 11000) return { ok: false, dovod: "uz-potvrdene" }
    console.error("[potvrdenia] zápis zlyhal:", e)
    return { ok: false, dovod: "zapis-zlyhal", detail: String((e as Error).message ?? e) }
  }
}

/** Má táto osoba potvrdenú túto verziu? */
export async function maPotvrdene(personId: string, versionId: string): Promise<boolean> {
  const col = await getCollection<Potvrdenie>(KOLEKCIA_POTVRDENIA)
  const pocet = await col.countDocuments(
    { personId, versionId, type: "acknowledgement" },
    { limit: 1 }
  )
  return pocet > 0
}

/**
 * Potvrdenia jednej osoby, najnovšie prvé.
 *
 * Osoba musí vedieť zobraziť a stiahnuť, čo o nej systém eviduje, aj bez
 * žiadosti na HR (`docs/ONBOARDING_KONCEPCIA.md` kap. 6).
 */
export async function potvrdeniaOsoby(personId: string): Promise<Potvrdenie[]> {
  const col = await getCollection<Potvrdenie>(KOLEKCIA_POTVRDENIA)
  return col.find({ personId }).sort({ acknowledgedAt: -1 }).toArray()
}
