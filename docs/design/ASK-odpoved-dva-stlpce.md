# ASK — odpoveď v dvoch stĺpcoch

Referencia: `ASK-odpoved-dva-stlpce.html`. Nadväzuje na `ASK-otazka-z-hlavicky` (pole v hlavičke, plachta, `/ask?q=` s behom). Základ: `ZAKLAD.md`, `ASK.md`, `SHELL-rozcestnik`.
Zdroj: `components/Answer.tsx`, `components/Search.tsx`, `lib/sseClient.ts` (`Citation`, `AnswerSource`, `Completion`), `lib/formatText.ts` (`cleanCitation`, `mergeCitations`), `components/FormattedText.tsx`.

Požiadavka používateľa 30. 9. 2026: na desktope dva stĺpce, vľavo odpoveď, vpravo citácie a pomocné údaje.

## Čo sa mení

1. **≥ 1180 px a aspoň jedna citácia → dva stĺpce.** Mriežka `minmax(0,1fr) 400px`, gap 28, `max-width` 1240. Vľavo otázka, karta odpovede, hodnotenie. Vpravo `sticky` stĺpec.
2. **Pravý stĺpec**, poradie: **Doslovné citácie (n)** (`mergeCitations`, poznámka „z m odkazov") · **Zdroje v kontexte (n)** zbalené (`<details>` ako dnes) · **Technické údaje** zbalené (dnes vždy otvorená pätička pod odpoveďou).
3. **Citácia** = číslo 22 px (teal) + úryvok `cleanCitation` v „…" + `documentTitle · articleRef · znenie` + „Otvoriť v knižnici", ak zodpovedajúci zdroj má `url`. Pás `borderLeft teal` sa ruší.
4. **Značka `[n]` v texte** za vetou, ku ktorej citácia patrí. Hover/fokus/klik na značku zvýrazní citáciu vpravo a vetu v texte; hover na citáciu zvýrazní jej značky. Klik zvýraznenie pripne.
5. **Počas behu:** vpravo prerušovaný rám „Citácie pribudnú počas písania", potom citácie po jednej, keď prídu udalosti `citation`. Zdroje a technické údaje až po `done`.
6. **Bez citácií** (adaptér `openai`, `supportsCitations = false`, alebo 0 citácií): jeden stĺpec max. 760 ako dnes, zdroje pod odpoveďou.
7. **< 1180:** jeden stĺpec, citácie pod odpoveďou. 834: klik na `[n]` posunie na citáciu. < 640: ťuknutie na `[n]` (24 px) otvorí spodnú plachtu s citáciou a listovaním (44 px); zoznam ostáva aj pod odpoveďou.

## Prečo

Citácie sú dôkaz, nie príloha. Dnes sú pod odpoveďou, takže pri čítaní tvrdenia človek dôkaz nevidí a musí rolovať. Vedľa textu sa tvrdenie a úryvok čítajú naraz. Odpoveď ostáva v šírke na čítanie (max. 72 znakov). Pravý stĺpec by na 1440 inak bol prázdne miesto.

## Rozhodnutia 30. 9. 2026

- **Q1 ✅** Poloha značky: `sseClient` zapíše pri udalosti `citation` `at = text.length`, `FormattedText` vloží značku na najbližší koniec vety. Bez zmeny servera a schémy. Uložená odpoveď značky nemá, citácie áno.
- **Q2 ✅** Technické údaje: zbalené (`<details>`) a zobrazené **len rolám s prístupom k hodnoteniu** (tie isté, ktoré vidia `Rating`). Ostatní ich nevidia vôbec.

Odsúhlasil používateľ 30. 9. 2026.

## Rámy

- **1440** beží (citácie pribúdajú, dá sa spustiť znova) · hotová odpoveď s pripnutou citáciou 2 · bez citácií (jeden stĺpec).
- **834** jeden stĺpec. **390** spodná plachta citácie.

## Rozmery

Pravý stĺpec 400, gap 28. Nadpis sekcie 12/700 verzálky `--muted`. Citácia: padding 12/14, radius 10, číslo 22 (`--teal-soft` / `--teal-700`), úryvok 14/1.55, meta 12. Zvýraznenie: obrys `--teal-700` + `0 0 0 3px --teal-soft`; veta v texte spodný pás 38 % `rgba(15,118,110,.16)`. Značka v texte 19 px (390: 24), radius 6, 11/700. Spodná plachta: radius 18, úryvok 15.5/1.6, tlačidlá 44.

## i18n (sk/cs/en)

Nové: `answer.citationsPending` „Citácie pribudnú počas písania", `answer.technical` „Technické údaje", `answer.openInLibrary` „Otvoriť v knižnici", `answer.citationOf` „Citácia {n} z {m}", `answer.prev` / `answer.next`. `answer.citations`, `answer.sources`, `answer.citationsNote` ostávajú.

## Údaje, ktoré v modeli neexistujú

- Poloha citácie v texte (`at`) — len na klientovi počas behu (Q1). Uložená odpoveď (`ratings`) ju nemá; pri zobrazení uloženej odpovede sa značky nekreslia, citácie áno.
- Väzba citácia → zdroj (kvôli `url` a zneniu): cez `chunkIndex` ↔ index zdroja, ak sa zhoduje; inak sa „Otvoriť v knižnici" a znenie pri citácii nekreslia.

🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/ASK-odpoved-dva-stlpce.html + .md.
Nadväzuje na ASK-otazka-z-hlavicky (ak ešte nie je v main, rob na jeho vetve).
Q1–Q2 sú rozhodnuté (30. 9. 2026), pozri .md.
Najprv prečítaj Answer.tsx, Search.tsx, FormattedText.tsx, lib/sseClient.ts,
lib/formatText.ts (+ testy formatText, sseClient), ASK.md a docs/DEVLOG.md k /ask.

Rozsah (vetva design/ask-dva-stlpce):
1. sseClient: pri udalosti citation zapíš at = text.length (Q1). Test.
2. formatText: placeCitations(text, citations) → pozície značiek na konci vety,
   zlúčené citácie (mergeCitations) majú spoločné číslo. Testy.
3. Answer.tsx: rozdeliť na AnswerBody (karta) a AnswerAside (Doslovné citácie, Zdroje
   v kontexte <details>, Technické údaje <details> len pre roly s hodnotením — Q2). Citácia podľa .md (číslo,
   úryvok, dokument · článok · znenie, „Otvoriť v knižnici" len pri url). borderLeft
   teal preč. Počas behu citationsPending, citácie pribúdajú.
4. FormattedText: značky <button class="cite" aria-describedby> na pozíciách z bodu 2.
   Prepojenie hover/fokus/klik (pripnutie) ↔ citácia; zvýraznenie vety.
5. Layout /ask: ≥ 1180 px a (citácie > 0 alebo beží pri supportsCitations) → grid
   minmax(0,1fr) 400px, gap 28, max 1240, aside sticky s vlastným rolovaním.
   Inak jeden stĺpec 760. < 1180 aside pod kartou; 834 klik posunie na citáciu;
   < 640 spodná plachta (citácia, listovanie, 44 px, Esc/závoj zavrie).
6. Uložená odpoveď bez at: citácie áno, značky nie.
i18n sk/cs/en podľa .md. Zapíš do docs/DEVLOG.md.
Overenie: tsc, eslint (baseline), vitest, build; render 1440 / 834 / 390: beh s
citáciami, hotová odpoveď, adaptér bez citácií (jeden stĺpec), nič sa nenašlo;
svetlá aj tmavá; klávesnica (Tab na značky, fokus zvýrazní citáciu).
```
