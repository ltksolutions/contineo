# ADR-018 — Vzdelávanie ako modul platformy (`learning`); ClubUp ako produkt nad Contineom

> **Stav:** prijaté · **Dátum:** 2026-09-27
> **Zadal a odsúhlasil:** Ján Letko — plán „ClubUp ako produkt nad platformou
> Contineo" schválený 17. 9. 2026 (odložený za onboarding), model a rozsah
> odsúhlasené 27. 9. 2026.
> **Nadväzuje na:** ADR-003 (hranica onboarding ↔ LMS, kap. 3.1), D34 (modul,
> nie fork), D27 (stav sa odvodzuje), D24 (dôkazy sa nemenia), D35 (jazyk
> prostredia ≠ jazyk obsahu), ADR-011 (súbory v GridFS), ADR-012 (retencia, DPO).
> **Mení:** ADR-003 kap. 3.1 — LMS už nie je cudzí systém, ale modul tej istej
> platformy; hranica *potvrdenie ≠ test* zostáva.
> **Plán postupu:** `docs/LEARNING_analyza_a_plan.md`.

---

## 1. Kontext

Tréneri, ktorým bolo Contineo ukázané, chcú vzdelávanie ako službu v tom
istom prostredí. ClubUp (LMS pre manažment klubov, akreditácia ŽU) má hotový
doménový návrh, ale **žiadny aplikačný kód** — nič sa nemigruje ani nezlučuje.
SFZ zároveň potrebuje interné školenia (bezpečnosť, interné poriadky,
licencie trénerov), ktoré sú vecne LMS, nie onboarding: **onboarding
dokladuje, že si čítal; LMS overuje, či si pochopil** (ADR-003 kap. 3.1).

Zvažované varianty (plán 17. 9.): **A)** ClubUp samostatne + prepojenie,
**B)** ClubUp ako produkt nad platformou Contineo, **C)** zdieľané služby.
Variant A by postavil druhýkrát to, čo Contineo už má (tenanti, osoby,
prihlásenie, knižnica so schválenými zneniami, dôkazy, notifikácie, i18n);
variant C by vytvoril tretí systém bez vlastníka.

## 2. Rozhodnutie

**Variant B.** Vzdelávanie je **modul `learning`** platformy Contineo,
zapínaný profilom tenanta (D34). ClubUp zostáva **značkou a doménou** —
neskôr vlastný tenant s vlastným vzhľadom; v kóde je to ten istý modul.
Prvý tenant s modulom je **SFZ intranet** (interné vzdelávanie); pre SFZ
zostáva modul **vypnutý, kým Ján nepovie** — onboarding (Fáza 8) má
prednosť pri nasadení do ostrej prevádzky.

### D117 — Kurz je plochý; úrovne sú trasy

- **Kurz → časti.** Časť má príznak *povinná / nepovinná* a bloky obsahu:
  text, obrázok, galéria, **dokument z knižnice** (odkaz na konkrétne
  znenie), video interné aj externé.
- **Téma** je **číselník organizácie** (ako `category`, D55) a atribút kurzu
  (práve jedna); nie vrstva stromu.
- **smart:tag** `Kľúč: Hodnota` („Bezpečnosť: Výťah", „Úroveň: 2") je na
  kurzoch, otázkach a testoch. Kľúč aj hodnota sa normalizujú na
  porovnávanie, `label` je kópia toho, čo človek napísal. Filter: rôzne
  kľúče = AND, rovnaký kľúč = OR. Zatiaľ len v module `learning`;
  dokumenty ostávajú pri `tags` / `category`.
- **Úrovne a moduly z ClubUpu sa nemodelujú v kurze.** Program „4 úrovne ×
  10 tém" = **4 trasy** (jedna na úroveň) z 10 kurzov s témou z číselníka
  a smart:tagom `Úroveň: N`. Trasa z kurzov je rozšírenie
  `onboarding_tracks` a **nie je v rozsahu L1–L3**.
- Kurz má **jeden jazyk obsahu**; kurz v inom jazyku je iný kurz (D35).
  Prostredie modulu je SK · CS · EN cez `lib/i18n.ts` bez výnimky.

### D118 — Publikovaná verzia kurzu je nemenná

- Kurz má `versions[]` ako dokument (`documents.versions[]`): koncept sa
  upravuje, zverejnená verzia sa **nemení**, zmena = nová verzia (kópia).
- Zápis nesie **`versionId` v čase zápisu** — človek dokončuje to, do čoho
  sa zapísal; nová verzia sa mu neponúkne potichu.
- Zverejnenie zmrazí aj odkazy na testy (`testKey` + `testVersion`).

### D119 — Stav postupu sa odvodzuje z udalostí (D27), udalosti sa nemenia (D24)

- Ukladajú sa **zápis**, **dokončenie časti**, **pokus o test**,
  **certifikát** a jedno meranie — **sledovanie videa** (`video_watch`,
  rozsahy; meranie ako `reading_times`, nie dôkaz).
- Časť je hotová ⇔ dokončenie **a** každé video s *povinným dopozeraním*
  má sledované ≥ 90 % dĺžky **a** každý povinný test má prejdený pokus.
  Kurz je hotový ⇔ všetky povinné časti hotové. **Server** to počíta z
  uložených rozsahov, nie z tlačidla.
- Žiadny `courseCompleted` ani „aktuálna časť" v databáze; certifikát je
  záznam o tom, že sa dokončenie **vyhodnotilo a vydalo**.

### D120 — Testy sú služba platformy s bankou otázok

- **Banka otázok** organizácie: otázka má typ (`single_choice`,
  `multiple_choice`, `true_false`, `short_text`), váhu, vysvetlenie a
  **aspoň jeden smart:tag**. Otázka sa nemaže, vyraďuje sa (`retired`) —
  pokusy ju citujú snímkou.
- **Test je recept, nie zoznam otázok**: sekcie, každá = *filter
  smart:tagov + počet otázok*. Pri každom pokuse sa otázky **losujú**
  a odpovede **miešajú**; pokus si uloží **snímky otázok, poradie otázok
  a poradie odpovedí** (forenzná reprodukovateľnosť; server vyhodnocuje
  podľa uloženého poradia). Test bez dostatku otázok v banke nie je
  `ready` — hovorí to pri uložení, nie pri pokuse.
- Pri otázke s **viacerými správnymi odpoveďami** to rozhranie **vopred
  povie** (zaškrtávacie políčka, veta nad otázkou).
- Test sa **prideľuje ako hotový**: k časti kurzu (jeden alebo viac, každý
  s príznakom *povinný*) a — po dohode s onboardingom — ako krok trasy.
  Model to dovoľuje od začiatku (`test_attempts.context`); krok `test` v
  `tracks.ts` **nie je v L1–L3**.

### D121 — Zodpovednosť za test je menovitá; HR výsledky nevidí

- Test má **jednu alebo viac zodpovedných osôb** (rôzne oblasti). Vidia
  pokusy a skóre **svojho** testu a môžu resetovať pokus s dôvodom (audit).
- Rola `learning-admin` spravuje kurzy, témy, tagy, banku a testy; výsledky
  cudzích testov jej rola sama osebe neotvára. **`hr` skóre nevidí**;
  prideľovať kurz adresátom môže.
- Výsledok testu je hodnotenie osoby: verzia kurzu nesie **právny základ**
  (číselník D92); `/dpo` výkaz sa rozširuje; retencia podľa ADR-012
  (3 roky od skončenia pomeru, strop 5 rokov) sa rozširuje na
  `part_completions`, `video_watch`, `test_attempts`; **certifikát sa
  nemaže, anonymizuje sa** — číslo musí zostať overiteľné. Dodatok k
  ADR-012 vznikne pred L2 naostro.

### D122 — Rola, zápis, certifikát, video

- **Rola `learning-admin`** (lektor / metodik) — nie `content-admin`:
  rola zodpovedá práci (D46, D53). Brána `learningContext()` = rola **a**
  zhoda `companyCode` (D29, D32).
- **Zápis** vzniká (1) **pridelením** adresátom (`Audience`: všetci /
  oddelenie / skupina / trasa) alebo (2) **samozápisom** pri kurze
  s `openEnrollment`. Bez termínu a pripomienok (ADR-004 sa nevzťahuje).
- **Certifikát** vydáva **tenant sám** (kópia údajov o organizácii ako
  `issuedBy`), číslo `{SHORT}-{ROK}-{poradie}`, `verificationHash`,
  **PDF generuje Contineo** a ukladá ako `VersionFile`; verejné overenie
  `/verify/[registrationNumber]?h=`. Externý vydavateľ (ŽU pre ClubUp) =
  ten istý záznam, ručne doplnené číslo a PDF. `revokedAt` namiesto
  mazania.
- **Video je súčasť platformy**: vlastný prehrávač (bez pretáčania dopredu
  pri povinnom dopozeraní), úložisko **ako pri knižnici** — GridFS
  do 25 MB (`fileStore.ts`, nahrávanie po kúskoch), na väčšie súbory
  **adaptér** `videoStorage: "gridfs" | "s3" | "azure"` v profile tenanta
  (vzor ADR-001). Bez prekódovania — hotové MP4. Externé video (YouTube
  a pod.) povinné dopozeranie zaručiť nevie; rozhranie to pri nastavení povie.

### D123 — Modul je jeden podstrom

- Všetko pod **`/learning`** (`/learning`, `/learning/[courseKey]/…`,
  `/learning/manage`, `/learning/tests`); `/verify/…` je verejná.
- `Tenant.modules.learning` zapína navigáciu **aj** routy (`notFound()`
  pri vypnutom). Nové kolekcie: `courses`, `questions`, `tests`,
  `enrollments`, `part_completions`, `video_watch`, `test_attempts`,
  `certificates`. **Žiadna migrácia** existujúcich kolekcií.
- Dizajn: rámy v **Claude Design** nad ZAKLADOM (zadanie
  `docs/design/LEARNING-zadanie.md`), jeden rám = jeden PR — ako pri
  onboardingu.

## 3. Rozsah a poradie

**L0** rozhodnutie, kostra, zadanie pre dizajn → **L1** kurz, obsah, video,
zápis, postup → **L2** banka otázok, testy, pokusy, výsledky, GDPR →
**L3** certifikáty a verejné overenie. Mimo: trasa z kurzov a test ako krok
trasy · predaj kurzov (objednávky, platby, DPH) · SportUp SSO · webináre ·
prekódovanie videa · smart:tagy na dokumentoch · schvaľovanie kurzu ·
tenant ClubUp s vlastnou doménou.

## 4. Dôsledky

- ADR-003 kap. 3.1 dostáva poznámku „doplnené ADR-018": test do Continea
  patrí — ako modul, nie ako súčasť potvrdenia.
- Onboarding a learning zdieľajú `i18n.ts`, `appNav.ts`, `tenants.ts`,
  `audit.ts`, `notifications.ts` — do nich idú **len prídavky na konci
  sekcie**, v malých PR; `tracks.ts` sa v L1–L3 nedotýka.
- Pri zapnutom module pribudne bežnému človeku položka „Vzdelávanie";
  `learning-admin` „Správa kurzov" a „Testy" (na telefóne pod „Viac").
- `npm run check` dostane invarianty modulu (zápis bez verzie, dokončenie
  bez zápisu, test bez zodpovednej osoby, otázka bez tagu).

## 5. Otvorené (s vlastníkom)

- Stav OIDC v SportUpe a spájanie účtov (Entra + SportUp = jedna osoba) — Ján.
- Požiadavky ŽU na certifikáty a evidenciu (garancia obsahu, akreditácia) — Ján.
- Predaj: platby, faktúry, DPH, spotrebiteľské podmienky — účtovník a právnik.
- Test ako krok trasy: dohoda s onboardingom (ADR-005 reťaz dôkazov, `/documents`).
