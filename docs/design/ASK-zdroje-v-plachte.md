# ASK — zdroje v plachte otázky

Referencia: `ASK-zdroje-v-plachte.html` (živé rámy `?f=default|open|live|nolive|inline|edit`, `&theme=dark`). Zadanie: `docs/design/ASK-zdroje-v-plachte-zadanie.md`. Vzor: `ASK-zdroje-hladania` (PR #418). Kód: `components/AskSheet.tsx`, `components/Search.tsx`, `lib/answerKicker.ts` (`answerFrom`), `app/ask/page.tsx`.
Rámy: 390 / 834 / 1440, svetlá aj tmavá (stav 2).

## Čo sa mení

1. **Tlačidlo zdrojov v lište plachty** (Q1 A): `.ask-sheet-bar` = `details.ask-scope.ask-sheet-scope` (summary `.button--quiet.button--sm` „Zdroje: Knižnica ▾") · `.ask-sheet-hint` · „Opýtať sa". Zdroje sú vždy vymenované. Pod 640 px má tlačidlo 44 px (`.button--sm`), nápoveda je skrytá (dnešné pravidlo) a „Opýtať sa" je dole v `.ask-sheet-foot`. Od 640 do 1023 px sa nápoveda pri výbere skryje a od 1024 px sa skráti tromi bodkami, aby sa lišta nezalomila.
2. **Rozbalenie v plachte** (Q2 A): pod lištou `fieldset.ask-sheet-scope-pane.form-group` „Hľadať v" > `.card.form-group-body--rows` > `.form-list` > `label.form-row.select-row` s `checkbox name="src"`. Pätka: „Platí pre túto otázku. Aspoň jeden zdroj ostáva zapnutý." Viditeľnosť riadi `<details open>` cez `:has()` (odchýlka S1), takže to funguje bez JS.
3. **Odoslanie**: ten istý `<form method="get" action="/ask">`. Bez JS `?q=…&src=library&src=<id>` (zbalené riadky sa odošlú tiež, `display:none` vstup sa posiela). S JS `router.push('/ask?q=…&src=library,<id>')`. `page.tsx` už číta obe formy (PR #418).
4. **Aspoň jeden**: klik, ktorý by odškrtol posledný zapnutý riadok, sa zastaví (`preventDefault`) a pätka stmavne. Riadok nie je `disabled`, lebo by sa neodoslal. Bez JS rozhodne server: prázdny `src` = predvolený výber.
5. **Veta `.ask-sheet-info`** podľa výberu (Q4 A): „Odpoveď sa skladá len {answerFrom(výber)}." → „… z dokumentov SFZ" / „… z dokumentov SFZ a zo zdroja Sportnet dokumentácia" / „… zo zdroja Sportnet dokumentácia". Zvyšok vety ostáva.
6. **Zmena nič nespúšťa.** Odpoveď vznikne až po „Opýtať sa" alebo Enter.
7. **Klávesnica**: Tab z poľa → Zdroje → (riadky, keď sú rozbalené) → Opýtať sa. Esc pri rozbalených riadkoch ich zbalí a vráti fokus na tlačidlo, druhé Esc zavrie plachtu. ↑↓ a Enter pre nedávne otázky platia ďalej v poli.
8. **Nadväznosť** (stav 6): `AskSheet` dostane `initialSources`. „Upraviť otázku" na `/ask` ho naplní výberom obrazovky odpovede. Mimo `/ask` sa berie predvolený výber (Q3 A). Obrazovka odpovede začne s `src` z adresy, ako po PR #418.
9. **Bez živého zdroja** sa tlačidlo ani riadky nekreslia.

Vzor SwiftUI: `DisclosureGroup` v rámci `.sheet`, riadky `List(selection:)`. Hodnota v tlačidle je ako pri `Picker(.menu)`. Nekreslí sa druhý `.popover` nad plachtou.

## Rozhodnuté

Rozhodnuté 23. 10. 2026 — Q1–Q4 podľa A, odchýlky S1–S2 podľa odporúčaní (používateľ).

- **Q1 — kde je výber.** A: v lište vľavo od „Opýtať sa" · B: samostatný riadok nad vetou.
  **Rozhodnuté: A** — je pri tlačidle, ktoré otázku odošle, a lišta pod 640 px aj tak drží len jeho.
- **Q2 — rozbalenie.** A: riadky v plachte pod lištou · B: popover ako na obrazovke odpovede.
  **Rozhodnuté: A** — plachta je už sama nad obrazovkou a popover nad ňou by bol vrstva navyše.
- **Q3 — pamätanie výberu.** A: nepamätá sa; plachta začína predvoleným výberom, na `/ask` výberom z adresy · B: posledný výber v prehliadači.
  **Rozhodnuté: A** — čo sa hľadá, je vidieť v tlačidle pred každou otázkou a pravidlo je rovnaké ako dnes.
- **Q4 — veta o zdrojoch.** A: mení sa podľa výberu · B: všeobecná veta.
  **Rozhodnuté: A** — inak klame a `answerFrom` už toto znenie skladá.

## Odchýlky od systému

- **S1 — riadky mimo `<details>`.** `<details>` drží len summary, riadky sú sesterský `fieldset` zobrazený cez `.ask-sheet:has(.ask-sheet-scope[open]) .ask-sheet-scope-pane`. V lište (flex) by obsah `<details>` sedel vedľa tlačidla, nie pod lištou. **Odporúčanie:** pridať do `globals.css` `.ask-sheet-scope` a `.ask-sheet-scope-pane` (padding `0 18px 14px`, pod 640 `0 12px 14px`).
- **S2 — nápoveda pri výbere.** `.ask-sheet-hint` sa pri tlačidle zdrojov skracuje (≥ 1024) alebo skrýva (640–1023). **Odporúčanie:** pridať pravidlo `.ask-sheet-bar:has(.ask-sheet-scope) .ask-sheet-hint` do `globals.css` a `.ask-sheet-bar-button { flex: none }`.
- Bez novej farby, rozmeru ani komponentu: tlačidlo, riadky a pätka sú triedy systému.

## i18n (sk/cs/en)

Opakovane použité z PR #418: `ask.scopeButton(names)`, `ask.scopeGroup` „Hľadať v", `ask.scopeLibrarySub`, `ask.scopeLiveSub`, `ask.fromLibrary/fromLive/fromBoth` (`answerFrom`). Nové: `ask.sheet.scopeFoot` „Platí pre túto otázku. Aspoň jeden zdroj ostáva zapnutý.", `ask.sheet.infoLead(from)` „Odpoveď sa skladá len {from}." (nahrádza `infoLead(organisation)`).

## Údaje, ktoré v modeli neexistujú

Žiadne. Zoznam zdrojov a predvolený výber už `/ask` načítava (`liveSources`, „používať predvolene"). Hlavička a `AskSheet` ich potrebujú tiež: odovzdať z layoutu, alebo načítať pri otvorení plachty. 🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
stiahni design

Implementuj design_handoff_contineo_intranet/ASK-zdroje-v-plachte.html + .md.
Q1–Q4 rozhodnuté podľa A, S1–S2 podľa odporúčaní. Prečítaj AskSheet.tsx, Header.tsx (HeaderAsk),
Search.tsx (ask-scope z PR #418), lib/answerKicker.ts, app/ask/page.tsx, DEVLOG k /ask.

1. AskSheet: props sources [{id,name,sub}] a initialSources; bez živého zdroja nekresliť.
   V .ask-sheet-bar vľavo details.ask-scope.ask-sheet-scope (summary .button--quiet
   .button--sm „Zdroje: {mená}"), pod lištou fieldset.ask-sheet-scope-pane s
   .form-row.select-row (checkbox name="src"). Posledný zapnutý: preventDefault.
2. submit(): router.push(`/ask?q=…&src=${výber.join(",")}`); bez JS GET posiela src opakovane.
3. .ask-sheet-info: infoLead(answerFrom({library, live}, org, lang)).
4. Esc: najprv zbaliť details, potom zavrieť plachtu. Tab poradie podľa .md.
5. „Upraviť otázku" v Search odovzdá aktuálny výber ako initialSources; HeaderAsk mimo
   /ask predvolený výber (Q3). Zdroje do hlavičky z layoutu alebo pri otvorení plachty.
6. globals.css: S1, S2. i18n sk/cs/en. Zapíš do docs/DEVLOG.md.
Overenie: tsc, eslint, vitest, build; 390/834/1440 svetlá aj tmavá; overlay aj inline;
bez JS (inline /ask odošle q aj src); klávesnica.
```
