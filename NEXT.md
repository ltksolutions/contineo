# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-27 večer** (import osôb SFZ, ADR-019, ADR-020; súbežne learning L3 v druhej session)

---

## Kde sme teraz

Všetko je **zlúčené v `main` a nasadené** na `intranet.futbalsfz.sk`. Hash
nasadeného commitu je v pätičke. Staršia história je v `CHANGELOG.md`
a `docs/DEVLOG.md`. **Od 27. 9. pracujú v repe dve sessions naraz** —
každá vo vlastnom `git worktree` (ADR-020); rozrobené vetvy druhej session
vidno v `git branch -a`, nie v tomto súbore.

**Osoby SFZ sú v systéme (27. 9.):** 153 osôb z licenčného zoznamu M365
(150 nových + 3 doplnené), bez technických kont. Zaradenie do oddelení je
ručné a čaká (`docs/TODO.md`, I4). **ADR-019:** import existujúcim dopĺňa
len prázdne polia; prepis je prepínač „Aktualizovať existujúcich".
Náhľad importu je tabuľka s rozdielom „dnes → po" a hľadaním.

**Rámy z Claude Design sú zapracované všetky** (`docs/design/`, PR #113–#123).
Postup: Ján navrhne rám, napíše **„stiahni design"**, archív sa stiahne cez
Share → Project HTML → Project archive, rámy idú do `docs/design`, každý rám
jeden PR. Priebeh nahrávania zostáva modálne okno (CLAUDE.md projektu v Claude
Design).

**Znenie predpisu po štyroch rozhodnutiach (24.–25. 9.):**

- **ADR-014** — karta Príprava → Schválenie → Zverejnenie → Pridelenie;
  zodpovedná osoba už v príprave, schvaľovatelia z posledného kola, prenos
  pridelení pri zverejnení.
- **ADR-015** — názov dokumentu so zverejneným znením sa mení len novým
  znením a schvaľuje sa s ním.
- **ADR-016** — bez označenia znenia, zdroja dátumu a opravy údajov; formulka
  „… v znení účinnom od {dátum} …".
- **ADR-017** — viac právnych základov pri znení; zákonná povinnosť má
  prednosť (námietka nemaže).

**ADR-012 (retencia a DPO)** beží v režime `report`; DPO je Ján. **ADR-013**
(údaje o znení) je súčasťou schválenia.

**Naostro neoverené:** celý postup nového znenia cez kartu (predloženie,
zverejnenie s novým názvom, prenos pridelení), uloženie kombinácie
právnych základov, `/dpo` s námietkou, vyradená osoba.

**Vzdelávanie (modul `learning`) — rozhodnuté 27. 9., ADR-018, zatiaľ bez
kódu.** Plán L0–L3 je v `docs/LEARNING_analyza_a_plan.md`, zadanie pre
Claude Design v `docs/design/LEARNING-zadanie.md`. Modul zostáva pre SFZ
**vypnutý**, kým Ján nepovie; onboarding má prednosť. Prvý krok kódu je
**L0 vo vetve `learning-l0` cez PR** (`tenants.ts` `modules.learning`,
`lib/learning.ts` s rolou `learning-admin`, `appNav.ts`, `i18n.ts` sekcia
`learning`, prázdne `/learning*`) — dotýka sa súborov, na ktorých beží aj
onboarding, preto malé PR a rebase pred každým. `tracks.ts` sa v L1–L3
nemení (O18).

## Čo čaká na rozhodnutie Jána

**22 osôb z `@sfzmarketing.sk`** sú v tenante SFZ ako `employee` — nechať,
alebo typ `external` / vlastný tenant? A či doplniť ľudí mimo Basic/Standard
licencií (Ján v exporte nebol).

**Ako DPO — `C1_C3_ochrana_udajov.docx`:** text informovania (C1), záznam
o spracovateľských činnostiach (C2), DPIA pred pilotom (C3), termín
balančného testu (A3, A11). C1 a A3 sú brány pred pilotom.

**Mazanie pôvodných noriem a testovacích dokumentov** pred ostrou prevádzkou
— Ján povie kedy a ktoré; predtým výpis toho, čo sa na ne odkazuje.

**Zapnúť ostré mazanie** — `RETENTION_MODE=delete` po kontrole výkazu
`retention` v odpovedi cronu.

**Automatický prevod `.docx` → PDF** (Graph, povolenia v Entra ID) a **D93**
(`docs/D93_plan_vyber_podla_filtra.md`) čakajú ako doteraz.

## Najbližšie kroky

0. **Zaradiť 153 osôb do oddelení** v `/organisation` — bez toho sa im
   normy podľa oddelenia nepridelia (D49).
1. **Prvé ostré nové znenie cez kartu** — pri ňom overiť nový názov,
   formulku „v znení účinnom od", kombináciu právnych základov a prenos
   pridelení (`docs/TODO.md`, O15/O16).
2. **Prejsť `/dpo` naostro:** výkaz, CSV; námietku len na testovacej osobe.
3. **Odkaz na `/privacy` do pozvánky** (päta `inviteEmail`) — posledná
   chýbajúca časť C1.
4. **Právny základ už počas schvaľovania** (ADR-014, D109) — návrh miesta,
   kde koncept uvidí zodpovedná osoba bez prístupu do knižnice.

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva (27. 9. večer): **0 errors, 41 warnings,
1864 testov v 133 súboroch.** Nová chyba alebo nové varovanie znamená regresiu, nie šum.

**Tieto štyri brzdy nevidia chyby za behu.** 23. 9. prešli všetky štyri
a produkcia aj tak spadla (dočasná mŕtva zóna v `library/page.tsx`). Preto
je odteraz `@typescript-eslint/no-use-before-define` zapnuté ako **chyba** —
`tsc` túto triedu chýb chytiť nevie, hlási len priamy odkaz v tom istom
mieste, nie odkaz vnútri callbacku.

**Stránka sa overuje telom odpovede, nie stavovým kódom.** Next servíruje
chybovú stránku s kódom **200**, takže `curl -o /dev/null -w '%{http_code}'`
o ničom nevypovedá. Hľadá sa reťazec „A server error occurred" v tele.

**A overuje sa to, čo ľudia s obrazovkou robia, nie to, čo sa menilo.**
Knižnica nasadená bez vyskúšaného filtra nie je overená knižnica.

Stav, ktorý sa naživo nedá vyvolať bez zápisu (karta v kroku 2, námietka),
sa overuje **testom vykreslenia** s podvrhnutými dátami
(`tests/libraryDetailFlow.test.ts`, `approvalsPage`, `dpoPage`).

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

**Lokálne SFZ je na `http://sfz.localhost:3000`, nie na `localhost`** — ten
patrí tenantovi LTK a osoba Jána tam nie je (D90), takže knižnica hlási
„Stránka sa nenašla" aj pri prihlásení. Prihlasuje sa zvlášť; odkaz z e-mailu
má v `callbackUrl` https, po prihlásení treba ručne otvoriť `http://`.
**Lokálny server píše do ostrej databázy** — zápisy (presun, audit) sa
naživo skúšajú len so súhlasom Jána.

**Marketingový web má vlastnú sadu** a púšťa sa z `web/`:

```
cd web && npx eslint . && npx vitest run && npm run build
```

Baseline: **0 errors, 0 warnings, 13 testov v 2 súboroch, 62 predgenerovaných
stránok** (z toho 18 OG a Twitter obrázkov). `next lint` tu už neexistuje —
volá sa priamo `eslint`.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
