# KANAL — widget, výber zdrojov a hlavička odpovede

Referencia: `KANAL-widget-zdroje.html` (živé rámy `?f=default|open|openOne|changed|running|single`). Zadanie: `docs/design/KANAL-widget-zdroje-zadanie.md`. Vzor: `ASK-zdroje-hladania`. Kód: `lib/widgetScript.ts`, `app/api/widget/[channel]/chat/route.ts`, ADR-028, ADR-029, D174.
Rámy: panel 400 × 600 a mobil 390 (celá obrazovka), svetlá téma. Tmavá sa nekreslí, widget ju nemá.

## Čo sa mení

1. **Pás zdrojov** medzi hlavičkou (`.head`) a rozhovorom (`.log`): tiché tlačidlo „Zdroje: Knižnica, Sportnet dokumentácia ▾" (`.button--quiet.button--sm`, výška 44 px, `aria-expanded`). Zdroje sú vždy vymenované v poradí z nastavenia kanála, nikdy „všetky". Keď sa text nezmestí, skráti sa tromi bodkami a celý je v `aria-label`.
2. **Výber v paneli** (Q1 A). Po kliknutí sa pod pásom rozbalí karta `.form-list` > `label.form-row.select-row` s natívnym checkboxom. Rozhovor sa odsunie nadol, neprekrýva sa. Pätka: „Platí od ďalšej otázky." a tiché „Hotovo", ktoré výber zatvorí (Esc tiež). Plné ostáva len „Odoslať".
3. **Aspoň jeden zdroj.** Posledný zapnutý riadok je `disabled` (`.form-row:has(> input:disabled)` = 50 %) a pätka povie „Aspoň jeden zdroj ostáva zapnutý." Tu sa riadok zamyká, nie tlačidlo ako na `/ask`, lebo „Hotovo" nič neodosiela a výber nesmie byť nikdy prázdny.
4. **Zmena nič nespúšťa.** Výber sa pošle s ďalšou otázkou: `POST /chat { query, language, sources: [...] }`.
5. **Oznam pri poslednej odpovedi** (Q2 A). Keď sa výber líši od zdrojov poslednej odpovede, pod ňou je `.lnote--info` „Zdroje sa zmenili. Táto odpoveď je len z dokumentov SFZ." a tiché „Opýtať sa znova". To pošle tú istú otázku s novým výberom ako novú správu, staré sa nemažú. Návrat k pôvodnému výberu oznam skryje. Pri starších odpovediach sa nekreslí.
6. **Hlavička každej odpovede** (`.a-head`, 12.5 px, `--muted`, 600) menuje, v čom sa hľadalo (Ján 23. 10. 2026). Kreslí sa aj vtedy, keď zo zdroja nič neprišlo:
   - „Odpoveď z dokumentov SFZ"
   - „Odpoveď z dokumentov SFZ a zo zdroja Sportnet dokumentácia"
   - „Odpoveď zo zdroja Sportnet dokumentácia"

   Znenie je rovnaké ako na `/ask`. Pod odpoveďou ostáva „Zdroje" a palce ako dnes.
7. **Počas písania** je pás zdrojov `disabled` (ako „Odoslať" dnes cez `busy`). Hlavička už menuje zdroje behu.
8. **Jediný povolený zdroj** = pás sa nekreslí. Hlavička odpovede ostáva.

Vzor SwiftUI: `DisclosureGroup` s riadkami `List(selection:)`. Rozbalí sa na mieste, lebo 400 px panel nemá miesto na `.popover` ani druhú `.sheet`. Hodnota v tlačidle je ako pri `Picker(.menu)`.

## Rozhodnuté

Rozhodnuté 23. 10. 2026 — Q1–Q5 podľa A, odchýlky W1–W5 podľa odporúčaní (používateľ).

- **Q1 — kde je výber.** A: pás pod hlavičkou, rozbalí sa v paneli · B: ikona pri poli otázky.
  **Rozhodnuté: A** — výber je vidieť ešte pred otázkou a v 400 px nie je miesto na popover.
- **Q2 — po zmene zdrojov.** A: platí od ďalšej otázky a pri poslednej odpovedi je tiché „Opýtať sa znova" · B: len od ďalšej otázky.
  **Rozhodnuté: A** — je to rovnaké pravidlo ako na `/ask` a nič sa nespustí samo.
- **Q3 — predvolené zdroje kanála.** A: všetky povolené zapnuté · B: nové pole „zapnuté predvolene" pri každom zdroji.
  **Rozhodnuté: A** — widget dnes hľadá vo všetkých, takže pre ISSF sa bez zásahu nič nemení.
- **Q4 — rozsahy konektora.** A: jeden riadok za konektor (všetky jeho povolené rozsahy spolu) · B: riadok za každý rozsah.
  **Rozhodnuté: A** — človek pozná „Sportnet dokumentácia", nie rozsah.
- **Q5 — uloženie výberu.** A: platí počas otvoreného panela · B: pamätať v prehliadači.
  **Rozhodnuté: A** — widget nemá účet a pamätanie v prehliadači cudzej stránky by prekvapilo.

Poznámka k názvom: ovládač hovorí „Knižnica" (ako na `/ask`), hlavička hovorí „dokumentov SFZ" (zadanie, Ján). Podnadpis riadku „Predpisy a dokumenty SFZ" ich spája, takže druhú otázku netreba.

## Pravidlá prenesené do štýlov widgetu

Shadow DOM `globals.css` nedostane. Do `style.textContent` v `widgetScript.ts` sa prenesie:

- **Tokeny na `:host`** so svetlými hodnotami z `:root`: `--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--line-strong`, `--control-line`, `--on-accent`, `--ok-bg`, `--ok-fg`, `--fs-small`. `--accent` ostáva z `CFG.accent`. Dnešné pevné farby (`#1f2937`, `#e5e7eb`, `#d1d5db`, `#6b7280`, `#f6f7f9`) nahradiť tokenmi.
- **Tlačidlá:** `.button`, `.button:hover`, `.button:focus-visible`, `.button:disabled`, `.button--quiet` (+ `:hover`), `.button--sm`. Terč 44 px v paneli platí na všetkých šírkach (`.button--sm` má 36 px, zvýšenie robí `.scope-bar .button`, `.scope-foot .button`, `.lnote--action .button`).
- **Riadky:** `.form-list`, `.form-row`, `.form-row + .form-row::before`, `.select-row + .select-row::before`, `.form-row:hover`, `.form-row:has(> input:focus-visible)`, `.form-row > input`, `.form-row > input:focus-visible`, `.form-row:has(> input:disabled)`, `.form-row-main`, `.form-row-sub`, `.select-row > input` (+ `:checked`, `:checked::after`).
- **Oznam:** `.lnote`, `.lnote-mark`, `.lnote-text`, `.lnote--info` (+ `.lnote-mark`, `.lnote-text`).

Pravidlá sa kopírujú doslova a menia sa iba spolu s `globals.css`. Do `tests/` patrí test, ktorý porovná hodnoty tokenov v `widgetScript.ts` s `:root` v `globals.css`.

## Odchýlky od systému

- **W1 — `.btn.quiet` widgetu ≠ `.button--quiet`.** Widget má tiché tlačidlo s okrajom a textom farby organizácie, systém má okraj `--line-strong` a text `--ink`. **Odporúčanie:** nahradiť `.btn`/`.btn.quiet` prenesenými `.button`/`.button--quiet`, aby tiché vyzeralo všade rovnako. Týka sa aj tlačidla ticketu.
- **W2 — `.lnote` s tlačidlom** (rovnaké ako O2 v `ASK-zdroje-hladania`): `.lnote--action { align-items:center; flex-wrap:wrap }`, `.lnote-text { flex:1 1 180px }`. **Odporúčanie:** ak už je `.lnote--action` v `globals.css` z PR #418, preniesť ju; inak ju tam pridať.
- **W3 — karta riadkov.** `.scope-card` je lokálne (okraj `--line`, polomer 10), lebo `.card` + `.form-group-body--rows` nesie odsadenia stránky. **Odporúčanie:** preniesť len `.card` bez paddingu, nepridávať novú triedu do systému.
- **W4 — hlavička odpovede.** `.answer-head` / `.answer-kicker` z `/ask` majú značku a čas, ktoré sa do bubliny nezmestia. `.a-head` je iba text (12.5 px, 600, `--muted`). **Odporúčanie:** nechať lokálne vo widgete.
- **W5 — palce** majú výšku 36 px pod terčom 44 px (dnešný stav, mimo rozsahu). **Odporúčanie:** zvýšiť na 44 px pri tejto úprave.

## Údaje a API, ktoré neexistujú

- `GET` konfigurácia widgetu (`/script`) neposiela zoznam povolených zdrojov. Treba pridať `CFG.sources: [{ id, name, sub }]`: Knižnica + verejné konektory z `connectorScopes` (D174), zlúčené za konektor (Q4 A).
- `POST /chat` neprijíma `sources`. Treba pridať validáciu (len podmnožina povolených, prázdne alebo neznáme = všetky povolené) a zúženie `narrow` podľa výberu.
- Udalosť `done` neposiela zdroje behu. Treba poslať `searchedScope`, z ktorého widget poskladá hlavičku. Ten sa uloží aj do záznamu odpovede (ako `/ask`, PR #418).
- Texty (`dictionary().widget`, sk/cs/en): `scopeButton(names)`, `scopeDone` „Hotovo", `scopeHint` „Platí od ďalšej otázky.", `scopeLast` „Aspoň jeden zdroj ostáva zapnutý.", `scopeChanged(kicker, only)`, `reask` „Opýtať sa znova", `answerFrom*` (rovnaké kľúče ako `/ask`), `scopeLibrarySub`, `scopeLiveSub`.

🔴 Zmena schémy: **žiadna** (`searchedScope` v zázname podľa PR #418).

## Prompt pre Claude Code

```
stiahni design

Implementuj design_handoff_contineo_intranet/KANAL-widget-zdroje.html + .md.
Q1–Q5 rozhodnuté podľa A, W1–W5 podľa odporúčaní. Prečítaj widgetScript.ts, api/widget/*,
docs/design/KANAL-widget-zdroje-zadanie.md, ADR-028/029, PR #418 (/ask).

1. script route: CFG.sources (Knižnica + verejné konektory kanála, jeden za konektor).
2. chat route: prijať sources[], overiť proti povoleným, zúžiť narrow; v done
   poslať searchedScope a uložiť ho do záznamu.
3. widgetScript.ts: tokeny na :host, prenesené pravidlá (.button*, .form-row*,
   .select-row, .lnote*); pás zdrojov pod .head (skryť pri 1 zdroji), rozbalenie
   v paneli s „Hotovo", posledný zapnutý disabled, počas busy disabled.
4. .a-head v každej odpovedi podľa searchedScope; .lnote--info + „Opýtať sa znova"
   pod poslednou odpoveďou, keď výber ≠ jej zdroje.
5. W1: .btn → .button; W5: palce 44 px. i18n sk/cs/en. Zapíš do docs/DEVLOG.md.
Overenie: tsc, eslint, vitest (+ test tokenov widget = globals.css), build;
panel 400 a 390 px; klávesnica (Tab, medzerník, Esc).
```
