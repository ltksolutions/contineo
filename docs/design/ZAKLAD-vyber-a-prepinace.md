# Základ — výbery a prepínače podľa SwiftUI

Referencia: `ZAKLAD-vyber-a-prepinace.html`. Základ: `ZAKLAD.md`, `HR-pridelit-nadpis-karty.md` (vzor `.form-group`), `ZAKLAD-podmenu-a-akcie`.

## Čo sa mení

Zaškrtávacie políčka a krúžky v predvolenom vzhľade prehliadača sa nahradia štyrmi prvkami podľa toho, **čo sa vyberá**. V HTML ostáva natívny `input` (mená, hodnoty, `required`, bez JS, Tab/medzerník, čítačka) — mení sa vzhľad (`appearance: none`) a riadok.

| Čo sa vyberá | SwiftUI | V aplikácii |
| --- | --- | --- |
| zapnuté / vypnuté | `Toggle` | `input type=checkbox role="switch"` + `.toggle` vpravo v riadku, 46×28 px, zapnutý `--accent` |
| niekoľko zo zoznamu | `List(selection:)` | `input type=checkbox` + `.select-row`: kruh 22 px vľavo, vybraný plný `--accent` s bielou fajkou |
| jedna z 2–5 | `Picker(.inline)` | `input type=radio` + `.choice-row`: fajka `--accent` vpravo; pole voľby (dátum, dni) pod zvoleným riadkom |
| jedna z mnohých | `Picker(.menu)` | natívny `<select>` v riadku, hodnota vpravo s ⌃⌄ |
| pohľad | `Picker(.segmented)` | `.view-switch` — len pohľad, nie vo formulári (bez zmeny) |
| áno/nie s významom (posudok) | `LabeledContent` + `Picker(.segmented)` | `.seg` — dve natívne rádiá v riadku vedľa otázky; nezvolený sivý, zvolený farba a fajka podľa významu. Nie `.view-switch` (EVAL-posudok, výnimka schválená Jánom 8. 10. 2026) |

**Riadok** (`.form-row`, ako `List` row): celý riadok je `<label>`, min. 44 px, `padding: 9px 16px`, oddeľovač `--line` odsadený zľava (pri kruhu 50 px), hover `--surface-2`, `:focus-visible` obrys `--accent` na riadku. Riadky sú v `.form-group-body` bez vnútorného odstupu.

## Kde

- **/hr/assign** — normy, trasy, skupiny, osoby: `.select-row`; „Všetkým v organizácii": `.toggle` (zapnutý stlmí zvyšok Komu ako dnes); termín: `.choice-row`; oddelenia ostávajú `MultiSelect` (riadok s hodnotou „2 vybrané").
- **Testy, kurzy** (`.mc-group`) — pravidlá áno/nie: `.toggle`; výber zdrojov/skupín/trás: `.select-row`.
- **/evaluation** Zdroje, **/library/[id]** Komu, **/people/[id]** Trasy, Roly: `.select-row`. Termín v `/library/[id]`: `.choice-row`.
- **Nastavenia** (`.set-sec`) — áno/nie voľby: `.toggle`; jazyk, rola: `Picker(.menu)`.
- `.tag--choice` (pilulky) sa vo formulároch nahradí `.select-row`; ako štítok na čítanie ostáva.

## Prečo

Jeden vzhľad pre tri rôzne veci (zapnúť nastavenie, vybrať položky, zvoliť jednu možnosť) — človek nevie, či zaškrtnutie niečo hneď zmení, alebo len pridá do výberu. SwiftUI to rozlišuje tvarom; malé štvorčeky 17 px sú navyše na telefóne pod 44 px terčom.

## Rozhodnutia v repozitári

- `hr/assign/page.tsx` (hlavička): „zaškrtávacie políčka, nie `select multiple`" — **dodržané**, ostávajú natívne checkboxy, mení sa len vzhľad.
- Formulár bez JavaScriptu — dodržané, všetko je CSS nad `input`.
- `.view-switch` len pre pohľad (ZAKLAD-podmenu-a-akcie) — segmented sa do formulára nedáva. **Výnimka 8. 10. 2026:** `.seg` pri áno/nie s významom v posudku (`Rating`) — farba po voľbe ho odlišuje od `.view-switch`.

## Rámy

- Katalóg prvkov (Toggle, výber A / B, inline picker, menu picker).
- **1440 / 834 / 390** — /hr/assign s novými prvkami.

## Údaje, ktoré v modeli neexistujú

Žiadne. Schéma bez zmeny.

## Rozhodnuté (6. 10. 2026)

- **Q1** Výber viacerých: **A** — kruh vľavo. Variant B (fajka vpravo) sa nepoužíva pre výber viacerých, len pre jednu voľbu (`.choice-row`).
- **Q2** „Všetkým v organizácii" = prepínač.
- **Q3** Pilulky `.tag--choice` vo formulároch → `.select-row`.
- **Q4** Prepínač sa uloží formulárom (tlačidlom), nie hneď.

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** Výber viacerých: **A** kruh vľavo, alebo **B** fajka vpravo? **Odporúčam A** — prázdny kruh ukazuje, že sa dá vybrať; pri B nevybraný riadok nevyzerá ako ovládač.
- **Q2** „Všetkým v organizácii" ako prepínač? **Odporúčam áno** — je to stav celého publika („prebije výber nižšie"), nie položka zoznamu.
- **Q3** Pilulky `.tag--choice` (trasy, skupiny) nahradiť riadkami? **Odporúčam áno** — jeden vzor pre výber viacerých; pilulky ostanú len na zobrazenie.
- **Q4** Pri `role="switch"` sa prepínač vo formulári odošle až tlačidlom (nie hneď ako v iOS). **Odporúčam ponechať** — web ostáva webom, stav sa ukladá formulárom; hneď sa ukladá len tam, kde to stránka robí už dnes.
-->

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/ZAKLAD-vyber-a-prepinace.html + .md.
Najprv HR-pridelit-nadpis-karty (.form-group) — riadky sedia v .form-group-body.
1. globals.css: .form-row, .select-row (kruh vľavo), .choice-row (fajka vpravo), .toggle,
   .form-row--menu. input appearance:none, natívny input ostáva (name/value/required/checked).
   Terč 44 px, :focus-visible na riadku, tmavá téma cez tokeny.
2. Nasaď podľa sekcie „Kde" v .md; .tag--choice vo formulároch → .select-row.
3. Toggle: <input type="checkbox" role="switch">. Bez JS musí všetko fungovať ako dnes.
Overenie: tsc, eslint, vitest, build; 1440 svetlá + 390 tmavá; ovládanie len klávesnicou;
VoiceOver ohlási „prepínač" / „začiarkavacie políčko".
```
