# Plán: univerzálny pozicioning webu (futbal = len ukážka)

> **Stav:** plán na schválenie (2026-06-29). **Žiadne zmeny zatiaľ nevykonané** v `web/`.
> **Cieľ:** aby contineo.app pôsobil ako univerzálna aplikácia pre ľubovoľnú organizáciu; futbal/SFZ má ostať len ako **konkrétna ukážka nasadenia do veľkej organizácie**, nie ako doména produktu.
> **Princíp:** nemazať názorné príklady (predávajú konkrétnosťou), ale jasne ich **označiť ako ukážku** a opraviť miesta, kde sa všeobecná schopnosť produktu omylom popisuje futbalovým slovníkom.

---

## Čo je už univerzálne (netreba meniť)

`brand-messaging.md`, hero/claim, `modes` (režimy nasadenia), `security` (sekcia na hlavnej), `audience` („Firmy a inštitúcie", „organizácie s množstvom obsahu"), `roadmap`. Hlas značky je v poriadku.

## Dotknuté súbory

`web/lib/dictionaries.js` (SK aj EN vetva), `web/components/Tech.js`, `web/components/BotDemo.js`.

---

## Tier 1 — Opraviť (všeobecná schopnosť popísaná futbalom)

Tu produkt popisuje svoju schopnosť, ale natvrdo cez „zväzy SFZ". To je zavádzajúce a treba zovšeobecniť (futbal max. ako príklad v zátvorke).

**1.1 Tech pilier „Multi-tenant a bezpečnosť"** — `dictionaries.js` (SK ~199 / EN ~529)
- SK starý: „Hierarchia zväzov (SFZ → regionálny → oblastný) ako samostatné organizácie. Verejné normy vidia všetci; interný obsah len príslušníci daného zväzu. Audit pri každej zmene znalostí."
- SK nový: „Hierarchia organizácií (centrála → regionálne → lokálne jednotky) ako samostatní tenanti. Verejný obsah vidia všetci; interný obsah len príslušníci danej jednotky. Audit pri každej zmene znalostí."
- EN nový: „A hierarchy of organisations (headquarters → regional → local units) as separate tenants. Public content is visible to everyone; internal content only to members of that unit. Audit trail on every knowledge change."

**1.2 Security list — multi-tenant riadok** — `dictionaries.js` (SK ~273 / EN ~603)
- SK starý: „Multi-tenant hierarchia (SFZ → regionálny → oblastný): verejné normy vidia všetci, interný obsah je oddelený per organizácia."
- SK nový: „Multi-tenant hierarchia (centrála → regionálne → lokálne jednotky): verejný obsah vidia všetci, interný obsah je oddelený per organizácia."
- EN obdobne.

**1.3 Security list — prístup** — `dictionaries.js` (SK ~269 / EN ~599)
- SK starý: „Prístup podľa príslušnosti k zväzu/klubu a skupín (automaticky zo sportnet.online)…"
- SK nový: „Prístup podľa príslušnosti k organizácii/jednotke a skupín (z pripojeného zdroja identity, napr. sportnet.online v športe)…"

**1.4 Pilier „Vstupné kanály"** — `dictionaries.js` (SK ~200)
- Drobnosť: „PDF normy" → „PDF dokumenty a predpisy"; vetu o Sportnet.online ponechať ako príklad zdroja identity.

---

## Tier 2 — `/technologia`: ponechať príklad, pridať rámovanie (odporúčané)

Stránka `/technologia` je technický deep-dive a futbalový príklad je tu názorný. Namiesto prepisovania všetkého pridať **jeden jasný banner**, že ide o ukážku.

**2.1 Nový text v `dictionaries.js` → `tech`** (SK+EN), napr. kľúč `exampleNote`:
- SK: „Príklady na tejto stránke (sekcie, značky, dotazy) vychádzajú z jedného reálneho nasadenia — športového zväzu. Contineo je doménovo univerzálne; „norma" je len jeden druh dokumentu a „zväz" len jeden druh organizácie."
- EN: „The examples on this page (sections, tags, queries) come from one real deployment — a sports association. Contineo is domain-agnostic; a „regulation" is just one kind of document and an „association" just one kind of organisation."

**2.2 `Tech.js`** — vykresliť `t.exampleNote` ako info-pruh hneď pod hero podtitulom (1 odsek, štýl `muted`). Bez ďalších zásahov do kódových ukážok.

> Po tomto rámovaní môžu sekcie (`Číselník sekcií`, `Rozsah platnosti`, kódové bloky `DOC_CHUNKS`/`TICKETS`/`VECTOR_QUERY`/`TAG_EXAMPLES`) ostať ako konkrétny príklad.

---

## Tier 3 — Demo bot: označiť ako ukážku

**3.1 `BotDemo.js`** (tag „SsFZ" ~227) + FAQ dáta (`dictionaries.js` ~673–711, hráč/prestup).
- Ponechať obsah (funkčné demo), ale pridať vizuálny štítok „Ukážka / Demo" a kontext, že ide o vzorové dáta športového zväzu.
- `appliesAll` (SK ~115 / EN ~445): „platí pre všetkých (SFZ)" → „platí pre všetkých (celá organizácia)".

---

## Tier 4 — Voliteľné (väčší zásah, len ak chceš)

Plné zovšeobecnenie `/technologia` do neutrálnej domény (centrála/pobočky, „dokument" namiesto „norma", generické sekcie číselníka) a presun futbalu do samostatného bloku „Case study: športový zväz". Vyšší objem prepisu SK+EN; odporúčam až ako druhý krok, ak Tier 1–3 nebude stačiť.

---

## Odporúčaný rozsah

**Tier 1 + Tier 2 + Tier 3.** Rieši vnímanie „len pre futbal" s nízkym rizikom, zachová názorné príklady a je rýchlo spätné. Tier 4 nechať ako rezervu.

## Otvorené pre teba
1. Schvaľuješ rozsah **Tier 1–3**, alebo chceš aj **Tier 4** (plné zovšeobecnenie)?
2. Pri identite: spomínať sportnet.online ako *príklad* (odporúčam), alebo ho z všeobecných formulácií vypustiť úplne?
