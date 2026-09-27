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

- Karta na kľúč: hlavička (kľúč · „kurzy 3 · otázky 50 · testy 3" · „Premenovať kľúč"), riadky hodnôt (políčko · `.stag` · kurzy · otázky · testy · „Premenovať").
- 390: počty ako jeden riadok pod hodnotou, políčko 44 px.
- Premenovanie: formulár pod riadkom (`?rename=key:value`), pole s novým zápisom, veta „Zmení sa všade — na 15 miestach (2 kurzy, 12 otázok, 1 test), vrátane filtrov sekcií testov.", „Premenovať" / „Zrušiť".
- **Premenovanie na existujúcu hodnotu = zlúčenie**: veta v `--warn-fg` „„Bezpečnosť: Požiar" už existuje — zlúčia sa. Zostane jeden tag na 17 miestach (…)." a tlačidlo „Zlúčiť" namiesto „Premenovať".
- smart:tag sa **tu nevytvára** — vzniká, kde sa prvýkrát napíše. Hodnota bez použitia sa v prehľade neukazuje; kľúč bez hodnôt tiež nie.

## Zlúčenie

Rozhodnutie Jána 27. 9. 2026. Knižnica je hotová (`mergeSmartTags`), chýba obrazovka.

**Pravidlá**
- Premenovanie aj zlúčenie mení tag **všade**: kurzy, banka otázok, testy vrátane filtrov sekcií (Q1 ✅ — alternatíva).
- Zlúčiť sa dá **2 a viac** hodnôt do jednej. Cieľ = jedna zo zlučovaných alebo nový zápis „Kľúč: Hodnota". Kurz/otázka/test, ktorý mal viac zlučovaných, dostane cieľ **raz**.
- V rámci jedného kľúča aj **naprieč kľúčmi** („Bezpecnost: Lift" + „Bezpečnosť: Výťah"). Kľúč, ktorému nezostane žiadna hodnota, zmizne z prehľadu.

**Postup**
1. **Výber**: políčko pri každom riadku hodnoty (390: 44 px). Vybraný riadok `--accent-soft` + `inset 3px 0 0 var(--accent)`. Od 2 vybraných pás **„Vybraté 3 · Zlúčiť do…"** + „Zrušiť výber":
   - 1440: nad kartami, `position: sticky; top: 0`, s vybranými `.stag`;
   - 390: prilepený dole nad spodnou lištou (ako savebar v `/organisation`), bez zoznamu tagov.
2. **Zlúčiť do…** (`?merge=K:V,K:V,…`): karta pod pásom — „Zlúčiť 3 smart:tagy do jedného", prepínače „Čo zostane" (vybrané `.stag` + použitie; predvolená najpoužívanejšia) a posledná voľba **„Nový zápis"** s poľom „Kľúč: Hodnota". Veta dopadu: „Zmení sa na 23 miestach (4 kurzy, 17 otázok, 2 testy) — aj vo filtroch sekcií testov. Vybrané tagy zmiznú, zostane „Bezpečnosť: Výťah". …dostane „Bezpečnosť: Výťah" raz." + „Zlúčiť" / „Zrušiť". Dopad sa počíta na serveri pri zobrazení kroku 2.
3. **Výsledok**: `.notice` „Zlúčené: 3 tagy → Bezpečnosť: Výťah (23 miest)." Cieľový riadok krátko v `--ok-bg`. Audit: subjekt `smart:tag`, akcia `zlúčené`, zoznam zdrojov a cieľ.

**Bez JS**: karty sú jeden `<form method="get">` s políčkami a tlačidlom „Zlúčiť vybraté" → `?merge=…` zobrazí ten istý formulár (krok 2). S JS sa pás ukazuje priebežne.

**Chyby** (`.notice--error` / veta pod poľom v `--bad-fg`)
- vybratá 1 hodnota → „Na zlúčenie treba aspoň dva smart:tagy."
- neplatný nový zápis → „„X" nie je smart:tag v tvare „Kľúč: Hodnota"."

**Rámy zlúčenia**: 390 výber + pás · formulár s dopadom · výsledok · formulár v tmavej téme; 1440 to isté; dve chybové karty.

## Rámy

- **390**: kurzy · nový kurz · prázdne · tmavá · témy · smart:tagy s premenovaním na existujúcu hodnotu · zlúčenie (3 kroky + tmavá).
- **834**: kurzy.
- **1440**: kurzy · prázdne · témy · smart:tagy s premenovaním · zlúčenie (3 kroky).

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| Záložky obrazovky | `/organisation?tab=` |
| KeyFromLabel | komponent (názov → kľúč) |
| `.doc-table`, `th.doc-col-right`, `.pager`, `.view-switch`, `.doc-card` | `globals.css` (ZAKLAD úlohy 2, 5) |
| Číslovník s vyradením | `category` (D55) |
| Select s hľadaním | `Select.tsx` (`searchable`, KOMPONENT-vyber-oddelenia) |
| AppShell, `/more` | `AppNav.tsx`, `lib/appNav.ts` |
| Zlúčenie a premenovanie smart:tagov | `mergeSmartTags`, `renameSmartTag`, `renameSmartTagKey` v `lib/smartTagsDb.ts` |
| Savebar prilepený dole | `/organisation` |
| Audit | `lib/audit.ts` |

Nové: `.tabs` (ak `/organisation` nemá triedu na znovupoužitie — overiť), `.tgk`/`.tgv`, `.trow`.

## Údaje, ktoré v modeli zatiaľ nie sú

- Kolekcie `courses`, `enrollments`; `topics` ako číselník organizácie (`retiredAt`).
- Agregácia smart:tagov naprieč `courses`, `questions`, `tests` (počty) — odvodená, neukladá sa.

## Rozhodnutia Jána 27. 9. 2026

- **Q1 ✅ (alternatíva)** Premenovanie aj zlúčenie mení smart:tag **všade** — kurzy, banka otázok, testy vrátane filtrov sekcií. Premenovanie na existujúcu hodnotu je zlúčenie. Knižnica: `lib/smartTagsDb.ts`.

## Pôvodná otázka

- **Q1** — Premenovanie smart:tagu mení `label` aj v zverejnených verziách? Návrh bol: len v živých záznamoch. Rozhodnuté inak (vyššie).
