# NAHRAVANIE.md — Nahrať dokument (`/library/new`)

**Obrazovka, ktorou sa obsah dostáva do systému.** Dovtedy sa normy nahrávali
príkazovým riadkom — zákazník si novelu nevedel nahrať sám.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `SPRAVA.html` (časť 1).

---

## Čo je UŽ HOTOVÉ — nerob znova

`app/src/app/library/new/page.tsx`.

| Vec | Kde | Stav |
| --- | --- | --- |
| Číslované sekcie (nie stepper) | `.upload-step`, `.upload-step-no` | ✅ |
| Zóna na pretiahnutie bez JS | `.upload-drop`, `.upload-file` | ✅ |
| Mriežka metadát | `.upload-grid`, `.upload-wide` | ✅ |
| Zaradenie a kľúč ako dve polia (D80) | `sectionKey` + `documentKey` | ✅ |
| Nápoveda s hodnotami číselníka | `CODELISTS.sectionKey` | ✅ |
| Oddelenie, ktoré dokument spravuje | `ownerDepartment` | ✅ |
| Značky cez `MultiSelect` | `t.tags` | ✅ |
| Predvyplnenie po chybe z adresy | `?title=&sectionKey=` | ✅ |
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

## Úloha 4 — Sekcia 2 má na telefóne 11 polí v jednom stĺpci

**Teraz:** `.upload-grid` má 11 polí. Na 390 px je to stĺpec vysoký ~1400 px
a tlačidlo „Nahrať" je pod ním.

**Má byť:** **povinné polia zostanú, nepovinné do `<details>`.**

Povinné (vždy vidieť): názov, zaradenie, kľúč, prístup, jazyk.
Nepovinné (v `<details>` „Ďalšie údaje"): druh, oddelenie, interné číslo,
značky, rozsah.

```css
.upload-optional > summary {
  font-size: var(--fs-small);
  font-weight: 600;
  padding: 10px 0;
  cursor: pointer;
}
```

**Na desktope je `<details>` otvorené** (`open` atribút pri šírke nad 1024
sa cez CSS nastaviť nedá — daj `open` vždy a na telefóne to človek zavrie
sám; alebo, čistejšie: `open` nastav v `page.tsx` vždy `true` a
neriešiť to). Rozhodnutie: **vždy `open`**. Zbalené nepovinné polia na
desktope by boli skrytá práca; na telefóne stačí, že sú dole.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Obsah 880 px; `.upload-grid` dva stĺpce; `.upload-wide` cez oba |
| **390** | Jeden stĺpec; nepovinné polia v `<details>`; „Nahrať" na celú šírku 44 px |

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Náhľad nahraného PDF | ❌ konverzia beží po nahraní na serveri. Nekresliť. |
| Počet strán pred nahraním | ❌ to isté. |
| Schvaľovateľ pri nahrávaní | ❌ kolo sa zakladá na detaile, nie tu (ADR-006). |

🔴 Zmena schémy: **netreba žiadnu.**
