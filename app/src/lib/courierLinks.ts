/**
 * courierLinks.ts — odkazy von v správach Kuriéra (ADR-033, D222).
 *
 * **Len Kuriér.** Spoločný rozklad `formatText.ts` ostáva s vnútornými
 * odkazmi — tým istým rozkladom ide výstup jazykového modelu nad cudzími
 * dokumentmi a ten nesmie vedieť vyrobiť odkaz von (D208). Odkaz von je
 * preto samostatný krok nad textovými úsekmi, ktorý zapína len zobrazenie
 * správy (`FormattedText external`). Tak to D208 predpokladal: samostatný
 * druh s viditeľným označením (doména a ↗), nie rozšírenie vzoru `LINK`.
 *
 * Čistý TypeScript — testuje sa bez prehliadača a siete.
 */

/** Najviac toľko náhľadov na správu — viac by zahltilo vlákno aj server. */
export const MAX_PREVIEWS = 3

/** Len `https://`, bez prihlasovacích údajov v adrese, s doménou. */
export function isExternalHref(href: unknown): href is string {
  if (typeof href !== "string" || !/^https:\/\/[^\s()<>]+$/i.test(href)) return false
  try {
    const u = new URL(href)
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".")
  } catch {
    return false
  }
}

/** Doména pre označenie odkazu („futbalnet.sk"), bez `www.`. */
export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, "")
  } catch {
    return ""
  }
}

export type ExternalPart = { druh: "text"; text: string } | { druh: "von"; text: string; href: string; host: string }

const EXTERNAL = /\[([^\]\n]+)\]\((https:\/\/[^)\s]+)\)/g

/** Rozdelí text na bežné úseky a odkazy von `[text](https://…)`. */
export function splitExternal(text: string): ExternalPart[] {
  const parts: ExternalPart[] = []
  let last = 0
  for (const m of text.matchAll(EXTERNAL)) {
    if (!isExternalHref(m[2])) continue
    if (m.index! > last) parts.push({ druh: "text", text: text.slice(last, m.index) })
    parts.push({ druh: "von", text: m[1], href: m[2], host: hostOf(m[2]) })
    last = m.index! + m[0].length
  }
  if (last < text.length) parts.push({ druh: "text", text: text.slice(last) })
  return parts.length ? parts : [{ druh: "text", text }]
}

/** Odkazy von v texte správy — jedinečné, v poradí výskytu, najviac `MAX_PREVIEWS`. */
export function externalLinksOf(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(EXTERNAL)) {
    if (isExternalHref(m[2]) && !out.includes(m[2])) out.push(m[2])
    if (out.length >= MAX_PREVIEWS) break
  }
  return out
}
