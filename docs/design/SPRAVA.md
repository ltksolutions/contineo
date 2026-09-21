# SPRAVA.md — Kolá, Kurácia, Upozornenia, Viac

Štyri menšie obrazovky vlny B v jednom zadaní — každá má dve-tri úlohy
a spoločný vzor: zoznam + formulár, prázdny stav, mobilná úprava.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `SPRAVA.html` (časť 3–6).

---

## 1. Kolá / trasy (`/library/tracks`)

### Hotové
Zoznam trás s počtom krokov a stavom, formulár na novú trasu, kľúč s
nápovedou, šírka 760 px. Prázdny stav ako `<p className="card">`.

### Úloha 1.1 — Prázdny stav
`.empty`: **„Žiadne trasy"** / „Trasa je poradie noriem, ktoré má človek
prečítať — napríklad pri vstupe do organizácie. Prvú založíte formulárom
nižšie."

### Úloha 1.2 — Stav trasy cez variant, nie neutrálnu pilulku
`<span className="tag">` bez variantu pri každej trase. Trasa je buď
aktívna, alebo nie:
- aktívna → `.tag--published`
- neaktívna → `.tag--archived`

### Úloha 1.3 — Trasa vedie na svoj detail
Riadok trasy dnes **nie je odkaz** — pritom detail trasy existuje:
`/library/tracks/[key]` (v kóde od 2026-09-06) nesie poradie krokov aj ich
pridávanie, odoberanie a posúvanie. Nadpis trasy urob odkazom na
`/library/tracks/<key>`.

Detail trasy vlastné zadanie nemá (viď `MASTER.md`, „Obrazovky mimo
handoffu") — jeho vzhľad nechaj, ako je, a čo ti na ňom padne do oka,
napíš do PR ako otázku.

---

## 2. Kurácia odpovedí (`/library/curation`)

### Hotové
Zoznam overených odpovedí pripravených na zverejnenie, prístup odvodený
z najprísnejšieho zdroja (`strictestAccessLevel()`), zoznam zdrojových
úsekov, tlačidlo „Zverejniť", šírka 860 px.

### Úloha 2.1 — Prázdny stav
`.empty`: **„Nič nečaká na zverejnenie"** / „Keď hodnotiteľ označí odpoveď
ako overenú, objaví sa tu aj so zdrojmi, z ktorých vychádza."

### Úloha 2.2 — Pilulka prístupu má farbu podľa prísnosti
`<span className="tag" style={{ … }}>` s inline štýlom. Prístup je stav
a farba ho má nesť:
- verejné → `.tag--published` (zelená — smie von)
- interné → `.tag--archived` (sivá — len dovnútra)

**Nie červená pre interné.** Interné nie je chyba, je to predvolený stav.

### Úloha 2.3 — Zdroje sú zoznam, nie odrážky v `.quiet`
Dnes `<ul className="quiet">` s `paddingLeft: 18`. Zdroj je to, čím sa
odpoveď obhajuje — má byť čitateľný ako v `/ask`:

Použi `.answer-source` zo `/ask` (existuje, `globals.css:3099`) — tá istá
karta, ten istý tvar. Dve obrazovky, ktoré zobrazujú to isté, to majú
zobrazovať rovnako.

---

## 3. Upozornenia (`/notifications`)

### Hotové
Zoznam udalostí s časom, „Označiť všetko ako prečítané", počet
neprečítaných, štyri druhy udalostí (preindexovanie, prepis modelom,
rozposlané pripomienky, zverejnené znenie), šírka 820 px.

### Úloha 3.1 — Neprečítané sa dá rozoznať
**Teraz:** zoznam je `<ul className="card">` a neprečítané položky nemajú
vizuálny rozdiel — počet v hlavičke hovorí „3 neprečítané", ale ktoré to sú,
sa nedá zistiť.

**Má byť:** ľavý pruh v `--accent` a mierne pozadie, ako označený riadok
tabuľky (`ZAKLAD.md`, úloha 4):

```css
.notif-row.is-unread {
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}
```

### Úloha 3.2 — Prázdny stav
`.empty`: **„Žiadne upozornenia"** / „Objaví sa tu, keď sa zverejní znenie,
rozpošlú pripomienky alebo dobehne preindexovanie."

### Úloha 3.3 — Každé upozornenie vedie na svoje miesto
Časť položiek dnes nie je odkaz. Upozornenie bez cesty k veci, o ktorej
hovorí, je len oznámenie — celý riadok má byť odkaz na dokument, kolo alebo
výkaz.

---

## 4. Viac (`/more`)

### Hotové
Skupiny Organizácia / Správa, riadky 52 px, počty, chevron, šírka 560 px.
Vznikla v PR 2 ako cieľ piatej položky spodnej lišty.

### Úloha 4.1 — Chevron je znak, má byť ikona
`.more-row-chevron` je textový znak. Použi chevron z `globals.css`
(`select.field-input`, `M2.5 4.5L6 8l3.5-3.5`) — ten istý, aký má
`<details>` v detaile dokumentu.

### Úloha 4.2 — Skupina „Účet" sa nerobí — a je to správne
PR 2 to rozhodol: osobné veci (téma, odhlásenie) ostávajú pod avatarom
v hlavičke. **Nepridávaj ich sem.** Duplicitná položka v dvoch ponukách je
horšia než položka na jednom mieste.

### Úloha 4.3 — Obrazovka existuje len pod 640 px
`/more` je cieľ spodnej lišty. Na desktope sa naň nedá dostať navigáciou
(tam je plný pás) a **je to v poriadku** — ale keď naň niekto príde odkazom,
má vidieť to isté. Nič neskrývaj mediálnym dotazom.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Kde | Údaj | Stav |
| --- | --- | --- |
| Kolá | úprava krokov trasy | ✅ existuje na `/library/tracks/[key]` — mimo handoffu, nemeniť |
| Upozornenia | nastavenie, čo chcem dostávať | ❌ 🔴 samostatné rozhodnutie (schéma: na osobe) |
| Viac | skupina „Účet" | ❌ zámerne, viď úloha 4.2 |

🔴 Zmena schémy: **netreba žiadnu** pre úlohy vyššie.
