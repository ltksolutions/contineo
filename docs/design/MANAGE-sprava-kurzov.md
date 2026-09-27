# MANAGE — Správa kurzov (`/learning/manage`)

Referencia: `MANAGE-sprava-kurzov.html`. Základ: `ZAKLAD.md`, `LEARNING-moje-kurzy.md` (`.stag`). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 4 z 9. Model: ADR-018 (D117, D118, D121, D122).

## Čo sa mení

Nová obrazovka pre rolu `learning-admin` so záložkami `?tab=courses | topics | tags` (tvar ako `/organisation`). Brána `learningContext()` = rola **a** `companyCode`.

## Navigácia

- Desktop: „Správa kurzov" za „Vzdelávanie", potom „Testy" (rám TESTS).
- Telefón: pod **Viac → Správa** (`MORE_GROUPS.management`); lišta svieti na „Viac".

## Záložka Kurzy

- `.page-head`: „Správa kurzov" + `.button` „Nový kurz".
- Filter stavu: `.view-switch` ako odkazy `?status=all|draft|published|archived` s počtami.
- **834 / 1440**: `.doc-table` — Kurz (názov + kľúč mono + „otvorený na zápis") · Téma · Stav · Zapísaní · Dokončili (pravé stĺpce, `th.doc-col-right`) · Upravené · „Upraviť". Pod tabuľkou `.pager`.
- **390**: karty (pilulky stavu, názov, téma, „48 zapísaných · 31 dokončilo").
- **Stav** = `.tag--draft` / `--published` / `--archived` + „· vN". Zverejnený s rozpracovanou novou verziou má **dve pilulky** („Zverejnený · v2" + „Koncept · v3").
- Počty zapísaných a dokončených sú počty, **nie skóre** (D121).

### Nový kurz

- `?new=1` → karta nad zoznamom (orámovaná `--accent`): Názov (`KeyFromLabel`, náhľad „Kľúč v adrese: …") + Téma (Select, len aktívne témy) + „Vytvoriť koncept" / „Zrušiť".
- Vytvorí koncept v1 a presmeruje na `/learning/manage/[courseKey]`.

### Prázdne

`.empty` „Zatiaľ tu nie je žiadny kurz" / „Kurz vznikne ako koncept — časti, bloky a nastavenia doplníte pred zverejnením. Téma musí existovať v záložke Témy." + „Nový kurz".

## Záložka Témy

- Zoznam v `.card`: názov + kľúč · počet kurzov · „Premenovať" · „Vyradiť" (vyradená: `.tag--archived`, názov `--muted`, „Vrátiť").
- Dole formulár „Nová téma" (`KeyFromLabel`) + `.button--quiet` „Pridať tému".
- Vyradená téma sa nedá zvoliť pri novom kurze; existujúce kurzy si ju nechajú. **Nemaže sa** (zverejnené verzie ju citujú).

## Záložka smart:tagy

- Karta na kľúč: hlavička (kľúč · „kurzy 3 · otázky 42 · testy 2" · „Premenovať kľúč"), riadky hodnôt (`.stag` · kurzy · otázky · testy · „Premenovať").
- 390: počty ako jeden riadok pod hodnotou.
- Premenovanie: formulár pod riadkom (`?rename=key:value`), pole s novým zápisom, veta „Zmení sa na všetkých 16 miestach (1 kurz, 14 otázok, 1 test)…", „Premenovať" / „Zrušiť".
- smart:tag sa **tu nevytvára** — vzniká, kde sa prvýkrát napíše. Hodnota bez použitia sa v prehľade neukazuje.

## Rámy

- **390**: kurzy · nový kurz · prázdne · tmavá · témy · smart:tagy s otvoreným premenovaním.
- **834**: kurzy.
- **1440**: kurzy · prázdne · témy · smart:tagy.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| Záložky obrazovky | `/organisation?tab=` |
| KeyFromLabel | komponent (názov → kľúč) |
| `.doc-table`, `th.doc-col-right`, `.pager`, `.view-switch`, `.doc-card` | `globals.css` (ZAKLAD úlohy 2, 5) |
| Číslovník s vyradením | `category` (D55) |
| Select s hľadaním | `Select.tsx` (`searchable`, KOMPONENT-vyber-oddelenia) |
| AppShell, `/more` | `AppNav.tsx`, `lib/appNav.ts` |

Nové: `.tabs` (ak `/organisation` nemá triedu na znovupoužitie — overiť), `.tgk`/`.tgv`, `.trow`.

## Údaje, ktoré v modeli zatiaľ nie sú

- Kolekcie `courses`, `enrollments`; `topics` ako číselník organizácie (`retiredAt`).
- Agregácia smart:tagov naprieč `courses`, `questions`, `tests` (počty) — odvodená, neukladá sa.

## Otázky pre Jána

- **Q1** — Premenovanie smart:tagu mení `label` **aj v zverejnených verziách** kurzov a v snímkach otázok v pokusoch? Návrh: mení sa len zobrazený text v živých záznamoch (koncepty, banka, testy, filtre); zverejnené verzie a snímky pokusov (D118, D120) ostávajú, ako boli — porovnáva sa normalizovaný tvar, takže filter funguje ďalej. Premenovanie na existujúcu hodnotu = zlúčenie.
