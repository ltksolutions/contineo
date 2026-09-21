# OSOBY.md — Osoby (`/people` + štyri podstránky)

**Správa ľudí organizácie.** Kto je v systéme, do akého oddelenia patrí,
aké má roly, či ešte nedoručil pozvanie.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `OSOBY.html`.

⚠️ **Adresár (`/directory`) je iná obrazovka a nezjednocuje sa s touto.**
Adresár je pre všetkých (kontakty), Osoby sú správa s inými právami. Vyzerajú
podobne a to je jediné, čo majú spoločné.

---

## Rozcestník

| Routa | Šírka | Na čo je |
| --- | --- | --- |
| `/people` | 880 | zoznam + hľadanie + tri akcie |
| `/people/[id]` | 680 | úprava osoby, roly, vylúčenie, jej dôkazy |
| `/people/new` | 560 | pozvať jednu osobu |
| `/people/invite` | 720 | rozposlať pozvania hromadne |
| `/people/import` | 680 | import z CSV |

---

## Čo je UŽ HOTOVÉ — nerob znova

| Obrazovka | Hotové |
| --- | --- |
| `/people` | zoznam kariet, `LiveFilter` (funguje bez JS), typ osoby a roly ako pilulky, počet, tri akcie |
| `/people/[id]` | plný formulár (meno, titul, funkcia, telefón, pracovisko, oddelenie, typ, jazyk, skupiny, trasy), roly v `.hr-group`, opätovné pozvanie, vylúčenie s povinným opísaním, výpis dôkazov osoby |
| `/people/new` | `.field-row` páry, nápovedy pri každom poli, predvyplnenie po chybe z adresy |
| `/people/invite` | náhľad zoznamu pred odoslaním, počet v tlačidle |
| `/people/import` | `CsvImport` komponent |

**Vylúčenie osoby má povinné opísanie e-mailu** (`confirmation`) — to je
zámerná trecia plocha, neuľahčuj ju.

---

## Úloha 1 — Karta osoby nepovie to hlavné: či je účet aktívny

**Teraz:** karta má meno, pilulku typu osoby, pilulky rolí a vpravo
`.quiet` text. Stav účtu (pozvaný / aktívny / vylúčený) je v tom texte
zamiešaný medzi ostatné.

**Má byť** stavová pilulka z `ZAKLAD.md` **ako prvá vpravo**:

| Stav | Trieda |
| --- | --- |
| Aktívny | `.tag--published` |
| Pozvaný, nedoručené | `.tag--draft` |
| Vylúčený | `.tag--archived` |

Typ osoby a roly zostávajú neutrálne `.tag` — nie sú to stavy, sú to
vlastnosti. Keby boli farebné tiež, farba by prestala niečo znamenať.

**Vylúčená osoba dostane `opacity: .75`** (rovnako ako odvolané potvrdenie
v `/acknowledgements`) a **zostáva v zozname** — nemaže sa.

## Úloha 2 — Zoznam osôb potrebuje filtre, nie len hľadanie

**Teraz:** `LiveFilter` hľadá v mene a e-maile. Pri 210 ľuďoch je otázka
„kto z Právneho ešte nepotvrdil pozvanie" nezodpovedateľná.

**Má byť:** tri pilulkové filtre nad zoznamom, ako faceta v knižnici
(`.pill` zo `ZAKLAD.md`), v URL:

```
?status=invited     Pozvaní · Aktívni · Vylúčení
?dept=<kód>         oddelenie
?role=<kód>         rola
```

Použi `normalizeQuery`/`toQuery` — **ten istý mechanizmus ako knižnica**,
takže filtrovaný zoznam sa dá poslať odkazom a funguje bez JS.

Chipy aktívnych filtrov pod nimi (`.library-chip`, existuje).

## Úloha 3 — `/people/[id]`: sedem kariet v stĺpci (ten istý problém ako detail dokumentu)

**Teraz:** formulár, opätovné pozvanie, vylúčenie a dôkazy — štyri `.card`
bloky pod sebou, každý s `padding: 20` a rovnakou váhou. Vylúčenie osoby
vyzerá ako uloženie telefónu.

**Má byť** rovnaké riešenie ako v `DETAIL.md` (úloha 1):

1. **hlavička** — meno, e-mail, stav
2. **formulár** — hlavná práca, ostáva hore
3. **`<details class="detail-tools">`** — „Pozvanie a prístup" (opätovné
   pozvanie + vylúčenie/vrátenie)
4. **dôkazy osoby** — dole, ako dnes

Vylúčenie v zbalenom `<details>` nie je skrývanie — je to zaradenie
podľa toho, ako často sa robí.

## Úloha 4 — Prázdne a chybové stavy

| Obrazovka | Nadpis | Text |
| --- | --- | --- |
| `/people` bez filtra | Zatiaľ nikto | Pozvite prvú osobu alebo naimportujte zoznam z CSV. |
| `/people` s filtrom | Filtru nič nevyhovuje | + „Zrušiť filtre“ |
| `/people/invite` | Niet komu posielať | Všetci pozvaní už prístup majú. |
| `/people/[id]` dôkazy | Žiadne pridelenia | Tejto osobe zatiaľ nebola pridelená norma. |

`/people/new` má dnes chybu ako `<p className="card">` v `--warn-fg` —
zmeň na `.notice--error` (chyba je červená, jantárová je upozornenie).

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Šírky podľa obrazovky (560–880) zostávajú; `.field-row` dva stĺpce od 640 px |
| **390** | `.field-row` jeden stĺpec (už je); akcie na celú šírku 44 px; filtre sa zalomia |

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Kedy sa osoba naposledy prihlásila | ❌ neukladá sa. Nekresliť. |
| Fotografia osoby | ❌ nie je v modeli ani v `/directory`. |
| História zmien osoby | ⚠️ auditný záznam existuje, výpis na obrazovke nie — 🔴 samostatné rozhodnutie |

🔴 Zmena schémy: **netreba žiadnu.**
