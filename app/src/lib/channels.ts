/**
 * channels.ts — kanály organizácie (ADR-028, D161; typy D169).
 *
 * Kanál je rozhranie, cez ktoré obsah organizácie ide k ľuďom — rovnaký
 * pojem ako na contineo.app/sk/technologia. Dva typy (Ján 6. 10. 2026):
 *
 *   • **widget** — vložiteľný do cudzej stránky namiesto vyhľadávania:
 *     vždy asistent (otázka a odpoveď), voliteľne tickety (eskalácia
 *     z chatu) a schránka helpdesku (e-maily sa stávajú ticketmi, odpovede
 *     odchádzajú z nej, história sa ťaží do FAQ);
 *   • **portal** — články, knižnica a formuláre; dnes existuje len knižnica
 *     (čitateľský pohľad intranetu), články a formuláre sa pripravujú.
 *
 * Spoločné: kľúč, názov, publikum, obsah (priečinky knižnice), riešitelia,
 * jazyky. Kanálov je viac — ISSF pre kluby, iný projekt s iným priečinkom —
 * preto nič z toho nie je „helpdesk organizácie", ale záznam v `channels`.
 *
 * **Rozsah obsahu sú priečinky knižnice** (`folderIds`): do hľadania idú
 * platné znenia dokumentov, ktorých `folderPath` niektorý z nich obsahuje
 * (`searchScope()`). Kanál bez priečinkov vidí celú knižnicu organizácie.
 *
 * **Tajomstvá** (client secret schránky, tajomstvo widgetu) sa ukladajú
 * zašifrované tým istým kľúčom ako kľúč AI (ADR-026, `secrets.ts`); von sa
 * nevracajú, obrazovka vidí len koncovku. Prázdne pole tajomstvo nemení.
 *
 * Schránka je za adaptérom (`mailbox/`, D162): tu sa rozhoduje len, ktorý.
 */

import { randomBytes, randomUUID } from "node:crypto"
import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { encrypt, decrypt, encryptionAvailable } from "./secrets"
import { requireCompanyCode } from "./tenantScope"
import { isUiLanguage, type UiLanguage } from "./i18n"
import { GraphMailbox } from "./mailbox/graph"
import type { MailboxAdapter, MailboxKind } from "./mailbox/types"
import { ingestMessages, TICKETS_COLLECTION } from "./tickets"

export const CHANNELS_COLLECTION = "channels"
export type ChannelKind = "widget" | "portal"
export const CHANNEL_KINDS: ChannelKind[] = ["widget", "portal"]
/** Rola riešiteľa (D167) — oddelená od správcu obsahu. */
export const HELPDESK_ROLE = "helpdesk"
export const MAILBOX_KINDS: MailboxKind[] = ["graph", "imap"]
/** Koľko stránok delta dotazu zoberie jedno spustenie — do 60 s cronu. */
export const SYNC_MAX_PAGES = 20
export const DEFAULT_RATE_LIMIT = 60

export class HelpdeskError extends AppError {}

export interface ChannelMailbox {
  kind: MailboxKind
  /** Adresa schránky — číta sa z nej aj odpovedá. */
  address: string
  graph?: {
    tenantId: string
    clientId: string
    clientSecretEnc?: string
    clientSecretHint?: string
    secretSetAt?: Date
    secretSetBy?: string
  }
  /** Značka synchronizácie (Graph: celý `deltaLink`). */
  cursor: string | null
  /**
   * Odkedy sa správy stávajú ticketmi. Nastaví sa pri prvej synchronizácii:
   * prvé kolo delta dotazu vráti celú schránku a z histórie sa tickety
   * nerobia — tá ide do ťažby FAQ (D165).
   */
  syncSince: Date | null
  lastSyncAt: Date | null
  lastSyncError: string | null
  lastSyncCounts: { created: number; appended: number; skipped: number } | null
}

export interface ChannelWidget {
  secretEnc?: string
  secretHint?: string
  secretSetAt?: Date
  /** Nové tajomstvo sa ukáže raz — príznak zhasne pri prvom zobrazení. */
  revealOnce?: boolean
  origins: string[]
  rateLimitPerHour: number
}

export interface HelpdeskChannel {
  companyCode: string
  key: string
  /** Typ kanála (D169). Po založení sa nemení — tickety a widget sa naň odkazujú. */
  kind: ChannelKind
  name: string
  audience: string
  folderIds: string[]
  /**
   * Tickety zapnuté (len `widget`): eskalácia z chatu po dvoch negatívnych
   * hodnoteniach a e-maily zo schránky, ak je. Bez ticketov je kanál len
   * asistent — odpovedá a nič neeviduje.
   */
  tickets: boolean
  /** Schránka helpdesku (len `widget`, voliteľná). */
  mailbox: ChannelMailbox | null
  assigneeIds: string[]
  /** Nastavenie vloženia (len `widget`); pri portáli prázdne. */
  widget: ChannelWidget
  languages: UiLanguage[]
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
}

/** Čo vidí obrazovka — bez tajomstiev. */
export type ChannelView = Omit<HelpdeskChannel, "mailbox" | "widget"> & {
  mailbox: (Omit<ChannelMailbox, "graph"> & { graph?: { tenantId: string; clientId: string; clientSecretHint?: string; secretSetAt?: Date; secretSetBy?: string; hasSecret: boolean } }) | null
  widget: Omit<ChannelWidget, "secretEnc"> & { hasSecret: boolean }
}

export function channelView(c: HelpdeskChannel): ChannelView {
  const { mailbox, widget, ...rest } = c
  return {
    ...rest,
    mailbox: mailbox
      ? {
          ...mailbox,
          graph: mailbox.graph
            ? {
                tenantId: mailbox.graph.tenantId, clientId: mailbox.graph.clientId,
                clientSecretHint: mailbox.graph.clientSecretHint, secretSetAt: mailbox.graph.secretSetAt,
                secretSetBy: mailbox.graph.secretSetBy, hasSecret: Boolean(mailbox.graph.clientSecretEnc),
              }
            : undefined,
        }
      : null,
    widget: { origins: widget.origins, rateLimitPerHour: widget.rateLimitPerHour, secretHint: widget.secretHint, secretSetAt: widget.secretSetAt, revealOnce: widget.revealOnce, hasSecret: Boolean(widget.secretEnc) },
  }
}

export async function listChannels(companyCode: string): Promise<HelpdeskChannel[]> {
  const code = requireCompanyCode(companyCode, "listChannels")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  return col.find({ companyCode: code }).sort({ name: 1 }).toArray()
}

/** Kanály s ticketmi, ktorých je osoba riešiteľom (D161: ticket vidí len riešiteľ svojho kanála). */
export async function channelsForAgent(companyCode: string, personId: string): Promise<HelpdeskChannel[]> {
  const code = requireCompanyCode(companyCode, "channelsForAgent")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  return col.find({ companyCode: code, assigneeIds: personId, tickets: true }).sort({ name: 1 }).toArray()
}

export async function channelByKey(companyCode: string, key: string): Promise<HelpdeskChannel | null> {
  const code = requireCompanyCode(companyCode, "channelByKey")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  return col.findOne({ companyCode: code, key: key.trim().toLowerCase() })
}

export interface ChannelInput {
  /** Prázdne = nový kanál; kľúč pridelí `saveChannel`. Pri úprave povinný. */
  key?: string
  /** Pri založení povinný; pri úprave sa ignoruje (typ sa nemení). */
  kind?: string
  tickets?: boolean
  name: string
  audience?: string
  folderIds?: string[]
  assigneeIds?: string[]
  languages?: string[]
  widgetOrigins?: string[]
  rateLimitPerHour?: number | string
  mailbox?: {
    kind: string
    address: string
    tenantId?: string
    clientId?: string
    /** Prázdne = bez zmeny. */
    clientSecret?: string
  } | null
}

function tidyList(xs: string[] | undefined): string[] {
  return [...new Set((xs ?? []).map(x => x.trim()).filter(Boolean))]
}

/**
 * Založí alebo upraví kanál. Kľúč je identita — bez kľúča vzniká nový kanál
 * s UUID, s kľúčom sa upravuje existujúci (odkazujú naň tickety aj widget).
 * Validácia a audit tu, nie v akcii.
 */
export async function saveChannel(companyCode: string, input: ChannelInput, actor: string): Promise<HelpdeskChannel> {
  const code = requireCompanyCode(companyCode, "saveChannel")
  const given = (input.key ?? "").trim().toLowerCase()
  const key = given || randomUUID()
  const name = input.name.replace(/\s+/g, " ").trim()
  if (!name) throw new HelpdeskError("helpdesk.nameRequired", "Názov kanála je povinný.")

  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  const existing = await col.findOne({ companyCode: code, key })
  // Kľúč je UUID pridelené tu, pri založení (Ján 7. 10. 2026). Človek ho
  // nevymýšľa: nemá sa s čím zraziť a nenesie názov projektu, ktorý sa
  // o rok zmení — je v adrese skriptu, v `aud` tokenu a v
  // `externalRef.widget.<kľúč>` osôb, takže sa nemení. Zadaný kľúč preto
  // znamená úpravu existujúceho kanála; tvar sa neoveruje, aby kanál
  // založený pred UUID ostal upraviteľný so svojím pôvodným kľúčom.
  if (given && !existing) throw new HelpdeskError("helpdesk.notFound", "Taký kanál tu nie je.", { key })
  const now = new Date()

  // Typ sa určuje raz, pri založení (D169).
  const kind: ChannelKind = existing?.kind ?? (input.kind as ChannelKind)
  if (!CHANNEL_KINDS.includes(kind)) throw new HelpdeskError("helpdesk.kind", "Neznámy typ kanála.", { kind: String(input.kind ?? "") })
  const tickets = kind === "widget" ? Boolean(input.tickets ?? existing?.tickets ?? false) : false

  // Schránka: druh a adresa sú povinné, keď je schránka vôbec zadaná. Portál schránku nemá.
  let mailbox: ChannelMailbox | null = existing?.mailbox ?? null
  if (input.mailbox === null || kind === "portal") {
    mailbox = null
  } else if (input.mailbox) {
    const kind = input.mailbox.kind.trim() as MailboxKind
    if (!MAILBOX_KINDS.includes(kind)) throw new HelpdeskError("helpdesk.mailboxKind", "Neznámy druh schránky.", { kind })
    const address = input.mailbox.address.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new HelpdeskError("helpdesk.mailboxAddress", "Adresa schránky nie je e-mailová adresa.")
    const changedIdentity = !mailbox || mailbox.kind !== kind || mailbox.address !== address
    const next: ChannelMailbox = {
      kind, address,
      // Iná schránka = iná história; značka a hranica ticketov začínajú odznova.
      cursor: changedIdentity ? null : mailbox!.cursor,
      syncSince: changedIdentity ? null : mailbox!.syncSince,
      lastSyncAt: changedIdentity ? null : mailbox!.lastSyncAt,
      lastSyncError: changedIdentity ? null : mailbox!.lastSyncError,
      lastSyncCounts: changedIdentity ? null : mailbox!.lastSyncCounts,
    }
    if (kind === "graph") {
      const tenantId = (input.mailbox.tenantId ?? "").trim()
      const clientId = (input.mailbox.clientId ?? "").trim()
      if (!tenantId || !clientId) throw new HelpdeskError("helpdesk.graphIds", "Pri Microsoft 365 je povinný tenant a client id aplikácie.")
      const secret = (input.mailbox.clientSecret ?? "").trim()
      const previous = mailbox?.graph
      next.graph = { tenantId, clientId, clientSecretEnc: previous?.clientSecretEnc, clientSecretHint: previous?.clientSecretHint, secretSetAt: previous?.secretSetAt, secretSetBy: previous?.secretSetBy }
      if (secret) {
        if (!encryptionAvailable()) throw new HelpdeskError("tenant.noEncryptionKey", "Šifrovací kľúč nie je nastavený — tajomstvo sa nedá uložiť.")
        next.graph.clientSecretEnc = encrypt(secret)
        next.graph.clientSecretHint = secret.slice(-4)
        next.graph.secretSetAt = now
        next.graph.secretSetBy = actor
      }
    }
    mailbox = next
  }

  const languages = tidyList(input.languages).filter(isUiLanguage)
  const rate = Number(input.rateLimitPerHour ?? existing?.widget.rateLimitPerHour ?? DEFAULT_RATE_LIMIT)
  const widget: ChannelWidget = {
    ...(existing?.widget ?? { origins: [], rateLimitPerHour: DEFAULT_RATE_LIMIT }),
    origins: tidyList(input.widgetOrigins).map(o => o.replace(/\/+$/, "")),
    rateLimitPerHour: Number.isFinite(rate) && rate > 0 ? Math.min(Math.round(rate), 10_000) : DEFAULT_RATE_LIMIT,
  }

  const channel: HelpdeskChannel = {
    companyCode: code, key, kind, name,
    audience: (input.audience ?? "").trim(),
    folderIds: tidyList(input.folderIds),
    tickets,
    mailbox,
    assigneeIds: tidyList(input.assigneeIds),
    widget: kind === "widget" ? widget : { origins: [], rateLimitPerHour: DEFAULT_RATE_LIMIT },
    languages: languages.length ? languages : (existing?.languages ?? []),
    createdAt: existing?.createdAt ?? now, createdBy: existing?.createdBy ?? actor,
    updatedAt: now, updatedBy: actor,
  }
  await col.updateOne({ companyCode: code, key }, { $set: channel }, { upsert: true })
  await writeAudit({
    companyCode: code, subject: "helpdesk-channel", action: existing ? "changed" : "created", actor,
    targetId: key, targetLabel: name,
    note: `${kind}${tickets ? " · tickety" : ""}${mailbox ? ` · schránka ${mailbox.kind} · ${mailbox.address}` : ""}`,
  })
  return channel
}

/** Kanál sa dá odstrániť, len kým nemá tickety — tie sa nemažú (D163). */
export async function removeChannel(companyCode: string, key: string, actor: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "removeChannel")
  const tickets = await getCollection(TICKETS_COLLECTION)
  if (await tickets.countDocuments({ companyCode: code, channelKey: key }, { limit: 1 })) {
    throw new HelpdeskError("helpdesk.hasTickets", "Kanál má tickety — odstrániť sa nedá, len prestať používať.")
  }
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  const r = await col.findOneAndDelete({ companyCode: code, key })
  if (r) await writeAudit({ companyCode: code, subject: "helpdesk-channel", action: "deleted", actor, targetId: key, targetLabel: r.name })
}

/** Nový tajný kľúč widgetu (D166). Vráti ho v čistom len raz — potom je už len koncovka. */
export async function rotateWidgetSecret(companyCode: string, key: string, actor: string): Promise<string> {
  const code = requireCompanyCode(companyCode, "rotateWidgetSecret")
  if (!encryptionAvailable()) throw new HelpdeskError("tenant.noEncryptionKey", "Šifrovací kľúč nie je nastavený — tajomstvo sa nedá uložiť.")
  const secret = randomBytes(32).toString("base64url")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  const r = await col.updateOne(
    { companyCode: code, key },
    { $set: { "widget.secretEnc": encrypt(secret), "widget.secretHint": secret.slice(-4), "widget.secretSetAt": new Date(), "widget.revealOnce": true, updatedAt: new Date(), updatedBy: actor } },
  )
  if (!r.matchedCount) throw new HelpdeskError("helpdesk.notFound", "Taký kanál tu nie je.")
  await writeAudit({ companyCode: code, subject: "helpdesk-channel", action: "widget-secret", actor, targetId: key, note: `…${secret.slice(-4)}` })
  return secret
}

/**
 * Tajný kľúč widgetu na jedno zobrazenie po vytvorení. Do adresy nepatrí
 * (ostalo by v histórii prehliadača a v logoch), tak sa ukáže zo servera
 * a príznak hneď zhasne.
 */
export async function takeRevealedWidgetSecret(companyCode: string, key: string): Promise<string | null> {
  const code = requireCompanyCode(companyCode, "takeRevealedWidgetSecret")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  const c = await col.findOne({ companyCode: code, key, "widget.revealOnce": true })
  if (!c?.widget.secretEnc) return null
  await col.updateOne({ companyCode: code, key }, { $unset: { "widget.revealOnce": "" } })
  try { return decrypt(c.widget.secretEnc) } catch { return null }
}

/** Tajný kľúč widgetu v čistom — len pre overenie tokenu (krok 5). */
export function widgetSecret(channel: HelpdeskChannel): string | null {
  if (!channel.widget.secretEnc) return null
  try { return decrypt(channel.widget.secretEnc) } catch { return null }
}

// ── schránka ────────────────────────────────────────────────────────────────

/** Adaptér podľa nastavenia kanála. Vyhadzuje, keď schránka nie je nastavená celá. */
export function mailboxFor(channel: HelpdeskChannel): MailboxAdapter {
  const m = channel.mailbox
  if (!m) throw new HelpdeskError("helpdesk.noMailbox", "Kanál nemá schránku.")
  if (m.kind === "graph") {
    if (!m.graph?.clientSecretEnc) throw new HelpdeskError("helpdesk.noSecret", "Schránka nemá uložené tajomstvo aplikácie.")
    let clientSecret: string
    try {
      clientSecret = decrypt(m.graph.clientSecretEnc)
    } catch {
      // Nečitateľné tajomstvo nepadá potichu na nič — rovnako ako kľúč AI (D157).
      throw new HelpdeskError("helpdesk.secretUnreadable", "Tajomstvo schránky sa nedá rozšifrovať — zadaj ho znova.")
    }
    return new GraphMailbox({ tenantId: m.graph.tenantId, clientId: m.graph.clientId, clientSecret, address: m.address })
  }
  // IMAP vznikne s prvým zákazníkom, ktorý ho má (ADR-028 D162).
  throw new HelpdeskError("helpdesk.imapNotYet", "IMAP schránka ešte nie je k dispozícii — zatiaľ len Microsoft 365.")
}

export async function verifyMailbox(companyCode: string, key: string): Promise<{ address: string; displayName: string | null }> {
  const channel = await channelByKey(companyCode, key)
  if (!channel) throw new HelpdeskError("helpdesk.notFound", "Taký kanál tu nie je.")
  return mailboxFor(channel).verify()
}

export interface SyncReport {
  key: string
  pages: number
  created: number
  appended: number
  skipped: number
  /** Správy spred `syncSince` — história, nie tickety. */
  beforeStart: number
  done: boolean
  error: string | null
}

/**
 * Jedno kolo synchronizácie: stránky delta dotazu od značky, nové správy do
 * ticketov, značka späť na kanál. Prvé kolo len nastaví hranicu `syncSince`
 * a prejde históriu bez zápisu — tickety z nej by boli tisíce vybavených vecí.
 */
export async function syncChannel(companyCode: string, key: string, maxPages = SYNC_MAX_PAGES): Promise<SyncReport> {
  const code = requireCompanyCode(companyCode, "syncChannel")
  const channel = await channelByKey(code, key)
  if (!channel?.mailbox) throw new HelpdeskError("helpdesk.noMailbox", "Kanál nemá schránku.")
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  const report: SyncReport = { key, pages: 0, created: 0, appended: 0, skipped: 0, beforeStart: 0, done: false, error: null }
  const since = channel.mailbox.syncSince ?? new Date()
  let cursor = channel.mailbox.cursor
  try {
    const adapter = mailboxFor(channel)
    for (; report.pages < maxPages; ) {
      const page = await adapter.listNew(cursor)
      report.pages += 1
      const fresh = page.messages.filter(m => m.receivedAt >= since)
      report.beforeStart += page.messages.length - fresh.length
      if (fresh.length) {
        const r = await ingestMessages(code, key, fresh)
        report.created += r.created; report.appended += r.appended; report.skipped += r.skipped
      }
      cursor = page.cursor
      // Značka sa ukladá po každej stránke — prerušené kolo nezačne odznova.
      await col.updateOne({ companyCode: code, key }, { $set: { "mailbox.cursor": cursor, "mailbox.syncSince": since } })
      if (!page.more) { report.done = true; break }
    }
    await col.updateOne(
      { companyCode: code, key },
      { $set: { "mailbox.lastSyncAt": new Date(), "mailbox.lastSyncError": null, "mailbox.lastSyncCounts": { created: report.created, appended: report.appended, skipped: report.skipped } } },
    )
  } catch (e) {
    report.error = e instanceof AppError ? e.code : "mailbox.failed"
    console.error(`[helpdesk] synchronizacia ${code}/${key} zlyhala:`, e)
    await col.updateOne({ companyCode: code, key }, { $set: { "mailbox.lastSyncAt": new Date(), "mailbox.lastSyncError": report.error } })
  }
  return report
}

/** Všetky kanály so schránkou — pre cron. */
export async function channelsWithMailbox(): Promise<HelpdeskChannel[]> {
  const col = await getCollection<HelpdeskChannel>(CHANNELS_COLLECTION)
  return col.find({ mailbox: { $ne: null } }).toArray()
}
