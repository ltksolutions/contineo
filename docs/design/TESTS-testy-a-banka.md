# TESTS — Testy, Banka otázok, Výsledky (`/learning/tests`)

Referencia: `TESTS-testy-a-banka.html`. Základ: `ZAKLAD.md`, `MANAGE-COURSE-uprava-kurzu.md` (`SmartTagInput`, `.notice--warn`), `MANAGE-sprava-kurzov.md` (`.tabs`). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 6 z 9 (L2). Model: ADR-018 (D120, D121).

## Čo sa mení

Nová obrazovka so záložkami `?tab=tests | questions | results`. Nové komponenty: **editor sekcií testu** (`TestSectionEditor`), **editor odpovedí** (`AnswerEditor`, 4 typy). Nový variant `.tag--warn`.

## Prístup

- `tests`, `questions`: rola `learning-admin`.
- `results`: **len zodpovedná osoba testu** a len jej testy. `learning-admin` ani `hr` ju samy osebe nemajú (D121). Kto nie je zodpovedný za žiadny test, záložku nevidí.
- Navigácia: „Testy" za „Správa kurzov"; na telefóne Viac → Správa.

## Záložka Testy

- `.view-switch`: Všetky · Pripravené · Koncepty · Vyradené. „Nový test".
- Tabuľka (390: karty): Test · Sekcie · Otázok · Hranica · Zodpovedné osoby (iniciály `.av-row`; bez osoby červená veta „nikto — nedá sa pripraviť") · Stav · „Upraviť".
- Stavy: Koncept `.tag--draft` · Pripravený `.tag--published` · ⚠ Nedostatok otázok `.tag--warn` · Vyradený `.tag--archived`.

```css
.tag--warn { background: var(--warn-bg); color: var(--warn-fg); border-color: transparent; }
```

### Editor testu (`/learning/tests/[testKey]`)

1440: obsah + bočný stĺpec 300 px. 390: bočná karta „Stav testu" navrchu.

- **Základ**: Názov · Inštrukcie · **Zodpovedné osoby** = `ResponsiblePicker` v režime 1..n (políčka v posuvnom rámiku, nič predvolené). Bez osoby veta v `--bad`.
- **Sekcie**: riadok = `SmartTagInput` + Počet + živý údaj:
  - dosť: „V banke vyhovuje 37 otázok" `--ok-fg` + „Zobraziť v banke"
  - málo: celá sekcia `--bad-bg`/`--bad-fg` okraj, „V banke vyhovuje len 5 otázok — chýba 3" + „Pridať otázky →" (banka s filtrom sekcie)
  - poradie ↑ ↓, „Odstrániť", „Pridať sekciu"
  - veta: losuje sa pri každom pokuse, odpovede sa miešajú; rôzne kľúče = AND, rovnaký kľúč = OR
- **Pravidlá**: Hranica úspešnosti % · Limit času · Najviac pokusov · Pauza medzi pokusmi · Kedy ukázať správne odpovede (Nikdy · po odovzdaní · po prejdení · po vyčerpaní pokusov).
- **smart:tagy testu** (na hľadanie; nemenia losovanie).
- Bočná karta **Stav testu**: pilulka + `.check` (zodpovedné osoby · každá sekcia má dosť otázok · pravidlá vyplnené) + veta „Hovorí sa to pri uložení, nie pri pokuse."
- Bočná karta **Použité v**: kurz · časť · povinný · verzia testu.
- Pás „Uložiť" + stav + „Vyradiť test".

Počet vyhovujúcich otázok sa počíta pri uložení (bez JS); s JS aj pri zmene tagov.

## Záložka Banka otázok

- „Nová otázka" · „Import CSV".
- 1440: facety vľavo (smart:tagy po kľúčoch, Typ, Stav) ako v knižnici; 390: `<details>` „Filter".
- Zvolené: `.library-chip` + počet + „Zrušiť filtre".
- Tabuľka (390: karty): Otázka + `.stag` · Typ · Váha · Stav · „Upraviť". Vyradená: text `--muted` + `.tag--archived`.
- Prázdna banka: `.empty` „Banka otázok je prázdna" + „Nová otázka" / „Import CSV".

### Formulár otázky

Typ (4 prepínače) · Znenie · Obrázok (nepovinné) · **Odpovede podľa typu** · Vysvetlenie („Ukáže sa po odovzdaní, ak to test povoľuje.") · Váha · Obtiažnosť · smart:tagy.

| Typ | Editor odpovedí |
| --- | --- |
| Jedna správna | prepínače; správna riadok `--ok` |
| Viac správnych | políčka; aspoň dve správne; veta „Študent uvidí vetu ‚Táto otázka má viac správnych odpovedí'" |
| Pravda / nepravda | dve veľké voľby 48 px |
| Krátky text | Očakávaná odpoveď + „Aj takto je správne" (pilulky); porovnanie bez diakritiky a veľkosti písmen |

- **Aspoň jeden smart:tag**: bez neho sa otázka neuloží, veta „…bez neho otázku žiadny test nevylosuje." v `--bad`.
- Pri existujúcej otázke: „Použitá v 2 testoch · 41 pokusov ju cituje snímkou" + „Vyradiť" (nie zmazať, D120).

## Médiá v otázkach a odpovediach (D120, Ján 27. 9. 2026)

- **Otázka**: text a/alebo 0..n obrázkov a videí (interné aj externé) v poradí. Aspoň jedno z textu a médií povinné.
- **Odpoveď**: text a/alebo **jedno** médium (obrázok alebo video). Aspoň jedno povinné. „Krátky text" = odpoveď vždy text, médium len v otázke.
- **Obrázok** má povinné pole „Popis obrázka" (alt).
- **Video v otázke sa nemusí dopozerať** — limit času beží ďalej. Povinné dopozeranie je len pri kurze (PART).

Formulár otázky:
- Pod znením „Obrázky a videá v otázke": zoznam (náhľad 88 px · Popis obrázka · ↑ ↓ · Odstrániť) + „Pridať obrázok" · „Pridať video" (`UploadFiles`, priebeh v `.upload-overlay`) · „Vložiť odkaz na video".
- Každá odpoveď: hlavička (správna ✓ · „Odpoveď A" · prepínač obsahu **Text · Obrázok · Video** · Odstrániť), telo (médium + Popis obrázka / súbor videa + „Text pod … — nepovinné"), vpravo **náhľad dlaždice** ako v teste (834/1440; na 390 nie).
- Validácia pri uložení (`.notice--error` + veta pri poli): „Otázka potrebuje text alebo aspoň jeden obrázok či video." · „Odpoveď 3 je prázdna." · „Chýba popis obrázka."
- Zoznam banky: ikonky obrázka a videa (`Icon.tsx`, 15 px, `--muted`) vedľa typu.
- Import CSV médiá nenesie — veta v náhľade importu: „Obrázky a videá sa pridajú pri otázke po importe."

Rámy: 1440 formulár s obrázkom v otázke a odpoveďami obrázok · video · text; 390 to isté; 390 chyby.

## Záložka Výsledky

- Výber testu (Select, len testy, za ktoré zodpovedám; pod názvom kto ďalší zodpovedá) · „Export CSV".
- Tabuľka (390: karty): Osoba + oddelenie · Kurz / kontext · Dátum · Pokus N z M · Skóre · Prešiel/Neprešiel (`.tag--published` / `.tag--expired`) · „Resetovať" (pri vyčerpaných pokusoch).
- **Resetovať pokusy** (`?reset=[attemptOwner]`): karta s `--bad-fg` okrajom, veta čo sa stane, **povinný dôvod**, „Resetovať pokusy" / „Zrušiť". Pokusy sa nemažú — označia sa ako resetované (D24), zápis do auditu.
- Na ráme poznámka (modrý rámik — nie je súčasť UI): HR túto záložku nemá.

## Rámy

- **390**: testy · editor s chybami · editor pripravený (tmavá) · banka · prázdna banka · nová otázka bez tagu · krátky text · výsledky · reset.
- **834**: testy.
- **1440**: testy · editor pripravený · editor s chybami · banka · otázka viac správnych · výsledky + reset.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| ResponsiblePicker | `components/ResponsiblePicker.tsx` — rozšíriť o 1..n |
| Facety, `.library-chip`, `<details>` filter | `/library` |
| `.doc-table`, `.pager`, `.view-switch`, `.check`, `.empty` | `globals.css` |
| UploadFiles (obrázok otázky, import CSV) | `components/UploadFiles.tsx` |
| Audit | `lib/audit.ts` |
| Select `searchable` | `Select.tsx` |

Nové: `TestSectionEditor`, `AnswerEditor`, `.tag--warn`, `.sec2`, `.ansr`, `.tf`, `.rp`.

## Údaje, ktoré v modeli zatiaľ nie sú

- `question.media[]` — 0..n médií otázky v poradí; `answer.media` — najviac jedno médium odpovede (pri `short_text` nikdy). `QuestionMedia = { kind: "image", fileId, alt } | { kind: "video", source: "upload" | "external", fileId?, url?, durationSec }`. `alt` povinný pri obrázku. Otázka: text **alebo** aspoň jedno médium; odpoveď: text **alebo** médium (D120, rozhodnutie 27. 9. 2026). Dokumenty ani iné súbory nie.

- `test.versions[]` — zmena receptu po priradení ku zverejnenému kurzu (D118 zmrazuje `testVersion`).
- `test.showAnswers`: `never | after_submit | after_pass | after_last_attempt`.
- `question.difficulty`, `question.alternatives[]` (krátky text).
- `test_attempts.resetAt`, `resetBy`, `resetReason`.
- Počet vyhovujúcich otázok na sekciu (odvodené dopytom nad bankou).

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅** Vlastný formát CSV (nižšie). Vzor: `TESTS-import-otazok-vzor.csv`.
- **Q2 ✅** „Viac správnych" sa boduje **všetko alebo nič**: plná váha len pri presnej zhode (všetky správne, žiadna nesprávna), inak 0. Dôvod: pri pomernom bodovaní sa oplatí zaškrtnúť všetko; test overuje pochopenie pre prax (bezpečnosť, predpisy), nie odhad. Pomerné bodovanie sa dá pridať neskôr ako voľba testu — model ukladá odpovede, nie body, takže prepočet je možný.

## Import otázok z CSV

**Súbor:** UTF-8 (s BOM aj bez), oddeľovač `;` (predvolený v slovenskom a českom Exceli), prvý riadok hlavička, jeden riadok = jedna otázka. Názvy stĺpcov a hodnoty typu sú **anglické kódy** — rovnaké pre sk/cs/en, nemenia sa s jazykom prostredia. Poradie stĺpcov nerozhoduje, rozhoduje hlavička.

| Stĺpec | Povinný | Obsah |
| --- | --- | --- |
| `id` | nie | vlastný kľúč otázky. Ak otázka s týmto `id` v banke už je, riadok ju **upraví** (nová snímka, pokusy citujú starú); inak vznikne nová. Prázdne = vždy nová. |
| `type` | áno | `single` · `multiple` · `true_false` · `short_text` |
| `text` | áno | znenie otázky; nový riadok v bunke = nový odsek |
| `answer_1` … `answer_8` | podľa typu | odpovede. `single` 2–8, `multiple` 3–8, `true_false` prázdne, `short_text` = očakávaná odpoveď v `answer_1`, alternatívy v `answer_2`… |
| `correct` | áno pre `single`, `multiple`, `true_false` | čísla odpovedí oddelené čiarkou (`2` · `1,3,4`); pri `true_false` `true` alebo `false`; pri `short_text` prázdne |
| `explanation` | nie | vysvetlenie po odovzdaní |
| `weight` | nie | celé číslo ≥ 1, predvolene `1` |
| `difficulty` | nie | `easy` · `medium` · `hard`, predvolene `medium` |
| `tags` | áno | smart:tagy `Kľúč: Hodnota` oddelené `|` (`Bezpečnosť: Požiar | Úroveň: 1`) — aspoň jeden |

Obrázky a videá sa CSV nenahrávajú — veta v náhľade importu: „Obrázky a videá sa pridajú pri otázke po importe."

**Pravidlá kontroly** (každá chyba = veta s číslom riadku):
- neznámy `type` · chýba `text` · chýba `tags` alebo tag nie je v tvare „Kľúč: Hodnota"
- `single`: práve jedno číslo v `correct` · `multiple`: aspoň dve · číslo mimo vyplnených odpovedí
- `short_text` bez `answer_1`
- duplicitné `id` v súbore

**Postup (bez JS, dva kroky):**
1. `?tab=questions&import=1` — nahrať súbor (`UploadFiles`, priebeh v `.upload-overlay`).
2. Náhľad: „42 otázok · 38 nových · 3 úpravy · 1 chyba" + tabuľka riadkov s chybou (riadok · stĺpec · veta). Pri chybe sa **neimportuje nič** — opraviť súbor a nahrať znova. Bez chýb: „Importovať 41 otázok".

Nové kľúče a hodnoty smart:tagov z importu sa v náhľade vypíšu zvlášť („Nové smart:tagy: Bezpečnosť: Eskalátor"), aby sa preklep nedostal do banky potichu.

**Export** banky (tlačidlo pri filtri) používa ten istý formát — súbor sa dá upraviť a nahrať späť cez `id`.
