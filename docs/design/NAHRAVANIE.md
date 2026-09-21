# NAHRAVANIE.md — Nahrať dokument (`/library/new`)

**Obrazovka, ktorou sa obsah dostáva do systému.** Dovtedy sa normy nahrávali
príkazovým riadkom — zákazník si novelu nevedel nahrať sám.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `SPRAVA.html` (časť 1).

> ⚠️ **Prepísané 21. 9. 2026 podľa ADR-010.** Ján rozhodol, že pole
> **Zaradenie z formulára mizne** a **kľúč sa negeneruje ručne, ale zo
> názvu** so živým náhľadom. Úlohy 4 a 5 nižšie sú nové; rám v
> `SPRAVA.html` ešte kreslí starý formulár s oboma poľami —
> **v tomto jednom bode platí zadanie, nie rám.**

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/library/new/page.tsx`.

| Vec | Kde | Stav |
| --- | --- | --- |
| Číslované sekcie (nie stepper) | `.upload-step`, `.upload-step-no` | ✅ |
| Zóna na pretiahnutie bez JS | `.upload-drop`, `.upload-file` | ✅ |
| Mriežka metadát | `.upload-grid`, `.upload-wide` | ✅ |
| ~~Zaradenie a kľúč ako dve polia~~ | `sectionKey` + `documentKey` | ⛔ **ruší ADR-010 — viď úlohy 4 a 5** |
| Nápoveda s hodnotami číselníka | `CODELISTS.category` | ✅ (pre Druh) |
| Oddelenie, ktoré dokument spravuje | `ownerDepartment` | ✅ |
| Značky cez `MultiSelect` | `t.tags` | ✅ |
| Predvyplnenie po chybe z adresy | `?title=&documentKey=` | ✅ |
| Šírka 880 px | `maxWidth: 880` | ✅ |

**Stepper sa nerobí a nerobil** — schvaľovací krok pri nahrávaní neexistuje
(dokument vzniká ako koncept, schvaľuje sa až na detaile). Tri číslované
sekcie sú správne: je to jeden formulár, nie sprievodca.

---

## Úloha 1 — Chyba pri nahrávaní sa musí dať prežiť

**Teraz:** pri chybe sa vypíše `<p className="card">` s textom vo
`--warn-fg` a formulár sa predvyplní z adresy (`?title=&sectionKey=`).
**Súbor sa ale nepredvyplní** — ten prehliadač preniesť nevie.

Človek teda nahral 40 MB PDF, dostal chybu v metadátach a musí súbor vybrať
znova, hoci s ním nič nebolo.

**Má byť:** hláška povie, **čo presne** treba opraviť a **že súbor treba
vybrať znova** — nie mlčať o tom.

```
Dokument sa nenahral: kľúč „rpp-2026" už v knižnici existuje.
Zmeňte kľúč a vyberte súbor znova — prehliadač ho z bezpečnostných
dôvodov neuchová.
```

Použi `.notice--error` zo `ZAKLAD.md`, nie vlastnú kartu s `--warn-fg`.
Jantárová je pre upozornenie, chyba je červená.

**Zóna na súbor dostane v tomto stave zvýraznenie:**

```css
.upload-drop.is-required { border-color: var(--bad-fg); }
```

## Úloha 2 — Zóna na súbor ukáže, čo je vybraté

**Teraz:** `.upload-drop` je `<label>` s textom a skrytým `<input type="file">`.
Po výbere súboru sa **nič nezmení** — natívny `<input>` názov ukazuje mimo
zóny alebo vôbec.

**Má byť** — bez JavaScriptu to ide len jedným spôsobom a ten je správny:
nechaj `<input type="file">` **viditeľný** pod nadpisom zóny, nie skrytý.
Prehliadač potom sám vypíše „vybrané: rpp-4-2.pdf" a je to jeho natívne
chovanie, ktoré funguje všade.

```css
.upload-file {
  /* nie sr-only */
  margin-top: 10px;
  font-size: var(--fs-small);
}
```

Zóna zostáva klikateľná ako celok (je to `<label>`), len prestane predstierať,
že je to tlačidlo „Vybrať súbor" bez spätnej vazby.

## Úloha 3 — Formát a limit patria k zóne, nie do nápovedy

**Teraz:** `.upload-drop-note` nesie formáty. Limit veľkosti (40 MB) a to,
**že SVG sa zámerne nepodporuje**, v texte nie je — hoci to server odmietne
a človek sa to dozvie až po nahraní.

**Má byť** v `.upload-drop-note`, monospace, tri riadky:

```
PDF · DOCX · MD · sken (OCR)
najviac 40 MB
SVG zámerne nepodporujeme
```

Hodnoty ber z `lib/branding.ts` (`MAX_BYTES`, `ALLOWED_TYPES`) — nie
natvrdo. Keď sa limit zmení, text sa zmení s ním.

## Úloha 4 — Kľúč sa negeneruje ručne: pole nahradí náhľad (ADR-010)

**Teraz:** formulár pýta **Kľúč** ako povinné textové pole a nápoveda
hovorí, že nevyplnený sa doplní zo zaradenia.

**Prečo to musí zmiznúť:** doplnenie zo zaradenia je pasca. Zaradenie je
kategória — `poriadky` zdieľajú všetky poriadky — takže prvý dokument
kategórie kľúč obsadí a identita ďalších je lož. „poriadky" nie je identita
Pracovného poriadku.

**Má byť:**

1. **Pole „Kľúč" zmizne z bežného toku.** Kľúč vzniká ako slug z názvu:
   malé písmená bez diakritiky, medzery a interpunkcia na podčiarkovník
   („Pracovný poriadok SFZ" → `pracovny_poriadok_sfz`).
2. **Pod poľom Názov je náhľad výsledného identifikátora** — celý, s
   prefixom tenanta:

```
Identifikátor: sfz:pracovny_poriadok_sfz
```

```css
.key-preview {
  margin-top: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--fs-micro);
  color: var(--muted);
}
.key-preview-value { color: var(--ink); }
.key-preview--taken { color: var(--bad-fg); }
```

3. **Prepísať sa dá, ale je to vedomý krok** — `<details>` „Zadať kľúč
   ručne" hneď pod náhľadom, nie samostatné pole v mriežke. Text v ňom:
   „Kľúč vzniká raz a nikdy sa nemení — žije v potvrdeniach, audite a
   exportoch. Premenovanie dokumentu ho nemení."
4. **Pri kolízii varuj pred odoslaním** (`.key-preview--taken`):
   „Identifikátor `sfz:pracovny_poriadok` je obsadený. Upravte názov, alebo
   zadajte kľúč ručne." Serverová kontrola v `uploadDocument()` zostáva
   poslednou bránou.

⚠️ **Živý náhľad podľa toho, čo človek píše, vyžaduje JavaScript.**
Handoff inak stojí na tom, že nič JS nevyžaduje — preto: **bez skriptu sa
náhľad nevykreslí vôbec** (nie prázdny), pole na ručné zadanie zostane
prístupné a server kľúč doplní sám. Formulár musí odoslateľný bez skriptu,
len bez náhľadu.

## Úloha 5 — Zaradenie sa zlučuje do Druhu (ADR-010)

**Pole „Zaradenie" z formulára odstráň.** Od D80 je zaradenie len
zoskupovanie — a presne to isté robí **Druh** (`category`). Dve polia na
jednu rolu znamenajú, že pri každom dokumente niekto rieši, čím sa líšia.

- **Druh sa stáva povinným** a presúva sa medzi hlavné polia (dnes je
  nepovinný).
- `sectionKey` **v dátach zostáva** — určuje `documentId` dokumentom spred
  D80. Vo formulári o ňom nie je ani slovo.
- Nápoveda pri Druhu vypisuje hodnoty z `CODELISTS.category`, nie
  `sectionKey`.

🔴 **Migráciu hodnôt `sectionKey.json` → `category.json` v tomto PR
nerob.** ADR-010 ju radí až po Fáze 8 (ide o ostré dáta). Tento PR mení
**len formulár**; ak v číselníku Druhov hodnota chýba, je to vec migrácie,
nie tohto PR.

## Úloha 6 — Sekcia 2 má na telefóne dlhý stĺpec

Po úlohách 4 a 5 má formulár o jedno pole menej a kľúč je v `<details>`.
Zostáva rozdelenie na hlavné a ďalšie:

**Hlavné (vždy vidieť):** názov (+ náhľad kľúča), druh, prístup, jazyk.
**Ďalšie (v `<details>` „Ďalšie údaje"):** oddelenie, interné číslo,
značky, rozsah.

```css
.upload-optional > summary {
  font-size: var(--fs-small);
  font-weight: 600;
  padding: 10px 0;
  cursor: pointer;
}
```

`<details>` dávaj **vždy `open`**. Zbalené nepovinné polia na desktope by
boli skrytá práca; na telefóne stačí, že sú dole.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 880 px; `.upload-grid` dva stĺpce; `.upload-wide` cez oba |
| **390** | Jeden stĺpec; nepovinné polia v `<details>`; „Nahrať" na celú šírku 44 px |

**Rám v `SPRAVA.html` je v tomto zastaraný** — kreslí Zaradenie aj Kľúč ako
polia v mriežke. Všetko ostatné (zóna na súbor, hlásenia, značky, rozloženie)
platí.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Náhľad nahraného PDF | ❌ konverzia beží po nahraní na serveri. Nekresliť. |
| Počet strán pred nahraním | ❌ to isté. |
| Schvaľovateľ pri nahrávaní | ❌ kolo sa zakladá na detaile, nie tu (ADR-006). |

🔴 Zmena schémy: **netreba žiadnu.** `sectionKey` zostáva v dátach; mizne
len z formulára.
