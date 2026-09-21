# PRIECINKY.md — Správa priečinkov (`/library/folders`)

**Obrazovka správcu, ktorá vznikla v PR 4** — predtým bola správa priečinkov
zamiešaná v panely filtrov knižnice a na telefóne z nej bol stĺpec dlhý
stovky riadkov pod výsledkami.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `SPRAVA.html` (časť 2).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/library/folders/page.tsx`.

| Vec | Kde | Stav |
| --- | --- | --- |
| Strom s čiarami hierarchie | `.tree--lines` + `--level` (globals.css 2937–2969) | ✅ |
| Odsadenie z `--level`, nie z inline paddingu | `.tree--lines .tree-item` | ✅ |
| Poradie ťahaním + šípky ako bezJS cesta (D60) | `.tree-grip`, `.tree-arrows` | ✅ |
| Premenovanie, presun, zrušenie, zakladanie | 4 serverové akcie | ✅ |
| Každý priečinok vo vlastnom `<details>` | `.tree-edit-toggle` | ✅ |
| Počet vrátane podstromu | `.tree-count` | ✅ |
| Zrušiť sa dá len prázdny priečinok | `deleteFolderAction` | ✅ |
| Návrat na knižnicu (`return=folders`) | `backToLibrary()` | ✅ |
| Dotykové ciele 44 px | PR 1 | ✅ |
| Šírka 640 px | `maxWidth: 640` | ✅ |

**Funkčne je hotová.** Nižšie sú tri veci, ktoré chýbajú ako stav, nie ako
funkcia.

---

## Pozor: strom sa nekreslí tromi triedami, ale štyrmi a premennou

Skutočná štruktúra (`globals.css` 1624–1694 a 2937–2995 + `TreeWithOrder.tsx`):

```html
<ul class="tree tree--lines">
  <li class="tree-item" style="--level: 1">
    <details><summary><div class="tree-row">…</div></summary>
      <div class="tree-edit">…</div>
    </details>
  </li>
  <li class="tree-item" style="--level: 2">…</li>
</ul>
```

- **Odsadenie nesie `--level`** ako inline premenná na `.tree-item`, nie
  `padding-left` písaný rukou. Z tej istej premennej sa počítajú aj čiary
  hierarchie (`::before` zvislá, `::after` vodorovná odbočka) — bez nej je
  hlbší strom len zoznam s medzerami naľavo.
- Čiary sa kreslia **až od druhej úrovne** (`:not([style*="--level: 1"])`) —
  koreňový priečinok nemá z čoho vychádzať.
- `.tree-row` má `align-items: baseline` a `min-height: 44px` — dotykový
  cieľ je už v ňom, nie v mediálnom dotaze.
- `.tree-edit` má `border-left: 2px solid var(--line)` a odsadenie 12 px —
  vizuálne patrí pod svoj riadok.

**Nič z toho neprepisuj.** Keby si odsadenie urobil inak, čiary sa rozídu
s riadkami, lebo obe počítajú z tej istej premennej.

## Úloha 1 — Prázdny strom

**Teraz:** keď organizácia nemá ani jeden priečinok, vykreslí sa nadpis,
prázdne miesto a pod ním formulár „Nový priečinok".

**Má byť:** `.empty` zo `ZAKLAD.md` **nad** formulárom:

- **„Knižnica nemá priečinky"**
- „Dokumenty sú zatiaľ nezaradené. Priečinok založíte formulárom nižšie —
  a potom ich doň presuniete hromadne z knižnice."

Bez tlačidla: formulár je hneď pod tým, dve výzvy k tomu istému sú šum.

## Úloha 2 — Zrušenie povie, prečo sa nedá

**Teraz:** pri priečinku s obsahom je tlačidlo „Zrušiť" a pod ním
`.quiet` veta. Server zrušenie odmietne, keď priečinok nie je prázdny.

**Má byť:** keď priečinok **má** obsah, tlačidlo je **vypnuté**
(`aria-disabled`, úloha 3 zo `ZAKLAD.md`) a veta hovorí konkrétne:

```
Zrušiť sa dá len prázdny priečinok. V tomto je 24 dokumentov
a 2 podpriečinky — najprv ich presuňte.
```

Nie „priečinok nie je prázdny". Čísla už na obrazovke sú (`.tree-count`),
takže veta ich má použiť.

## Úloha 3 — Presun na seba a do vlastného podstromu

**Teraz:** `moveFolderAction` má v `<select>` všetky priečinky vrátane
toho, ktorý sa presúva, a jeho vlastných potomkov. Server to odmietne —
ale až po odoslaní.

**Má byť:** tie možnosti v zozname **nie sú**. `flattenTree()` už hierarchiu
pozná, takže sa dajú odfiltrovať pri vykreslení.

Je to vec `page.tsx`, nie CSS. Pravidlo: **ponuka neobsahuje voľby, ktoré
server odmietne.**

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 640 px (je to strom, nie tabuľka — širší by mal riadky cez celú obrazovku) |
| **390** | To isté; `.tree-row` 44 px; formuláre v `<details>` v jednom stĺpci |

Tablet je zhodný s desktopom.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

Žiadne. Všetko potrebné nesie `lib/folders.ts`.

🔴 Zmena schémy: **netreba žiadnu.**
