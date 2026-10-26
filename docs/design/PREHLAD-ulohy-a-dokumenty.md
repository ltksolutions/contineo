# PREHLAD-ulohy-a-dokumenty — Prehľad bežného používateľa

Artefakt *Design*: https://claude.ai/artifact/81LbjeKbakaztb7LPW3YRb
(pripojený „Contineo — design system", verzia `1793052749-cc8f`).
Stiahnuté 26. 10. 2026: hlavná plocha `Main.dc.html` (1440) ako
`PREHLAD-ulohy-a-dokumenty.html`; plátno má ešte rámy 834, 390 a Stavy.
Zadanie: `PREHLAD-ulohy-a-dokumenty-zadanie.md`.

## Rozhodnuté (Ján 26. 10. 2026: „Q1–Q5 podľa odporúčaní (A)")

- **Q1 — rozsahy pri 5+ druhoch:** A — pás `.view-switch` s počtami, na
  telefóne a tablete sa roluje vodorovne, na počítači všetky v rade.
- **Q2 — akcia v riadku:** A — celý riadok je odkaz na detail (šípka
  vpravo), „Opýtať sa" je na detaile, v zozname nie.
- **Q3 — „nové":** A — len pri dokumente zverejnenom od môjho
  predchádzajúceho prihlásenia (ako `isNewFor()` pri úlohách).
- **Q4 — od 1024 px:** A — pod sebou na celú šírku, úlohy prvé.
- **Q5 — dlaždica Knižnica:** A — ostáva v rozcestníku.

## Odchýlky od design systému (schválené, pridané do `globals.css` a `conventions.md`)

1. `.view-switch--scroll` — pás rozsahov s vodorovným rolovaním.
2. `a.panel-row.panel-row--link` + `svg.panel-chevron` — riadok zoznamu ako
   odkaz so šípkou namiesto `.panel-action`.
3. `.panel-group` (+ `--bad`) — nadpis skupiny vnútri panela.
4. `.task-icon` (+ `--bad`, `--soon`, `--decide`) — ikona druhu úlohy
   v kruhu 36 px; farba nesie naliehavosť.

## Odchýlky implementácie od návrhu

- **Dokumenty 6 riadkov, nie 8** (návrh 1440): platí skoršie rozhodnutie
  Q2 z `ZAKLAD-prehlad-a-detail-pre-pouzivatela.md` (6 riadkov).
- **Skupina „Blíži sa termín"** namiesto „Tento týždeň" — hranica je
  `SOON_DAYS` (5 dní), nie kalendárny týždeň; úlohy s neskorším alebo
  žiadnym termínom sú v skupine **„Ďalšie"**, ktorú návrh nekreslil.
- **Druhý riadok úlohy:** úkon · druh · krok trasy, a keď úloha nie je
  z trasy, dátum účinnosti — návrh 1440 mal dátum aj pri trase.
- **Prázdne úlohy** ostávajú dvojriadkové `.panel-empty` bez ikony
  (Stavy 1 mali zelenú fajku — `task-icon--ok` by bola piata odchýlka).
- Počet pri nadpise (`5 · z toho 3 po termíne`) používa `.panel-head-count`
  v `h2.section-group-title`, bez novej triedy.
- Hlavička aplikácie v návrhu je len kontext; nemení sa.
