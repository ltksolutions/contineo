# ADMIN.md — Správa platformy (`/admin`) a Príručka (`/guide`)

Dve obrazovky mimo bežnej práce: jedna moja (správa organizácií), druhá pre
každého (ako sa systém používa).

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `PEOPLE.html` (časť 3–4).

---

## 1. Správa platformy (`/admin`)

Prehľad všetkých organizácií — koľko majú ľudí, dokumentov, či im niečo
chýba. Šírka 900 px.

### Hotové
Zoznam organizácií s kódom, doménami, `.admin-data` so štyrmi číslami,
upozornenie na dokumenty bez verzie, odkaz na novú organizáciu.

### Úloha 1.1 — Inline štýly pri pilulkách
**Teraz:** `<span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>`
na dvoch miestach — pre organizáciu bez domény a pre dokumenty bez verzie.

**Má byť:** `.tag--draft` (jantárová zo `ZAKLAD.md`). Je to presne ten
význam: **rozrobené, chýba niečo**.

### Úloha 1.2 — Štyri čísla sú v poriadku, chýba im poradie podľa dôležitosti
`.admin-data` (globals.css 1423) má 2 stĺpce na telefóne a 4 od 640 px —
to je správne, **nemeň**.

Ale poradie: dnes je to *osoby, dokumenty, znenia, potvrdenia*.
Má byť **dokumenty, znenia, osoby, potvrdenia** — Contineo je systém na
dokumenty, takže prvé číslo má byť o nich.

### Úloha 1.3 — Prázdny stav
`.empty`: **„Žiadne organizácie"** / „Prvú pridáte tlačidlom vyššie."

Pozn.: v praxi sa nestane (`/admin` vidí len ten, kto už organizáciu má),
ale prázdna obrazovka bez textu je horšia než veta, ktorá sa nezobrazí.

### Úloha 1.4 — Organizácia bez domén je varovanie, nie poznámka
Organizácia bez domény znamená, že **sa do nej nikto nevie prihlásiť**.
Dnes je to pilulka medzi ostatnými.

**Má byť** `.notice--error` **v karte tej organizácie**, s vetou, čo to
znamená: „Do organizácie sa nedá prihlásiť — prihlásenie je viazané na
domény. Doplňte aspoň jednu."

---

## 2. Príručka (`/guide`)

Vysvetlenie, ako systém funguje. Šírka 720 px.

### Hotové
Prepínač kapitol ako karty-odkazy, obsah kapitoly v `.answer.card`
s `line-height: 1.75`, i18n pre všetky tri jazyky.

### Úloha 2.1 — Prepínač kapitol je zoznam kariet, má byť navigácia
**Teraz:** kapitoly sú `<Link className="card">` v riadku — teda vyzerajú
ako obsah, nie ako prepínač.

**Má byť** `.view-switch` zo `ZAKLAD.md` (existuje, používa knižnica):
pri dvoch-troch kapitolách. Pri viac ako štyroch zostaň pri kartách, ale
daj im `.is-on` stav — dnes sa nedá zistiť, ktorá kapitola je otvorená.

```css
.guide-chapter.is-on { border-color: var(--accent); background: var(--accent-soft); }
```

### Úloha 2.2 — Text príručky dostane šírku riadka
`.answer` v karte 720 px má riadok ~90 znakov. To isté, čo v `ZNENIE.md`
(úloha 3):

```css
.guide-body { max-width: 68ch; }
```

### Úloha 2.3 — Príručka nemá prázdny stav a nepotrebuje ho
Kapitoly sú v `lib/i18n.ts`, takže vždy nejaké sú. **Nepridávaj `.empty`.**
Prázdny stav pre niečo, čo nemôže byť prázdne, je mŕtvy kód.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Kde | Údaj | Stav |
| --- | --- | --- |
| `/admin` | posledná aktivita organizácie | ❌ neukladá sa |
| `/admin` | veľkosť úložiska | ❌ nepočíta sa |
| `/guide` | vyhľadávanie v príručke | ❌ kapitol je málo, netreba |

🔴 Zmena schémy: **netreba žiadnu.**
