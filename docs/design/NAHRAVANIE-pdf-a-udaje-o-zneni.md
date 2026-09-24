# NAHRAVANIE — PDF a údaje o znení (`/library/new`)

Základ: `ZAKLAD.md`, `NAHRAVANIE.md`. Referencia: `NAHRAVANIE-pdf-a-udaje-o-zneni.html`.

## Čo už je v kóde — nerob znova

`library/new/page.tsx`: úseky 1 Súbor (`UploadFiles`: PDF povinné + zdroj), 2 Metadáta, 3 Údaje o znení (`VersionMetaFields`), priebeh v % (D98), 25 MB, predvyplnenie z prvej strany (D108), kľúč s náhľadom (ADR-010).

## Čo sa mení (len podoba, žiadna funkcia)

1. **Zóny vedľa seba** od 640 px: `.upload-files { grid-template-columns: 1.25fr 1fr }`, pod 640 px jeden stĺpec. Dnes sú pod sebou.
   *Prečo:* úsek 1 je nižší a je vidieť, že sú to dve časti jedného nahratia.
2. **Vybraný súbor** sa ukáže ako riadok `.upload-chosen`: typ, názov (elipsa), veľkosť, odkaz „Zmeniť". Zóna PDF dostane `.is-set` (plný okraj `--ok-fg`).
   Bez JS ostáva natívny `<input type="file">` — riadok je progresívne vylepšenie v `UploadFiles`.
3. **Úsek 3 má v nadpise „nepovinné"** (`.upload-step-opt`) a poznámku `uploadNote` v rámčeku `.prefill-note`. Keď je zdroj `.docx`, veta menuje Word (predvyplnenie je z tabuľky na prvej strane).
4. **Tlačidlo „Nahrať a previesť"** je neaktívne, kým nie je vybraté PDF (`aria-disabled`, poznámka „Najprv vyber PDF."). Server kontrolu drží ďalej.

Nové texty (i18n, `library.upload`): `optional` „nepovinné", `pickPdfFirst` „Najprv vyber PDF.", `change` „Zmeniť", `prefillFromWord` (variant `uploadNote`).

## Nemení sa — priebeh nahrávania

Zostáva modálne okno v strede obrazovky (`.upload-overlay` v `UploadFiles.tsx`): percentá počas nahrávania, neurčitý pruh počas prevodu. **Rozhodol Ján Letko 23. 9. 2026** — kto odošle formulár zo spodku stránky, priebeh v zóne hore nevidí. Pozri `NAHRAVANIE.md`.

## Rámy

| Šírka | Stav v referencii |
| --- | --- |
| **1440** | súbory vybrané, všetko vyplnené, pripravené |
| **834** | nahrávanie 62 % v modálnom okne (bez zmeny), zdroj Word → poznámka o predvyplnení |
| **390** | prázdny stav, zóny pod sebou, polia 44 px / 16 px, tlačidlo na celú šírku |

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Autor ako výber osoby/útvaru | ❌ je voľný text s `<datalist>` návrhmi — nekresliť ako výber |

🔴 Zmena schémy: **žiadna.**
