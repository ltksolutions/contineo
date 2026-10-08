/**
 * mailbox/graph.ts — schránka na Microsoft 365 cez Microsoft Graph (ADR-028, D162).
 *
 * **Aplikačné oprávnenia, nie delegované.** Synchronizácia beží z cronu bez
 * prihláseného človeka; token je z `client_credentials` registrácie
 * aplikácie v Entra (tenant, client id, tajomstvo). Oprávnenia `Mail.Read`
 * a `Mail.Send` sú na celú organizáciu, preto ich správca M365 **zúži na
 * schránku kanála** (RBAC for Applications, prípadne staršia Application
 * Access Policy — postup v `docs/NASADENIE_app.md`). Contineo tak technicky
 * nevidí inú poštu, aj keby chcelo.
 *
 * **Prečo nie IMAP na M365:** základné prihlásenie je v Exchange Online
 * vypnuté; IMAP cez OAuth potrebuje tú istú registráciu a nedá delta dotaz,
 * `conversationId` ani odosielanie.
 *
 * Delta dotaz: `/users/{schránka}/mailFolders/inbox/messages/delta`
 * s `$filter=receivedDateTime ge {since}` — jediný filter, ktorý delta na
 * správach pozná. Bez neho prvé kolo vráti celú schránku. Značka je celý
 * `@odata.deltaLink` (filter nesie v sebe); keď vyprší (`syncStateNotFound`),
 * začne sa odznova od `since` — správy, ktoré už ticket má, odfiltruje
 * `internetMessageId`.
 */

import { AppError } from "../appError"
import { htmlToText, type MailboxAdapter, type MailboxPage, type MailMessage, type MailFolder, type MailHeader } from "./types"

export class MailboxError extends AppError {}

export interface GraphMailboxConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  /** Adresa (UPN) schránky, napr. helpdesk@futbalsfz.sk. */
  address: string
}

const GRAPH = "https://graph.microsoft.com/v1.0"
const TIMEOUT_MS = 15000
const SELECT = "id,internetMessageId,conversationId,from,toRecipients,subject,body,receivedDateTime,hasAttachments,isDraft"
/** Analýza histórie (ADR-030, D180): bez tela, adresátov a príloh. */
const HEADER_SELECT = "id,conversationId,from,subject,receivedDateTime,parentFolderId,isDraft"

type GraphRecipient = { emailAddress?: { address?: string; name?: string } }
type GraphMessage = {
  id: string
  internetMessageId?: string
  conversationId?: string
  from?: GraphRecipient
  toRecipients?: GraphRecipient[]
  subject?: string
  body?: { contentType?: string; content?: string }
  receivedDateTime?: string
  hasAttachments?: boolean
  isDraft?: boolean
  "@removed"?: unknown
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    return await run(abort.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** Chyba Graphu do našej výnimky — kód pre i18n, podrobnosť do logu. */
async function graphError(r: Response, what: string): Promise<MailboxError> {
  let detail = ""
  try {
    const j = await r.json() as { error?: { code?: string; message?: string } }
    detail = `${j.error?.code ?? ""} ${j.error?.message ?? ""}`.trim()
  } catch { /* telo nie je JSON */ }
  console.error(`[mailbox/graph] ${what}: ${r.status} ${detail}`)
  if (r.status === 401 || r.status === 403) {
    return new MailboxError("mailbox.forbidden", "Schránka odmietla prístup — skontroluj oprávnenia aplikácie a zúženie na schránku.", { status: r.status })
  }
  if (r.status === 404) {
    return new MailboxError("mailbox.notFound", "Schránka s touto adresou v organizácii nie je.", { status: r.status })
  }
  if (/syncStateNotFound/i.test(detail)) {
    return new MailboxError("mailbox.cursorExpired", "Značka synchronizácie vypršala — ďalšie spustenie začne odznova.", { status: r.status })
  }
  return new MailboxError("mailbox.failed", "Schránka neodpovedala správne.", { status: r.status })
}

export function toMailMessage(m: GraphMessage, mailboxAddress: string): MailMessage {
  const fromAddress = m.from?.emailAddress?.address ?? null
  const body = m.body?.content ?? ""
  return {
    id: m.id,
    internetMessageId: m.internetMessageId ?? null,
    threadRef: m.conversationId ?? m.id,
    from: fromAddress ? { address: fromAddress.toLowerCase(), name: m.from?.emailAddress?.name ?? null } : null,
    to: (m.toRecipients ?? [])
      .map(r => r.emailAddress?.address ? { address: r.emailAddress.address.toLowerCase(), name: r.emailAddress.name ?? null } : null)
      .filter((x): x is { address: string; name: string | null } => Boolean(x)),
    subject: m.subject ?? "",
    text: (m.body?.contentType ?? "").toLowerCase() === "html" ? htmlToText(body) : body.trim(),
    receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(0),
    outgoing: Boolean(fromAddress && fromAddress.toLowerCase() === mailboxAddress.toLowerCase()),
    // Obsah príloh sa neťahá (D163) — doklady maloletých zostávajú v schránke.
    attachments: [],
  }
}

export class GraphMailbox implements MailboxAdapter {
  readonly kind = "graph" as const
  readonly address: string
  private token: { value: string; expiresAt: number } | null = null

  constructor(private readonly config: GraphMailboxConfig) {
    this.address = config.address.trim().toLowerCase()
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    })
    const r = await withTimeout(signal => fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(this.config.tenantId)}/oauth2/v2.0/token`,
      { method: "POST", body, signal, cache: "no-store" },
    ))
    if (!r.ok) {
      const detail = await r.text().catch(() => "")
      console.error(`[mailbox/graph] token: ${r.status} ${detail.slice(0, 300)}`)
      throw new MailboxError("mailbox.auth", "Prihlásenie aplikácie do Microsoft 365 zlyhalo — skontroluj tenant, client id a tajomstvo.", { status: r.status })
    }
    const j = await r.json() as { access_token: string; expires_in: number }
    this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
    return j.access_token
  }

  private async get(url: string, what: string, pageSize = 50): Promise<Response> {
    const token = await this.accessToken()
    const r = await withTimeout(signal => fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: `outlook.body-content-type="text", odata.maxpagesize=${pageSize}` },
      signal, cache: "no-store",
    }))
    if (!r.ok) throw await graphError(r, what)
    return r
  }

  private userPath(): string {
    return `${GRAPH}/users/${encodeURIComponent(this.address)}`
  }

  /**
   * Overí len to, čo synchronizácia naozaj robí: čítanie priečinka Doručené.
   * Profil používateľa (`/users/{adresa}`) sa nečíta — potrebuje `User.Read.All`
   * v Entra, ktoré zúžená aplikácia nemá a mať nemá (RBAC for Applications dáva
   * len `Mail.Read`/`Mail.Send` na jednu schránku). 7. 10. 2026 overenie
   * na tom padalo s 403, hoci zúženie bolo správne.
   */
  async verify(): Promise<{ address: string; displayName: string | null }> {
    const r = await this.get(`${this.userPath()}/mailFolders/inbox?$select=id,displayName`, "overenie schránky")
    await r.json().catch(() => null)
    return { address: this.address, displayName: null }
  }

  async listNew(cursor: string | null, since: Date, folder: MailFolder = "inbox"): Promise<MailboxPage> {
    // Graph chce DateTimeOffset bez milisekúnd.
    const from = since.toISOString().replace(/\.\d{3}Z$/, "Z")
    const url = cursor ?? `${this.userPath()}/mailFolders/${folder}/messages/delta?$select=${SELECT}&$filter=${encodeURIComponent(`receivedDateTime ge ${from}`)}`
    let r: Response
    try {
      r = await this.get(url, "delta")
    } catch (e) {
      // Vypršaná značka: jedno kolo odznova, nie chyba synchronizácie.
      if (e instanceof MailboxError && e.code === "mailbox.cursorExpired" && cursor) return this.listNew(null, since, folder)
      throw e
    }
    const j = await r.json() as { value?: GraphMessage[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string }
    const messages = (j.value ?? [])
      .filter(m => !m["@removed"] && !m.isDraft)
      .map(m => toMailMessage(m, this.address))
    return {
      messages,
      cursor: j["@odata.nextLink"] ?? j["@odata.deltaLink"] ?? null,
      more: Boolean(j["@odata.nextLink"]),
    }
  }

  async listThread(threadRef: string, limit = 50): Promise<MailMessage[]> {
    // Filter na conversationId ide naprieč priečinkami (prijaté, odoslané,
    // archív). $orderby sa s ním nekombinuje (InefficientFilter) — triedi sa tu.
    const filter = encodeURIComponent(`conversationId eq '${threadRef.replace(/'/g, "''")}'`)
    let url: string | null = `${this.userPath()}/messages?$select=${SELECT}&$filter=${filter}&$top=${Math.min(50, limit)}`
    const out: MailMessage[] = []
    while (url && out.length < limit) {
      const r = await this.get(url, "vlákno")
      const j = await r.json() as { value?: GraphMessage[]; "@odata.nextLink"?: string }
      for (const m of j.value ?? []) if (!m.isDraft) out.push(toMailMessage(m, this.address))
      url = j["@odata.nextLink"] ?? null
    }
    return out.slice(0, limit).sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
  }

  async listRecent(limit: number): Promise<MailMessage[]> {
    const out: MailMessage[] = []
    // Celá schránka, nie len prijaté: odpovede helpdesku ležia v odoslaných
    // a bez nich by história nemala odpovede.
    let url: string | null = `${this.userPath()}/messages?$select=${SELECT}&$orderby=receivedDateTime desc&$top=${Math.min(50, limit)}`
    while (url && out.length < limit) {
      const r = await this.get(url, "história")
      const j = await r.json() as { value?: GraphMessage[]; "@odata.nextLink"?: string }
      for (const m of j.value ?? []) {
        if (m.isDraft) continue
        out.push(toMailMessage(m, this.address))
        if (out.length >= limit) break
      }
      url = j["@odata.nextLink"] ?? null
    }
    return out
  }

  /**
   * Hlavičky bez tela po stránkach po 500 (ADR-030, D180). Celá schránka ako
   * pri `listRecent` — odpovede ležia v odoslaných a helpdesk si poštu
   * triedi do podpriečinkov; nevyžiadanú a odstránenú poštu len označí.
   */
  async listHeaders(from: Date, to: Date): Promise<MailHeader[]> {
    const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z")
    const [junk, deleted] = await Promise.all(["junkemail", "deleteditems"].map(async name => {
      try {
        const r = await this.get(`${this.userPath()}/mailFolders/${name}?$select=id`, "priečinok")
        return ((await r.json()) as { id?: string }).id ?? null
      } catch {
        // Schránka bez priečinka (iný jazyk, zmazaný) — nič sa neoznačí.
        return null
      }
    }))
    const filter = encodeURIComponent(`receivedDateTime ge ${iso(from)} and receivedDateTime lt ${iso(to)}`)
    let url: string | null = `${this.userPath()}/messages?$select=${HEADER_SELECT}&$filter=${filter}&$top=500`
    const out: MailHeader[] = []
    while (url) {
      const r = await this.get(url, "hlavičky", 500)
      const j = await r.json() as { value?: (GraphMessage & { parentFolderId?: string })[]; "@odata.nextLink"?: string }
      for (const m of j.value ?? []) {
        if (m.isDraft) continue
        const fromAddress = m.from?.emailAddress?.address?.toLowerCase() ?? null
        out.push({
          threadRef: m.conversationId ?? m.id,
          fromAddress,
          subject: m.subject ?? "",
          receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(0),
          outgoing: fromAddress === this.address,
          folder: m.parentFolderId && m.parentFolderId === junk ? "junk" : m.parentFolderId && m.parentFolderId === deleted ? "deleted" : "other",
        })
      }
      url = j["@odata.nextLink"] ?? null
    }
    return out
  }

  async reply(messageId: string, text: string): Promise<{ messageId: string | null }> {
    const token = await this.accessToken()
    const r = await withTimeout(signal => fetch(`${this.userPath()}/messages/${encodeURIComponent(messageId)}/reply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { body: { contentType: "Text", content: text } } }),
      signal, cache: "no-store",
    }))
    if (!r.ok) throw await graphError(r, "odpoveď")
    // `reply` vráti 202 bez tela; identifikátor odoslanej správy Graph nedá.
    // Ticket si preto odoslanie zapíše sám (text, kto, kedy) — D163.
    return { messageId: null }
  }

  async send(to: string, subject: string, text: string): Promise<{ messageId: string | null }> {
    const token = await this.accessToken()
    const r = await withTimeout(signal => fetch(`${this.userPath()}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject, body: { contentType: "Text", content: text }, toRecipients: [{ emailAddress: { address: to } }] },
        saveToSentItems: true,
      }),
      signal, cache: "no-store",
    }))
    if (!r.ok) throw await graphError(r, "odoslanie")
    return { messageId: null }
  }
}
