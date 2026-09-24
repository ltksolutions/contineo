# KOMPONENT — výber oddelenia (a ostatné výbery zo zoznamu)

Referencia: `KOMPONENT-vyber-oddelenia.html`. Základ: `ZAKLAD.md`. Zdroj: `components/MultiSelect.tsx` (hľadanie bez diakritiky, klávesnica, `<noscript>`, `.multiselect-*` v globals.css ~r. 1172), `components/Select.tsx`, `lib/departments.ts` (`flattenTree`).

## Podnet (Ján, 24. 9. 2026)

Výber oddelenia má byť výber s hľadaním, ako všetky výbery. Dnes má oddelenie päť podôb na ôsmich miestach.

## Pravidlo

- **Viac hodnôt** (pridelenie, filter) → `MultiSelect` + strom.
- **Práve jedna hodnota** (model: `ownerDepartmentId`, `departmentId`, `parentId`) → `Select` s tým istým hľadaním (nový režim `searchable`). **Z jednej hodnoty sa multiselect nerobí** — zmenil by sa model (viď Q1).
- **Hľadanie** od 8 možností; pri 2–5 možnostiach (Prístup, Jazyk, Rozsah, Typ osoby…) nie.

## Miesta — oddelenia

| Obrazovka | Pole | Dnes | Návrh |
| --- | --- | --- | --- |
| `/hr/assign` | Komu → Oddelenia | štítky v strome | MultiSelect + strom + počet ľudí (nahrádza bod 3 v `HR-pravny-zaklad`) |
| `/library` | facet Oddelenie | zaškrtávacie odkazy | MultiSelect ako facet Značky |
| `/library/new` | Oddelenie, ktoré spravuje | Select s „— —" | Select + hľadanie |
| úprava dokumentu | to isté | to isté | Select + hľadanie |
| `/people/[id]` | Oddelenie | Select „— — — —" + veta Zaradenie | Select + hľadanie; cesta pod hodnotou nahradí vetu |
| `/people/new` | Oddelenie | **voľný text** | Select + hľadanie (Q2) |
| `/organisation` → Oddelenia | Nadradené | Select | Select + hľadanie |
| `/library/folders` | Nadradený priečinok | Select | Select + hľadanie |

Ostatné: **Druh** (Q3), **Pracovisko**, **Priečinok dokumentu** (úprava aj hromadný presun) → Select + hľadanie. Krátke zoznamy bez zmeny.

## Tvar

- **Zatvorené (jedna)**: názov + cesta v strome (`A › B › C`, 11.5 px, `--muted`, elipsa zľava ok). Namiesto „— " odsadenia.
- **Otvorené (jedna)**: pole hľadania v hornej časti zoznamu, výsledky s cestou, zhoda `<mark>` v `--warn-bg`. Enter vyberie a zavrie.
- **Viac — bez písania**: zoznam ako strom (odsadenie 18 px na úroveň), počet ľudí vpravo (`withDescendants`), ✓ pri zvolených; chips s počtom; `.multiselect-footer` Zrušiť výber / Hotovo; poznámka „Pridelenie oddelenia platí aj pre všetky podriadené" (`departmentNote*`).
- **Viac — s písaním**: strom sa splošti na výsledky s cestou.
- Rozmery a klávesnica z `MultiSelect.tsx` (44 px ovládanie, 40 px riadok, 16 px vstup). Bez JS: `<noscript>` ako dnes.

## Rozhodnutia Jána 24. 9. 2026

- **Q1 ✅** Dokument aj osoba majú **práve jedno oddelenie** → Select s hľadaním, nie multiselect. Zoskupovanie ľudí naprieč oddeleniami príde čoskoro cez **Značky/Tagy** (nie cez viac oddelení).
- **Q2 ✅** `/people/new`: oddelenie **zo zoznamu** (Select s hľadaním, `departmentId`), nie voľný text. Import z CSV mapuje text na `departmentId` zvlášť.
- **Q3 ✅** **Druh dostane hľadanie** — `Select` v režime `searchable`; povinnosť s JS stráži komponent, bez JS `<noscript><select required>`.

## Pôvodné otázky

- **Q1** — Oddelenie, ktoré dokument **spravuje**, a oddelenie **osoby** ostávajú jedna hodnota (model). Súhlas? (Viac oddelení osoby = skupiny, ktoré už existujú.)
- **Q2** — `/people/new` má oddelenie ako voľný text (`name="department"`), úprava osoby ako výber zo stromu. Zjednotiť na výber (`departmentId`)? Import z CSV nesie text — ten sa mapuje zvlášť.
- **Q3** — **Druh** je dnes natívny `<select required>` zámerne (povinnosť bez JS, rozhodnutie 2026-09-21). S hľadaním by bol `Select` so `<noscript><select required>`; povinnosť s JS stráži komponent. Prejsť, alebo nechať natívny?

🔴 Zmena schémy: **žiadna** (okrem Q2, ak sa `department` text nahradí `departmentId`).
