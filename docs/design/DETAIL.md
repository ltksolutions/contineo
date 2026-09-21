# DETAIL.md — Detail dokumentu (`/library/[id]`)

**Pracovný pult správcu obsahu.** Jedna obrazovka, na ktorej sa dokument
upravuje, zverejňuje, prideľuje, preindexuje a kde žije história verzií.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `DETAIL.html`.

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/library/[id]/page.tsx` (~900 riadkov). Je to najväčšia
obrazovka v systéme a **funkčne je hotová.**

| Vec | Kde | Stav |
| --- | --- | --- |
| Mriežka obsah + bočný panel | `.detail-grid`, `.detail-main`, `.detail-side` | ✅ |
| Bočný panel: potvrdenia, metadáta | `.detail-card`, `.detail-bar` | ✅ |
| Na telefóne je panel karta NAD textom | PR 5 | ✅ |
| Percento potvrdení + pásik | `.detail-percent`, `.detail-bar-fill` | ✅ |
| Metadáta ako `<dl>` | `.detail-meta-row` | ✅ |
| Úprava metadát v `<details>` | `.card` + `<form>` | ✅ |
| Zverejnenie so schvaľovacím kolom (ADR-006) | `publishHeading` | ✅ |
| Oprava textu znenia (ADR-007) | `textFix*` | ✅ |
| Prenos pridelení na nové znenie | `carryOverAssignmentsAction` | ✅ |
| Nové znenie zo súboru | `newVersionHeading` | ✅ |
| Preindexovanie | `reindexDocumentAction` | ✅ |
| História verzií s auditom | `.audit`, `.audit-entry` | ✅ |
| Odvolanie verzie s povinným dôvodom | `revokeVersion*` | ✅ |
| Priradenie do priečinka | `assignToFolderAction` | ✅ |

**Nič z tejto funkcionality neodstraňuj ani nepresúvaj na inú obrazovku.**
Každá z tých akcií má v kóde zdôvodnenie a väčšina nesie auditný záznam.

---

## Úloha 1 — Obrazovka nemá hierarchiu: sedem kariet v jednom stĺpci

**Toto je hlavná úloha.**

**Teraz:** v `.detail-main` stojí pod sebou sedem `.card` blokov —
metadáta, prenos pridelení, priečinok, text, zverejnenie, nové znenie,
preindexovanie — a pod nimi história verzií. Všetky majú rovnakú váhu,
rovnaké `padding: 18` a žiadne zoskupenie. Na 1440 px je to stĺpec vysoký
~4000 px, v ktorom sa „Zverejniť" hľadá rolovaním.

Väčšina z nich je pritom **vzácna akcia**: preindexovanie sa robí pri
poruche, nové znenie raz za rok, oprava textu výnimočne.

**Má byť:** tri úrovne, nie jedna.

**1. Hlavička dokumentu** (ostáva) — pilulky, názov, meta riadok.

**2. Čo treba teraz** — práve tie karty, ktoré niečo žiadajú, a len ony.
**Vždy najviac jedna a vždy v jednom stave** — stav sa odvodí z dokumentu
a z bežiaceho kola, nikdy sa nekreslia dva naraz:

| Situácia | Karta úrovne 2 |
| --- | --- |
| dokument nemá publikované znenie, má koncept | **Zverejniť znenie** + „Predložiť na schválenie" |
| má platné znenie **a** pripravený koncept | **Zverejniť nové znenie 5.0** + „Predložiť na schválenie" |
| beží schvaľovacie kolo | **stav kola** — kto rozhoduje, čo predložil; žiadne tlačidlo na predloženie |
| publikované a nič sa nepripravuje | **žiadna karta** |

Pozor na dve chyby, ktoré sa tu ponúkajú samy:
- chip „Čaká na schválenie" **spolu** s tlačidlom „Predložiť na schválenie" —
  buď kolo beží, alebo sa má predložiť; nikdy oboje,
- hlavička s pilulkou „Platný" a karta s textom „znenie je koncept" — hlavička
  hovorí o **dokumente**, karta o **znení**, ktoré sa práve pripravuje.
  Preto má karta v názve číslo verzie („nové znenie 5.0"), aby bolo zrejmé,
  že sa netýka toho platného.

**3. Ostatné akcie do `<details>` s jedným súhrnným nadpisom:**

```html
<details class="detail-tools">
  <summary>Úpravy a správa dokumentu</summary>
  <!-- metadáta · priečinok · prenos pridelení · nové znenie ·
       oprava textu · preindexovanie -->
</details>
```

```css
.detail-tools { margin: 0 0 18px; }
.detail-tools > summary {
  font-size: var(--fs-section);
  font-weight: 650;
  padding: 14px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
}
.detail-tools[open] > summary { border-radius: var(--radius) var(--radius) 0 0; }
.detail-tools-body { display: grid; gap: 14px; padding: 14px 0 0; }
```

**Prečo `<details>` a nie záložky:** záložky potrebujú klientsky stav alebo
adresu, a táto obrazovka má už dnes v adrese `?msg=` a `?error=`.
`<details>` funguje bez JavaScriptu (na čom celá aplikácia stojí) a hlavne —
zatvorený stav je tu správny predvolený stav. Kto prišiel dokument
zverejniť, nechce vidieť formulár na preindexovanie.

**Metadáta zostanú vo vlastnom `<details>`** vnútri — sú najčastejšie
používané z tejto skupiny, takže patria prvé.

## Úloha 2 — Stavové pilulky a verzie v tabuľkovej farbe

**Teraz:**

```tsx
<span className="tag">{processing[d.processingState]}</span>
{d.category && <span className="tag quiet">{d.category}</span>}
...
{v.isActive ? <span className="tag">{t.active}</span> : <span className="tag">{t.archived}</span>}
```

Všetko neutrálne sivé. V zozname knižnice má ten istý dokument farebnú
pilulku (PR 8), na detaile ju stratí — človek príde z farebného zoznamu na
sivý detail a nevie, či je to ten istý stav.

**Má byť** — `statusTagClass()` z `lib/libraryRead.ts` (existuje, PR 8):

| Miesto | Trieda |
| --- | --- |
| stav dokumentu v hlavičke | `statusTagClass(d)` — rovnaká ako v zozname |
| aktívna verzia | `.tag--published` |
| archivovaná verzia | `.tag--archived` |
| kategória (druh) | `.tag` neutrálna — **správne, nemeniť** |

Technické spracovanie sa ukazuje **len keď niečo hovorí** (rovnaké pravidlo
ako v zozname, PR 8): hotový stav sa nekreslí, zlyhanie červené.

## Úloha 3 — Inline štýly do tried

Rovnaký problém ako `/documents` a `/approvals`, ale vo väčšom rozsahu:
takmer každá z tých sedmičiek kariet má `style={{ padding: 18, display: "grid", gap: 10, margin: "0 0 18px" }}`.

```css
.detail-page { max-width: 1180px; }
.detail-block { padding: 18px; display: grid; gap: 12px; margin: 0 0 18px; }
.detail-block-title { font-size: var(--fs-section); margin: 0; }
.detail-block-note { font-size: var(--fs-body); color: var(--muted); margin: 0; }
.detail-chips { display: flex; gap: 7px; flex-wrap: wrap; margin: 0 0 10px; }
```

`.detail-grid`, `.detail-side`, `.detail-card`, `.audit` už existujú —
doplň k nim len tieto.

## Úloha 4 — Dlhý názov a dlhý meta riadok

`.page-title` má `line-height: 1.2` a žiadne `text-wrap`. Názov normy
s 90 znakmi sa na 1180 px zalomí do dvoch riadkov s jedným slovom na druhom.

```css
.detail-page .page-title { text-wrap: pretty; overflow-wrap: anywhere; }
```

Meta riadok pod názvom (id · priečinok · verzia · účinnosť) je na 390 px
štyri riadky. Nechaj ho zalomiť — **neskracuj** — ale oddeľ interpunkciou,
ktorá znesie zalomenie: ` · ` s medzerami, nie `·` natvrdo.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | `.detail-grid` = obsah + panel 260 px vpravo; „Čo treba teraz" hore; `<details>` zatvorené |
| **834** | To isté, panel užší; `<details>` zatvorené |
| **390** | Panel je karta **nad** textom (PR 5); `<details>` zatvorené; formuláre v jednom stĺpci |

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Rozdiel proti predchádzajúcej verzii | ❌ existuje len pri oprave textu (ADR-007), nie medzi verziami. Samostatné rozhodnutie. |
| „Kto nepotvrdil" ako zoznam na detaile | ⚠️ odkaz existuje, vedie na `/hr`. Neduplikovať zoznam sem. |
| Oddelenie, ktorému je dokument pridelený | ❌ dokument to nenesie (`assignments`). `ownerDepartment` je iná vec — oddelenie, ktoré dokument **spravuje**. Nemýliť si ich. |

🔴 Zmena schémy: **netreba žiadnu.**
