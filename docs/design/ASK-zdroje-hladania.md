# ASK — zdroje hľadania

Referencia: `ASK-zdroje-hladania.html` (rámy sú živé — `?f=default|sheet|changed|running|both|nolive`, `&theme=dark`). Základ: `ZAKLAD.md`, `ASK-otazka-z-hlavicky`, `ASK-odpoved-dva-stlpce`, `ZAKLAD-vyber-a-prepinace`.
Zdroj: `app/ask/page.tsx`, `components/Search.tsx` (pilulky rozsahu), `components/Answer.tsx`, `lib/answerKicker.ts`, `lib/liveSources.ts`, ADR-029.

## Čo sa mení

1. **Ovládač pod otázkou.** `.view-switch.ask-scope` s tlačidlami → `<details class="ask-scope">`, `summary.button.button--quiet.button--sm` „Zdroje: Knižnica ▾". Hodnota: jeden zdroj = jeho názov; všetky = „všetky"; inak „2 z 3".
2. **Plachta.** `<form method="get" action="/ask" class="filter-sheet-body">` s `.sheet-grip`, `.sheet-h` („Zdroje hľadania" · Zavrieť), skrytým `q` a `fieldset.form-group` „Hľadať v" > `.form-group-body--rows` > `.form-list` > `label.form-row.select-row` s natívnym `checkbox name="src"`. Podnadpis riadku: Knižnica „Dokumenty organizácie v Contineo", živý zdroj „Živý zdroj — hľadá sa priamo v ňom, obsah neprešiel kurátorom" (D174). Pod kartou `.form-group-foot`. Na konci jediné plné `button.filter-sheet-apply` „Opýtať sa znova".
   - < 640: spodná plachta nad `.ask-scrim`, hlavná lišta skrytá (ako pri `.ask-sheet--overlay`). Esc a závoj zavrú.
   - ≥ 640: ten istý obsah ako popover pod tlačidlom (odchýlka O1).
3. **Zmena nič nespúšťa.** Odškrtnutie / zaškrtnutie mení len výber. Volanie modelu je iba „Opýtať sa znova".
4. **Oznam.** Plachta zatvorená a výber ≠ zdroje zobrazenej odpovede → nad kartou odpovede `div.lnote.lnote--info` (`role="status"`): „Zdroje sa zmenili. Odpoveď nižšie je len z Knižnice." + `button.button.button--sm` „Opýtať sa znova". Návrat k pôvodnému výberu ho skryje. Kým je plachta otvorená, oznam sa nekreslí (plné tlačidlo je len jedno).
5. **Aspoň jeden zdroj.** Checkbox sa nezamyká (zamknutý by formulár neodoslal). Bez výberu: tlačidlo `disabled`, pätka „Vyberte aspoň jeden zdroj.", v tlačidle „Zdroje: žiadne". Server prázdny alebo neznámy `src` nahradí predvoleným výberom.
6. **Hlavička odpovede** (`answerKicker`) dostane **zdroje, s ktorými sa naozaj pýtalo** (`askedScope`, nastaví sa v `send()`), nie živý výber. Dnes `Search` posiela `only` → po prepnutí by hlavička klamala.
7. **Počas písania** je ovládač `button … disabled` (nie `<details>`), hlavička už menuje zdroje behu.
8. **Organizácia bez živého zdroja:** ovládač sa nekreslí (ako dnes `liveSources.length > 0`).
9. **Adresa:** `?src=library,<id>` vzniká odoslaním formulára. `page.tsx` číta `src` **opakovane aj s čiarkami** (`getAll` + `split(",")`) — bez JS prehliadač pošle `src=library&src=sportnet`. Po zápise ostáva `/ask/a/{id}` ako dnes.

## Prečo

`.view-switch` je „ako to vidím" — jedna voľba z niekoľkých, mení pohľad na to isté. Zdroje sú niekoľko z niekoľkých a menia odpoveď, teda iný vstup. A každý klik bol volanie modelu: kto chcel zapnúť dva zdroje, zaplatil dve odpovede a prvú ani nečítal. Výber, potom jedno vedomé opýtanie.

Vzor SwiftUI: `Menu` s `Toggle` položkami (tlačidlo s hodnotou), obsah ako `.sheet` s `presentationDetents([.medium])` na iPhone a `.popover` na iPade / Macu; riadky ako `List(selection:)` (`.select-row`).

## Rozhodnuté

Rozhodnuté 23. 10. 2026 — Q1–Q3 podľa A (používateľ).

- **Q1 — tvar ovládača.** A: tiché tlačidlo „Zdroje: … ▾" + plachta s `.select-row` a „Opýtať sa znova" · B: riadky `.select-row` stále viditeľné pod otázkou · C: `.toggle` pri každom zdroji.
  **Rozhodnuté: A** — zdroje sa menia zriedka, plachta nezaberá miesto nad odpoveďou a jedno plné tlačidlo jasne hovorí, že opýtanie stojí volanie modelu.
- **Q2 — zapisovať nezopakovaný výber do adresy?** A: nie — adresa opisuje zobrazenú odpoveď (`/ask/a/{id}`), `?src=` vzniká až odoslaním · B: `replaceState` na `/ask?q=&src=` pri každej zmene (dnešné správanie).
  **Rozhodnuté: A** — pri B by obnovenie stránky `/ask?q=` položilo otázku znova a zaplatilo druhé volanie, čo `ASK-historia-otazok` H4 práve odstránilo.
- **Q3 — hlavička pri samotnej Knižnici.** A: „Odpoveď z Knižnice", keď má organizácia živý zdroj; bez živého zdroja ostáva „Odpoveď z dokumentov SFZ" (Ján 8. 10. 2026) · B: vždy „Odpoveď z Knižnice" · C: vždy „z dokumentov SFZ".
  **Rozhodnuté: A** — slovo „Knižnica" nadväzuje na riadok v plachte; kde plachta nie je, nemá s čím nadväzovať a Jánovo znenie platí ďalej. Mení Jánovo rozhodnutie o `answerKicker` — overiť s Jánom pri implementácii.

Ostáva podľa repozitára (nemení sa): predvolený výber = Knižnica + konektory s „používať predvolene" (Ján 8. 10. 2026, `Search.tsx`). Rám „predvolene" ukazuje len Knižnicu, lebo Sportnet tam predvolené nemá.

## Odchýlky od systému

- **O1 — plachta ≥ 640 ako popover.** `.filter-sheet-body` je len spodná plachta a `.filter-sheet` sa od 1024 px skrýva; popover so zoznamom riadkov v systéme nie je (`.more-menu` má len odkazy). V rámoch je to lokálne pravidlo nad `.ask-scope .filter-sheet-body`: `position:absolute; top:calc(100% + 4px)`, okraj, polomer 10 a tieň z `.more-menu`, padding 12, **šírka 360 px** (nová hodnota — dva riadky s podnadpisom sa pri 230 px z `.more-menu` lámu na štyri). **Odporúčanie:** pridať do `globals.css` triedu `.ask-scope-pop` (resp. všeobecné `.popover-sheet`), nie rozširovať `.filter-sheet`.
- **O2 — `.lnote` s tlačidlom.** `.lnote` nemá miesto pre akciu. Lokálne `.lnote--action { align-items:center; flex-wrap:wrap }` a `.lnote-text { flex:1 1 220px }`; pod 640 px tlačidlo zalomí pod text (44 px z `.button--sm`). **Odporúčanie:** pridať `.lnote--action` do `globals.css`.
- `.lnote-mark` „!" aj pri `--info` — systém iný znak nemá.

## Rámy

Stavy 1–6 v 390 / 834 / 1440; tmavá téma pre stav 2 a 3 (390, 1440). Rámy kreslia len obsah `/ask` so zjednodušenou hlavičkou a lištou, bez bočného panela; hodnotenie (`Rating`) a zdroje v kontexte mimo rozsahu.

## i18n (sk/cs/en)

Nové: `ask.scopeButton(value)` „Zdroje: {value}", `ask.scopeAll` „všetky", `ask.scopeSome(n, m)` „{n} z {m}", `ask.scopeNone` „žiadne", `ask.scopeTitle` „Zdroje hľadania", `ask.scopeGroup` „Hľadať v", `ask.scopeLibrarySub`, `ask.scopeLiveSub`, `ask.scopeFoot` „Zmena sa prejaví, až keď sa opýtate znova.", `ask.scopeEmpty` „Vyberte aspoň jeden zdroj.", `ask.reask` „Opýtať sa znova", `ask.scopeChanged(names, only)` „Zdroje sa zmenili. Odpoveď nižšie je {len }z {names}.", `ask.close` „Zavrieť". Genitív názvu živého zdroja: `ask.answerKickerBoth` už skloňuje — ten istý tvar pre `scopeChanged`.

## Údaje, ktoré v modeli neexistujú

- **Genitív názvu konektora** („Sportnet dokumentácie") — konektor má len `name`. Dnešná hlavička ho tiež potrebuje; ak ho `answerKickerBoth` nerieši, pridať do konektora voliteľné `nameGenitive` (sk/cs), inak tvar „zo zdroja Sportnet dokumentácia".
- **Popis zdroja v riadku** — z `uses.retrieval` / `serverInfo` sa dá vziať nanajvýš názov; podnadpis je pevný text podľa druhu (knižnica / živý).
- `askedScope` — len stav klienta pre bežiacu odpoveď; uložená odpoveď ho odvodí zo zdrojov (`scopeFromSources`) ako dnes.

🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/ASK-zdroje-hladania.html + .md.
Q1–Q3 rozhodnuté podľa A. Prečítaj Search.tsx, Answer.tsx,
lib/answerKicker.ts, app/ask/page.tsx, ADR-029 a docs/DEVLOG.md k /ask.

1. page.tsx: src čítať cez všetky hodnoty aj čiarky; neznáme id zahodiť.
2. Search.tsx: .view-switch.ask-scope → <details class="ask-scope"> so
   summary.button--quiet.button--sm a <form method="get" action="/ask">
   (q hidden, checkbox name="src"). Zmena výberu nevolá send ani replaceState (Q2).
   Odoslanie: preventDefault → send(preset, výber) + replaceState /ask?q=&src=
   (potom record() prepíše na /ask/a/{id}). Esc/závoj zavrú; počas behu disabled.
3. askedScope nastaviť v send(); AnswerBody dostane askedScope, nie only.
4. .lnote--info s „Opýtať sa znova" nad kartou, keď !open && výber ≠ askedScope.
5. globals.css: .ask-scope-pop (O1), .lnote--action (O2), skrytie lišty
   pri otvorenej plachte < 640. Zmazať pravidlá button.view-switch-item pre ask-scope.
6. answerKicker podľa Q3. i18n sk/cs/en podľa .md. Zapíš do docs/DEVLOG.md.
Overenie: tsc, eslint, vitest, build; 390/834/1440 svetlá aj tmavá; bez JS
(formulár odošle GET); klávesnica (Tab do plachty, Esc, medzerník na riadku).
```
