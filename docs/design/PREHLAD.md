# PREHLAD.md — Prehľad (`/`)

**Úvodná obrazovka po prihlásení.** Odpovedá na jednu otázku: *čo odo mňa
niekto čaká.*

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `PREHLAD.html`
(1440 / 834 / 390 + prázdny stav).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/page.tsx` (233 riadkov) je postavený podľa `docs/design/README.md`
a PR 5. Skutočný stav k 21. 9. 2026:

| Vec | Kde | Stav |
| --- | --- | --- |
| Hero karta s oslovením a otázkou | `.overview-hero` (3569) | ✅ |
| Pole otázky → `GET /ask` bez JS | `.overview-ask` (3589) | ✅ |
| Návrhy otázok ako pilulky | `.overview-suggestion` (3613) | ✅ |
| KPI pás, 4 dlaždice ako odkazy | `.kpi`, `.kpi-tile` (3634) | ✅ |
| KPI mriežka 2×2 / od 1024 px 4×1 | `@media` (3634+) | ✅ |
| Tón dlaždice `--bad` / `--warn` | `.kpi-value--*` (3677) | ✅ |
| Dva panely: pozornosť + novinky | `.overview-panels` (3684) | ✅ |
| Termínový chip s tromi stavmi | `.due-chip--soon/over` (2304) | ✅ |
| Čísla z tých istých funkcií ako cieľové obrazovky | `pendingForPerson()`, `roundsWaitingFor()` | ✅ |
| Expirujúce znenia v paneli noviniek | `expiringVersions()` | ✅ |

**Dlaždica „Na schválenie" počíta to, čo čaká na mňa**, nie na organizáciu —
je to zámer zapísaný v hlavičke súboru. Nemeň to.

---

## Úloha 1 — Prázdny panel povie, čo to znamená

**Teraz:** `<p className="panel-empty quiet">{t.nothingPending}</p>` — jedna
sivá veta. Pri oboch paneloch naraz je celá obrazovka pod KPI prázdna a
nedá sa rozoznať, či systém nič nenašiel, alebo či sa nič nedeje.

**Má byť:** dva riadky — čo tu nie je a čo z toho vyplýva. **Nie `.empty`
box z `ZAKLAD.md`** — ten je pre celú obrazovku; vnútri panela by dashed
rám vytvoril rám v ráme.

```css
.panel-empty {
  display: grid;
  gap: 3px;
  padding: 18px 15px;
}
.panel-empty-title { font-size: var(--fs-small); font-weight: 600; color: var(--ink); }
.panel-empty-text { font-size: var(--fs-micro); color: var(--muted); line-height: 1.5; }
```

Texty (i18n `overview.empty.*`):
- pozornosť → **„Nič od vás nikto nečaká"** / „Keď vám niekto pridelí normu
  alebo vás určí schvaľovateľom, objaví sa to tu aj s termínom."
- novinky → **„Za posledných 7 dní nič nové"** / „Nové znenia a tie, ktorým
  sa blíži koniec platnosti, sa ukážu tu."

`7` je `NEW_DAYS` — do textu ho vlož premennou, nie natvrdo.

## Úloha 2 — Nula na dlaždici je tichá

**Teraz:** dlaždica s hodnotou `0` vyzerá rovnako naliehavo ako dlaždica so
šiestimi. Štyri veľké nuly na úvodnej obrazovke sú štyri falošné poplachy.

**Má byť:** `0` sa kreslí v `--muted`, nenulová hodnota v `--ink` (alebo
v tóne). Dlaždica **zostáva** — keby zmizla, ostatné by sa preskupili a
človek by pri každom prihlásení hľadal, kde čo je.

```css
.kpi-value--zero { color: var(--muted); font-weight: 600; }
```

V `page.tsx`: `tile.value === 0` pridá `kpi-value--zero` a `tone` sa
v tom prípade **nepoužije** (nula nie je červená).

## Úloha 3 — Panel má cestu k celému zoznamu

**Teraz:** panel ukáže `slice(0, 6)` a pri siedmej položke sa o nej nikde
nedozvieš. Panel pozornosti má navyše dva druhy riadkov (povinnosti +
schválenia), takže šesť povinností môže úplne vytlačiť schválenie.

**Má byť:** hlavička panela nesie počet a odkaz, keď je položiek viac.

```css
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-head-count {
  font-size: var(--fs-micro);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.panel-head-link { margin-left: auto; font-size: var(--fs-micro); font-weight: 600; }
```

- pozornosť → „Zobraziť všetkých 9 →" na `/documents`
- novinky → „Celá knižnica →" na `/library`

Odkaz sa kreslí **len keď je položiek viac než 6**. Odkaz „zobraziť všetko"
nad zoznamom, ktorý je celý vidieť, je klamstvo o tom, že niečo skrývame.

**Schválenia dostanú strop 2, nie 3** (dnes `slice(0, 3)`), a povinnosti 4 —
spolu 6 riadkov. Inak pri deviatich povinnostiach schválenie nikto neuvidí,
hoci je to rozhodnutie, ktoré blokuje druhých ľudí.

## Úloha 4 — Dlhý názov sa zalomí, nie skráti

**Teraz:** `.panel-name` nemá pravidlo, takže dlhý názov („Metodický pokyn
k licenciám trénerov mládeže a dospelých v kategórii U15") roztiahne riadok
a chip s termínom vytlačí mimo karty.

**Má byť:**

```css
.panel-main { flex: 1; min-width: 0; }
.panel-name {
  display: block;
  line-height: 1.35;
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
```

**Dva riadky sú v poriadku, tri ellipsis.** Nie `white-space: nowrap` —
skrátený názov normy je nepoužiteľný údaj; kto rozhoduje o potvrdení, musí
vedieť, čo potvrdzuje.

```css
.panel-name {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

Chip a akcia idú pod 640 px **pod** text, nie vedľa (inak na 390 px zostane
názvu 90 px):

```css
@media (max-width: 639px) {
  .panel-row { flex-wrap: wrap; }
  .panel-main { flex: 1 0 100%; }
  .panel-action { min-height: 44px; }
}
```

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Hero cez celú šírku; KPI 4×1; panely `1.2fr 1fr` vedľa seba |
| **834** | Hero; KPI 2×2; panely **pod sebou** (dva panely po 400 px sú užšie než ich obsah) |
| **390** | Hero bez návrhov otázok (tri pilulky = tri riadky); KPI 2×2; panely pod sebou; chip a akcia pod textom |

**Pod 640 px sa návrhy otázok neukazujú.** Sú to tri dlhé vety, ktoré na
telefóne zaberú viac miesta než samotné pole. Kto sa chce spýtať, klikne do
poľa; návrhy sú pomôcka pre toho, kto nevie, čo systém vie — a to sa zisťuje
na väčšej obrazovke.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Prehľad stojí na `pendingForPerson()`, `roundsWaitingFor()`,
`libraryNews()` a `expiringVersions()` — všetky existujú a používajú ich aj
cieľové obrazovky.

🔴 Zmena schémy: **netreba žiadnu.**

---

## Poradie

Úloha 1 a 2 sú nezávislé a viditeľné hneď — začni nimi. Úloha 4 sa overuje
na 390 px s najdlhším názvom v knižnici.

Jeden commit na úlohu, celé to je jeden PR.
