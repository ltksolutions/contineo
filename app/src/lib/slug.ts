/**
 * Kľúč z názvu — položky číselníka, kurzy, testy, súbory.
 *
 * Malé písmená bez diakritiky, medzery a interpunkcia na podčiarkovník:
 * „Metodický pokyn" → `metodicky_pokyn`. Tvar sedí s `KEY_PATTERN`
 * (`codelists.ts`), takže čo tu vznikne, server prijme.
 *
 * **Kľúč dokumentu odtiaľto od ADR-043 nevzniká** — je to náhodné UUID
 * (`newDocumentKey()` v `libraryWrite.ts`). Staré dokumenty si slug
 * z názvu nechávajú.
 *
 * Čistá funkcia bez závislostí zámerne — volá ju server aj formulár
 * v prehliadači (`KeyFromLabel`), a obe strany musia dôjsť k tomu istému
 * kľúču. Keby existovali dve kópie, raz sa rozídu.
 */
/**
 * Kľúč trasy onboardingu z názvu — to isté pravidlo, len s pomlčkou
 * (`TRACK_KEY` v `tracks.ts`): „Nový zamestnanec" → `novy-zamestnanec`.
 */
export function slugifyTrackKey(title: string): string {
  return slugifyKey(title).replace(/_/g, "-")
}

export function slugifyKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

/**
 * Návrh kódu organizácie z názvu (ADR-010, ADMIN.md úloha 1.4).
 *
 * Iniciály slov bez diakritiky: „Stredoslovenská vodárenská spoločnosť" → `SVS`.
 * Jednoslovný názov dá prvé tri písmená („Contineo" → `CON`) — dve písmená
 * sú minimum `CODE_PATTERN`, tri sa lepšie čítajú. Krátke spojky sa
 * vynechávajú: „a", „v", „na" v skratke nikto nečaká.
 *
 * **Je to návrh, nie pravidlo.** Organizácie svoju skratku spravidla majú
 * (`SFZ`, `StVPS`) a tá má prednosť — admin pole prepíše. Preto je to čistá
 * funkcia bez databázy: kolíziu rieši volajúci proti zoznamu obsadených kódov
 * (`withoutCollision()`), poslednou bránou zostáva zápis.
 */
const CODE_SKIP = new Set(["a", "i", "v", "vo", "na", "pre", "the", "and", "of", "sro", "as"])

export function suggestCompanyCode(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter(w => !CODE_SKIP.has(w.toLowerCase()))

  if (words.length === 0) return ""
  const code = words.length === 1
    ? words[0].slice(0, 3)
    : words.map(w => w[0]).join("").slice(0, 8)
  return code.toUpperCase()
}

/**
 * Prvý voľný variant návrhu. Obsadený kód dostane číslo (`SVS` → `SVS2`),
 * aby admin nemusel hádať, ktorý je voľný. Pri dvojznakovom návrhu tak
 * vznikne trojznakový — obe tvar `CODE_PATTERN` spĺňajú.
 */
export function withoutCollision(code: string, used: string[]): string {
  if (!code) return ""
  const taken = new Set(used.map(c => c.trim().toUpperCase()))
  if (!taken.has(code)) return code
  for (let i = 2; i < 100; i++) {
    const next = `${code}${i}`.slice(0, 24)
    if (!taken.has(next)) return next
  }
  return code
}
