# ASK.md — Opýtať sa (`/ask`)

**Jediné miesto, kde sa otázka odpovedá.** Pole v hlavičke aj hero pole na
Prehľade odosielajú `GET` s `?q=` práve sem.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `ASK.html`
(1440 / 390 + bez otázky + odpoveď + nič sa nenašlo + chyba).

---

## Routa zostáva — a komentár v nej je zastaraný

`/ask/page.tsx` má v hlavičke komentár **„Domovská strana"**. Je to
pozostatok z čias, keď `/` a `/ask` boli jedno. Od PR 5 je `/` Prehľad
s KPI a `/ask` je obrazovka odpovede.

**Oprav komentár, nie obsah** — a nechaj v ňom zmienku, že `?q=` prichádza
z poľa v hlavičke a z hero poľa Prehľadu, lebo to je dôvod, prečo routa
nesmie zmiznúť.

## Čo je UŽ HOTOVÉ — nerob znova

| Vec | Kde | Stav |
| --- | --- | --- |
| Hero karta okolo poľa otázky | `.ask-hero` (3008) | ✅ |
| Pole otázky + počítadlo znakov | `.ask-field`, `.ask-counter` (3018) | ✅ |
| Príklady otázok | `.ask-example` (3054) | ✅ |
| Karta odpovede s hlavičkou | `.answer-head`, `.answer-kicker` (3072) | ✅ |
| Značka Continea v hlavičke odpovede | `.answer-mark` (3079) | ✅ |
| Zdroje ako karty s odkazom na originál | `.answer-source` (3099) | ✅ |
| Poradové číslo zdroja `[1]` | `.answer-source-index` (3114) | ✅ |
| Fázy streamovania odpovede | `.answer-phase` (4205) | ✅ |
| Hodnotenie odpovede | `Rating.tsx` | ✅ |
| `<noscript>` hláška | PR 7 | ✅ |
| `?q=` z hlavičky bez JS | `page.tsx` | ✅ |

---

## Úloha 1 — Tri stavy obrazovky, dnes rozlíšené dva

**Teraz:** obrazovka pozná „bez otázky" (hero + príklady) a „odpoveď".
Chýba **„na otázku sa nedá odpovedať"** — keď vyhľadávanie nenájde v
dokumentoch nič, čo by otázku pokrylo.

Dnes v takom prípade príde odpoveď modelu bez zdrojov, čo je najhorší možný
výsledok: veta, ktorá vyzerá ako odpoveď z predpisu, ale nič ju nekryje.

**Má byť:** vlastný stav, tvarom ako karta odpovede, ale bez odpovede.

```css
.answer--none { border-style: dashed; }
```

Obsah (i18n `ask.none.*`):
- kicker: **„V dokumentoch organizácie sa k tomu nič nenašlo"**
- text: „Skúste otázku inak, alebo hľadajte v knižnici — nie všetko je
  v predpisoch." + odkaz na `/library?search=<q>`

**Bez zdrojov sa odpoveď nezobrazuje vôbec.** Nie je to obmedzenie modelu,
je to pointa celého systému: Contineo odpovedá z obsahu organizácie a s
citáciou. Odpoveď bez citácie je iný produkt.

Podmienka v kóde: `sources.length === 0` → tento stav, model sa nevolá.

## Úloha 2 — Chyba povie, čo robiť

**Teraz:** keď vyhľadávanie alebo model zlyhá, nie je pre to stav.

**Má byť:** `.notice--error` zo `ZAKLAD.md` **nad** hero kartou, nie
namiesto nej — pole s otázkou musí zostať, aby sa dala skúsiť znova.

Texty (i18n `ask.error.*`):
- model nedostupný → „Odpoveď sa teraz nedá zložiť. Skúste to o chvíľu —
  vyhľadávanie v knižnici funguje."
- dotaz vypršal → „Otázka trvala príliš dlho. Skúste ju rozdeliť na dve."

Vždy s **cestou von** (odkaz do knižnice), nie len s oznámením.

## Úloha 3 — Otázka zostane v poli

**Teraz:** po odoslaní sa `?q=` vykreslí v odpovedi, ale pole je prázdne
(`type="search"` bez `defaultValue`).

**Má byť:** `defaultValue={asked}`. Kto chce otázku upraviť, nemá ju písať
znova — a hlavne: bez nej sa po vrátení z odkazu na zdroj stratí kontext.

## Úloha 4 — Dlhá odpoveď a dlhý zdroj

- `.answer` dostane `max-width: 70ch` — riadok textu cez 1440 px sa nečíta.
- `.answer-source-title` sa **zalomí**, neskráti (rovnaký dôvod ako pri
  názve normy v Prehľade): `text-wrap: pretty; overflow-wrap: anywhere`.
- Pod 640 px má `.answer-source` min. výšku **44 px** a celá karta je
  klikateľná plocha, nie len text.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Hero cez šírku obsahu; odpoveď `max-width: 70ch`; zdroje pod odpoveďou v jednom stĺpci |
| **390** | Hero bez príkladov otázok (rovnaký dôvod ako na Prehľade); odpoveď 16 px / 1.65; zdroje ako karty 44 px |

Tablet 834 sa od 1440 líši len šírkou obsahu — vlastný rám nepotrebuje.

---

## Údaje, ktoré v modeli NEEXISTUJÚ — NEKRESLIŤ

Obe veci sú v starom ráme `_archiv/Contineo Obrazovky.dc.html`. **Ignoruj ich.**

### 1. Rozsah hľadania („Knižnica / Intranet / Verejný web / Archív")

V systéme nič také nie je. Prehľadáva sa `document_chunks` jednej
organizácie a jediné delenie je `accessLevel`. Pilulky by predstierali
voľbu, ktorá nič nemení. Zapísané v `TODO.md` (riadok 146).

🔴 Rozhodnutie pre Jána, nie úloha: čo tie rozsahy vlastne sú (typ zdroja?
stav znenia? archív = `effectiveTo` v minulosti?), plus filter do
`SearchOptions` a prenos voľby cez `/api/chat`.

### 2. Skóre zhody („0,94") pri zdroji

Hodnota existuje, ale **nie je to číslo pre človeka** — je to vzdialenosť vo
vektorovom priestore, ktorá sa medzi dotazmi nedá porovnávať. Ukázať ju
znamená tvrdiť, že 0,94 je lepšie než 0,83, čo v zmysle, v akom to človek
čaká, nie je pravda.

**Nerobí sa.** Zdroje sú zoradené podľa relevancie a poradie je tá informácia.

---

## Poradie

Úloha 1 je najdôležitejšia — je to jediná z nich, ktorá mení, čo systém
tvrdí. Potom 3 (jednoriadková), potom 2, potom 4.

Jeden commit na úlohu, celé to je jeden PR.
