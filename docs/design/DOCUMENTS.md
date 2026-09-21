# DOCUMENTS.md — Na potvrdenie (`/documents`)

**Obrazovka, na ktorej človek plní povinnosť.** Odpovedá na otázku *čo mám
prečítať a potvrdiť, a dokedy.*

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `DOCUMENTS.html`
(1440 / 390 + prázdny stav + po termíne + zablokovaný krok).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/documents/page.tsx` (220 riadkov).

| Vec | Kde | Stav |
| --- | --- | --- |
| Trasy sa nesplošťujú, každá má vlastnú sekciu | `tracks.map` | ✅ |
| Poradie kroku „Krok 2 z 5" | `t.step()` | ✅ |
| Miesto, kde človek skončil, má rám v `--accent` | `isNext` | ✅ |
| Postup „3 z 5" pri trase | `t.progress()` | ✅ |
| Súčet len pri viacerých trasách | `tracks.length > 1` | ✅ |
| Zablokovaný krok s dôvodom | `s.blocked` | ✅ |
| Pridelené mimo trasy má vlastnú sekciu | `outside` | ✅ |
| Kľúč trasy ide v adrese do dôkazu | `?track=` | ✅ |
| Stav „nie je v organizácii" bez shellu | `not-in-tenant` | ✅ |
| Šírka 760 px (text, nie tabuľka) | `maxWidth: 760` | ✅ |

**Karty zostávajú na všetkých šírkach** — tabuľková podoba sa nerobí
(rozhodnutie z PR 5). Karta nesie poradie kroku, stav aj dôvod blokovania
a riadok tabuľky to neunesie; porovnávať sa tu navyše nič neporovnáva.

---

## Úloha 1 — Termín na obrazovke ÚPLNE CHÝBA

**Toto je najdôležitejšia úloha v tomto zadaní.**

**Teraz:** karta kroku ukazuje verziu a dátum účinnosti
(`t.version(versionLabel, effectiveFrom)`). **Termín potvrdenia nie je
nikde.** Pritom Prehľad (`/`) pri tej istej povinnosti kreslí
`due-chip` s „do 12. 9. 2026" a dlaždica hlási „2 po termíne".

Človek teda na Prehľade vidí, že mu niečo horí, klikne — a na obrazovke,
kde to má vybaviť, termín zmizne.

**Má byť:** `due-chip` na karte, s tými istými tromi stavmi ako na Prehľade
(`dueState()` z `lib/due.ts` — tá funkcia už existuje a používa ju Prehľad).

```css
.duty-due { margin-left: auto; }
```

Chip ide do riadku so stavovou pilulkou, **vpravo**. Poradie v riadku:
`Krok 2 z 5` · názov (flex) · `due-chip` · stavová pilulka.

**V sekcii „Pridelené mimo trasy" sa `.duty-order` nekreslí vôbec.**
Pridelenie mimo trasy poradie nemá — trasa hovorí „a v tomto poradí“,
pridelenie len „toto je vaša povinnosť“. Dnešný kód `.duty-order` v tejto
sekcii nevykresľuje a je to správne; nepridávaj ho tam.

Text: „do 12. 9. 2026" (`t.by()`, ten istý kľúč ako na Prehľade — nie nový).

**Keď povinnosť termín nemá, chip sa nekreslí.** Prázdny chip alebo
„bez termínu" je šum; absencia termínu je bežný a v poriadku stav.

🔴 **Poznámka k dátam:** termín nesie `pendingForPerson()` (pole `due`), ale
`acknowledgementDuties()` — ktorú táto obrazovka volá — ho v krokoch trasy
**nevracia**. Overiť a doplniť do návratového typu; ak by to znamenalo druhý
dotaz, povedz to a rozhodne sa. Nie je to zmena schémy, dáta existujú.

## Úloha 2 — Stavové pilulky prestanú prepisovať farbu inline

**Teraz:**

```tsx
<span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
```

Inline prepis existujúceho variantu. Znamená to, že keď sa v `ZAKLAD.md`
zmení paleta pilulky, táto obrazovka sa nezmení.

**Má byť:** varianty zo `ZAKLAD.md`, prípadne dva nové pre stavy, ktoré
knižnica nemá:

| Stav kroku | Trieda |
| --- | --- |
| hotové | `.tag--published` (zelená) |
| zablokované | `.tag--draft` (jantárová) |
| pokračujte tu | `.tag--review` (accent-soft) |
| nezačaté | `.tag` (neutrálna, bez variantu) |

Žiadny `style={{ background }}` na pilulke nesmie zostať.

## Úloha 3 — Inline štýly do tried

**Teraz:** takmer každý prvok má `style={{ … }}`. Karta kroku má
`padding: "16px 18px"`, riadok `display: flex, gap: 16, flexWrap`, sekcia
`margin: "0 0 32px"`. Je to presne to, čo `.page-title` a `.page-lead`
v `ZAKLAD` odstránili na iných obrazovkách.

**Má byť** — päť tried do `globals.css`:

```css
.duty-track { margin: 0 0 32px; }
.duty-track-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
  margin: 0 0 4px;
}
.duty-list { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 12px; }
.duty-card { padding: 16px 18px; }
.duty-card.is-next { border-color: var(--accent); }
.duty-head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.duty-order { flex: 0 0 auto; font-size: var(--fs-small); color: var(--muted); }
.duty-title { flex: 1 1 260px; font-size: var(--fs-lead); font-weight: 600; text-wrap: pretty; }
.duty-meta { font-size: var(--fs-small); color: var(--muted); margin: 8px 0 0; }
.duty-action { margin: 12px 0 0; }
```

`maxWidth: 760` ponechaj inline **alebo** dajmu triedu `.duty-page` —
je to vec obsahu (text na čítanie), takže nepatrí do shellu. Rozhodni sa,
ale nech je to jedno miesto.

## Úloha 4 — Prázdny stav

**Teraz:** `<p className="card" style={{ padding: 20 }}>{t.nothingToDo}</p>` —
jedna veta v karte.

**Má byť:** `.empty` zo `ZAKLAD.md`, s dvomi riadkami:

- **„Nemáte nič na potvrdenie"**
- „Keď vám niekto pridelí normu alebo vás zaradí do trasy, objaví sa tu aj
  s termínom. Nič od vás teraz nikto nečaká."

Bez akcie — človek tu nemá čo urobiť a tlačidlo „Prejsť do knižnice" by mu
podsúvalo prácu, ktorú nemá.

**Pozor na rozdiel oproti knižnici:** tu nie sú filtre, takže variant
„filtru nič nevyhovuje" neexistuje. Jeden text.

## Úloha 5 — Telefón: akcia na celú šírku

**Teraz:** `<Link className="button">` v `<p>` — na 390 px je to tlačidlo
šírky textu uprostred karty.

**Má byť** pod 640 px na celú šírku karty, výška 44 px:

```css
@media (max-width: 639px) {
  .duty-action .button { width: 100%; min-height: 44px; }
  .duty-head { gap: 8px; }
  .duty-order { flex: 1 0 100%; }
}
```

Poradie kroku ide na 390 px na vlastný riadok — inak zoberie názvu 60 px.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 760 px vľavo (nie na stred — shell dáva odsadenie); karty pod sebou; chip a pilulka v riadku s názvom |
| **390** | Poradie kroku na vlastnom riadku; chip a pilulka pod názvom; tlačidlo na celú šírku |

Tablet 834 je zhodný s 1440 — obsah má aj tam 760 px. Vlastný rám nepotrebuje.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Termín (`due`) v krokoch trasy | ⚠️ dáta existujú v `pendingForPerson()`, `acknowledgementDuties()` ich nevracia — viď úloha 1 |
| „Kto mi to pridelil" | ❌ pridelenie nesie `audience`, nie osobu, ktorá ho vytvorila. Nekresliť. |
| Odhad času na prečítanie | ❌ `reading_times` merajú skutočný čas po fakte, nie odhad pred ním. Nekresliť. |

🔴 Zmena schémy: **netreba žiadnu.**
