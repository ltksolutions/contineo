/**
 * complianceRequests.ts — pevné väzby a požiadavky na kontrolu súladu
 * (ADR-032, D197 v prvej podobe a D200, Ján 11. 10. 2026).
 *
 * **Pevná väzba** hovorí „tento dokument sa kontroluje proti týmto normám"
 * (napríklad manuál ISSF proti RaPP, SP, DP, Stanovám…). Nastaví sa jedným
 * kliknutím z dobehnutej kontroly („Uložiť ako pevné väzby") a dá sa zrušiť.
 *
 * **Požiadavka** vznikne pri zverejnení nového znenia dokumentu, ktorý je
 * v nejakej väzbe — ako norma alebo ako kontrolovaný dokument. Nespúšťa sa
 * sama (kontrola stojí jednotky USD a nie každá novela ju potrebuje): na
 * `/library/compliance` je pod „Čaká na kontrolu" s predvyplneným výberom
 * a „Skontrolovať", alebo „Netreba" s dôvodom. Upozornenie dostanú
 * zodpovedné osoby prepojených dokumentov, správcovia obsahu a rola
 * `compliance`; súhrnný e-mail len rola `compliance`.
 *
 * Prepojené sú (D200): dokumenty v pevnej väzbe, dokumenty, ktoré sa proti
 * zmenenému už kontrolovali (história behov), a návrhy FAQ, ktoré ho citujú.
 * Koncept požiadavku nevytvára — až zverejnenie.
 */

import { randomBytes } from "node:crypto"
import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { AppError } from "./appError"
import { DOCUMENTS_COLLECTION } from "./documents"
import { notifyPeople } from "./notifications"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { tenantByCompanyCode, brandingView } from "./tenants"
import { send, complianceRequestEmail } from "./ecomail"
import { normalizeLanguage } from "./i18n"
import { textFingerprint } from "./chunkIdentity"

export class ComplianceRequestError extends AppError {}

export const COMPLIANCE_LINKS_COLLECTION = "compliance_links"
export const COMPLIANCE_REQUESTS_COLLECTION = "compliance_requests"
/** Rovnaké ako v `complianceCheck.ts` — tu bez importu, aby nevznikol kruh cez `libraryWrite`. */
const RUNS_COLLECTION = "compliance_runs"
const PROPOSALS_COLLECTION = "faq_proposals"

/** Pevná väzba: kontrolovaný dokument a normy, proti ktorým sa kontroluje. */
export interface ComplianceLink {
  companyCode: string
  subjectId: string
  /** Kópia názvu v čase nastavenia — dokument sa môže premenovať. */
  subjectTitle: string
  referenceIds: string[]
  referenceTitles: string[]
  setBy: string
  setAt: Date
  /** Beh, z ktorého sa väzba uložila. */
  fromRunId: string | null
}

export interface ComplianceRequest {
  companyCode: string
  id: string
  /** Dokument, ktorý dostal nové znenie. */
  documentId: string
  documentTitle: string
  versionLabel: string
  publishedAt: Date
  publishedBy: string
  /** Čo skontrolovať: dokumenty a normy (predvyplnený výber). */
  subjectIds: string[]
  subjectTitles: string[]
  referenceIds: string[]
  referenceTitles: string[]
  /** Návrhy FAQ, ktoré zmenený dokument citujú, po kanáloch. */
  faq: { channelKey: string; proposals: number }[]
  status: "open" | "started" | "dismissed"
  runId: string | null
  reason: string | null
  decidedBy: string | null
  decidedAt: Date | null
  createdAt: Date
}

async function links() { return getCollection<ComplianceLink>(COMPLIANCE_LINKS_COLLECTION) }
async function requests() { return getCollection<ComplianceRequest>(COMPLIANCE_REQUESTS_COLLECTION) }

export async function listLinks(companyCode: string): Promise<ComplianceLink[]> {
  const code = requireCompanyCode(companyCode, "listLinks")
  return (await links()).find({ companyCode: code }, { projection: { _id: 0 } }).sort({ subjectTitle: 1 }).toArray()
}

/**
 * Uloží pevné väzby z dobehnutej kontroly: každý kontrolovaný dokument proti
 * jej normám. Existujúca väzba toho istého dokumentu sa nahradí — platí
 * posledné rozhodnutie, nie súčet.
 */
export async function setLinksFromRun(companyCode: string, run: { runId: string; scope: { kind: string; subjectIds?: string[] }; documentIds: string[]; results?: { documentId: string; title: string }[]; documents: { documentId: string; title: string }[] }, actor: string): Promise<number> {
  const code = requireCompanyCode(companyCode, "setLinksFromRun")
  if (run.scope.kind !== "documents" || !run.scope.subjectIds?.length) throw new ComplianceRequestError("compliance.unknownRun", "Taká kontrola tu nie je.")
  const refTitles = run.documentIds.map(id => run.documents.find(d => d.documentId === id)?.title ?? id)
  const col = await links()
  const now = new Date()
  for (const subjectId of run.scope.subjectIds) {
    const subjectTitle = run.results?.find(r => r.documentId === subjectId)?.title ?? subjectId
    await col.replaceOne(
      { companyCode: code, subjectId },
      { companyCode: code, subjectId, subjectTitle, referenceIds: run.documentIds, referenceTitles: refTitles, setBy: actor, setAt: now, fromRunId: run.runId },
      { upsert: true },
    )
  }
  return run.scope.subjectIds.length
}

export async function removeLink(companyCode: string, subjectId: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "removeLink")
  await (await links()).deleteOne({ companyCode: code, subjectId })
}

/**
 * Čo treba skontrolovať, keď sa zmení `documentId` (čistá funkcia):
 * dokumenty, ktoré sa proti nemu kontrolujú (väzby a história), a pri
 * zmene kontrolovaného dokumentu on sám proti svojim normám.
 */
export function linkedChecks(
  documentId: string,
  linkRows: { subjectId: string; referenceIds: string[] }[],
  history: { subjectIds: string[]; referenceIds: string[] }[],
  /** Zverejnený text sa zhoduje s textom po poslednej kontrole a všetko je rozhodnuté — sám sa nekontroluje (D200). */
  selfUpToDate = false,
): { subjectIds: string[]; referenceIds: string[] } {
  const subjects = new Set<string>()
  const refs = new Set<string>()
  for (const row of [...linkRows.map(l => ({ subjectIds: [l.subjectId], referenceIds: l.referenceIds })), ...history]) {
    if (row.referenceIds.includes(documentId)) {
      row.subjectIds.forEach(s => subjects.add(s))
      row.referenceIds.forEach(r => refs.add(r))
    }
    if (row.subjectIds.includes(documentId) && !selfUpToDate) {
      subjects.add(documentId)
      row.referenceIds.forEach(r => refs.add(r))
    }
  }
  for (const s of subjects) refs.delete(s)
  return { subjectIds: [...subjects], referenceIds: [...refs] }
}

/**
 * Je zverejnený text dokumentu presne ten, ktorý vyšiel z jeho poslednej
 * kontroly (skontrolovaný text + zapísané prijaté znenia), a sú všetky
 * nálezy rozhodnuté? Potom je nové znenie výsledkom kontroly, nie zmenou,
 * ktorú treba kontrolovať znova (Ján 11. 10. 2026).
 */
export async function upToDateSinceCheck(code: string, documentId: string): Promise<boolean> {
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode: code, documentId }, { projection: { _id: 0, versions: 1, markdown: 1 } })
  const active = ((doc?.versions ?? []) as { isActive?: boolean; markdown?: string }[]).find(v => v.isActive)
  const text = String(active?.markdown ?? doc?.markdown ?? "")
  if (!text.trim()) return false
  const last = await (await getCollection(RUNS_COLLECTION)).find(
    { companyCode: code, "scope.kind": "documents", "results.documentId": documentId },
    { projection: { _id: 0, results: 1 } },
  ).sort({ startedAt: -1 }).limit(1).next()
  const res = ((last?.results ?? []) as { documentId: string; textHash?: string; findings: { status?: string | null }[] }[]).find(r => r.documentId === documentId)
  return Boolean(res?.textHash && res.textHash === textFingerprint(text) && res.findings.every(f => f.status))
}

/**
 * Hierarchia dokumentov ako väzby (ADR-034, D219): zverejnený dokument sa
 * kontroluje proti svojim záväzným predkom a jeho potomkovia proti nemu
 * (a ostatným svojim predkom). Pevné väzby (D200) ostávajú popri tom.
 */
async function hierarchyLinkRows(code: string, documentId: string): Promise<{ subjectId: string; referenceIds: string[] }[]> {
  const { ancestorsOf, descendantsOf, parentsMapOf } = await import("./documentHierarchy")
  const { documentRole } = await import("./codelists")
  const { tenantExtras } = await import("./codelistsTenant")
  const extras = tenantExtras((await tenantByCompanyCode(code)) ?? {})
  const docs = await (await getCollection(DOCUMENTS_COLLECTION)).find({ companyCode: code }, { projection: { _id: 0, documentId: 1, category: 1, parentIds: 1 } }).toArray() as unknown as { documentId: string; category?: string; parentIds?: string[] }[]
  const map = parentsMapOf(docs)
  const binding = new Set(docs.filter(d => documentRole(d.category, extras) === "binding").map(d => d.documentId))
  return [documentId, ...descendantsOf(documentId, map)]
    .map(id => ({ subjectId: id, referenceIds: ancestorsOf(id, map).filter(r => binding.has(r)) }))
    .filter(r => r.referenceIds.length > 0)
}

interface FaqCitingRow {
  channelKey: string
  review?: { documents?: { documentId: string; textHash?: string }[] } | null
}

/**
 * Návrhy FAQ, ktoré treba skontrolovať proti novému zneniu — po kanáloch.
 *
 * Návrh, ktorý posledná kontrola preverila **proti tomu istému textu**, aký
 * sa práve zverejnil, sa nepočíta (Ján 12. 10. 2026). Bez toho zverejnenie
 * manuálov ISSF založilo šesť požiadaviek na kontrolu návrhov, ktoré deň
 * predtým prešli kontrolou proti nezmenenému textu. To isté pravidlo ako
 * pri dokumentoch (D200, `upToDateSinceCheck`). Staršie kontroly odtlačok
 * nemajú, takže pri nich požiadavka vznikne — radšej raz navyše než nikdy.
 */
export function faqToCheck(documentId: string, rows: FaqCitingRow[], fingerprint: string | null): { channelKey: string; proposals: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const checked = fingerprint !== null && (r.review?.documents ?? []).some(d => d.documentId === documentId && d.textHash === fingerprint)
    if (!checked) counts.set(r.channelKey, (counts.get(r.channelKey) ?? 0) + 1)
  }
  return [...counts].map(([channelKey, proposals]) => ({ channelKey, proposals }))
}

/** Odtlačok zverejneného textu (platné znenie), `null` keď text nie je. */
async function publishedFingerprint(code: string, documentId: string): Promise<string | null> {
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode: code, documentId }, { projection: { _id: 0, versions: 1, markdown: 1 } })
  const active = ((doc?.versions ?? []) as { isActive?: boolean; markdown?: string }[]).find(v => v.isActive)
  const text = String(active?.markdown ?? doc?.markdown ?? "")
  return text.trim() ? textFingerprint(text) : null
}

async function titles(code: string, ids: string[]): Promise<string[]> {
  const rows = await (await getCollection(DOCUMENTS_COLLECTION)).find({ companyCode: code, documentId: { $in: ids } }, { projection: { _id: 0, documentId: 1, title: 1 } }).toArray()
  return ids.map(id => String(rows.find(r => r.documentId === id)?.title ?? id))
}

/**
 * Pri zverejnení nového znenia: požiadavka na kontrolu, ak je dokument
 * v nejakej väzbe alebo ho citujú návrhy FAQ. **Nikdy nevyhodí** —
 * zverejnenie sa nesmie pokaziť preto, že sa nepodarilo vytvoriť
 * pripomienku. Otvorená požiadavka k tomu istému dokumentu sa nahradí.
 */
export async function requestOnPublish(companyCode: string, documentId: string, versionLabel: string, actor: string): Promise<ComplianceRequest | null> {
  try {
    const code = requireCompanyCode(companyCode, "requestOnPublish")
    const [linkRows, runRows, faqRows] = await Promise.all([
      (await links()).find({ companyCode: code, $or: [{ subjectId: documentId }, { referenceIds: documentId }] }).toArray(),
      (await getCollection(RUNS_COLLECTION)).find(
        { companyCode: code, "scope.kind": "documents", $or: [{ documentIds: documentId }, { "scope.subjectIds": documentId }] },
        { projection: { _id: 0, documentIds: 1, "scope.subjectIds": 1 } },
      ).toArray(),
      (await getCollection<FaqCitingRow>(PROPOSALS_COLLECTION)).find(
        { companyCode: code, status: "open", "sources.documentId": documentId },
        { projection: { _id: 0, channelKey: 1, "review.documents": 1 } },
      ).toArray(),
    ])
    const history = runRows.map(r => ({ subjectIds: ((r.scope as { subjectIds?: string[] })?.subjectIds ?? []), referenceIds: (r.documentIds as string[]) ?? [] }))
    const hierarchyRows = await hierarchyLinkRows(code, documentId)
    const { subjectIds, referenceIds } = linkedChecks(documentId, [...linkRows, ...hierarchyRows], history, await upToDateSinceCheck(code, documentId))
    const faq = faqToCheck(documentId, faqRows, await publishedFingerprint(code, documentId))
    if (!subjectIds.length && !faq.length) return null
    const [documentTitle] = await titles(code, [documentId])
    const req: ComplianceRequest = {
      companyCode: code, id: randomBytes(6).toString("hex"), documentId, documentTitle, versionLabel,
      publishedAt: new Date(), publishedBy: actor,
      subjectIds, subjectTitles: await titles(code, subjectIds), referenceIds, referenceTitles: await titles(code, referenceIds),
      faq, status: "open", runId: null, reason: null, decidedBy: null, decidedAt: null, createdAt: new Date(),
    }
    await (await requests()).updateMany({ companyCode: code, documentId, status: "open" }, { $set: { status: "dismissed", reason: `Nahradené novším znením ${versionLabel}.`, decidedBy: actor, decidedAt: new Date() } })
    await (await requests()).insertOne({ ...req })
    await announceRequest(code, req, subjectIds)
    return req
  } catch (e) {
    console.error(`[compliance] požiadavka na kontrolu ${companyCode}/${documentId} zlyhala:`, e)
    return null
  }
}

/** Zvonček: zodpovedné osoby prepojených dokumentov, správcovia obsahu, rola compliance. E-mail: len compliance. */
async function announceRequest(code: string, req: ComplianceRequest, subjectIds: string[]): Promise<void> {
  const docs = await (await getCollection(DOCUMENTS_COLLECTION)).find(
    { companyCode: code, documentId: { $in: [req.documentId, ...subjectIds] } },
    { projection: { _id: 0, versions: 1, draftResponsible: 1 } },
  ).toArray()
  const responsible = docs.flatMap(d => {
    const active = ((d.versions ?? []) as { isActive?: boolean; responsiblePerson?: { personId?: string } }[]).find(v => v.isActive)
    return [active?.responsiblePerson?.personId, (d.draftResponsible as { personId?: string } | undefined)?.personId].filter((x): x is string => Boolean(x))
  })
  const persons = await getCollection<Person>(PERSONS_COLLECTION)
  const staff = await persons.find({ companyCode: code, roles: { $in: ["content-admin", "compliance"] }, status: { $ne: "inactive" } } as never, { projection: { _id: 0, id: 1, roles: 1, email: 1, language: 1 } }).toArray()
  await notifyPeople({
    companyCode: code, personIds: [...responsible, ...staff.map(p => p.id)], kind: "complianceRequested",
    params: { documentId: req.documentId, documentTitle: req.documentTitle, versionLabel: req.versionLabel, count: req.subjectIds.length },
  })
  const tenant = await tenantByCompanyCode(code)
  const host = tenant?.hostnames[0]
  if (!tenant || !host) return
  for (const p of staff.filter(p => p.roles?.includes("compliance") && p.email)) {
    try {
      await send({ to: p.email, ...complianceRequestEmail(`https://${host}/library/compliance#requests`, host, req, normalizeLanguage(p.language), brandingView(tenant)) })
    } catch (e) {
      console.error("[compliance] e-mail o požiadavke zlyhal:", e)
    }
  }
}

export async function openRequests(companyCode: string): Promise<ComplianceRequest[]> {
  const code = requireCompanyCode(companyCode, "openRequests")
  return (await requests()).find({ companyCode: code, status: "open" }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
}

export async function requestById(companyCode: string, id: string): Promise<ComplianceRequest | null> {
  const code = requireCompanyCode(companyCode, "requestById")
  return (await requests()).findOne({ companyCode: code, id }, { projection: { _id: 0 } })
}

/** Kontrola sa spustila z požiadavky — požiadavka sa uzavrie s odkazom na beh. */
export async function markRequestStarted(companyCode: string, id: string, runId: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "markRequestStarted")
  await (await requests()).updateOne({ companyCode: code, id, status: "open" }, { $set: { status: "started", runId, decidedBy: actor, decidedAt: new Date() } })
}

/** „Netreba" — s dôvodom, aby bolo o rok jasné, prečo sa novela nekontrolovala. */
export async function dismissRequest(companyCode: string, id: string, reason: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "dismissRequest")
  const why = reason.trim()
  if (!why) throw new ComplianceRequestError("compliance.reasonRequired", "Uveďte dôvod rozhodnutia.")
  const r = await (await requests()).updateOne({ companyCode: code, id, status: "open" }, { $set: { status: "dismissed", reason: why.slice(0, 1000), decidedBy: actor, decidedAt: new Date() } })
  if (!r.matchedCount) throw new ComplianceRequestError("compliance.unknownRun", "Taká požiadavka tu nie je.")
}
