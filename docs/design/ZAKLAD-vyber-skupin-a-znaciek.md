# ZAKLAD — výber skupín a značiek (DESIGN_ODCHYLKY P8)

> **Stav: rozhodnuté 8. 10. 2026** — Q1–Q6 podľa odporúčania (Q6 = jedno pole „Hľadať alebo pridať"), pripravené na implementáciu.

Referencia: `ZAKLAD-vyber-skupin-a-znaciek.html`. Základ: `ZAKLAD.md`, `ZAKLAD-vyber-a-prepinace.md` (`.select-row`, pilulky preč z formulárov), `HR-pridelit-nadpis-karty.md` (`.form-group`), `KOMPONENT-hladanie-osob.md` (hľadanie nad riadkami). Zdroj: `components/TagSelect.tsx`, `people/[id]/page.tsx`, `library/[id]/page.tsx`, `library/new/page.tsx`, `library/new/faq/page.tsx`, `lib/codelists.ts`, `lib/libraryRead.ts` (`tagOptions`), `lib/persons.ts` (`normalizeKeys`, `audiencesInOrg`).

Je to **rozdiel oproti existujúcim obrazovkám**. Mená polí (`groups`, `tags`) a význam ostávajú.

## Čo sa mení

`TagSelect` (pilulky `.tag--choice`, stav v Reacte, skryté pole `"a, b"`, bez JS holé textové pole) sa nahradí serverovým komponentom **`ValueSelect`**: `fieldset.form-group` → `legend.form-group-head` → `div.card.form-group-body.form-group-body--rows` → `.form-list` s riadkami a `p.form-group-foot`.

| Prvok | Tvar |
| --- | --- |
| Existujúca hodnota | `label.form-row.select-row` > `input type=checkbox name="groups" value="rozhodcovia"` + `span.form-row-main` (názov) + `span.form-row-detail` (počet) |
| Počet | tlmený text vpravo: „14 ľudí", „6 dokumentov" (iOS `List` detail) |
| Len táto osoba / dokument | zaškrtnutá, namiesto počtu `span.form-row-detail.is-only` „len tu" (`--warn-fg`) |
| Hodnota mimo číselníka (značky) | podnadpis `form-row-sub` „nie je v číselníku", zobrazí sa kľúč |
| Hľadať alebo pridať | **jedno pole** `.sel-combo` navrchu karty, `input type=search name="groupsNew"` / `"tagsNew"`, placeholder „Hľadať alebo pridať skupinu" (prázdny zoznam: „Pridať skupinu"); pri každom počte možností (Q6) |
| S JS | písanie filtruje riadky (bez diakritiky, case-insensitive, zaškrtnuté ostávajú). Keď sa text presne nezhoduje so žiadnou hodnotou, pod riadkami pribudne `label.form-row.select-row.is-add` „+ Pridať „komisari"" · `form-row-sub` „nová skupina". Ťuknutie alebo Enter: ostrovček vloží zaškrtnutý `checkbox name="groups" value="komisari"` medzi riadky a pole vyprázdni. Pri presnej zhode Enter zaškrtne existujúci riadok |
| Bez JS | vidno všetky riadky; napísaný text (viac hodnôt čiarkou) sa odošle s formulárom ako nová hodnota a server ho porovná s existujúcimi (podobný názov nižšie) |
| Poradie | zaškrtnuté hore, potom abecedne (Q4) |
| Prázdne | len riadok s poľom; pätička „Zatiaľ žiadna skupina — vznikne prvou, ktorú napíšete." |
| Podobný názov | `.sel-warn` v karte pod riadkami (pozri nižšie) |

**Server** (`savePersonAction`, ukladanie dokumentu): `fd.getAll("groups")` + `split(",")` z `groupsNew` → `normalizeKeys()` ako dnes. Kvôli prechodu prijme aj starý tvar `groups="a, b"`.

**Podobný názov — bez JS:** nová hodnota z `groupsNew` / `tagsNew`, ktorá sa po odstránení diakritiky zhoduje s existujúcou alebo sa od nej líši o jedno písmeno (Levenshtein ≤ 1, len pri dĺžke ≥ 5), sa **neuloží**. Všetko ostatné sa uloží a server presmeruje s `?similar=<hodnota>&like=<existujúca>`. V karte sa ukáže `.sel-warn`:

> Skupinu **„rozhodcova"** sme neuložili: podobá sa na existujúcu **„rozhodcovia"** (14 ľudí). Ostatné údaje osoby sú uložené.
> [Pridať do „rozhodcovia"] [Založiť „rozhodcova"]

Obe tlačidlá sú tiché, každé je malý formulár (`addGroupAction` s `value` a `force=1` pri založení). Na dokumente je to isté s `addTagAction`. (Q3)

**Nové triedy:**

```css
.form-row-detail { color: var(--muted); font-size: 14px; white-space: nowrap; }
.form-row-detail.is-only { color: var(--warn-fg); }
.form-row.is-add .form-row-main > span { color: var(--accent); font-weight: 600; }
.form-row.is-add::before { /* prerušovaný kruh 22 px s „+" na mieste checkboxu */ }
.sel-combo { display: flex; align-items: center; gap: 9px; height: 40px; margin: 10px 12px 6px; padding: 0 12px; border-radius: 10px; background: var(--bg); border: 1px solid var(--line); }
.sel-warn { display: grid; gap: 10px; padding: 12px 16px 14px; background: var(--warn-bg); border-top: 1px solid rgba(180,83,9,.25); }
@media (max-width: 639px) { .sel-combo { height: 44px; } }
```

## Kde

| Obrazovka | Pole | Počet vpravo | Pätička |
| --- | --- | --- | --- |
| `/people/[id]` | `groups` + `groupsNew` | ľudí (`audiencesInOrg().groups[].count`) | „Nová skupina vznikne uložením osoby." |
| `/library/[id]` (úprava údajov) | `tags` + `tagsNew` | dokumentov | „Nová značka vznikne uložením dokumentu a pribudne do číselníka organizácie." |
| `/library/new` krok Údaje | `tags` + `tagsNew` | dokumentov | „Nová značka vznikne uložením dokumentu." |
| `/library/new/faq` | `tags` + `tagsNew` | dokumentov | ako vyššie |

Na `/people/[id]` sa skupina presúva z `div.field` medzi poliami do `fieldset.form-group` nad **Trasy**, takže tri výbery (Skupiny, Trasy, Roly) majú ten istý tvar. `TagSelect.tsx` a CSS `.tags`, `.tags-list`, `.tags-new`, `.tag--choice` sa po nasadení zmažú, ak ich nič iné nepoužíva.

## Prečo

- Pilulka je vo vizuálnom jazyku aplikácie štítok **na čítanie**. Vo formulári nie je jasné, či ťuknutie niečo vyberie alebo niekam vedie, a „+"/„✓" s počtom je na telefóne pod 44 px.
- Bez JS dnes zostane textové pole s čiarkami. To je presne pasca, kvôli ktorej `TagSelect` vznikol („rozhodcovia" vs. „rozhodcova").
- Desiatky skupín v rade pilulií sa nedajú prehľadať. Riadky s hľadaním sa správajú ako výber osôb.

## Rozhodnutia v repozitári — dodržané

- **Číselník skupín zámerne nie je, zoznam sa odvodzuje z ľudí** (D38, hlavička `TagSelect.tsx`, `people/[id]`) — dodržané: nová skupina vznikne uložením osoby.
- **Hodnota, ktorú má len táto osoba, sa nesmie uložením ticho stratiť** (`TagSelect.tsx`, rovnako `orphanTracks` pri trasách) — dodržané: je v zozname a zaškrtnutá s „len tu".
- **Napísať novú sa dá, ale vedome — samostatné pole, nie preklep v zozname** (`TagSelect.tsx`) — dodržané: samostatný riadok s poľom. Varovanie pri podobnom názve to ešte posilňuje.
- **Normalizácia `trim().toLowerCase()`** (`normalizeKeys`) — bez zmeny.
- **Značky sú otvorený číselník, kľúč má tvar `KEY_PATTERN`** (`lib/codelists.ts`, malé písmená bez diakritiky, „rastie cez governance") — dodržané. Pre novú značku z formulára pozri Q2.
- **`MultiSelect` zostáva pre oddelenia** (strom, hľadanie) — tento návrh ho nemení.

## Rámy

- **1440 svetlá**: `/library/[id]` úprava údajov (5 značiek: 1 z číselníka zaškrtnutá, 1 mimo číselníka „len tu") · `/people/[id]` so 14 skupinami a hľadaním „ko" · varovanie „rozhodcova" ≈ „rozhodcovia".
- **390 tmavá**: `/people/[id]` (2 skupiny, 1 zaškrtnutá, vyplnená nová „komisari") · `/library/new` krok Údaje (5 značiek, 2 zaškrtnuté) · prázdny zoznam.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `List(selection:)` + `Section` | `.form-group` + `.select-row` |
| `LabeledContent` / detail text | `.form-row-detail` (počet, „len tu") |
| `.searchable` + `searchSuggestions` | `.sel-combo` „Hľadať alebo pridať" + riadok „+ Pridať" |

## Údaje, ktoré v modeli neexistujú

- **Počet dokumentov pri značke**: `tagOptions()` vracia len `{ value }`. Treba agregáciu `documents` podľa `tags` (`$unwind` + `$group`, jedna požiadavka), vrátiť `{ value, label, count }`. `label` z `codelistOptions("tags")`; pri hodnote mimo číselníka `label` chýba.
- **Návrh podobnej hodnoty**: nová čistá funkcia `similarValue(newValue, existing[])` (bez diakritiky, Levenshtein ≤ 1 od dĺžky 5). Nič sa neukladá.
- Ostatné (počet ľudí v skupine) už existuje v `audiencesInOrg()`.

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** Nový serverový `ValueSelect` s natívnymi checkboxmi; JS len na hľadanie. `TagSelect` sa ruší.
- **Q2** Nová značka: server z názvu urobí kľúč (ako `KeyFromLabel`) a založí položku v číselníku organizácie s názvom.
- **Q3** Podobný názov: neuloží sa len nová hodnota, zvyšok áno; varovanie `?similar=&like=` s dvoma tichými voľbami.
- **Q4** Poradie: zaškrtnuté hore, ostatné abecedne.
- **Q5** ~~Hľadanie od 12 možností~~ — nahradené Q6.
- **Q6** Hľadanie a nová hodnota v jednom poli „Hľadať alebo pridať" navrchu karty, pri každom počte možností. Vzor `.searchable(text:tokens:suggestedTokens:)` / `searchSuggestions`; žetóny (pilulky) sa nekreslia, vybrané hodnoty sú zaškrtnuté riadky.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — Komponent ako serverový `ValueSelect` (natívne checkboxy, JS len na hľadanie), nie úprava `TagSelect`?
  **Odporúčam áno.** Bez JS bude fungovať rovnako ako s ním, a to sa pri dnešnom klientskom stave so skrytým poľom nedá dosiahnuť.
- **Q2** — Nová značka z formulára dokumentu: server z napísaného názvu urobí kľúč (ako `KeyFromLabel`, „Štart hráča" → `start_hraca`) a založí položku v číselníku organizácie s týmto názvom?
  **Odporúčam áno.** Dnes nová značka vznikne len ako kľúč na dokumente, bez názvu. V číselníku ju nevidno a ak niekto napíše „Štart hráča", `checkValue` ju odmietne pre tvar kľúča.
- **Q3** — Pri podobnom názve neuložiť len túto novú hodnotu, uložiť zvyšok a ukázať varovanie s dvoma tichými voľbami (`?similar=`)?
  **Odporúčam áno.** Bez JS sa formulár osoby po odoslaní nedá vrátiť s vyplnenými poliami. Takto sa nič nestratí a rozhodnutie je jedno ťuknutie.
- **Q4** — Poradie: zaškrtnuté hore, ostatné abecedne (nie podľa počtu)?
  **Odporúčam abecedne.** Pri desiatkach hodnôt sa skupina hľadá podľa mena. Poradie podľa počtu by sa menilo s každou osobou a človek by si ho nezapamätal.
- **Q5** — Hľadanie od 12 možností?
  **Odporúčam 12.** Je to zhruba jedna obrazovka telefónu. Pri menej riadkoch je pole navyše prekážka, pri viac už zoznam nedovidno.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ZAKLAD-vyber-skupin-a-znaciek.html + .md.
Vetva design/vyber-skupin-a-znaciek z main. DESIGN_ODCHYLKY P8.

1. components/ValueSelect.tsx (server): fieldset.form-group > legend > card
   form-group-body--rows > .form-list; riadky label.form-row.select-row s natívnym
   checkboxom name={name} value={key}; vpravo .form-row-detail (počet / „len tu");
   navrchu karty jedno pole .sel-combo input type=search name={`${name}New`}
   („Hľadať alebo pridať …"); .form-group-foot.
   Zaškrtnuté hore, ostatné abecedne. Hodnota, ktorú má len táto položka
   (count ≤ 1 a vybraná) alebo ktorá nie je v ponuke, je vždy v zozname a zaškrtnutá.
2. Ostrovček (pri každom počte): písanie filtruje riadky (bez diakritiky,
   case-insensitive, zaškrtnuté neskrýva); bez presnej zhody riadok .is-add
   „+ Pridať „…"" — ťuknutie/Enter vloží zaškrtnutý checkbox name={name} a pole
   vyprázdni; pri presnej zhode Enter zaškrtne existujúci. Bez JS nič neskrýva
   a text sa odošle ako {name}New.
3. globals.css: .form-row-detail, .is-only, .is-add, .sel-combo, .sel-warn
   (svetlá aj tmavá, 44 px na <640).
4. Server: groups = getAll("groups") ∪ split(groupsNew) → normalizeKeys; prijať aj
   starý tvar "a, b". Rovnako tags / tagsNew. similarValue() (bez diakritiky,
   Levenshtein ≤ 1 od dĺžky 5): podobnú novú hodnotu neuložiť, zvyšok uložiť,
   presmerovať s ?similar=&like=; v karte .sel-warn s dvoma tichými formulármi
   (pridať k existujúcej / založiť s force=1).
5. Značky: tagOptions → { value, label, count } (agregácia documents.tags + číselník).
   tagsNew: z názvu kľúč ako KeyFromLabel, založiť položku v číselníku organizácie
   s názvom (Q2), potom checkValue.
6. Nasadiť: people/[id] (Skupiny nad Trasy), library/[id], library/new, library/new/faq.
   TagSelect.tsx a CSS .tags*, .tag--choice zmazať, ak ich nič nepoužíva.
7. i18n sk/cs/en: počty (ľudí/dokumentov s plurálmi), „len tu", „nie je v číselníku",
   pätičky, prázdny stav, texty varovania.

Over 1440 svetlá + 390 tmavá, bez JS (vypnutý v prehliadači), len klávesnicou,
VoiceOver ohlási „začiarkavacie políčko". tsc, eslint, vitest (similarValue, zlúčenie
groups/groupsNew), build. Komentáre: odkaz na ZAKLAD-vyber-skupin-a-znaciek (7. 10. 2026).
Do DESIGN_ODCHYLKY P8 stav ✓ s dátumom.
```
