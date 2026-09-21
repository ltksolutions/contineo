# SPRAVCA.md — Správa platformy (`/admin`) a Príručka (`/guide`)

Dve obrazovky na koniec: jedna moja vlastná, druhá pre každého.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `OSOBY.html` (časť 3–4).

---

## 1. Správa platformy (`/admin`)

Zoznam organizácií so stavom ich dát. **Vidí ju len správca platformy** —
je to nástroj na poruchu, nie dashboard.

### Hotové
Karty organizácií, kód ako pilulka, `.admin-data` so štyrmi číslami,
upozornenie na dokumenty bez verzie, šírka 900.

### Úloha 1.1 — Varovania cez variant, nie inline štýl
`<span className="tag" style={{ background: "var(--warn-bg)", … }}>` je
v súbore **dvakrát**. Použi `.tag--draft` (jantárová zo `ZAKLAD.md`).

### Úloha 1.2 — Chybný stav má byť vidieť z karty, nie z čísel
**Teraz:** organizácia s dokumentmi bez verzie má varovnú pilulku dole
medzi číslami. Pri desiatich organizáciách ju človek prejde.

**Má byť:** karta s problémom dostane **ľavý pruh**, ako neprečítané
upozornenie:

```css
.admin-tenant.has-problem { box-shadow: inset 3px 0 0 var(--warn-fg); }
```

Organizácia v poriadku nemá nič — **nekresli zelenú fajku.** Na tejto
obrazovke je „v poriadku" predvolený stav a nepotrebuje značku.

### Úloha 1.3 — Štyri čísla majú menovateľ
`.admin-data` ukazuje „148 dokumentov, 210 osôb, 1 240 úsekov, 3 trasy".
Bez porovnania sú to štyri čísla bez významu — ale **nepridávaj grafy.**

Stačí **jedno**: pri úsekoch doplň priemer na dokument (`1 240 · ⌀ 8,4`).
Keď je priemer pod 2, je niečo zlé s indexovaním, a to je presne to, načo
je táto obrazovka.

### Úloha 1.4 — Prázdny stav
`.empty`: **„Žiadne organizácie"** / „Prvú založíte tlačidlom vyššie."

---

## 2. Príručka (`/guide`)

Vysvetlenie, ako systém funguje. Štruktúrovaný text so záložkami.

### Hotové
Prepínač kapitol ako odkazy (`?chapter=`), obsah v `.answer.card`
s `line-height: 1.75`, šírka 720.

### Úloha 2.1 — Kapitoly sú pilulky, majú byť záložky
**Teraz:** kapitoly sú `.card` odkazy v riadku — teda vyzerajú ako obsah,
nie ako navigácia.

**Má byť** `.view-switch` zo `ZAKLAD.md` — ten istý prvok ako
Tabuľka/Karty v knižnici. Je to presne tá istá úloha: prepnúť pohľad
odkazom.

Pri viac ako piatich kapitolách pod 640 px nechaj **vodorovné rolovanie**
(`overflow-x: auto`) — **jediné miesto v celom systéme, kde je to
v poriadku**, lebo kapitoly majú poradie a človek ho vidí.

### Úloha 2.2 — Text príručky potrebuje šírku riadka
`.answer` v karte 720 px má riadok ~90 znakov. Rovnako ako znenie
dokumentu (`ZNENIE.md`, úloha 3):

```css
.guide-body { max-width: 68ch; }
```

### Úloha 2.3 — Príručka je jediná obrazovka, kde chýba, „kde som"
Pri dlhej kapitole človek nevie, koľko zostáva. **Nerieš to ukazovateľom** —
pridaj **obsah kapitoly** (odkazy na `<h2>` vnútri) nad text, ak má
kapitola viac ako tri nadpisy.

Bez JavaScriptu: `<a href="#nadpis">` a `id` na nadpisoch.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Kde | Údaj | Stav |
| --- | --- | --- |
| `/admin` | veľkosť dát organizácie | ❌ neukladá sa |
| `/admin` | posledná aktivita organizácie | ❌ 🔴 rozhodnutie: dalo by sa z `updatedAt` najnovšieho dokumentu |
| `/guide` | hľadanie v príručke | ❌ zámerne — príručka má päť kapitol, hľadanie by bolo naviac |

🔴 Zmena schémy: **netreba žiadnu.**
