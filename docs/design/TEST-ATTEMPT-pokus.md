# TEST-ATTEMPT — Pokus o test (`/learning/[courseKey]/[partKey]/test/[testKey]`)

Referencia: `TEST-ATTEMPT-pokus.html`. Základ: `ZAKLAD.md`, `PART-cast-kurzu.md` (pás testov), `TESTS-testy-a-banka.md` (typy otázok, `showAnswers`). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 7 z 9 (L2). Model: ADR-018 (D120).

## Čo sa mení

Nová obrazovka pokusu. Nové komponenty: **otázka testu** (`AttemptQuestion`, 4 typy), **lišta pokusu** (`AttemptBar`, JavaScript), **navigátor otázok** (1440), **prehľad odpovedí**.

## Stavy a adresy

| Stav | Adresa | Obsah |
| --- | --- | --- |
| úvod | `…/test/[testKey]` | názov, popis, 4 fakty, 3 pravidlá, „Spustiť test" (`<form method="post">` vytvorí pokus) |
| priebeh | `…/test/[testKey]/[attemptId]?q=7` | lišta + jedna otázka + Späť / Ďalej / Prehľad |
| prehľad | `…?review=1` | zoznam 20 otázok, nezodpovedané `--warn-bg` |
| potvrdenie | `…?review=1&confirm=1` | karta „Odovzdať test?" s počtom a číslami nezodpovedaných |
| čas vypršal | po uzavretí serverom | karta ! `--warn` + „Zobraziť výsledok" |
| odovzdané | po odoslaní | karta ✓ `--ok` + „Zobraziť výsledok" · „Späť na časť" |

## Úvod

- Fakty (`dl`, 4 bunky): Otázok · Na prejdenie · Limit času · Pokus N z M.
- Pravidlá: losovanie a miešanie pri každom pokuse · priebežné ukladanie, čas beží ďalej aj pri výpadku · kedy uvidím správne odpovede (podľa `showAnswers`).
- Ďalší pokus: `.notice--info` „Predchádzajúci pokus 25. 9. 2026: 60 % — neprešiel."
- Keď pokus nie je možný (pauza, vyčerpané), namiesto „Spustiť" veta a vypnuté tlačidlo — rovnako ako na RESULT.

## Lišta pokusu (sticky pod hlavičkou)

„Otázka 7 / 20" · odpočet „zostáva 14:05" · stav ukladania · pás postupu 3 px.
- Odpočet: bežne `--surface-2`; < 5 min `--warn`; < 1 min `--bad`. Čas počíta **server** (začiatok pokusu + limit); klient len zobrazuje.
- Ukladanie každých 30 s a pri každom „Ďalej": „ukladá sa…" → „✓ uložené 10:14". Pri chybe „neuložené — skúšame znova" v `--warn`.
- 390: bez názvu testu.

## Otázka

- Nad znením: „Otázka 7 z 20 · váha 2" (váha len ak > 1).
- **Viac správnych**: veta **nad** znením „Táto otázka má viac správnych odpovedí — označte všetky." (`--accent-soft`, ikona políčka) + zaškrtávacie políčka.
- Jedna správna: prepínače. Voľby 52 px, celý riadok klikateľný, zvolená `--accent-soft` + rám `--accent`.
- Pravda / nepravda: dve voľby 72 px vedľa seba.
- Krátky text: pole 48 px, 16 px + „Na diakritike a veľkých písmenách nezáleží."
- Obrázok otázky nad voľbami (ak je).
- Poradie volieb = uložené poradie pokusu (D120), nie poradie v banke.

## Médiá v otázkach a odpovediach (D120)

- **Médiá otázky nad znením**: obrázok na šírku karty (16:9, `alt`), video v prehrávači **bez povinného dopozerania** (pretáčanie voľné, limit beží ďalej; veta „Video nemusíte dopozerať — pretáčať môžete voľne, čas testu beží ďalej."). Viac médií pod sebou v poradí z banky.
- **Odpovede s médiom = dlaždice**: 390 pod sebou, 834+ mriežka 2 stĺpce. Políčko / prepínač 26 px v ľavom hornom rohu dlaždice, celá dlaždica je `<label>`, min. 44 px. Zvolená: rám 2 px `--accent` + `--accent-soft`. Médium 4:3, text pod ním. Textová odpoveď v tej istej mriežke.
- **Video v odpovedi**: samostatné tlačidlo „Prehrať 0:14" **mimo** `<label>` (44 px na 390) — prehratie odpoveď nevyberie.
- „Viac správnych" — veta nad otázkou ostáva.
- Bez JS: `<img alt>`, `<video controls>`, dlaždice ako obyčajné políčka.

Rámy: 390 otázka s videom · viac správnych s dlaždicami · tmavá; 1440 oboje.

## Navigácia

- 834 / 1440: pod otázkou „← Späť" · „Prehľad odpovedí" · „Ďalej →".
- 390: spodný panel 48 px Späť / Ďalej + „Prehľad odpovedí · 3 nezodpovedané" **nad** spodnou lištou aplikácie. Navigácia aplikácie ostáva (Q1 ✅).
- 1440: vľavo navigátor 5 × 4 (zodpovedaná `--accent-soft`, preskočená `--warn-bg`, aktuálna rám 2 px `--accent`) + „Prehľad a odovzdanie".
- Aj na desktope jedna otázka na obrazovku (zadanie dovoľuje zoznam s kotvami) — rovnaké správanie ukladania a odpočtu na všetkých šírkach.

## Bez JavaScriptu

Druhý variant: všetky otázky v jednom `<form>`, jedno „Odovzdať test". Namiesto odpočtu `.notice--info` „Test ste spustili o 10:02 — odovzdajte ho do 10:32. Po tomto čase server prijme len to, čo už bolo odoslané." Veta, že odpovede sa priebežne neukladajú.

## Rámy

- **390**: úvod · 2. pokus · 4 typy otázok (krátky text pod 5 minút) · tmavá · prehľad · potvrdenie · čas vypršal · odovzdané · bez JS.
- **834**: viac správnych.
- **1440**: úvod · viac správnych s navigátorom · potvrdenie · čas vypršal · bez JS.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| AppShell (hlavička ostáva) | `AppNav.tsx` |
| `.card`, `.button`, `.notice`, `.field-input` | `globals.css` |
| Formulár bez JS s `method="post"` | vzor `/documents` potvrdenie |
| Notice, Skeleton | komponenty |

Nové: `AttemptBar` (klient: odpočet, ukladanie), `AttemptQuestion`, `QuestionNavigator`, `AttemptReview`, `.opt`, `.tf2`, `.q-multi`, `.adock`.

## Údaje, ktoré v modeli zatiaľ nie sú

- `question.media[]` — 0..n médií otázky v poradí; `answer.media` — najviac jedno médium odpovede (pri `short_text` nikdy). `QuestionMedia = { kind: "image", fileId, alt } | { kind: "video", source: "upload" | "external", fileId?, url?, durationSec }`. `alt` povinný pri obrázku. Otázka: text **alebo** aspoň jedno médium; odpoveď: text **alebo** médium (D120, rozhodnutie 27. 9. 2026). Dokumenty ani iné súbory nie.
- Snímka pokusu (D120) nesie aj `media` — pokus ukazuje médiá zo snímky (fileId sa po vyradení otázky nemaže, kým ho cituje pokus).

- `test_attempts`: `startedAt`, `deadlineAt` (server), `answers[]` s `savedAt`, `submittedAt`, `closedBy` (`user` | `timeout`).
- Snímky a poradie otázok/odpovedí pokusu (D120) — sú v ADR, len pripomenutie: obrazovka číta **len** zo snímky.

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Navigácia aplikácie **ostáva** aj počas pokusu (spodná lišta na telefóne, pás na desktope) — aby sa človek nestratil. `AppNav` sa nemení.
- **Q2 ✅** Odchod z rozpracovaného pokusu je bezpečný: odpovede sú uložené, pokus beží ďalej a pri návrate pokračuje na poslednej otázke, kým neuplynie limit (potom ho server uzavrie — stav „čas vypršal"). Test bez limitu: pokus ostáva otvorený do odovzdania.
- **Dôsledok pre PART a COURSE:** riadok testu s otvoreným pokusom ukazuje „rozpracovaný · zostáva 12 minút" + `.button` „Pokračovať" (namiesto „Spustiť"). Úvod testu pri otvorenom pokuse rovno presmeruje do priebehu.
