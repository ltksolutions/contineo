# ZNENIE.md — Znenie na potvrdenie (`/documents/[documentId]`)

**Obrazovka, na ktorej človek číta normu a potvrdzuje, že ju prečítal.**
Právne najdôležitejšia obrazovka v systéme — vzniká z nej dôkazný záznam
(D24, D28).

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `DETAIL.html` (dolná časť).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/documents/[documentId]/page.tsx`.

| Vec | Kde | Stav |
| --- | --- | --- |
| Šírka 760 px (text na čítanie) | `maxWidth: 760` | ✅ |
| Znenie ako formátovaný text | `.answer .document-sheet` | ✅ |
| Potvrdzovacia karta s formulkou (D28) | `.acknowledge-card` | ✅ |
| Plávajúci pás s tlačidlom pod 640 px | `.acknowledge-dock` (PR 5) | ✅ |
| Potvrdené: zelená pilulka s dátumom | inline `--ok-*` | ✅ |
| Meranie času čítania | `ReadingTimer` | ✅ |
| Potvrdenie bez JavaScriptu | serverová akcia | ✅ |
| Kľúč trasy z adresy do dôkazu | `?track=` | ✅ |

**Formulka sa ukladá doslovne v jazyku, v ktorom ju človek videl** (D28).
Text formulky nemeň ani neprepisuj — je to právny záväzok, nie kopia.

---

## Úloha 1 — Termín opäť chýba (rovnaká chyba ako v zozname)

**Teraz:** obrazovka ukáže názov, meta riadok a znenie. **Termín potvrdenia
nie je nikde** — rovnako ako v zozname `/documents` (viď `DOCUMENTS.md`,
úloha 1).

Človek teda vidí na Prehľade „do 12. 9.", v zozname (po oprave) „do 12. 9."
a na obrazovke, kde to má naozaj urobiť, nič.

**Má byť:** `due-chip` v riadku piluliek pod názvom, s tromi stavmi
z `dueState()`. Pri termíne po lehote **nie červená karta ani varovanie** —
len chip v `--bad-bg`. Prekročený termín potvrdenie nezakazuje a obrazovka
sa nemá tváriť, že áno.

## Úloha 2 — Stavová pilulka „Potvrdené" cez variant

**Teraz:**

```tsx
<p className="tag" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
```

**Má byť:** `.tag--published` (zelená zo `ZAKLAD.md`). Žiadny inline prepis.

Pozor: je to `<p>` s triedou `.tag` — zmeň na `<span>`. Odstavec s
`display: inline-flex` je značkovanie, ktoré čítačka ohlási ako odstavec,
hoci je to štítok.

## Úloha 3 — Znenie dostane šírku riadka

**Teraz:** `.document-sheet` dedí `.answer` s `line-height: 1.7`, ale bez
`max-width`. Kontejner má 760 px, takže riadok má ~700 px — pri 14 px písme
je to **95 znakov**. Norma sa tak číta ťažšie než by musela.

Skutočné pravidlo (`globals.css` 1593–1602) je karta, nie šírka riadka:

```css
.document-sheet {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 20px 16px;           /* od 640 px: 28px 32px */
}
```

**Toto je zmena, ktorú navrhujem** (nie stav kódu) — pridať k tomu šírku
riadka a väčšie písmo:

```css
.document-sheet { max-width: 68ch; font-size: var(--fs-lead); }
```

`--fs-lead` (15 px) namiesto zdedených 14: je to dlhý právny text, nie
popisok. Pozadie, rámik ani odsadenie **nemeň** — tie sú v poriadku.

**Nadpisy článkov v znení** dostanú priestor nad sebou, nie len tučné písmo:

```css
.document-sheet h2, .document-sheet h3 { margin: 28px 0 8px; }
.document-sheet h2:first-child { margin-top: 0; }
```

## Úloha 4 — Kde v texte som

Norma má 68 strán. Človek roluje, potvrdzovacie tlačidlo je v plávajúcom
páse (PR 5) a **nevie, koľko mu ešte zostáva**.

**Má byť:** tenký ukazovateľ prečítanej časti na hornej hrane pásu.

```css
.acknowledge-dock { position: relative; }
.acknowledge-progress {
  position: absolute;
  inset: 0 auto auto 0;
  height: 2px;
  background: var(--accent);
  transition: width .1s linear;
}
```

⚠️ **Toto je jediná vec v celom handoffe, ktorá vyžaduje JavaScript.**
Preto: bez skriptu sa pruh **nevykreslí vôbec** (nie na 0 %), potvrdenie
funguje ďalej a nič sa nestratí. Je to ozdoba, nie funkcia — a `ReadingTimer`
už klientsky komponent na tejto obrazovke je, takže nový nepribúda.

Ak to Ján nechce, vynechaj celú úlohu 4. Ostatné tri sú nezávislé.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 760 px, znenie 68ch, potvrdzovacia karta na konci textu |
| **390** | Znenie 16 px; potvrdzovacia karta ostáva (formulka sa musí prečítať), tlačidlo v plávajúcom páse 50 px |

**Plávajúci pás obsahuje len tlačidlo, nie formulku** (PR 5 — správne).
Formulka je právny text; keby bola v páse, človek by ju odklikol bez čítania.

**Odstup pod pásom už v kóde JE — nepridávaj ho.** `globals.css` (3409–3425)
rieši to takto:

```css
@media (max-width: 639px) {
  .acknowledge-dock {
    position: fixed; left: 10px; right: 10px;
    bottom: calc(66px + env(safe-area-inset-bottom));
    z-index: 24;
  }
  .acknowledge-dock .button { width: 100%; min-height: 50px; border-radius: 12px; box-shadow: var(--shadow); }
  .acknowledge-card { margin-bottom: 64px; }   /* ← miesto pre pás */
}
```

Odstup nesie **karta** (`margin-bottom: 64px`), nie stránka — a pás sedí
66 px nad spodkom, teda nad spodnou lištou, nie na nej. V skorších verziách
tohto zadania som navrhoval `padding-bottom` na stránke; bolo to zbytočné
a nesprávne. **Nechaj kód, ako je.**

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Percento prečítaného textu | ⚠️ len klientsky odhad z pozície rolovania — nie dáta. Viď úloha 4. |
| Odhad času na prečítanie | ❌ `reading_times` merajú skutočný čas po fakte. Nekresliť. |
| „Čo sa zmenilo oproti verzii, ktorú som potvrdil" | ❌ rozdiel medzi verziami neexistuje (viď `DETAIL.md`). Bola by to najužitočnejšia vec na tejto obrazovke — 🔴 samostatné rozhodnutie pre Jána. |

🔴 Zmena schémy: **netreba žiadnu.**
