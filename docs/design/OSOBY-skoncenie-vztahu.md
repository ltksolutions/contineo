# OSOBY — skončenie vzťahu (`/people/[id]`)

Referencia: `OSOBY-skoncenie-vztahu.html`. Základ: `ZAKLAD.md`, `OSOBY.md`. Zdroj: `app/src/app/people/[id]/page.tsx` (riadky ~320–410), `togglePersonStatusAction`, `setEndedAtAction`, i18n `people`, ADR-012 (D100).

## Čo funguje — nemení sa

„Prístup a členstvo" v `<details>`, zatvorené. Pozvánka len kým sa osoba neprihlásila. Vyradenie: nepovinný dátum skončenia (`max` = dnes), potvrdenie napísaním adresy. Vyradená osoba: samostatný formulár na dátum a samostatné „Vrátiť" (vráti ako pozvanú). Texty z i18n.

## Čo sa mení (podoba)

1. **Karta vyradenia** — hlavička s ikonou „!" v `--bad-bg`/`--bad-fg`, telo, päta `--bg` s tlačidlom. Odlíši nevratnú akciu od úpravy údajov.
2. **„Vyradiť"** — nová varianta `.button--danger` (biele pozadie, text a obrys `--bad-fg`). Dnes `button--quiet`.
3. **Adresa na opísanie** — pod `confirmLabel` sa ukáže `o.email` v `<code>` (`user-select: all`). Dnes je len v hlavičke stránky.
4. **Vyradená osoba** — veta `deactivatedOn` + `endedAtCurrent`/`endedAtMissing` sa zobrazí ako mriežka faktov (Vyradená · Vzťah skončil). Pri chýbajúcom dátume „—" a `endedAtMissing` ako nápoveda.
5. **„Vrátiť osobu"** — malá karta (text `returnNote*` vľavo, tlačidlo vpravo) pod kartou skončenia.

## Otázky pre Jána

- **Q1 — Časová os** (Vyradenie → Vzťah skončil → + 3 roky) v karte vyradenia. Je to len obrázok textu `excludeNote`/`endedAtNote`; nové krátke texty („dnes · neprihlási sa", „potvrdenia sa zmažú", „nevyplnené → od vyradenia"). Chceš ju?
- **Q2 — „Potvrdenia sa zmažú od {dátum}"** pri vyradenej osobe: dátum = `endedAt ?? deactivatedAt` + 3 roky (pravidlo z `retentionDb.ts`; 5-ročný strop od poslednej udalosti sa tu neuplatní). Nový odvodený údaj — ukázať?

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | aktívna osoba, vyradenie s dátumom |
| **834** | vyradená osoba, skončenie + vrátenie |
| **390** | vyradenie bez dátumu, os zvisle |

🔴 Zmena schémy: **žiadna.**
