# Modul `learning` — LMS na platforme Contineo: analýza a plán implementácie (v2)

> Stav: **schválené 27. 9. 2026** (Ján Letko). Rozhodnutie je v
> `docs/decisions/ADR-018-modul-learning.md`; toto je plán postupu
> (konvencia `docs/*_plan*.md` — plán, nie rozhodnutie).
>
> Dohodnuté 27. 9.: rozsah **L1 kurz a postup → L2 testy → L3 certifikáty**;
> prvý tenant **SFZ intranet**; prihlásenie **dnešné** (Entra / persons),
> SportUp SSO neskôr; dizajn **Claude Design nad ZAKLADOM**; onboarding beží
> paralelne v inej session.

---

## 1. Rozhodnutia z 27. 9. (Ján)

| # | Rozhodnutie |
|---|---|
| a | **Téma sa nezlučuje** — je to vlastná entita: **číselník tém** organizácie (ako `category`, D55). Kurz má práve jednu tému. |
| b | Nová rola **`learning-admin`**. |
| c | Zápis **pridelením** (adresáti ako pri norme) **aj samozápisom** pri otvorenom kurze. |
| d | Certifikát pre SFZ vydáva **tenant**, PDF generuje **Contineo**. |
| e | Výsledky testov: **HR ich automaticky nevidí**. Každý test má **jednu alebo viac zodpovedných osôb** (rôzne oblasti — bezpečnosť, tréneri, …); tie vidia výsledky svojich testov. Právny základ a retencia ako pri potvrdeniach (ADR-012), rozšírené na nové kolekcie. |
| f | Video je **súčasť platformy**: interné video (vlastný prehrávač, úložisko interné alebo externá služba) aj externé (YouTube a pod.); **„Povinné dopozeranie videa"** je požiadavka L1. |
| g | Dizajn v **Claude Design** v základnom dizajne Continea; súčasťou L0 je **zadanie pre Claude Design**. |
| i18n | Prostredie modulu SK · CS · EN cez `lib/i18n.ts` — bez výnimky. |

---

## 2. Model, ako si ho opísal — a ako ho čítam

```
Číselník tém (tenant)          smart:tagy  „kľúč: hodnota"
        │                              │
        ▼                              ▼
  KURZ ── téma, smart:tagy, popis, jazyk, verzie
    └── ČASŤ 1 (povinná)  ── bloky obsahu ── testy [T-A]
    └── ČASŤ 2 (nepovinná) ── bloky obsahu
    └── ČASŤ 3 (povinná)  ── bloky obsahu ── testy [T-B, T-C]

  BLOK OBSAHU: text · obrázok · galéria · dokument z knižnice ·
               video interné (s povinným dopozeraním) · video externé

  BANKA OTÁZOK (tenant): otázka ── typ, text, odpovede, ≥1 smart:tag
  TESTY (tenant):        test ── zodpovedné osoby, sekcie[]
                                 sekcia = filter smart:tagov + počet otázok
                         → pri pokuse sa otázky vyberú náhodne, odpovede zamiešajú
  Test sa prideľuje ako hotový: k časti kurzu · ako krok trasy onboardingu
```

Kľúčové posuny oproti ClubUpu (a v1 tohto plánu):

1. **Kurz je plochý: kurz → časti.** Vrstvy Úroveň / Modul z ClubUpu **nie sú
   v modeli kurzu**. Téma nie je vrstva stromu, ale **atribút kurzu**
   z číselníka. ClubUpový program „4 úrovne × 10 tém" sa potom skladá
   z **40 kurzov** (každý má tému z číselníka a smart:tag `Úroveň: 1` …
   `Úroveň: 4`) zoradených do **trasy** (poradie + prerekvizity) — trasa je
   presne to, čo už Contineo má (`onboarding_tracks`) a čo ty chceš rozšíriť
   aj o testy. → **Otázka Q1** nižšie.
2. **Testy nie sú súčasťou kurzu, ale samostatná služba platformy** s vlastnou
   bankou otázok, znovupoužiteľná v kurze aj v trase onboardingu. To mení
   hranicu z ADR-003 kap. 3.1 („test nepatrí do onboardingu"): test ako
   **krok trasy** bude možný, ale zostane odlíšený od potvrdenia — potvrdenie
   je dôkaz o oboznámení, test je hodnotenie. → **Otázka Q2**.
3. **smart:tag** je nový prierezový pojem (`kľúč: hodnota`). V L1–L3 ho
   používajú kurzy, otázky a testy; je navrhnutý tak, aby sa neskôr dal
   použiť aj na dokumentoch, bez zmeny tvaru. → **Otázka Q3**.

---

## 3. Kam to v Contineu patrí

### 3.1 Modul zapínaný profilom tenanta (D34)

`Tenant.modules?: { learning?: boolean }` — chýba = vypnuté; zapína `npm run
tenant`. SFZ: zapnuté až na tvoj pokyn; LTK (`app.contineo.app`): zapnuté
kvôli vývoju. Vypnutý modul = žiadna položka v navigácii **a** `notFound()`
na `/learning*`.

### 3.2 Adresy

| Adresa | Kto | Čo |
|---|---|---|
| `/learning` | každý prihlásený | Moje kurzy: rozpracované · na zápis · dokončené; filter podľa témy a smart:tagov |
| `/learning/[courseKey]` | zapísaný | Prehľad kurzu: časti (povinná / nepovinná, stav), „pokračuj tu" |
| `/learning/[courseKey]/[partKey]` | zapísaný | Časť: bloky obsahu, prehrávač, „označiť ako prejdené", testy časti |
| `/learning/[courseKey]/[partKey]/test/[testKey]` | zapísaný | Pokus o test (L2) |
| `/learning/[courseKey]/certificate` | zapísaný | Môj certifikát (L3) |
| `/learning/manage` | `learning-admin` | Kurzy organizácie (`?tab=courses`), **Témy** (`?tab=topics`), **smart:tagy** (`?tab=tags`) |
| `/learning/manage/[courseKey]` | `learning-admin` | Časti a bloky (`?tab=parts`), nastavenia, zverejnenie / nová verzia, zapísaní (`?tab=people`) |
| `/learning/tests` | `learning-admin`, zodpovedná osoba | **Testy** (`?tab=tests`) a **Banka otázok** (`?tab=questions`); výsledky testov, za ktoré človek zodpovedá (`?tab=results`) |
| `/verify/[registrationNumber]?h=` | verejná | Overenie certifikátu (L3) |

Všetko pod `/learning` — jeden podstrom, jeden príznak, minimum konfliktov
s paralelným onboardingom. Testy majú vlastnú sekciu `/learning/tests`, lebo
sú znovupoužiteľné mimo kurzu; kým sa nepoužijú v trase, bývajú pod modulom
`learning`.

### 3.3 Roly a viditeľnosť

| Kto | Vidí / smie |
|---|---|
| bežná osoba | vlastné kurzy, vlastné pokusy a skóre, vlastné certifikáty |
| `learning-admin` | kurzy, témy, smart:tagy, banka otázok, testy; zápisy; **výsledky testov, za ktoré je zodpovedný** (rola sama osebe výsledky cudzích testov neotvára) |
| zodpovedná osoba testu (`test.responsiblePersons[]`) | výsledky a pokusy **toho testu**, reset pokusu s dôvodom (audit); bez roly `learning-admin` vidí len `/learning/tests?tab=results` |
| `hr` | prideľuje kurz adresátom; **skóre nevidí** (e) |
| `dpo` | výkaz právnych základov testov (ADR-012 D104) |

Brána `learningContext()` podľa vzoru `hrContext()`: rola **a** zhoda
`companyCode` s tenantom (D29, D32). Zodpovednosť za test je menovitá,
nie rolová — rovnaký vzor ako schvaľovatelia znenia (D69).

### 3.4 Hranica voči onboardingu (ADR-003 kap. 3.1)

Zostáva: *potvrdenie dokladuje, že si čítal; test overuje, či si pochopil* —
a jedno druhé nenahrádza. Mení sa: test **môže byť krokom trasy** (Q2), ale
krok typu `test` je vlastný druh dôkazu (pokus so skóre), nie potvrdenie.
Do ADR-003 kap. 3.1 pôjde poznámka „doplnené ADR-018".

---

## 4. Dátový model (návrh v2)

Konvencie: anglické názvy, `companyCode` v každom dotaze (D32), kópia namiesto
odkazu, kde má byť o rok čitateľné, čo sa stalo; **stav sa odvodzuje** (D27);
**dôkazy sa nemenia ani nemažú** (D24).

### 4.1 smart:tag — `lib/smartTags.ts`

```ts
/** „Bezpečnosť: Výťah" → { key: "bezpecnost", value: "vytah", label: "Bezpečnosť: Výťah" } */
interface SmartTag { key: string; value: string; label: string }
```

- Parsovanie z textu `Kľúč: Hodnota` (dvojbodka + medzera; prvá dvojbodka
  delí), normalizácia kľúča aj hodnoty na porovnávanie (bez diakritiky, malé
  písmená, ako `normalizeKey` pri trasách), **label je kópia toho, čo človek
  napísal**.
- Uložené na entite ako pole `smartTags: SmartTag[]`; index na `{ companyCode,
  "smartTags.key", "smartTags.value" }`.
- Číselník použitých tagov tenanta sa **odvodzuje** agregáciou (D27), nie
  udržiava ručne; obrazovka `?tab=tags` je prehľad + premenovanie
  (premenovanie = hromadná zmena `label`, kľúč/hodnota zostávajú).
- Filter: zoznam tagov = **AND** (otázka musí mať všetky), v rámci jedného
  kľúča viac hodnôt = **OR** (`Úroveň: 1` alebo `Úroveň: 2`). → Q4.

### 4.2 Témy — číselník `topics` tenanta

~~Rovnaký mechanizmus ako `Tenant.codelists` (D55)~~ — **zmenené 27. 9.:**
`Tenant.learningTopics[]` (`{ key, label, retiredAt? }`) po vzore právnych
základov (D92), lebo položky `codelists` vyradiť nevedia. Kurz nesie `topicKey` + **kópiu** `topicLabel`. Položka
sa nemaže, len vyradí (`retiredAt`) — kurzy na ňu odkazujú.

### 4.3 `courses` — kurz a jeho verzie

```ts
interface Course {
  companyCode: string
  key: string                     // stabilný kľúč (ako documentKey, D80); unikát v tenantovi
  title: string                   // kópia z aktuálnej verzie (zoznamy)
  topicKey: string; topicLabel: string
  smartTags: SmartTag[]
  language: string                // jazyk obsahu (D35: kurz v inom jazyku = iný kurz)
  openEnrollment: boolean         // samozápis (c)
  versions: CourseVersion[]       // zverejnená verzia je nemenná
  createdAt, createdBy
}
interface CourseVersion {
  versionId: string; version: number
  state: "draft" | "published" | "archived"
  title, subtitle?, description? (markdown), estimatedMinutes?
  sequential: boolean             // časti postupne (zamknuté) / ľubovoľne — doplnené 27. 9. (rámy COURSE, PART)
  parts: Part[]
  issuer: Issuer                  // kto vydá certifikát (kópia) — tenant, alebo externý (ŽU)
  issuesCertificate: boolean
  legalBasisKey?, legalBasisLabel?  // ako pri znení (D92) — pre záznamy o dokončení a pokusoch
  publishedAt?, publishedBy?, archivedAt?, changeNote?
}
interface Part {
  key, order, title, summary?
  required: boolean               // povinná / nepovinná
  blocks: ContentBlock[]
  tests: { testKey: string; required: boolean }[]   // hotové testy z /learning/tests
  estimatedMinutes?
}
type ContentBlock =
  | { id, type: "text", markdown }
  | { id, type: "image", fileId, alt, caption? }
  | { id, type: "gallery", items: { fileId, alt, caption? }[] }
  | { id, type: "document", documentId, versionId, title }         // znenie z knižnice (kópia názvu)
  | { id, type: "video", source: VideoSource, mustWatch: boolean, durationSec }
type VideoSource =
  | { kind: "internal", assetId: string }                            // vlastné úložisko (4.7)
  | { kind: "external", provider: "youtube" | "vimeo" | "stream", url }
```

Prečo verzie vnorené a nie kolekcia na časť: kurz sa číta a verzuje vcelku,
nová verzia = kópia dokumentu (ako `documents.versions[]`), žiadne
premapovanie ID. Súbory sú v úložisku, v dokumente sú odkazy — 16 MB je ďaleko.
Zverejnenie zmrazí aj **odkazy na testy** (`testKey` + kópia `testVersion`),
aby zmena testu neprepísala, čo ľudia robili.

### 4.4 Banka otázok — `questions`

```ts
interface Question {
  companyCode: string; key: string
  type: "single_choice" | "multiple_choice" | "true_false" | "short_text"
  text?: string (markdown)                  // text a/alebo médiá — aspoň jedno (Ján 27. 9.)
  media?: QuestionMedia[]                   // obrázky a videá, v poradí
  answers?: { id, text?, media?: QuestionMedia, isCorrect }[]  // text a/alebo jedno médium; multiple: ≥ 2 správne, single: presne 1
  // QuestionMedia = { kind: "image", fileId, alt } | { kind: "video", source: VideoSource, durationSec? }
  // dokument ani iný súbor nie — len obrázok a video
  expectedText?, expectedTextAlternatives?  // short_text
  explanation?, weight: number (1), difficulty?
  smartTags: SmartTag[]                     // ≥ 1 povinný
  status: "active" | "retired"              // otázka sa nemaže — pokusy ju citujú (snímka)
  createdAt, createdBy, updatedAt
}
```

### 4.5 Testy — `tests`

```ts
interface Test {
  companyCode: string; key: string; title; instructions? (markdown)
  responsiblePersons: { personId, fullName, email }[]   // ≥ 1 (e)
  sections: { key, title?, filter: SmartTag[], count: number }[]  // sekcia = filter + počet
  randomizeAnswerOrder: true (fixné), randomizeQuestionOrder: true (v rámci sekcie)
  passingScore: number (0–1), timeLimitSec?, maxAttempts?, cooldownMinutes?
  showAnswersAfter: "never" | "after_pass" | "after_each_attempt"
  version: number                                        // rastie pri každej zmene sekcií/pravidiel
  smartTags: SmartTag[]                                  // na zaradenie testu samého
  status: "draft" | "ready" | "retired"
}
```

Test je **recept**, nie zoznam otázok: pri každom pokuse sa pre každú sekciu
náhodne vyberie `count` otázok z banky, ktoré vyhovujú filtru (AND/OR podľa
4.1). Ak ich v banke nie je dosť, test nie je `ready` a hovorí to pri ukladaní
aj v zozname (nie až pri pokuse). Pri `multiple_choice` UI **vopred oznámi**
„táto otázka má viac správnych odpovedí" (zaškrtávacie políčka namiesto
prepínačov + veta nad otázkou).

### 4.6 Udalosti namiesto stavu (D27, D24)

```ts
enrollments      { companyCode, personId, email, fullName, courseKey, versionId, courseTitle, enrolledAt,
                   reason: "assigned" | "self" | "granted", assignmentRef?, grantedBy?, grantReason?, cancelledAt?, cancellationReason? }
                 // unikát (companyCode, personId, courseKey); druhý zápis obnovuje prvý
part_completions { companyCode, enrollmentId, personId, courseKey, versionId, partKey, at }
video_watch      { companyCode, enrollmentId, personId, courseKey, versionId, partKey, blockId,
                   watchedRanges: [start, end][], watchedSec, durationSec, updatedAt }   // jediný „mutovaný" záznam — je to meranie, nie dôkaz (ako reading_times)
test_attempts    { companyCode, testKey, testVersion, personId, context: { kind: "course", courseKey, versionId, partKey } | { kind: "track", trackKey, order },
                   attemptNumber, questionSnapshots[] (text, odpovede, váha), questionOrder[], answerOrders{}, startedAt, submittedAt?, answers[]?, score?, passed?,
                   idempotencyKey (unikát) }
certificates     { companyCode, type: "course", enrollmentId, personId, fullName, birthDate?, courseKey, versionId, courseTitle, issuedAt,
                   issuedBy: Issuer (kópia), registrationNumber (unikát), verificationHash, certificateTitle, pdf?: VersionFile, revokedAt?, revokedReason? }
```

**Odvodenie** (`lib/learningProgress.ts`, čisté funkcie, testované bez DB):
časť je hotová ⇔ existuje `part_completion` **a** každý blok `mustWatch` má
`watchedSec ≥ 0,9 × durationSec` **a** každý `required` test má `passed`
pokus; kurz je hotový ⇔ všetky `required` časti hotové. Dokončenie kurzu
nie je príznak v DB, je to dátum posledného chýbajúceho dôkazu; certifikát
je záznam o tom, že sa to vyhodnotilo a vydalo. „Označiť ako prejdené" je
zablokované, kým nie je video dopozerané (server to overuje, nie len tlačidlo).

Certifikát je v tomto modeli jedného druhu (`course`); „medzicertifikát po
úrovni" z ClubUpu je certifikát kurzu, ktorý je krokom trasy.

### 4.7 Video — vlastný prehrávač a úložisko (f)

- **Prehrávač je náš** (HTML5 `<video>` + vlastné ovládanie, mobil-first,
  bez pretáčania dopredu pri `mustWatch`; sledované rozsahy sa posielajú
  každých ~10 s a pri opustení stránky do `video_watch`). Pre YouTube sa
  použije IFrame API (dostupný je čas prehrávania, nie zákaz pretáčania —
  pri `mustWatch` sa preto odporúča interné video; UI to pri nastavovaní
  bloku povie).
- **Úložisko ako pri knižnici, adaptér nad tým** (Ján, Q5): prvé úložisko
  je **GridFS v Atlase** (`fileStore.ts`, strop **25 MB**, nahrávanie po
  kúskoch cez `chunkedUpload`, čítanie prúdom s `Range`) — žiadna ďalšia
  služba, rezidencia vyriešená raz (ADR-002). 25 MB je pri H.264 720p
  zhruba 3–5 minút, čo na interné inštruktážne klipy stačí. Pre väčšie
  videá **adaptér** `videoStorage: "gridfs" | "s3" | "azure"` v profile
  tenanta (vzor ADR-001): S3-kompatibilné (R2 / Wasabi / MinIO) a Azure Blob
  — rozhranie sa navrhne v L1, druhá implementácia príde, keď bude prvý
  zákazník s dlhými videami. Prekódovanie (HLS, viac kvalít) **nie je v L1**
  — nahráva sa hotové MP4 (H.264 + AAC); UI to pri nahrávaní povie.

### 4.8 Čo sa dedí

`writeAudit` (nové `AuditSubject`: `course`, `question`, `test`, `enrollment`,
`certificate`), `notify`/`notifyPeople`, `fileStore` (obrázky, PDF, galérie),
`chunkedUpload` (veľké súbory — video), `KeyFromLabel`, `FormattedText`,
`AppShell`, `Notice`, `TreeWithOrder` (poradie častí), ZAKLAD (`.card`,
`.empty`, `.tag--*`, `.field`), `urlParams`.

---

## 5. Otázky Q1–Q6 — **zodpovedané (Ján, 27. 9.)**

| | Odpoveď |
|---|---|
| Q1 | Áno — kurz je plochý; ClubUp = **4 trasy, jedna na každú úroveň**, každá z 10 kurzov (téma z číselníka, smart:tag `Úroveň: N`). |
| Q2 | OK — model pripraviť, krok `test` v `tracks.ts` až po dohode s onboarding session. |
| Q3 | OK — smart:tagy zatiaľ len v learningu. |
| Q4 | OK — rôzne kľúče AND, rovnaký kľúč OR. |
| Q5 | Úložisko ako pri knižnici: **GridFS do 25 MB**, na väčšie súbory adaptér pre S3 / Azure (4.7 upravené). |
| Q6 | OK — jeden jazyk obsahu na kurz (D35). |

Pôvodné znenie otázok (pre kontext):

**Q1 — Úrovne a moduly.** Rozumiem správne, že **kurz je plochý (kurz →
časti)** a ClubUpový program „4 úrovne × 10 tém" sa raz poskladá ako
**trasa z kurzov** (každý kurz = jeden modul s témou z číselníka a smart:tagom
`Úroveň: N`)? Ak áno, do L1 patrí len plochý kurz; „trasa kurzov"
s prerekvizitami je neskoršia fáza (rozšírenie `onboarding_tracks` o krok
typu `course`). Ak nie a chceš úrovne priamo v kurze, povedz — model sa dá
rozšíriť o `parts[].levelKey`, ale radšej to nerobím bez potreby.

**Q2 — Test ako krok trasy onboardingu.** Chceš to už v L2, alebo stačí, že
model to dovoľuje (`test_attempts.context.kind: "track"`) a samotný krok
`type: "test"` v `tracks.ts` sa pridá neskôr, po dohode s onboarding session?
Odporúčam **neskôr** — `tracks.ts` sa práve mení v druhej session a krok
`test` mení aj obrazovku `/documents` a reťaz dôkazov (ADR-005).

**Q3 — smart:tagy aj na dokumentoch?** Teraz len kurzy, otázky, testy.
Dokumenty majú `tags` (číselník) a `category`; zjednotenie je samostatné
rozhodnutie a nie je v L1–L3.

**Q4 — Logika filtra v sekcii testu.** Navrhujem: tagy s **rôznym kľúčom =
AND**, tagy s **rovnakým kľúčom = OR**. Príklad: `Okruh: Bezpečnosť` +
`Úroveň: 1` + `Úroveň: 2` → otázky o bezpečnosti z úrovne 1 alebo 2. Sedí?

**Q5 — Úložisko interného videa.** Vercel Blob ako prvé (najmenej práce,
funguje na Verceli hneď), adaptér pripravený na S3/GridFS. Limit na súbor
navrhujem 500 MB, bez prekódovania. Sedí?

**Q6 — Jazyk obsahu kurzu.** Predpokladám D35: prostredie je trojjazyčné,
kurz má jeden jazyk obsahu, kurz v inom jazyku je iný kurz. Sedí?

---

## 6. Fázy a kroky

Každá fáza = malé PR (jeden rám / jedna vrstva), každý so ✔ `tsc` · `eslint`
· `vitest` · `build`; `NEXT.md` sa mení len pri „Poupratuj". Rámy z Claude
Design idú **pred** obrazovkami, dátová vrstva ich nepotrebuje a ide hneď.

### L0 — Rozhodnutie, kostra, zadanie pre dizajn `[2–3 dni]`

1. **ADR-018** (osnova z plánu 17. 9. + rozhodnutia 1 a Q1–Q6); riadok do
   `docs/decisions/README.md`; poznámka do ADR-003 kap. 3.1; D117+ do
   `OPEN_DECISIONS.md`; **Fáza 10 – Vzdelávanie** do
   `Contineo_RAG_Projektovy_plan.md`; `docs/LEARNING_KONCEPCIA.md`; `CHANGELOG.md`.
2. `Tenant.modules.learning` + `videoStorage`, `scripts/tenant_set.mjs`;
   `lib/learning.ts` (rola, `learningContext()`, `learningEnabled()`).
3. `appNav.ts` (+`learning`, `learningManage`, `learningTests`), `navData.ts`,
   `i18n.ts` sekcia `learning` (SK · CS · EN), `appNav.test.ts`.
4. Prázdne `/learning`, `/learning/manage`, `/learning/tests` s `.empty`;
   `notFound()` pri vypnutom module. Nasadené, pre SFZ neviditeľné.
5. **Zadanie pre Claude Design** — `docs/design/LEARNING-zadanie.md`: pre
   každú obrazovku z 3.2 účel, rola, obsah, stavy (prázdny · zamknutý ·
   rozpracovaný · hotový · čaká na test), akcie, mobil 360 px + desktop, čo
   zo ZAKLADU použiť a čo je nové (karta kurzu, zoznam častí s povinnosťou,
   blok obsahu, prehrávač videa s „povinné dopozeranie", galéria, otázka
   testu — jedna vs. viac správnych odpovedí, výsledok testu, certifikát,
   editor sekcií testu s filtrom smart:tagov). Poradie rámov: LEARNING →
   COURSE → PART (vrátane videa) → MANAGE → MANAGE-COURSE → TESTS →
   QUESTIONS → TEST-ATTEMPT → RESULT → CERTIFICATE.

### L1 — Kurz, obsah, video, postup `[3–4 týždne]`

6. `lib/smartTags.ts` (parsovanie, normalizácia, filter) + testy.
7. Číselník tém (`codelists.topic`) + `?tab=topics`; `?tab=tags` (prehľad,
   premenovanie).
8. `lib/courses.ts` — typy 4.3, `create`, `updateDraft`, `publish`
   (validácia: ≥ 1 časť, ≥ 1 povinná, ≥ 1 blok v časti, `mustWatch` len pri
   videu s `durationSec`, testy `ready`), `newVersion`, `archive`; testy Vitest.
9. `lib/videoStore.ts` — adaptér (Blob prvý), nahrávanie cez `chunkedUpload`,
   streamovanie s `Range`; `components/VideoPlayer.tsx` (klient, sledované
   rozsahy, zákaz pretáčania pri `mustWatch`); `video_watch` zápis.
10. `/learning/manage` (kurzy, založenie) a `/learning/manage/[courseKey]`
    (časti + bloky: text, obrázok, galéria, dokument z knižnice, video
    interné/externé; poradie; povinnosť; priradenie hotových testov; zverejnenie).
11. `lib/enrollments.ts` (pridelenie cez `Audience`, samozápis, kópie,
    unikát), `part_completions`, `lib/learningProgress.ts` (odvodenie).
12. `/learning`, `/learning/[courseKey]`, `/learning/[courseKey]/[partKey]`
    — podľa rámov; **overené na 360 px**.
13. `?tab=people` (kto, kde je, kedy naposledy; CSV); notifikácie (zápis,
    nová verzia); audit; `npm run check` invarianty; `scripts/learning_init.mjs`
    (indexy).

### L2 — Banka otázok a testy `[2–3 týždne]`

14. `lib/questions.ts` — typy 4.4, validácia (single = 1 správna, multiple
    ≥ 1, ≥ 1 smart:tag), `retire` namiesto mazania; `?tab=questions`
    (zoznam s filtrom smart:tagov, formulár, import CSV cez `lib/csv.ts`).
15. `lib/tests.ts` — typy 4.5, `sections`, kontrola „dosť otázok v banke"
    pri uložení, zodpovedné osoby (`ResponsiblePicker`), `version`;
    `?tab=tests`.
16. `lib/testAttempts.ts` — `startAttempt` (výber per sekcia, zamiešanie,
    snímky, `idempotencyKey`), `submitAttempt` (vyhodnotenie podľa
    `answerOrders`, vážené skóre, limit + 10 s), `maxAttempts`, `cooldown`;
    deterministický `shuffle` so seedom v testoch.
17. `/learning/[courseKey]/[partKey]/test/[testKey]` — jedna otázka na
    obrazovku na telefóne, oznam „viac správnych odpovedí", priebežné
    uloženie (30 s), odpočet, výsledok, vysvetlenia podľa `showAnswersAfter`.
18. `?tab=results` — len testy, za ktoré je človek zodpovedný; reset pokusu
    s dôvodom (audit); CSV. HR nič.
19. GDPR: právny základ na verzii kurzu (D92 číselník), výkaz pre `/dpo`,
    retencia — dodatok k ADR-012 (`part_completions`, `video_watch`,
    `test_attempts`; vydaný certifikát sa nemaže ani neanonymizuje — ADR-021, D132).

### L3 — Certifikáty `[1 týždeň]`

20. `lib/certificates.ts` — vydanie pri dokončení kurzu (re-validácia),
    číslo `{SHORT}-{ROK}-{poradie}`, `verificationHash`, záznam, notifikácia;
    externý vydavateľ → fronta „čaká na vydanie" + ručné doplnenie čísla a PDF.
21. PDF (generované, uložené ako `VersionFile`) s overovacím odkazom a QR.
22. `/learning/[courseKey]/certificate`, zoznam v `/learning`;
    `/verify/[registrationNumber]?h=` (verejná, `publicRoutes.ts`, 404 bez hashu).
23. `revoke` s dôvodom (audit). Certifikát sa pri retencii nemení (ADR-021, D132).

### Zámerne mimo L1–L3

Trasa z kurzov s prerekvizitami a test ako krok trasy (Q1, Q2 — po dohode
s onboardingom) · predaj kurzov (objednávky, platby, DPH) · SportUp SSO ·
webináre (Teams) · prekódovanie videa (HLS) · smart:tagy na dokumentoch ·
schvaľovanie kurzu viacerými ľuďmi · tenant ClubUp s vlastnou doménou.

---

## 7. Dotknuté súbory (L0 + L1)

**Nové:** `lib/learning.ts`, `lib/smartTags.ts`, `lib/courses.ts`,
`lib/videoStore.ts`, `lib/enrollments.ts`, `lib/learningProgress.ts`,
`components/VideoPlayer.tsx`, `components/ContentBlocks.tsx`,
`components/SmartTagInput.tsx`, `app/learning/**`, `app/learning/manage/**`,
`app/learning/tests/**` (L2), `app/api/learning/video/[assetId]/route.ts`,
`scripts/learning_init.mjs`, `tests/smartTags.test.ts`, `tests/courses.test.ts`,
`tests/enrollments.test.ts`, `tests/learningProgress.test.ts`,
`docs/decisions/ADR-018-*.md`, `docs/LEARNING_KONCEPCIA.md`,
`docs/design/LEARNING-zadanie.md`.

**Upravené (ohraničené prídavky):** `lib/tenants.ts` (`modules`,
`videoStorage`), `lib/appNav.ts`, `lib/navData.ts`, `lib/i18n.ts` (sekcia
`learning`), `lib/audit.ts` (`AuditSubject`), `lib/notifications.ts`
(`NotificationKind`), `lib/codelists*.ts` (číselník `topic`),
`scripts/tenant_set.mjs`, `scripts/check.mjs`, `globals.css` (nový blok na
konci, ak ZAKLAD nestačí), `docs/decisions/README.md`, ADR-003 (poznámka),
`OPEN_DECISIONS.md`, `Contineo_RAG_Projektovy_plan.md`, `CHANGELOG.md`.

**Nedotknuté:** `documents.ts`, `acknowledgements.ts`, `assignments.ts`
(použije sa len typ `Audience`), `tracks.ts` (kým nie je Q2), `.env`, CI,
existujúce kolekcie. **Žiadna migrácia.**

---

## 8. Riziká

| Riziko | Opatrenie |
|---|---|
| Konflikty s onboarding session (`i18n.ts`, `appNav.ts`, `tenants.ts`, `globals.css`) | vlastný podstrom; do zdieľaných súborov len prídavky na konci sekcie, malé PR, rebase pred každým; `tracks.ts` sa nedotýkam (Q2) |
| LMS predbehne onboarding v ostrej prevádzke | modul pre SFZ vypnutý do tvojho pokynu; L0 nasadené neviditeľne |
| Video: veľké súbory, prenos, cena úložiska | Blob s limitom na súbor, `chunkedUpload`, bez prekódovania v L1; adaptér dovolí presun na S3 bez zmeny modelu |
| „Povinné dopozeranie" sa dá obísť | server počíta z `watchedRanges`, nie z tlačidla; externé video to nevie zaručiť a UI to pri nastavení povie |
| Test = hodnotenie osoby (GDPR) | zodpovedné osoby menovite, HR nie, právny základ na kurze, retencia — bod 19 pred L2 naostro |
| Sekcia testu bez dostatku otázok | kontrola pri uložení testu a v zozname (stav `ready`), nie pri pokuse |
| Rozsah L1–L3 (odhad 6–8 týždňov) | fázy samostatne nasaditeľné; po L1 použiteľné školenie „prečítaj, pozri, klikni" |

---

## 9. Stav

Plán **schválený 27. 9. 2026** (rozhodnutia a)–g), Q1–Q6). Ďalej: ADR-018 →
zadanie pre Claude Design → L0.
