/**
 * documentPdf.ts — PDF dokumentu knižnice vyrobené z Markdownu so šablónou
 * organizácie (ADR-031).
 *
 * Schvaľuje a potvrdzuje sa PDF (ADR-011, D94). Kto píše dokumenty v `.md`,
 * dovtedy musel PDF vyrobiť sám mimo Continea. Teraz stačí nahrať `.md`
 * a PDF vznikne tu — s hlavičkou (logo, názov dokumentu, organizácia) a pätou (právny
 * názov, sídlo, IČO, DIČ, IČ DPH, web, e-mail, telefón, dátum, strana).
 *
 * Údaje sa berú z profilu organizácie **v čase vytvorenia znenia** a sú
 * natlačené v PDF — kópia, nie odkaz: keď sa o rok zmení adresa, staré
 * znenie ostane také, aké sa schvaľovalo.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { loadBrand } from "./branding"
import { dictionary, formatDate, type UiLanguage } from "./i18n"
import { renderMarkdownPdf, type PdfLetterhead } from "./markdownPdf"
import type { Tenant } from "./tenants"

/**
 * Logo organizácie ako PNG pre pdf-lib. Nahraté logo z `tenant_assets`, inak
 * statické z `public/tenants/`. Žiadne logo alebo poškodené = hlavička bez
 * loga; PDF kvôli tomu nesmie zlyhať.
 */
export async function tenantLogoPng(tenant: Pick<Tenant, "companyCode" | "branding">): Promise<Buffer | null> {
  const url = tenant.branding.logoUrl ?? ""
  let src: Buffer | null = null
  if (url.startsWith("/api/brand/")) {
    const brand = await loadBrand(tenant.companyCode)
    if (brand) {
      const raw = brand.data as unknown as { buffer?: Uint8Array }
      src = Buffer.from(raw.buffer ?? (brand.data as unknown as Uint8Array))
    }
  } else if (url.startsWith("/tenants/")) {
    // Len meno súboru — adresa je dáta, nie cesta na disku.
    src = await readFile(path.join(process.cwd(), "public", "tenants", path.basename(url.split("?")[0]))).catch(() => null)
  }
  if (!src) return null
  try {
    return await sharp(src, { density: 300 }).resize({ height: 180, withoutEnlargement: false }).png().toBuffer()
  } catch {
    return null
  }
}

/**
 * Riadky päty z profilu organizácie: kto (právny názov, sídlo), pod akými
 * číslami (IČO, DIČ, IČ DPH) a ako sa ozvať (web, e-mail, telefón). Prázdne
 * údaje sa vynechajú, prázdny riadok tiež. Tri krátke riadky namiesto dvoch
 * dlhých — dlhý sa zalomí uprostred čísla.
 */
export function footerLines(
  tenant: Pick<Tenant, "branding" | "controller" | "contact">,
  language: UiLanguage,
): string[] {
  const t = dictionary(language).library.upload.letterhead
  const c = tenant.controller ?? {}
  const who = [organisationName(tenant), c.address]
  const ids = [
    c.registrationNumber ? t.registrationNumber(c.registrationNumber) : null,
    c.taxId ? t.taxId(c.taxId) : null,
    c.vatId ? t.vatId(c.vatId) : null,
  ]
  const contact = tenant.contact ?? {}
  const reach = [contact.web, contact.email, contact.phone ? t.phone(contact.phone) : null]
  return [who, ids, reach]
    .map(parts => parts.filter((x): x is string => !!x && !!x.trim()).join(" · "))
    .filter(Boolean)
}

/**
 * Názov organizácie na dokumente: právny názov, inak názov portálu.
 * `branding.displayName` je často názov aplikácie („Intranet SFZ") — na
 * dokumente má stáť, kto ho vydal.
 */
export function organisationName(tenant: Pick<Tenant, "branding" | "controller">): string {
  return tenant.controller?.legalName || tenant.branding.displayName
}

/** Polnoc dňa v UTC — deň, nie okamih (pozri `PdfLetterhead.creationDate`). */
export function dayOf(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/** Hlavička a päta pre dokument organizácie. */
export async function letterheadFor(
  tenant: Pick<Tenant, "companyCode" | "branding" | "controller" | "contact">,
  language: UiLanguage,
  dates: { createdOn: Date; effectiveFrom?: Date | null },
  documentTitle?: string,
): Promise<PdfLetterhead> {
  const t = dictionary(language).library.upload.letterhead
  const date = [
    t.createdOn(formatDate(dates.createdOn, language)),
    dates.effectiveFrom ? t.effectiveFrom(formatDate(dates.effectiveFrom, language)) : null,
  ].filter(Boolean).join(" · ")
  return {
    logoPng: await tenantLogoPng(tenant),
    name: organisationName(tenant),
    documentTitle,
    footer: footerLines(tenant, language),
    date,
    creationDate: dayOf(dates.createdOn),
  }
}

/** Názov dokumentu: prvý nadpis `# …` v Markdowne, inak náhradný. */
export function markdownTitle(markdown: string, fallback: string): string {
  const m = markdown.match(/^#\s+(.+?)\s*#*\s*$/m)
  return m ? m[1].trim() : fallback
}

/**
 * PDF z Markdownu so šablónou organizácie. Prvý nadpis `# …` sa stane
 * nadpisom dokumentu a z textu sa vynechá — inak by bol v PDF dvakrát.
 */
export async function renderDocumentPdf(input: {
  tenant: Pick<Tenant, "companyCode" | "branding" | "controller" | "contact">
  language: UiLanguage
  title: string
  markdown: string
  createdOn: Date
  effectiveFrom?: Date | null
}): Promise<Uint8Array> {
  const h1 = input.markdown.match(/^#\s+.+$/m)
  const body = h1 ? input.markdown.replace(h1[0], "").replace(/^\s+/, "") : input.markdown
  const title = h1 ? markdownTitle(input.markdown, input.title) : input.title
  return renderMarkdownPdf({
    title,
    markdown: body,
    author: organisationName(input.tenant),
    texts: { page: dictionary(input.language).library.faq.pdfPage },
    letterhead: await letterheadFor(input.tenant, input.language, { createdOn: input.createdOn, effectiveFrom: input.effectiveFrom }, title),
  })
}
