# KNIZNICA — postup znenia (nahratie → schválenie → zverejnenie → pridelenie)

Referencia: `KNIZNICA-postup-znenia.html`. Základ: `ZAKLAD.md`, `DETAIL.md`, `NAHRAVANIE.md`.
Zdroj: `library/[id]/page.tsx`, `library/new/page.tsx`, `ApprovalPanel`, `VersionMetaFields`, ADR-006, ADR-011, ADR-013, D80.

## Problém (snímky `uploads/DETAIL-*`, `APPROVALS-*`)

- Postup má 9 krokov na 4 obrazovkách (`/library/new`, detail, `/approvals`, `/documents/[id]`, `/hr`). Nikde nie je vidieť, v ktorom kroku znenie je a čo príde.
- „Nové znenie zo súboru" je formulár schovaný v „Úpravy a správa dokumentu".
- Karta platného znenia je 7 `<details>` pod sebou (zmena právneho základu, zodpovedná osoba, právny základ, kolo, opraviť údaje…). Údaje o znení sú aj v karte, aj v bočnom paneli.
- Pri koncepte sú údaje o znení a predloženie na schválenie dva formuláre s dvomi tlačidlami.

## Čo sa NEMENÍ (rozhodnutia v repozitári)

ADR-006: schvaľuje sa znenie; schvaľovatelia menovaní, nie sám sebe; súbežne; zamietnutie s povinným dôvodom; schvaľovateľ rozhoduje v `/approvals`.
ADR-011: PDF povinné, zdroj odporúčaný. ADR-013: údaje o znení pri nahratí, zámok počas kola a po schválení, dátum účinnosti povinný na predloženie.
D80: nový dokument vs. nové znenie. Priebeh nahrávania = modálne okno (CLAUDE.md).

## Návrh podoby

1. **Hlavička detailu**: `Stiahnuť PDF` · `Upraviť dokument` · **`Nové znenie`** (hlavné). Kým sa jedno pripravuje, je neaktívne (`title` vysvetlí prečo). „Nové znenie" otvorí ten istý formulár ako `/library/new` v režime `version` (D80), predvyplnený z platného znenia.
2. **Karta „Nové znenie"** nahrádza „Čo treba teraz" (úloha 1 v `DETAIL.md`): hlavička (dátum účinnosti, stav, kto a kedy), **krokovník 1–4**, telo aktuálneho kroku, riadok „Potom" a päta s akciou.
   - 1 Príprava — kontrolný zoznam (PDF, zdroj/text, údaje o znení) + formulár údajov + schvaľovatelia. **Jedno tlačidlo „Uložiť a predložiť na schválenie"** + „Len uložiť".
   - 2 Schválenie — zoznam schvaľovateľov so stavom, „Čo sa schvaľuje" so zámkom 🔒, „Stiahnuť kolo".
   - 3 Zverejnenie — označenie znenia, zodpovedná osoba, „Zverejniť od {dátum}".
   - 4 Pridelenie — prenos pridelení / odkaz do `/hr`.
   Stavy krokov sa odvodzujú z `draftState` a kôl — žiadny nový stav v modeli.
3. **Platné znenie** — súhrn: zodpovedná osoba, právny základ, schválil, autor + riadok odkazov (PDF, Zmeniť zodpovednú osobu, Zmeniť právny základ, Opraviť údaje, História). Formuláre sa otvárajú až po kliknutí (dnešné `<details>` presunuté pod odkazy).
4. **Staršie znenia** — zoznam archivovaných, jeden riadok na znenie.
5. **Bočný panel** — Potvrdenia + **Dokument** (druh, značky, prístup, jazyk, priečinok, identifikátor) s „Upraviť". Údaje o znení a zodpovedná osoba z panelu odchádzajú (sú v karte znenia). Preindexovanie a oprava textu (ADR-007) v „Správa".

## Otázky pre Jána — zmeny postupu

**Odpovede Jána 24. 9. 2026:** Q1 ✅ áno · Q2 ✅ áno · Q3 ✅ áno · Q4 ✅ áno — prenos pridelení je voľba pri zverejnení, predvolene zapnutá, s tými istými poľami ako karta „Prideliť aj nové znenie" (publiká, povinný dôvod, termín; pôvodný termín sa neprenáša, e-maily sa neposielajú). Tlačidlo „Zverejniť a prideliť"; pri odškrtnutí „Zverejniť od {dátum}" a prideľuje sa ručne ako dnes. Karta `carryOverAssignmentsAction` ostáva pre prípad, keď sa voľba odškrtne.

- **Q1 — Zodpovedná osoba už v príprave.** Dnes sa určuje pri zverejnení a až potom určí právny základ → po zverejnení sa čaká, kým sa dá dobre prideľovať. Keby sa určila v kroku 1, právny základ určí počas schvaľovania. Pri zverejnení by sa len potvrdila. Mení to D91 (kedy sa zadáva) — súhlas?
- **Q2 — Schvaľovatelia predvyplnení z posledného kola** pri novom znení (dá sa zmeniť). Súhlas?
- **Q3 — Návrh označenia znenia** z dátumu účinnosti („úplné znenie od 1. 10. 2026"). Dnes sa píše ručne a v dátach je napr. „Pracovný poriadok SFZ 20260907" (opakuje názov). Súhlas s návrhom?
- **Q4 — Prenos pridelení ako voľba pri zverejnení** (zaškrtnuté, ak má platné znenie pridelenia) namiesto samostatnej karty „Prideliť aj nové znenie". Mení poradie: prenos by sa urobil zverejnením. Súhlas? Brána D73 (len schválené) ostáva splnená.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | platný dokument, nové znenie v kroku 2 (1 z 2 schválilo) |
| **834** | krok 1 Príprava hneď po nahratí nového znenia |
| **390** | krok 3 Zverejnenie po schválení (s prenosom pridelení, Q4) |
| **1440** | nový dokument bez platného znenia, kolo 1 zamietnuté → krok 1 |
| **834** | `/library/new` ako krok 1 (formulár bez zmeny + krokovník) |
| **390** | krok 4 Pridelenie, keď sa prenos pri zverejnení odškrtol |

## Pravidlá stavov karty

| Situácia | Karta | Krok |
| --- | --- | --- |
| koncept, žiadne kolo / kolo zamietnuté alebo stiahnuté | „Prvé znenie" alebo „Nové znenie od {d}" | 1 (pri zamietnutí 2 = ✕ + dôvod) |
| kolo beží | to isté | 2 |
| schválené, nezverejnené | to isté | 3 |
| zverejnené, platné znenie bez pridelení a predošlé ich malo | „Znenie od {d}" | 4 |
| inak | **žiadna karta** | — |

Stavy sa odvodzujú z `draftState`, kôl a pridelení — žiadny nový stav v modeli.

## Nové texty (i18n)

`flow.heading(date)` „Nové znenie od {d}", `flow.steps` Príprava / Schválenie / Zverejnenie / Pridelenie, `flow.next` „Potom", `flow.submitAndSave` „Uložiť a predložiť na schválenie", `flow.saveOnly` „Len uložiť", `flow.withdraw` „Stiahnuť kolo", `flow.firstVersion` „Prvé znenie", `flow.rejectedBy(who,date)` „{who} zamietol {date}", `flow.resubmit(n)` „Predložiť kolo {n}", `flow.resubmitNote` „Ide to aj bez výmeny súborov — schvaľovatelia uvidia, že sa nič nezmenilo.", `upload.nextNote` „Potom na detaile skontroluješ text, vyberieš schvaľovateľov a zodpovednú osobu a predložíš.", `flow.publishFrom(d)` „Zverejniť od {d}", `flow.publishAndAssign` „Zverejniť a prideliť", `flow.carryOver(n)` „Prideliť nové znenie tým istým {n} ľuďom", `flow.carryOverNote` „Publiká z predošlých znení: … Odškrtni, ak chceš prideliť inak.", `flow.locked` „zamknuté počas kola", `current.heading` „Platné znenie", `history.heading` „Staršie znenia", `newVersion` „Nové znenie".

## Údaje, ktoré v modeli NEEXISTUJÚ / overiť

| Údaj | Stav |
| --- | --- |
| „Stiahnuť kolo" | ✅ existuje — `cancelRound()` v `approvalsDb.ts`, **dôvod povinný** (`approval.reasonRequired`). V kroku 2 doplniť pole dôvodu. |
| Počet článkov textu („18 článkov") | ❌ vynechať |
| „schvaľovatelia uvidia, že sa nič nezmenilo" | ⚠️ overiť, či `/approvals` pri kole 2 porovná identitu konceptu s kolom 1 (D96); ak nie, vetu vynechať |
| Rola schvaľovateľa pod menom | ⚠️ z adresára (oddelenie/funkcia), ak je |
| Zodpovedná osoba na koncepte (Q1) | ❌ dnes len na zverejnenom znení — zmena modelu, len ak Q1 = áno |

🔴 Zmena schémy: **žiadna**, okrem Q1 (pole na koncepte).
