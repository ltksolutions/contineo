/**
 * widgetEmbed.ts — kód na vloženie widgetu do cudzej stránky (Ján 8. 10. 2026).
 *
 * Skladá sa tu, nie v šablóne stránky, aby ho bolo možné otestovať
 * a aby nastavenie kanála aj návod (`docs/WIDGET_ISSF.md`) ukazovali to isté.
 *
 * Náhradný blok rieši prípad, keď skript vôbec nenabehne (výpadok, kanál
 * vypnutý, zmenený kľúč): `<script>` vtedy vyvolá `onerror` a skrytý blok
 * s kontaktom sa ukáže. Keď skript nabehne, ale zlyhá volanie API, kontakt
 * ukáže samotný widget (`widgetScript.ts`).
 */

export const FALLBACK_ELEMENT_ID = "contineo-helpdesk-fallback"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export interface EmbedInput {
  /** Hostiteľ aplikácie organizácie, napr. `intranet.futbalsfz.sk`. */
  host: string
  channelKey: string
  /** Veta náhradného bloku bez adresy, napr. „Pomocníka sa nepodarilo načítať. Napíšte na". */
  fallbackText: string
  /** Kontakt pri výpadku; bez neho sa náhradný blok nevloží. */
  contact: string | null
  /**
   * Popis do HTML komentára nad kódom — kód sa kopíruje k vývojárovi cudzej
   * stránky a obrazovku nastavenia on neuvidí (Ján 8. 10. 2026).
   */
  doc?: { title: string; params: { name: string; text: string }[]; tokenHeading: string; token: string }
}

/** `--` v HTML komentári komentár ukončí; nahradí sa pomlčkou. */
function commentSafe(s: string): string {
  return s.replace(/--+/g, "—").replace(/>/g, "›")
}

function docComment(d: NonNullable<EmbedInput["doc"]>): string[] {
  const pad = Math.max(...d.params.map(p => p.name.length)) + 2
  return [
    `<!-- ${commentSafe(d.title)}`,
    ...d.params.map(p => `     ${p.name.padEnd(pad)}${commentSafe(p.text)}`),
    ``,
    `     ${commentSafe(d.tokenHeading)}: ${commentSafe(d.token)}`,
    `-->`,
  ]
}

export function widgetEmbedCode(i: EmbedInput): string {
  const src = `https://${i.host}/api/widget/${encodeURIComponent(i.channelKey)}/script`
  const lines: string[] = i.doc ? docComment(i.doc) : []
  if (i.contact) {
    lines.push(
      `<div id="${FALLBACK_ELEMENT_ID}" hidden>`,
      `  ${esc(i.fallbackText)} <a href="mailto:${esc(i.contact)}">${esc(i.contact)}</a>`,
      `</div>`,
    )
  }
  lines.push(
    `<script src="${esc(src)}"`,
    `        data-token="TOKEN_Z_VASHO_SERVERA"`,
    `        data-token-url="/api/contineo-token"`,
    ...(i.contact ? [`        onerror="document.getElementById('${FALLBACK_ELEMENT_ID}').hidden=false"`] : []),
    `        defer></script>`,
  )
  return lines.join("\n")
}
