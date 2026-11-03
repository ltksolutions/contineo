/**
 * widgetPdfLink.ts — podpísaný odkaz na PDF citovaného znenia vo widgete
 * (Ján 3. 11. 2026, KANAL-widget-strana).
 *
 * Človek v ISSF nie je prihlásený do intranetu, takže `/api/documents/…/pdf`
 * mu vráti 401. Widget preto dostane ku každému citovanému zneniu adresu
 * `/api/widget/<kanál>/pdf`, podpísanú tajným kľúčom kanála:
 *
 *   • podpis viaže **kanál, dokument a znenie** — adresa nejde prepísať na iný
 *     dokument ani na iné znenie, a kľúč iného kanála ju nepodpíše;
 *   • podpis vzniká **len pri odpovedi** z úsekov, ktoré kanál smel citovať
 *     (úroveň `public`, priečinky kanála) — widget si odkaz vyrobiť nevie;
 *   • adresa **vyprší** (`PDF_LINK_DAYS`); história ho pri otvorení podpíše
 *     znova, takže staré odpovede ostávajú použiteľné.
 *
 * Adresa sa dá vložiť do `<img>` aj otvoriť v novej karte — nič z toho
 * nepošle token v tele, preto podpis v adrese a nie token.
 *
 * Čisté funkcie: pravidlo, ktoré pustí cudzieho človeka k súboru, sa musí
 * dať otestovať bez databázy.
 */

import { createHmac, timingSafeEqual } from "node:crypto"
import { citedPage, type SourcePages } from "./pageLink"

/** Ako dlho odkaz platí. Mesiac stačí na odpoveď otvorenú z histórie aj na záložku. */
export const PDF_LINK_DAYS = 30

export interface PdfLinkClaims {
  channelKey: string
  documentId: string
  versionId: string
  /** Koniec platnosti v sekundách od 1. 1. 1970. */
  exp: number
}

function digest(c: PdfLinkClaims, secret: string): Buffer {
  // Oddeľovač, ktorý v identifikátoroch byť nemôže — inak by sa „a|b" + „c"
  // dalo podpísať ako „a" + „b|c".
  return createHmac("sha256", secret)
    .update(["widget-pdf", c.channelKey, c.documentId, c.versionId, String(c.exp)].join("\n"))
    .digest()
}

export function signPdfLink(c: PdfLinkClaims, secret: string): string {
  return digest(c, secret).toString("base64url")
}

/** Platí podpis a ešte nevypršal? */
export function verifyPdfLink(c: PdfLinkClaims, signature: string, secret: string, now: number = Date.now()): boolean {
  if (!Number.isSafeInteger(c.exp) || c.exp * 1000 <= now) return false
  if (!c.channelKey || !c.documentId || !c.versionId) return false
  let given: Buffer
  try { given = Buffer.from(signature, "base64url") } catch { return false }
  const expected = digest(c, secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Čo widget potrebuje, aby pri zdroji nakreslil náhľad a odkaz na stranu. */
export interface WidgetPageLink {
  /** Podpísaná adresa bez strany — widget z nej skladá stranu, počet strán a stiahnutie. */
  base: string
  /** PDF otvorené na citovanej strane (`#page=`). */
  pdf: string
  /** Náhľad citovanej strany (PNG). */
  thumb: string
  /** Citovaná strana — schéma, ak ju úsek opisuje, inak začiatok úseku. */
  page: number
  from: number
  to: number
  /** Strana je strana schémy (`pages.figure`). */
  figure: boolean
}

interface LinkableSource {
  documentId?: string
  versionId?: string
  pages?: SourcePages
  live?: unknown
  law?: unknown
}

/**
 * Odkazy k zdrojom odpovede v tom istom poradí; `null`, kde odkaz nedáva
 * zmysel (živý zdroj, zákon, úsek bez strán, dokument bez znenia).
 */
export function widgetPageLinks(
  sources: readonly unknown[],
  input: { apiBase: string; channelKey: string; secret: string; now?: number },
): (WidgetPageLink | null)[] {
  const exp = Math.floor((input.now ?? Date.now()) / 1000) + PDF_LINK_DAYS * 86400
  const base = `${input.apiBase}/api/widget/${encodeURIComponent(input.channelKey)}/pdf`
  return sources.map(raw => {
    const s = (raw ?? {}) as LinkableSource
    if (s.live || s.law || !s.documentId || !s.versionId || !s.pages) return null
    const { from, to } = s.pages
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1) return null
    const page = citedPage(s.pages)
    const claims = { channelKey: input.channelKey, documentId: s.documentId, versionId: s.versionId, exp }
    const q = new URLSearchParams({ d: s.documentId, v: s.versionId, e: String(exp), s: signPdfLink(claims, input.secret) })
    return {
      base: `${base}?${q}`,
      pdf: `${base}?${q}#page=${page}`,
      thumb: `${base}?${q}&page=${page}`,
      page, from, to,
      figure: Boolean(s.pages.figure),
    }
  })
}
