/**
 * lawCatalog.ts — katalóg legislatívy: predpisy zo Slov-Lexu ako zdieľaný
 * obsah platformy (ADR-039, D257, D258, D261).
 *
 * **Menovitá výnimka z D90.** Kolekcie `law_acts`, `law_act_versions`
 * a `law_chunks` nemajú `companyCode`: text zákona je úradné dielo a nepatrí
 * žiadnej organizácii, preto sa drží raz pre všetky. Funkcie nad katalógom
 * organizáciu neberú — a naopak, čo si organizácia z katalógu **vybrala**
 * (`law_subscriptions`, `law_settings`), je jej záznam a `companyCode` je
 * v podmienke každého dotazu bez výnimky.
 *
 * **Katalóg nie je dôkazný záznam** (D257): nikto v ňom nič neschvaľuje ani
 * nepotvrdzuje. Oprava textu na portáli sa prepíše (odtlačok), znenia sa
 * dopĺňajú. Dôkazné zostáva len to, čo z katalógu vstúpi do knižnice
 * organizácie (fáza 2, D260).
 *
 * Čítanie portálu a prevod na Markdown je v `slovLex.ts` (ADR-037, čisté
 * funkcie); tu je sieť, databáza a rez úsekov (`chunkCut.ts`, ADR-035: § je
 * jednotka). Vektory robí Atlas sám (`atlas-auto`) v tom istom priestore ako
 * knižnica — polia `embeddingModel` a spol. nesie každý úsek, aby strážca
 * priestoru (`embeddingGuard.ts`) platil aj pre legislatívu.
 */

import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { cutForIndex } from "./chunkCut"
import { CHUNKER_VERSION } from "./chunkIdentity"
import { createHash } from "node:crypto"
import { AppError } from "./appError"
import { getTenantProfile } from "./tenantProfile"
import type { DataResidency } from "./residency"
import {
  parseActRef, actId as actIdOf, actNumber, historyUrl, versionUrl, portalUrl, parseHistory, parseVersion, effectiveRow,
  timepointDate, SLOV_LEX_ADAPTER_VERSION, type ActRef, type HistoryRow,
} from "./slovLex"

export const LAW_ACTS_COLLECTION = "law_acts"
export const LAW_VERSIONS_COLLECTION = "law_act_versions"
export const LAW_CHUNKS_COLLECTION = "law_chunks"
export const LAW_SUBSCRIPTIONS_COLLECTION = "law_subscriptions"
export const LAW_SETTINGS_COLLECTION = "law_settings"

/** Id zdroja vo výbere zdrojov (`?src=law`) — popri `library` a id konektorov (D259). */
export const LAW_SOURCE_ID = "law"
/** `sourceType` úseku z katalógu — čitateľ má vedieť, že číta zákon, nie predpis organizácie. */
export const LAW_SOURCE_TYPE = "law"
/** Režimy rezidencie, v ktorých sa katalóg z cloudu nečíta (D257; ako ADR-038 D251). */
export const LAW_BLOCKED: readonly DataResidency[] = ["on-prem", "air-gap"]

export class LawCatalogError extends AppError {}

/**
 * Ponuka pre športovú organizáciu (ADR-039 § 5) — návrh, nie nastavenie:
 * predpis sa odoberá až po kliknutí. Názvy sú názvy predpisov (jazyk
 * dokumentu, nie prostredia), preto nejdú cez i18n.
 */
export const SUGGESTED_ACTS: readonly { address: string; title: string }[] = [
  { address: "440/2015", title: "Zákon o športe" },
  { address: "1/2014", title: "Zákon o organizovaní verejných športových podujatí" },
  { address: "83/1990", title: "Zákon o združovaní občanov" },
  { address: "18/2018", title: "Zákon o ochrane osobných údajov" },
]

/** Odtlačok textu znenia — rovnaký výpočet ako `connectorImport.contentHash()`; neimportuje sa, aby katalóg neťahal sadzbu PDF do cronu a odpovede. */
const contentHash = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex")

// ── Záznamy ──────────────────────────────────────────────────────────────────

export interface LawAct {
  /** `SK/ZZ/2015/440` — identita predpisu, rovnaká ako `source.externalId` v knižnici (ADR-037 D245). */
  actId: string
  year: number
  number: number
  /** Názov z posledného stiahnutého znenia: „Zákon č. 440/2015 Z. z. o športe …". */
  title: string
  /** „Zákon", „Vyhláška"… */
  kind: string
  addedAt: Date
  addedBy: { companyCode: string; email: string }
  lastCheckedAt: Date | null
  /** Posledná chyba kontroly — ostáva, kým ďalšia kontrola neprejde. */
  lastError: string | null
  adapterVersion: string
}

export interface LawActVersion {
  actId: string
  /** `YYYYMMDD` — časová verzia na portáli. */
  timepoint: string
  /** `actId@timepoint` — kľúč, podľa ktorého sa filtrujú úseky. */
  versionKey: string
  effectiveFrom: Date
  effectiveTo: Date | null
  /** Novela, ktorou znenie vzniklo („354/2016 Z. z."); `null` pri pôvodnom. */
  amendment: string | null
  title: string
  markdown: string
  contentHash: string
  /** Záväzné PDF na Slov-Lexe — len odkaz; sťahuje sa až pri odbere do knižnice (D260). */
  pdfUrl: string
  portalUrl: string
  fetchedAt: Date
  chunkCount: number
  adapterVersion: string
}

export interface LawChunk {
  versionKey: string
  actId: string
  timepoint: string
  chunkIndex: number
  text: string
  heading: string
  articleRef: string | null
  chunkType: string
  sourceType: typeof LAW_SOURCE_TYPE
  language: "sk"
  accessLevel: "public"
  embeddingModel: string
  embeddingDim: number
  embeddingProvider: string
  embeddedAt: Date
  chunkerVersion: number
  createdAt: Date
}

/** Odber predpisu organizáciou (D259) — záznam organizácie, s `companyCode`. */
export interface LawSubscription {
  companyCode: string
  actId: string
  /** `ask` = zdroj na Opýtať sa; `library` príde vo fáze 2 (D260). */
  level: "ask"
  addedAt: Date
  addedBy: string
}

export interface LawSettings {
  companyCode: string
  /** Zdroj „Legislatíva" je vo výbere zapnutý predvolene. */
  defaultOn: boolean
  updatedAt?: Date
  updatedBy?: string
}

// ── Čisté funkcie (testované bez databázy) ───────────────────────────────────

export const versionKeyOf = (actId: string, timepoint: string): string => `${actId}@${timepoint}`

/**
 * Kotva paragrafu na portáli z označenia úseku: „§ 58" → `paragraf-58`,
 * „§ 58a" → `paragraf-58a`. Pre článok, prílohu alebo poznámky kotva nie je.
 */
export function anchorFor(articleRef: string | null | undefined): string | null {
  const m = /§\s*(\d+[a-z]*)/i.exec(articleRef ?? "")
  return m ? `paragraf-${m[1].toLowerCase()}` : null
}

/** Adresa znenia pre človeka — hlavný portál, konkrétne znenie, voliteľne paragraf (D259). */
export function citationUrl(ref: ActRef, timepoint: string, articleRef: string | null | undefined): string {
  const anchor = anchorFor(articleRef)
  return `${portalUrl(ref, timepoint)}${anchor ? `#${anchor}` : ""}`
}

export function refOfActId(actId: string): ActRef {
  const ref = parseActRef(actId)
  if (!ref) throw new LawCatalogError("law.badAddress", `Neplatný identifikátor predpisu: ${actId}`)
  return ref
}

/**
 * Znenia účinné v daný deň — jedno na predpis: posledné, ktorého účinnosť
 * už nastala a neskončila. História na portáli pri novele uzavrie
 * predchádzajúce znenie (`effectiveTo`); kým ho neuzavrie, rozhoduje poradie.
 */
export function effectiveVersions<T extends { actId: string; timepoint: string; effectiveFrom: Date; effectiveTo: Date | null }>(
  versions: T[], asOf: Date,
): T[] {
  const byAct = new Map<string, T>()
  for (const v of [...versions].sort((a, b) => a.timepoint.localeCompare(b.timepoint))) {
    if (v.effectiveFrom.getTime() > asOf.getTime()) continue
    if (v.effectiveTo && v.effectiveTo.getTime() <= asOf.getTime()) continue
    byAct.set(v.actId, v)
  }
  return [...byAct.values()]
}

/** Smie organizácia s touto rezidenciou čítať katalóg z cloudu? (D257) */
export function lawAllowed(residency: DataResidency | undefined): boolean {
  return !LAW_BLOCKED.includes(residency ?? "global")
}

// ── Sieť ─────────────────────────────────────────────────────────────────────

/** Rovnaké hodnoty ako `webImport.ts`; portál má jedného klienta, nech sa hlási rovnako. */
const FETCH_TIMEOUT_MS = 30_000
const USER_AGENT = "Contineo/1 (+https://contineo.app; kniznica)"

async function fetchText(url: string): Promise<string> {
  let r: Response
  try {
    r = await fetch(url, { headers: { "user-agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (e) {
    throw new LawCatalogError("web.fetchFailed", `Slov-Lex neodpovedal: ${url} (${String((e as Error)?.message ?? e)})`, { url })
  }
  if (!r.ok) throw new LawCatalogError("web.fetchFailed", `Slov-Lex vrátil ${r.status}: ${url}`, { url, status: r.status })
  return r.text()
}

async function fetchHistory(ref: ActRef): Promise<HistoryRow[]> {
  const rows = parseHistory(await fetchText(historyUrl(ref)))
  if (!rows.length) throw new LawCatalogError("web.noVersion", `Predpis ${actNumber(ref)} nemá na Slov-Lexe žiadne znenie.`)
  return rows
}

// ── Zápis znenia a úsekov ────────────────────────────────────────────────────

function embeddingFields(now: Date) {
  return {
    embeddingModel: process.env.EMBEDDING_MODEL ?? "voyage-4",
    embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1024),
    embeddingProvider: process.env.EMBEDDING_KIND ?? "atlas-auto",
    embeddedAt: now,
  }
}

/**
 * Stiahne znenie, nareže ho a zapíše — nové znenie pridá, zmenený text toho
 * istého znenia prepíše (katalóg nie je dôkazný záznam, D257). Vracia, čo sa
 * stalo; `unchanged`, keď je text ten istý ako v katalógu.
 */
async function storeVersion(ref: ActRef, row: HistoryRow, now: Date): Promise<"added" | "refreshed" | "unchanged"> {
  const actId = actIdOf(ref)
  const key = versionKeyOf(actId, row.timepoint)
  const versions = await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION)
  const chunksCol = await getCollection<LawChunk>(LAW_CHUNKS_COLLECTION)

  const html = await fetchText(versionUrl(ref, row.timepoint))
  let page
  try {
    page = parseVersion(html, ref, row.timepoint)
  } catch (e) {
    throw new LawCatalogError("web.parseFailed", String((e as Error)?.message ?? e), { url: versionUrl(ref, row.timepoint) })
  }
  const hash = contentHash(page.markdown)
  const existing = await versions.findOne({ versionKey: key }, { projection: { contentHash: 1 } })
  const meta = {
    effectiveFrom: new Date(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? new Date(row.effectiveTo) : null,
    amendment: row.amendment,
  }
  if (existing && existing.contentHash === hash) {
    // Text sedí; z histórie sa môže zmeniť len koniec účinnosti (novela ho uzavrela).
    await versions.updateOne({ versionKey: key }, { $set: meta })
    return "unchanged"
  }

  // Rez zo štruktúry Markdownu (ADR-035): § ako jednotka, bez návrhu AI,
  // rovnako pre všetkých (D258). Prázdny rez je chyba, nie prázdne znenie.
  const cut = cutForIndex(page.markdown, page.title)
  if (!cut.chunks.length) throw new LawCatalogError("web.parseFailed", `Zo znenia ${key} nevznikol ani jeden úsek.`)

  // Najprv úseky, potom znenie: keby zápis spadol v strede, znenie bez
  // úsekov by sa tvárilo hotové a hľadanie by z neho nič nenašlo.
  await chunksCol.deleteMany({ versionKey: key })
  await chunksCol.insertMany(cut.chunks.map(ch => ({
    versionKey: key, actId, timepoint: row.timepoint,
    chunkIndex: ch.chunkIndex, text: ch.text, heading: ch.heading, articleRef: ch.articleRef ?? null,
    chunkType: ch.typ ?? "clanok", sourceType: LAW_SOURCE_TYPE, language: "sk", accessLevel: "public",
    ...embeddingFields(now), chunkerVersion: CHUNKER_VERSION, createdAt: now,
  })), { ordered: false })

  await versions.updateOne(
    { versionKey: key },
    {
      $set: {
        actId, timepoint: row.timepoint, ...meta, title: page.title, markdown: page.markdown, contentHash: hash,
        pdfUrl: page.pdfUrl, portalUrl: portalUrl(ref, row.timepoint), fetchedAt: now, chunkCount: cut.chunks.length,
        adapterVersion: SLOV_LEX_ADAPTER_VERSION,
      },
    },
    { upsert: true },
  )
  await (await getCollection<LawAct>(LAW_ACTS_COLLECTION)).updateOne({ actId }, { $set: { title: page.title, kind: page.kind } })
  return existing ? "refreshed" : "added"
}

// ── Katalóg ──────────────────────────────────────────────────────────────────

export async function actById(actId: string): Promise<LawAct | null> {
  return (await getCollection<LawAct>(LAW_ACTS_COLLECTION)).findOne({ actId }, { projection: { _id: 0 } })
}

export interface LawActOverview extends LawAct {
  versionCount: number
  subscriberCount: number
  /** Znenie účinné dnes; `null`, keď je v katalógu zatiaľ len znenie s účinnosťou v budúcnosti. */
  current: Pick<LawActVersion, "timepoint" | "effectiveFrom" | "amendment"> | null
  /** Znenia vyhlásené na neskôr. */
  laterCount: number
}

/** Prehľad pre správu katalógu a pre nastavenie organizácie. */
export async function listActs(now: Date = new Date(), onlyActIds?: string[]): Promise<LawActOverview[]> {
  const actsCol = await getCollection<LawAct>(LAW_ACTS_COLLECTION)
  const filter = onlyActIds ? { actId: { $in: onlyActIds } } : {}
  const acts = await actsCol.find(filter, { projection: { _id: 0 } }).sort({ year: 1, number: 1 }).toArray()
  if (!acts.length) return []
  const ids = acts.map(a => a.actId)
  const versions = await (await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION))
    .find({ actId: { $in: ids } }, { projection: { actId: 1, timepoint: 1, effectiveFrom: 1, effectiveTo: 1, amendment: 1 } }).toArray()
  const subs = await (await getCollection<LawSubscription>(LAW_SUBSCRIPTIONS_COLLECTION))
    .aggregate<{ _id: string; n: number }>([{ $match: { actId: { $in: ids } } }, { $group: { _id: "$actId", n: { $sum: 1 } } }]).toArray()
  const subCount = new Map(subs.map(s => [s._id, s.n]))
  const current = new Map(effectiveVersions(versions, now).map(v => [v.actId, v]))
  return acts.map(a => {
    const mine = versions.filter(v => v.actId === a.actId)
    const cur = current.get(a.actId) ?? null
    return {
      ...a,
      versionCount: mine.length,
      subscriberCount: subCount.get(a.actId) ?? 0,
      current: cur ? { timepoint: cur.timepoint, effectiveFrom: cur.effectiveFrom, amendment: cur.amendment } : null,
      laterCount: mine.filter(v => v.effectiveFrom.getTime() > now.getTime()).length,
    }
  })
}

export async function versionsOf(actId: string): Promise<Omit<LawActVersion, "markdown">[]> {
  return (await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION))
    .find({ actId }, { projection: { _id: 0, markdown: 0 } }).sort({ timepoint: 1 }).toArray()
}

/**
 * Pridá predpis do katalógu z adresy alebo čísla a stiahne **znenie účinné
 * dnes** — jedno stiahnutie, aby to človek stihol počkať. Zvyšok histórie
 * (staršie aj vyhlásené na neskôr) doplní `syncAct()`, teda cron (D261).
 * Predpis, ktorý už v katalógu je, sa vráti bez sťahovania.
 */
export async function addAct(address: string, actor: { companyCode: string; email: string }, now: Date = new Date()): Promise<LawAct> {
  const ref = parseActRef(address)
  if (!ref) throw new LawCatalogError("web.badAddress", `Adresa nie je predpis na Slov-Lexe: ${address.slice(0, 120)}`)
  const actId = actIdOf(ref)
  const existing = await actById(actId)
  if (existing) return existing

  const rows = await fetchHistory(ref)
  // Predpis vyhlásený, ale ešte neúčinný: berie sa prvé znenie, nech má katalóg z čoho začať.
  const row = effectiveRow(rows, now) ?? rows[0]
  const actsCol = await getCollection<LawAct>(LAW_ACTS_COLLECTION)
  const act: LawAct = {
    actId, year: ref.year, number: ref.number, title: `${actNumber(ref)}`, kind: "Predpis",
    addedAt: now, addedBy: actor, lastCheckedAt: null, lastError: null, adapterVersion: SLOV_LEX_ADAPTER_VERSION,
  }
  await actsCol.updateOne({ actId }, { $setOnInsert: act }, { upsert: true })
  try {
    await storeVersion(ref, row, now)
    await actsCol.updateOne({ actId }, { $set: { lastCheckedAt: now, lastError: null } })
  } catch (e) {
    // Predpis bez jediného znenia v katalógu nemá čo robiť — inak by sa ponúkal a nič nenašiel.
    await actsCol.deleteOne({ actId })
    throw e
  }
  return (await actById(actId))!
}

export interface SyncOutcome {
  actId: string
  added: string[]
  refreshed: string[]
  error: string | null
}

/**
 * Kontrola predpisu proti portálu (D261): prečíta históriu, stiahne znenia,
 * ktoré v katalógu nie sú (aj s účinnosťou v budúcnosti), a znovu stiahne
 * znenie účinné dnes, aby sa chytila oprava textu. Najviac `maxDownloads`
 * stiahnutí na jeden beh — história zákona o športe má 19 znení po 1,4 MB
 * a cron má časový strop.
 */
export async function syncAct(actId: string, now: Date = new Date(), maxDownloads = 6): Promise<SyncOutcome> {
  const ref = refOfActId(actId)
  const actsCol = await getCollection<LawAct>(LAW_ACTS_COLLECTION)
  const out: SyncOutcome = { actId, added: [], refreshed: [], error: null }
  try {
    const rows = await fetchHistory(ref)
    const have = new Set((await versionsOf(actId)).map(v => v.timepoint))
    const current = effectiveRow(rows, now)
    // Poradie: dnešné znenie (oprava textu), potom chýbajúce od najnovšieho —
    // novela vyhlásená na budúci rok je dôležitejšia než znenie z roku 2016.
    const queue: HistoryRow[] = []
    if (current) queue.push(current)
    for (const r of [...rows].reverse()) if (!have.has(r.timepoint) && r !== current) queue.push(r)
    let downloads = 0
    for (const row of queue) {
      if (downloads >= maxDownloads) break
      downloads++
      const what = await storeVersion(ref, row, now)
      if (what === "added") out.added.push(row.timepoint)
      if (what === "refreshed") out.refreshed.push(row.timepoint)
    }
    // Koniec účinnosti znení, ktoré sa nesťahovali — história ho vie uzavrieť.
    const versions = await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION)
    for (const r of rows) {
      if (have.has(r.timepoint) && !queue.includes(r)) {
        await versions.updateOne({ versionKey: versionKeyOf(actId, r.timepoint) }, { $set: { effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null } })
      }
    }
    await actsCol.updateOne({ actId }, { $set: { lastCheckedAt: now, lastError: null } })
  } catch (e) {
    out.error = String((e as Error)?.message ?? e).slice(0, 300)
    await actsCol.updateOne({ actId }, { $set: { lastCheckedAt: now, lastError: out.error } })
  }
  return out
}

/** Odstráni predpis z katalógu — len keď ho nikto neodoberá (D257). */
export async function removeAct(actId: string): Promise<void> {
  const subs = await (await getCollection<LawSubscription>(LAW_SUBSCRIPTIONS_COLLECTION)).countDocuments({ actId })
  if (subs > 0) throw new LawCatalogError("law.inUse", `Predpis ${actId} odoberá ${subs} organizácií.`, { count: subs })
  await (await getCollection<LawChunk>(LAW_CHUNKS_COLLECTION)).deleteMany({ actId })
  await (await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION)).deleteMany({ actId })
  await (await getCollection<LawAct>(LAW_ACTS_COLLECTION)).deleteOne({ actId })
}

// ── Odber organizácie (D259) — s `companyCode`, bez výnimky ─────────────────

export async function subscriptionsFor(companyCode: string): Promise<LawSubscription[]> {
  const code = requireCompanyCode(companyCode, "lawCatalog.subscriptionsFor")
  return (await getCollection<LawSubscription>(LAW_SUBSCRIPTIONS_COLLECTION)).find({ companyCode: code }, { projection: { _id: 0 } }).toArray()
}

/** Odoberané predpisy s prehľadom znení — pre nastavenie organizácie. */
export async function subscribedActs(companyCode: string, now: Date = new Date()): Promise<LawActOverview[]> {
  const subs = await subscriptionsFor(companyCode)
  if (!subs.length) return []
  return listActs(now, subs.map(s => s.actId))
}

/**
 * Organizácia si objedná predpis: keď v katalógu nie je, pridá sa (D257 —
 * katalóg rastie podľa potreby). Opakovaný odber je bez účinku.
 */
export async function subscribe(companyCode: string, address: string, actor: string, now: Date = new Date()): Promise<LawAct> {
  const code = requireCompanyCode(companyCode, "lawCatalog.subscribe")
  const act = await addAct(address, { companyCode: code, email: actor }, now)
  await (await getCollection<LawSubscription>(LAW_SUBSCRIPTIONS_COLLECTION)).updateOne(
    { companyCode: code, actId: act.actId },
    { $setOnInsert: { companyCode: code, actId: act.actId, level: "ask", addedAt: now, addedBy: actor } },
    { upsert: true },
  )
  return act
}

export async function unsubscribe(companyCode: string, actId: string): Promise<boolean> {
  const code = requireCompanyCode(companyCode, "lawCatalog.unsubscribe")
  const r = await (await getCollection<LawSubscription>(LAW_SUBSCRIPTIONS_COLLECTION)).deleteOne({ companyCode: code, actId })
  return r.deletedCount > 0
}

export async function lawSettings(companyCode: string): Promise<LawSettings> {
  const code = requireCompanyCode(companyCode, "lawCatalog.lawSettings")
  const doc = await (await getCollection<LawSettings>(LAW_SETTINGS_COLLECTION)).findOne({ companyCode: code }, { projection: { _id: 0 } })
  return doc ?? { companyCode: code, defaultOn: false }
}

export async function saveLawSettings(companyCode: string, defaultOn: boolean, actor: string, now: Date = new Date()): Promise<void> {
  const code = requireCompanyCode(companyCode, "lawCatalog.saveLawSettings")
  await (await getCollection<LawSettings>(LAW_SETTINGS_COLLECTION)).updateOne(
    { companyCode: code }, { $set: { defaultOn, updatedAt: now, updatedBy: actor } }, { upsert: true },
  )
}

export interface LawSourceState {
  /** Rezidencia dovoľuje čítať katalóg (D257). */
  allowed: boolean
  residency: DataResidency
  /** Odoberané predpisy (id). */
  actIds: string[]
  defaultOn: boolean
  /** Zdroj sa naozaj ponúka: dovolený a aspoň jeden predpis. */
  active: boolean
}

/** Stav zdroja „Legislatíva" pre organizáciu — pre výber zdrojov aj pre hľadanie. */
export async function lawSourceState(companyCode: string): Promise<LawSourceState> {
  const code = requireCompanyCode(companyCode, "lawCatalog.lawSourceState")
  const [profile, subs, settings] = await Promise.all([getTenantProfile(code), subscriptionsFor(code), lawSettings(code)])
  const residency = (profile.dataResidency ?? "global") as DataResidency
  const allowed = lawAllowed(residency)
  const actIds = subs.map(s => s.actId)
  return { allowed, residency, actIds, defaultOn: settings.defaultOn, active: allowed && actIds.length > 0 }
}

/** Dátum účinnosti z časovej verzie — pre zoznamy, kde znenie z portálu ešte nie je stiahnuté. */
export { timepointDate }
