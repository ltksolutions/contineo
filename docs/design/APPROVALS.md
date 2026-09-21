# APPROVALS.md — Na schválenie (`/approvals`)

**Obrazovka, na ktorej sa rozhoduje o znení.** Schvaľovatelia sú menovaní
ľudia (D69), nie držitelia roly — preto je to samostatná obrazovka a nie
časť knižnice, do ktorej sa nedostanú.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `APPROVALS.html`
(1440 / 390 + prázdny stav + rozbalené znenie + zamietnutie).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/approvals/page.tsx` (161 riadkov).

| Vec | Kde | Stav |
| --- | --- | --- |
| Znenie celé a priamo tu (D68) | `<details>` + `FormattedText` | ✅ |
| Kolo, číslo kola, kto predložil | `t.versionLine()`, `t.submittedBy()` | ✅ |
| Účinnosť od / „účinnosť neurčená" (D73) | `version.effectiveFrom` | ✅ |
| Ostatní schvaľovatelia bez odporúčania (D70) | `t.alsoDeciding()` | ✅ |
| Dve tlačidlá v JEDNOM formulári | `.approval-decide` | ✅ |
| Povinnosť dôvodu pri zamietnutí stráži server (D71) | `decideAction` | ✅ |
| Akcie na telefóne pod sebou, 44 px | PR 5 | ✅ |
| Poznámka predkladateľa | `r.note` | ✅ |
| Hláška po rozhodnutí | `<Notice>` | ✅ |

**Dve tlačidlá v jednom formulári je zámer, nie nedostatok.** Dôvod je jedno
pole a pri zamietnutí je povinný; dva formuláre by znamenali dve polia na
dôvod a človek by vyplnil to nesprávne. Nemeň to.

---

## Úloha 1 — Znenie sa neskrýva za „Prečítať znenie"

**Teraz:** text znenia je v `<details>`, zbalený. Schvaľovateľ musí kliknúť,
aby uvidel to, o čom rozhoduje.

**Má byť:** `<details open>` **keď je na obrazovke práve jedno kolo**,
zbalené keď sú dve a viac.

Dôvod: schvaľuje sa text (D68) a je to text, ktorý sa doslova ocitne
v potvrdzovacej formulke (D28). Pri jednom kole je skryť text za klik rovnaké
ako pýtať si podpis na zatvorenej obálke. Pri troch kolách naopak zbalené
zostáva — tri plné znenia pod sebou sa nedajú prečítať a človek by rolovaním
hľadal tlačidlá.

```tsx
<details open={rounds.length === 1}>
```

Jednoriadková zmena. `<summary>` ostáva — aj otvorené sa dá zavrieť.

## Úloha 2 — Pole dôvodu má tvar podľa rozhodnutia

**Teraz:** pole „Dôvod" je jednoriadkový `<input>` s nápovedou, vždy
rovnaké. Pri zamietnutí je dôvod povinný a človek doň píše vetu-dve; jeden
riadok na to nestačí a nedá sa v ňom prečítať, čo napísal.

**Má byť:** `<textarea className="field-input" rows={2}>`.

`textarea.field-input` má v `globals.css` (781) vlastné pravidlo
(`min-height: 96px`, `line-height: 1.55`) — použije sa automaticky.
Pre toto pole ho stlač na dva riadky:

```css
.approval-form textarea.field-input { min-height: 64px; }
```

**Nápoveda pod poľom sa mení podľa toho, čo je povinné:**
„Pri zamietnutí je dôvod povinný. Pri schválení nepovinný — ale ostane
v zázname." To druhé je dôležitejšie než sa zdá: schvaľovatelia píšu dôvod
aj pri schválení a majú vedieť, že sa to uchová.

## Úloha 3 — Prázdny stav

**Teraz:** `<p className="card" style={{ padding: 20 }}>{t.nothing}</p>`.

**Má byť:** `.empty` zo `ZAKLAD.md`:

- **„Nič nečaká na vaše rozhodnutie"**
- „Keď vás niekto určí schvaľovateľom znenia, objaví sa tu celý text aj
  s tým, kto ho predložil."

Bez akcie. Schvaľovateľ si prácu nevie nájsť sám — musí ho niekto určiť.

## Úloha 4 — Inline štýly do tried

Rovnaký problém ako v `/documents`. Karta kola má `style={{ padding: 18 }}`,
nadpis `fontSize: var(--fs-section)`, zoznam `display: grid, gap: 20`.

```css
.approval-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 20px; }
.approval-card { padding: 18px; }
.approval-title {
  font-size: var(--fs-section);
  letter-spacing: -0.01em;
  margin: 0 0 4px;
  text-wrap: pretty;
}
.approval-meta { font-size: var(--fs-small); color: var(--muted); }
.approval-note { font-size: var(--fs-body); margin: 10px 0 0; }
.approval-text { margin-top: 10px; line-height: 1.7; max-width: 70ch; }
```

`.approval-form` a `.approval-decide` už existujú — doplň k nim zvyšok.

## Úloha 5 — Poradie tlačidiel a ich váha

**Teraz:** „Schváliť" je `.button` (primárne), „Zamietnuť" je
`.button--quiet`. To je správne a **nemeň to** — ale na 390 px sú pod sebou
a primárne je hore, takže palec trafí „Schváliť" ako prvé.

**Má byť** pod 640 px: **„Zamietnuť" prvé, „Schváliť" druhé** (dole, pri
palci). Rozhodnutie, ktoré sa nedá vrátiť, nemá byť to, na ktoré padne
palec bez pozerania.

```css
@media (max-width: 639px) {
  .approval-decide { flex-direction: column-reverse; }
  .approval-decide .button { width: 100%; min-height: 44px; }
}
```

`column-reverse` mení len vizuálne poradie; v DOM aj v tabulátore zostáva
„Schváliť" prvé, čo je správne pre čítačku (primárna akcia sa ohlási prvá).

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 760 px; znenie rozbalené pri jednom kole, `max-width: 70ch`; tlačidlá v riadku |
| **390** | Znenie rozbalené; tlačidlá pod sebou, „Zamietnuť" hore; pole dôvodu 2 riadky |

---

## Čo na tejto obrazovke NIE JE — a prečo

**„Vrátené s pripomienkou" tu nenájdeš.** Táto obrazovka ukazuje len kolá,
ktoré čakajú na **moje** rozhodnutie (`roundsWaitingFor()`). Keď zamietnem,
kolo z obrazovky zmizne — výsledok vidí predkladateľ v knižnici na detaile
dokumentu, nie schvaľovateľ tu.

Ak by sa mala doplniť história mojich rozhodnutí, je to **nová obrazovka**
(alebo sekcia na `/more`), nie rozšírenie tejto. Nedopĺňaj to bez návrhu.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Termín na rozhodnutie | ❌ kolo termín **nenesie**. Prehľad pri schváleniach chip nekreslí a je to správne. Nevymýšľať. |
| Rozdiel proti predchádzajúcej verzii | ❌ `textFix` rozdiel existuje len pri oprave textu (ADR-007), nie medzi verziami. Samostatné rozhodnutie. |
| Moje minulé rozhodnutia | ❌ v zázname sú, na obrazovke nie — viď vyššie. |

🔴 Zmena schémy: **netreba žiadnu.**
