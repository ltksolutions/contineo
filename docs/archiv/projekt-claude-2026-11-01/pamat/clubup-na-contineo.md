---
name: clubup-na-contineo
description: Úvaha spustiť ClubUp (LMS) funkčne nad platformou Contineo — čo používateľ k tomu povedal; čítať pred prácou na LMS/learning module alebo ADR k ClubUpu
sources: [cowork]
---
- [stated] tréneri, ktorým ukazoval Contineo, by chceli LMS ako službu v Contineu
- [stated] zvažuje, aby ClubUp po funkčnej stránke bežal priamo na platforme Contineo; obsah LMS/CMS využiť aj na interné vzdelávanie zamestnancov, trénerov a pod.
- [stated] aplikačný kód ClubUpu zatiaľ neexistuje (stav 2026-09)
- [stated] identita: Contineo si založí osobu (person) pri SSO prihlásení cez SportUp, podobne ako pri Entra
- [stated] ClubUp má v budúcnosti kurzy aj predávať
- [stated] ClubUp má veľmi úzku spoluprácu so Žilinskou univerzitou (ŽU)
- [stated] plán ADR „ClubUp ako produkt nad platformou Contineo" schválil (2026-09-17); 2026-09-27 rozhodol ísť do toho: LMS ako modul `/learning` na platforme Contineo, rozsah prvej fázy L1–L3 (kurz a postup, testy, certifikáty), prvý tenant SFZ intranet (interné vzdelávanie), prihlásenie dnešné (SportUp SSO neskôr); onboarding (Fáza 8) rieši paralelne v inej session
- [stated] podklady ClubUpu (typy vzdelávania, doménový model) sú v repe `/Users/janletko/Documents/GitHub/clubup`
- [stated] dizajn obrazoviek LMS sa robí v Claude Design v existujúcom základnom dizajne projektu Contineo; treba preň pripraviť zadanie
- [stated] rozhodnutia k modulu learning (2026-09-27): Téma sa nezlučuje do Modulu (téma = číselník, atribút kurzu); nová rola `learning-admin`; zápis pridelením aj samozápisom; certifikát pre SFZ vydáva tenant, PDF generuje Contineo; každý test má zodpovedné osoby (viac oblastí), HR výsledky automaticky nevidí; video má byť súčasťou platformy (interné aj externé, vlastný prehrávač, úložisko interné/externá služba), povinné dopozeranie videa je požiadavka
- [stated] jeho model LMS: kurz = časti (povinná/nepovinná) s obsahom text, obrázky/galérie, dokumenty z knižnice Continea, video; k časti jeden alebo viac hotových testov; testy sú samostatná databáza (sekcia „Testy"), použiteľné aj v onboardingu a trasách; test má sekcie = filter smart:tagov + počet otázok, otázky aj odpovede sa losujú náhodne, otázka s viac správnymi odpoveďami musí na to upozorniť; smart:tag = „kľúč: hodnota" (napr. „Bezpečnosť: Výťah", „Tréner: Euro B licencia"), každá otázka má ≥ 1 smart:tag; i18n prostredia platí aj v learningu
- [stated] doplnenie 2026-09-27 (Q1–Q6): úrovne ClubUpu = 4 trasy (jedna na level) z plochých kurzov; test ako krok trasy až po dohode s onboardingom; smart:tagy zatiaľ len v learningu; filter sekcie testu: rôzne kľúče AND, rovnaký kľúč OR; interné video: Vercel Blob sa v Contineu NEpoužíva — úložisko ako pri knižnici (MongoDB/GridFS do 25 MB), na väčšie súbory adaptér pre S3/Azure; jeden jazyk obsahu na kurz (D35). Rozhodnutie je zapísané ako ADR-018 v repe; ďalšia práca (L0, vetva `learning-l0`) pokračuje v Claude Code
