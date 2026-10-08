# Zadanie pre Claude Design — ZAKLAD-vyber-skupin-a-znaciek

> Podklad pre návrh **výberu skupín a značiek bez pilulky** (súpis
> `docs/DESIGN_ODCHYLKY.md`, P8). Pripravené 7. 10. 2026 proti `main` po #306.
> Časť „Prompt pre Claude Design" sa skopíruje do projektu v Claude Design;
> zvyšok je kontext pre Jána.

## Prečo

Komponent `TagSelect` vyberá **skupiny osôb** a **značky dokumentov**. Kreslí
všetky možnosti ako pilulky (`.tag.tag--choice` so znakom „+"/„✓" a počtom),
ktoré sa prepínajú JavaScriptom. Pod nimi je pole „Nová skupina/značka"
s tlačidlom „Pridať".

Konvencia (ZAKLAD-vyber-a-prepinace, 6. 10. 2026) to zakazuje:
- **pilulky sú len na čítanie**, nepatria do formulára;
- **výber viacerých** je `.form-row.select-row` (kruh vľavo, natívny
  `checkbox`, celý riadok je terč 44 px).

Ďalší problém: bez JavaScriptu sa namiesto pilulky ukáže holé textové pole
„skupiny oddelené čiarkou". Presne pred týmto poľom komponent vznikol, lebo
`rozhodcovia` a `rozhodcova` vyzerajú rovnako a v databáze sú to dve skupiny.

## Kde sa používa

| Obrazovka | Pole | Čo sa vyberá |
|---|---|---|
| `/people/<id>` (úprava osoby) | `groups` | skupiny osôb; počet = koľko ľudí ju má |
| `/library/<id>/edit` (úprava dokumentu) | `tags` | značky dokumentu |
| `/library/new` (nahratie dokumentu, krok Údaje) | `tags` | značky nového dokumentu |
| `/library/new/faq` (nové FAQ) | `tags` | značky |

Rozsah dnes (SFZ, produkcia): **2 skupiny, 5 značiek**. Môže ich byť desiatky:
skupiny pribúdajú s projektmi, značky s druhmi predpisov.

Ako to funguje dnes (`components/TagSelect.tsx`):
- **Odoslanie:** skryté pole s hodnotami oddelenými čiarkou. Server ich
  normalizuje (`trim`, malé písmená).
- **Zoznam možností:** odvodzuje sa z dát. Číselník skupín zámerne nie je
  (D38), skupina vznikne tým, že ju niekto dostane.
- **Hodnota, ktorú už nikto iný nemá:** ostane v ponuke zaškrtnutá. Inak by
  ju uloženie ticho zmazalo.
- **Nová hodnota:** pridá sa poľom a tlačidlom (JS) a založí sa až uložením
  formulára.

Pre porovnanie: trasy na `/people/<id>` už majú tvar podľa konvencie
(`fieldset.form-group` + `.form-group-body--rows` + `label.form-row.select-row`).

## Pravidlá, ktoré návrh musí dodržať

- **Výber viacerých:** `.form-row.select-row` s natívnym checkboxom
  v `.form-group` (nadpis nad kartou, pätička pod kartou). Pilulky ani
  `.view-switch` vo formulári.
- **Bez JavaScriptu** musí fungovať aj pridanie novej hodnoty. Stav je
  v adrese alebo vo formulári, nie v JS.
- **Mobile first:** rámy 390 (tmavá) a 1440 (svetlá), terč aspoň 44 px.
- **Texty** sk (cs/en doplní kód).

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Tvar zoznamu.**
- **A (odporúčam):** `.form-group` s kartou `.select-row` riadkov. V riadku je
  hodnota a vpravo tlmený počet („12 ľudí", „5 dokumentov"), ako detailový
  text v iOS `List`. Rovnaký tvar ako trasy na tej istej stránke osoby.
- B: `MultiSelect` (rozbaľovací výber s hľadaním), ako oddelenia na
  `/hr/assign`. Má zmysel až pri desiatkach možností, pri 2–5 skrýva, čo je
  na výber.

**Q2 — Veľa možností.**
- **A (odporúčam):** od 12 možností pole „Hľadať…" nad riadkami, ako
  `PeopleSearch` na `/hr/tracks/<kľúč>`. S JS filtruje riadky, bez JS sú
  vidno všetky. Zaškrtnuté idú vždy hore.
- B: vždy celý zoznam, bez hľadania.

**Q3 — Nová skupina / značka.**
- **A (odporúčam):** posledný riadok tej istej karty je pole „Nová skupina"
  (`name="groupsNew"` / `tagsNew`, viac hodnôt oddelených čiarkou). Uloží sa
  s formulárom; server ju pridá k zaškrtnutým, normalizuje a duplikát
  zahodí. Funguje bez JS a netreba tlačidlo „Pridať".
  - Pod kartou je veta „Nová skupina vznikne uložením osoby."
  - Pri podobnom názve (líši sa diakritikou alebo jedným písmenom) server
    vráti varovanie s návrhom existujúcej hodnoty. Tento prípad stojí za
    vlastným rámom.
- B: ako dnes, pole a tlačidlo „Pridať" (JS), ktoré pridá zaškrtnutý riadok.

**Q4 — Hodnota, ktorú má len táto osoba / dokument.**
- **A (odporúčam):** ostáva v zozname zaškrtnutá s tlmeným „len tu"
  namiesto počtu. Odškrtnutím a uložením zmizne a človek to vidí vopred.
- B: bez rozlíšenia.

**Q5 — Prázdny zoznam** (organizácia ešte nemá žiadnu skupinu / značku).
- **A (odporúčam):** karta má len pole „Nová skupina" a vetu „Zatiaľ žiadna
  skupina — vznikne prvou, ktorú napíšete."
- B: prázdny stav `.empty` nad poľom.

## Rámy

- 390 tmavá: `/people/<id>` (2 skupiny, jedna zaškrtnutá, pole novej
  skupiny vyplnené), `/library/new` krok Údaje (5 značiek, 2 zaškrtnuté).
- 1440 svetlá: `/library/<id>/edit` (5 značiek), zoznam s 14 hodnotami
  a hľadaním (Q2), varovanie pri podobnom názve (Q3).

## Prompt pre Claude Design

```
Navrhni ZAKLAD-vyber-skupin-a-znaciek — náhradu komponentu TagSelect
(DESIGN_ODCHYLKY P8). Je to DIFF proti existujúcim obrazovkám; mená polí
a význam ostávajú.

Dnes: skupiny osôb a značky dokumentov sa vyberajú pilulkami (.tag
tag--choice s „+"/„✓" a počtom), ktoré prepína JavaScript; pod nimi pole
„Nová skupina/značka" a tlačidlo „Pridať". Bez JS sa ukáže holé textové
pole s hodnotami oddelenými čiarkou. Konvencia: pilulky sú len na čítanie,
výber viacerých je .form-row.select-row (kruh vľavo, natívny checkbox,
celý riadok terč 44 px) v .form-group (nadpis nad kartou).

Kde: /people/<id> (skupiny — vedľa je už „Trasy" v tvare
.form-group + .select-row), /library/<id>/edit, /library/new (krok Údaje)
a /library/new/faq (značky). Dnes SFZ: 2 skupiny, 5 značiek; môžu byť
desiatky. Číselník skupín zámerne nie je — skupina vznikne tým, že ju
niekto dostane; hodnota, ktorú má len táto osoba, sa nesmie uložením
ticho stratiť.

Pravidlá: všetko bez JavaScriptu (aj pridanie novej hodnoty); .form-group,
.form-row.select-row, pätička .form-group-foot; žiadne pilulky ani
.view-switch vo formulári; rámy 390 tmavá a 1440 svetlá; terč 44 px.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. .form-group s kartou .select-row riadkov; vpravo v riadku tlmený počet
   („12 ľudí", „5 dokumentov") ako detailový text v iOS List.
2. Od 12 možností pole „Hľadať…" nad riadkami (ako PeopleSearch): s JS
   filtruje, bez JS sú vidno všetky; zaškrtnuté hore.
3. Posledný riadok karty = pole „Nová skupina" (groupsNew / tagsNew,
   viac hodnôt čiarkou), uloží sa s formulárom; pod kartou veta „Nová
   skupina vznikne uložením osoby." Pri podobnom názve (diakritika, jedno
   písmeno) server vráti varovanie s návrhom existujúcej hodnoty — nakresli.
4. Hodnota, ktorú má len táto osoba/dokument: zaškrtnutá s tlmeným
   „len tu" namiesto počtu.
5. Prázdny zoznam: len pole „Nová skupina" a veta „Zatiaľ žiadna skupina —
   vznikne prvou, ktorú napíšete."

Rámy: 390 tmavá — /people/<id> (2 skupiny, jedna zaškrtnutá, vyplnená
nová), /library/new krok Údaje (5 značiek, 2 zaškrtnuté). 1440 svetlá —
/library/<id>/edit (5 značiek), zoznam so 14 hodnotami a hľadaním,
varovanie pri podobnom názve.

Výstup ako doteraz: ZAKLAD-vyber-skupin-a-znaciek.html + .md so sekciami
Čo sa mení, Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré
v modeli neexistujú, Rozhodnuté, Otázky (každá s odporúčaním,
odporúčaná prvá) a Prompt pre Claude Code.
```
