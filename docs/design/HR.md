# HR.md — Výkaz, prideľovanie, dôkazy, pripomienky

**Šesť obrazoviek jednej role.** Personalista (`hr`) sleduje, kto čo
potvrdil, prideľuje normy, rozposiela pripomienky a vydáva dôkazy.

Právne najcitlivejšia časť systému: **dôkazné záznamy sa nemenia ani
nemažú** (D24). Oprava je nový záznam, odvolanie je `revokedAt`.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `HR.html`.

---

## Rozcestník — čo je ktorá obrazovka

Toto je prvá vec, ktorú treba pochopiť, lebo názvy si sú podobné:

| Routa | Otázka, na ktorú odpovedá |
| --- | --- |
| `/hr` | Ktoré pridelenia bežia a ako sú na tom? |
| `/hr/[id]` | Kto konkrétne nepotvrdil **toto** pridelenie? |
| `/hr/overview` | Ako je na tom organizácia naprieč všetkým? |
| `/hr/assign` | Prideliť normu ľuďom. |
| `/hr/reminders` | Komu poslať pripomienku? |
| `/hr/evidence` | Ukáž mi dôkaz o jednom človeku. |

---

## Čo je UŽ HOTOVÉ — nerob znova

| Obrazovka | Hotové |
| --- | --- |
| `/hr` | zoznam pridelení, tri čísla (potvrdené / upozornení / chýbajú), odkazy na akcie, šírka 860 |
| `/hr/[id]` | zoznam osôb, príznak „už nie je v oddelení“ (D50), šírka 720 |
| `/hr/overview` | súhrny s prepínačom pohľadu, CSV export, odvolanie potvrdenia s povinným dôvodom, šírka 900 |
| `/hr/assign` | výber dokumentov, publikum (oddelenia / skupiny / trasy) ako `.tag--choice`, povinný dôvod, termín dátumom alebo počtom dní, šírka 680 |
| `/hr/reminders` | prepínač režimu, náhľad pred odoslaním, posiela sa len tým, kto nepotvrdil, šírka 760 |
| `/hr/evidence` | filtre osoba + stav, `.widget` rozbaľovacie riadky, CSV export, šírka 900 |

**Nič z tejto logiky neprepisuj.** Každé pravidlo má zdôvodnenie v kóde a
väčšina nesie auditný záznam.

---

## Komponenty, ktoré už existujú — prevezmi ich, nepíš nové

Prečítané z `globals.css`. **Nič z toho neprepisuj** a nevymýšľaj k tomu
vlastné triedy.

| Komponent | Kde | Podstatné |
| --- | --- | --- |
| Rozbaľovací riadok dôkazu | `.widget` 3506–3554 | `<details class="widget card">` → `<summary class="widget-summary">` (mriežka `1fr auto`, 44 px) → `.widget-main` + `.widget-meta` + `.widget-chevron` → `.widget-body`. Chevron sa otáča cez `.widget[open]`. |
| Voľba publika | `.tag--field` 1317–1334 | `<label class="tag tag--choice tag--field">` s **skutočným `<input type="checkbox">`** a prázdnym `.tag-mark`. Glyf kreslí CSS: `::before content: "+"` a pri `:has(input:checked)` `"✓"`. |
| Skupina polí | `.hr-group` 1364–1372 | `border` a `padding` má z triedy; `margin: 0`. V `/hr/assign` sa margin dopĺňa inline — **nechaj tak**. |
| Voľba v zozname | `.hr-choice` 1388–1410 | 44 px, `input` 20×20 s `accent-color`. |
| Štyri čísla | `.admin-data` 1423–1432 | 2 stĺpce, od 640 px štyri. |
| Termín | `.due-fields` 2325–2336 | `flex`, polia `1 1 180px`. |
| Filtre evidencie | `.evidence-filters` 3551 | od 640 px `2fr 1fr auto`. |
| Obsah rozbaleného dôkazu | `.detail-meta*` 2276–2299 | `<dl class="detail-meta">` → `.detail-meta-row` → `.detail-meta-key` (`flex: 0 0 104px`) + `.detail-meta-value`. Tá istá dvojica ako na detaile dokumentu. |

Dve veci, ktoré sa ponúkajú samy a sú chyba:

- **Nahradiť `<details class="widget">` plochými `<div>`.** Riadok dôkazu
  musí zostať rozbaľovací — inak sa IP, odtlačok oddelenia a formulka nemajú
  kam vojsť.
- **Nahradiť `:has(input:checked)` vlastnou triedou `.is-selected`.**
  Variant `.tag--field` ju nepoužíva a hlavne: bez `<input>` sa formulár
  neodošle. Je to ovládač, ktorý rozhoduje, komu vznikne právna povinnosť,
  a musí fungovať **bez JavaScriptu**.

## Úloha 1 — Stavy potvrdenia majú jednu farebnú škálu, dnes tri

**Teraz** má každá obrazovka vlastné riešenie:
- `/hr` — `<span className="tag">verzia 4.2</span>`, čísla bez farby
- `/hr/overview` — `<span className="tag" style={{ … }}>` s inline farbou
- `/hr/evidence` — `.widget` bez stavovej pilulky vôbec
- `/acknowledgements` — `<span className="tag" style={{ … }}>`

Personalista prechádza medzi nimi a ten istý stav vyzerá zakaždým inak.

**Má byť** jedna škála pre celú rolu, z variantov v `ZAKLAD.md`:

| Stav | Trieda | Kedy |
| --- | --- | --- |
| Potvrdené | `.tag--published` | je platný záznam |
| Otvorené, nepotvrdené | `.tag--review` | `firstOpenedAt` je, potvrdenie nie |
| Neotvorené | `.tag` neutrálna | ani neotvoril |
| Po termíne | `.tag--expired` | termín prešiel a nepotvrdené |
| Odvolané | `.tag--archived` | `revokedAt` |

**„Po termíne" prebíja „otvorené"** — keď je oboje, kreslí sa po termíne.
Personalistu zaujíma, čo horí, nie čo si niekto otvoril.

Napíš na to **jednu funkciu** `dutyTagClass(duty, now)` vedľa
`statusTagClass()` v `lib/libraryRead.ts` (alebo do `lib/pending.ts`,
kam patrí vecne) a volaj ju zo všetkých šiestich obrazoviek. Nie šesťkrát
ternárny výraz v JSX.

## Úloha 2 — Tri čísla na `/hr` sú text, majú byť pásik

**Teraz:** `.admin-data` s tromi blokmi — potvrdené, upozornení, chýbajú —
ako číslo pod popiskom. Pri desiatich prideleniach je to tridsať čísel,
medzi ktorými sa nedá porovnať, ktoré pridelenie zaostáva.

**Má byť:** `.ack-bar` zo `ZAKLAD.md` — ten istý pásik ako v knižnici
a na detaile dokumentu. Čísla zostávajú **pod** ním, nezmiznú.

```
[■■■■■■■□□□] 68 %     142 potvrdilo · 18 upozornených · 50 chýba
```

Prahy sú tie isté (≥ 90 zelená, ≥ 50 accent, pod tým jantárová), takže
personalista vidí zaostávajúce pridelenie na prvý pohľad.

## Úloha 3 — `/hr/assign`: publikum je najdôležitejšia voľba a vyzerá ako štítky

**Teraz:** oddelenia, skupiny a trasy sú `.tag--choice.tag--field` —
teda pilulky, ktoré sa dajú zaškrtnúť. Vizuálne sú to tie isté prvky ako
značky dokumentu, ale znamenajú niečo úplne iné: **komu vznikne povinnosť.**

**Má byť** — pilulky zostávajú (sú správne, dá sa ich vybrať veľa naraz),
ale sekcia dostane **súhrn dopadu nad tlačidlom**:

```css
.assign-impact {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  margin: 0 0 14px;
}
.assign-impact-count { font-size: var(--fs-lead); font-weight: 650; }
```

Text: **„Povinnosť vznikne 96 ľuďom"** + pod tým „Právne a legislatíva (24),
Rozhodcovia 2026 (72). Kto do oddelenia pribudne neskôr, dostane ju odo dňa
príchodu (D50)."

Číslo počítaj cez `matchesAudience()` — **jediné miesto s pravidlom
príslušnosti**, nie vlastným dotazom. Druhá kópia pravidla sa s prvou rozíde.

**Prečo to tam musí byť:** prideliť normu je nevratné v tom zmysle, že
ľuďom sa objaví povinnosť a chodia im pripomienky. Číslo pred odoslaním je
jediná poistka proti prekliku.

## Úloha 4 — `/hr/reminders`: náhľad povie, čo sa stane, nie čo sa poslalo

**Teraz:** zoznam ľudí a pod ním tlačidlo. Text `t.preview` hovorí
všeobecne.

**Má byť** rovnaký súhrn ako v úlohe 3, len s iným slovesom:
**„Odíde 18 e-mailov"** + „Ľudia, ktorí už potvrdili, nedostanú nič (D61)."

A **po odoslaní** `.notice` so skutočným počtom, nie „odoslané".

## Úloha 5 — `/hr/evidence`: dôkaz sa musí dať prečítať bez rozbaľovania

**Teraz:** každý riadok je `<details class="widget card">` — meno, stav,
a po rozbalení podrobnosti. Pri výkaze pre kontrolu to znamená rozkliknúť
štyridsať riadkov.

**Má byť:** `<details class="widget">` **zostáva** (viď tabuľka komponentov)
— pridáva sa len **dátum do `<summary>`**, do `.widget-main` vedľa stavovej
pilulky. Teda to, čo kontrolór hľadá, je vidieť bez klikania; rozbalenie drží
zvyšok: IP, odtlačok oddelenia, verzia formulky, čas čítania.

```
Marek Horák · Právne a legislatíva     [Potvrdené]  18. 12. 2025 14:22
Zuzana Kováčová · Ľudské zdroje        [Po termíne] neotvorené
```

**Nezmenšuj to, čo je po rozbalení.** Sú to údaje dôkazu (D24, D28) a
patria tam všetky.

**Čo ide do `.widget-body`:** `<dl class="detail-meta">` s riadkami
`.detail-meta-row` — presne ten istý komponent, aký má bočný panel detailu
dokumentu (`globals.css` 2276–2299). Kľúč má `flex: 0 0 104px` (104, nie 92:
„Jazyk dokumentu" sa do užšieho stĺpca zalomí). **Nepíš na to nové triedy** —
dvojica kľúč/hodnota už v systéme je a používa sa na dvoch obrazovkách.

Riadky: IP adresa · Oddelenie v čase potvrdenia · Znenie formulky ·
Čas čítania · Prvýkrát otvoril. Pri odvolanom zázname navyše: Odvolal ·
Dôvod odvolania.

## Úloha 6 — Prázdne stavy (všetkých šesť obrazoviek)

Dnes všade `<p className="card">`. Nahraď `.empty` zo `ZAKLAD.md`:

| Obrazovka | Nadpis | Text |
| --- | --- | --- |
| `/hr` | Žiadne pridelenia | Keď normu niekomu pridelíte, objaví sa tu aj s tým, koľkí ju už potvrdili. |
| `/hr/[id]` | Všetci potvrdili | Toto pridelenie je vybavené — nikto nechýba. |
| `/hr/overview` | Zatiaľ niet čo zhrnúť | Súhrn sa zjaví, keď bude prvé pridelenie. |
| `/hr/assign` | Niet čo prideliť | Prideliť sa dá len publikované znenie. V knižnici zatiaľ žiadne nie je. |
| `/hr/reminders` | Niet komu pripomínať | Všetci, ktorým beží termín, už potvrdili. |
| `/hr/evidence` | Filtru nič nevyhovuje / Žiadne záznamy | *(dva texty — evidencia má filtre)* |

`/hr/[id]` s prázdnym zoznamom je **dobrá správa**, nie chyba — text to má
povedať.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsahové šírky podľa obrazovky (680–900 px) zostávajú — sú to výkazy a formuláre, nie tabuľky cez celú obrazovku |
| **390** | Karty; tlačidlá na celú šírku 44 px; `.admin-data` tri čísla pod sebou; v `/hr/assign` pilulky publika sa zalomia |

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Oprava potvrdenia | ❌ typ `correction` v kóde je, **cesta nie** (`TODO.md`). 🔴 Rozhodnúť, ktoré polia sa smú opravovať a kto to smie. |
| Kto pridelenie vytvoril | ⚠️ v audite je, na obrazovke nie. Dalo by sa doplniť. |
| Plánovaná pripomienka (kedy odíde ďalšia) | ❌ cron beží, plán sa neukladá. Nekresliť. |

🔴 Zmena schémy: **netreba žiadnu** pre úlohy 1–6.
