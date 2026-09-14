/**
 * personFields.ts — meno, tituly, telefón a pracovisko ako čisté funkcie (D83–D86).
 *
 * Sú tu zámerne oddelene od `persons.ts`: sú to jediné pravidlá tejto zmeny,
 * ktoré sa dajú pomýliť, a zároveň jediné, ktoré sa dajú otestovať bez
 * clustera. Volá ich obrazovka, import aj migračný skript — tri kópie pravidla,
 * ako sa skladá meno, by znamenali tri rôzne mená toho istého človeka.
 */

import type { CodelistItem } from "./codelists"

// ── Meno ─────────────────────────────────────────────────────────────────────

/**
 * Meno a priezvisko na `fullName` (D83).
 *
 * `fullName` je to, čo sa v okamihu potvrdenia zamrazí do `acknowledgements`
 * a do auditu. Preto sa **neskladá z titulov** (D84): titul počas života
 * pribudne a ten istý človek by potom v starých záznamoch vystupoval pod iným
 * menom než v nových — a rozdiel by nebol zmenou osoby.
 */
export function composeFullName(givenName?: string, surname?: string): string {
  return [givenName, surname].map(x => (x ?? "").trim()).filter(Boolean).join(" ")
}

/**
 * Meno s titulmi — **len na zobrazenie** (D84).
 *
 * Karta osoby, adresár, tlačové výstupy. Nikdy sa neukladá do `fullName`.
 */
export function displayName(p: {
  fullName: string
  titleBefore?: string
  titleAfter?: string
}): string {
  const before = (p.titleBefore ?? "").trim()
  const after = (p.titleAfter ?? "").trim()
  const base = [before, p.fullName.trim()].filter(Boolean).join(" ")
  return after ? `${base}, ${after}` : base
}

/**
 * Rozdelenie existujúceho `fullName` na meno a priezvisko — **pre migráciu**.
 *
 * Delí sa po **prvej medzere**: prvé slovo je meno, zvyšok priezvisko. Zložené
 * priezviská tak zostanú celé; obrátené poradie („Letko Ján") rozdelí naopak
 * a to je presne dôvod, prečo migrácia beží najprv nasucho a výsledok sa číta.
 *
 * `null` znamená **nedá sa rozdeliť** (jedno slovo, prázdno). Vtedy sa
 * nehádže — polia zostanú prázdne a doplní ich personalista. Uhádnuté
 * priezvisko sa od zadaného nedá odlíšiť a to je horšie než prázdno.
 */
export function splitFullName(fullName: string): { givenName: string; surname: string } | null {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { givenName: parts[0], surname: parts.slice(1).join(" ") }
}

// ── Telefón ──────────────────────────────────────────────────────────────────

export type PhoneResult =
  | { ok: true; value: string }
  | { ok: false; reason: "phone.shape" | "phone.noPrefix" }

/** Predvolená predvoľba, keď ju organizácia nemá nastavenú. */
export const DEFAULT_PHONE_PREFIX = "+421"

/**
 * Telefón do tvaru E.164 — `+421905123456` (D86).
 *
 * Jeden tvar v databáze je podmienka toho, aby sa dve čísla dali porovnať
 * a aby odkaz `tel:` fungoval. „0905 123 456" a „+421 905 123 456" je to isté
 * číslo a uložené dvakrát rôzne by to nikto nezistil.
 *
 * `prefix` je **vlastnosť organizácie**, nie konštanta: Contineo nie je systém
 * jedného zväzu a zadrôtovaná slovenská predvoľba by českému zákazníkovi ticho
 * vyrobila neplatné čísla.
 *
 * Prázdny vstup je platný a znamená **vyprázdniť pole** — na rozdiel od mena
 * tu prázdno niečo znamená.
 */
export function normalizePhone(raw: string | undefined, prefix?: string): PhoneResult {
  const text = (raw ?? "").trim()
  if (!text) return { ok: true, value: "" }

  // Medzery, pomlčky, lomky, bodky a zátvorky sú spôsob zápisu, nie číslo.
  const compact = text.replace(/[\s .\-/()]/g, "")
  const dial = (prefix ?? DEFAULT_PHONE_PREFIX).trim() || DEFAULT_PHONE_PREFIX

  let candidate: string
  if (compact.startsWith("+")) candidate = compact
  else if (compact.startsWith("00")) candidate = `+${compact.slice(2)}`
  else if (compact.startsWith("0")) candidate = `${dial}${compact.slice(1)}`
  // Holé číslice bez nuly aj bez `+` sa prečítať nedajú: `905123456` môže byť
  // slovenský mobil bez nuly aj skrátené číslo odkiaľkoľvek. Hádať krajinu by
  // znamenalo tichú chybu, ktorá sa zistí, až keď treba niekomu zavolať.
  else return { ok: false, reason: "phone.noPrefix" }

  // E.164: `+`, predvoľba nezačínajúca nulou, celkovo 8 až 15 číslic.
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) return { ok: false, reason: "phone.shape" }
  return { ok: true, value: candidate }
}

// ── Pracovisko ───────────────────────────────────────────────────────────────

/** Text na porovnanie: malé písmená, bez diakritiky, bez oddeľovačov. */
function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[\s_\-.]/g, "")
}

/**
 * Text z CSV alebo z adresára na **kľúč pracoviska z číselníka** (D85).
 *
 * Páruje sa na kľúč aj na popisku, obe znormalizované — „Banská Bystrica",
 * „banska bystrica" aj `banska_bystrica` vedú na tú istú položku.
 *
 * `null` znamená **nespárované**. Vtedy sa pole nevyplní a riadok sa nezahodí:
 * meno, adresa a oddelenie sú platné aj bez pracoviska. Nespárovanú hodnotu
 * vypíše súhrn importu, aby ju personalista doplnil do číselníka — číselník
 * sa importom **nezakladá**, inak by ho za pol roka zaplnili preklepy.
 */
export function matchWorkplace(text: string | undefined, items: CodelistItem[]): string | null {
  const wanted = foldText((text ?? "").trim())
  if (!wanted) return null
  for (const item of items) {
    if (foldText(item.key) === wanted) return item.key
    if (item.label && foldText(item.label) === wanted) return item.key
  }
  return null
}

/** Popiska pracoviska pre zobrazenie; keď v číselníku nie je, ukáže sa kľúč. */
export function workplaceLabel(key: string | undefined, items: CodelistItem[]): string {
  if (!key) return ""
  return items.find(i => i.key === key)?.label ?? key
}
