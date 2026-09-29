# KOMPONENT — hľadanie v zozname osôb

Referencia: `KOMPONENT-hladanie-osob.html`. Základ: `ZAKLAD.md`, pravidlo „hľadanie od 8 možností" z `KOMPONENT-vyber-oddelenia.md`.
Zdroj: `components/ResponsiblePicker.tsx`, `components/ApprovalPanel.tsx`, `app/library/[id]/page.tsx` r. 895–923, `.approval-people` / `.approval-person` v `globals.css` r. 4206–4231, normalizácia z `MultiSelect.tsx`.

## Čo sa mení

Zoznamy **Schvaľovatelia** a **Zodpovedná osoba** (príprava znenia) dostanú nad rámikom:

1. **Riadok vybraných** — čipy s ×, viditeľné aj keď filter vybraného skryje.
2. **Pole hľadania** (lupa, 40 px) — filtruje zoznam počas písania; meno, e-mail, oddelenie; bez diakritiky; viac slov = AND. Zhoda `<mark>` v `--warn-bg`.
3. **Počet** „3 z 142" (`aria-live`), len keď je niečo napísané.
4. **Prázdny výsledok** v rámiku s dôvodom (vyradení / seba nie) a „Zrušiť hľadanie".

Samotný zoznam políčok/prepínačov, poradie a posuvný rámik 260 px **ostávajú**.

## Prečo

Pri desiatkach ľudí sa v rámiku 260 px meno hľadá rolovaním. Komentár v `ResponsiblePicker.tsx` (políčka namiesto rozbaľovacieho výberu — lepšie na telefóne, bez JS) platí ďalej, preto **filter nad zoznamom, nie `MultiSelect`**.

## Kde

Jeden klientsky obal (napr. `PeopleSearch`) okolo `.approval-people`, použitý v:
- `ResponsiblePicker` (prepínač aj `multiple` — test, ADR-018/D121, zmena zodpovednej osoby)
- výber schvaľovateľov v `library/[id]/page.tsx` a `ApprovalPanel.tsx`

## Správanie

- Pole sa zobrazí od **8 osôb**; menej = dnešný zoznam.
- Odfiltrované riadky len `hidden` — zostávajú vo formulári, zaškrtnuté sa odošlú.
- **Enter v poli nikdy neodošle formulár** (dnes by spustil „Predložiť na schválenie"). Pri jednom výsledku ho vyberie a pole vyčistí.
- ↓ = fokus na prvé viditeľné políčko, Esc = vyčistiť.
- Vybraní sa hore nepresúvajú (riadok by uskočil pod kurzorom).
- × pri zodpovednej osobe zruší voľbu — v príprave je nepovinná (`required={false}`). Pri `required` (zmena po zverejnení) čip × nemá.
- Bez JS: pole ani čipy sa nevykreslia, zoznam funguje ako dnes.

## Rámy

- **1440** — píše „gal", 2 schvaľovatelia vybraní (jeden odfiltrovaný, vidno ho v čipe), zodpovedná osoba určená.
- **834** — bez písania, čipy nad poľom.
- **390** — nič nevyhovuje; pole 44 px, vstup 16 px, čip 36 px; bez nápovedy klávesnice.
- Stavy: menej ako 8 ľudí, Enter pri jednom výsledku, bez JS.

## i18n (sk/cs/en)

`people.search.placeholder` „Hľadať meno, e-mail alebo oddelenie", `people.search.count(n, total)`, `people.search.picked(n)` „Vybraní (n)", `people.search.pickedOne` „Vybraná", `people.search.none(q)`, `people.search.noneApprovers` „Vyradení sa neponúkajú a seba schváliť nemôžeš.", `people.search.noneResponsible` „Vyradení sa neponúkajú.", `people.search.clear` „Zrušiť hľadanie", `people.search.remove(name)`.

## Údaje, ktoré v modeli neexistujú

Žiadne. `ResponsibleChoice` (`id`, `fullName`, `email`, `department`) stačí. 🔴 Zmena schémy: **žiadna**.

## Rozhodnutia 29. 9. 2026

- **Q1 ✅** Pole hľadania od **8 osôb**, pod 8 zoznam ako dnes.
- **Q2 ✅** **Enter pri jednom výsledku osobu vyberie** a pole vyčistí; formulár nikdy neodošle.
- **Q3 ✅** Rovnaký obal aj pre **„Komu" v `/hr/assign`** (osoby) — ako samostatný krok po schvaľovateľoch a zodpovednej osobe.
