# DETAIL — staršie znenia

Referencia: `DETAIL-starsie-znenia.html`. Základ: `ZAKLAD.md`, `KNIZNICA-postup-znenia.md` (bod 4).
Zdroj: `app/library/[id]/page.tsx` r. 1201–1228 (`.older`, `.older-row`, `.older-panel`), `versionLinks` r. 365, `versionPanel` r. 383, `VersionMetaLine`.

## Čo sa mení

„Staršie znenia" sú jedna **karta so zoznamom** (nie nadpis + voľné riadky):

| Stĺpec | Obsah |
| --- | --- |
| Platnosť | `effectiveFrom – effectiveTo`, pod tým „zverejnené {publishedAt}" |
| Znenie | `label` + `changeNote` (ak je) |
| Zodpovedná osoba | meno + právny základ; chýbajúce ako pilulka (`neurčený`, `vyradená`, `chýba`) |
| Potvrdili | `ackByVersion.get(versionId)`, „—" pri 0 |
| Akcie | **PDF** + **⋯** (`<details>`): Zmeniť zodpovednú osobu · Zmeniť právny základ (ak `canSetBasis`) · Odvolať potvrdenia (HR, potvrdenia > 0) · História |

- Hlavička karty: „Staršie znenia" + počet + poznámka „Ľudia ich už nevidia; potvrdenia ostávajú ako doklad." (od 640 px).
- Panel (`versionPanel`) sa otvorí **pod riadkom na celú šírku**, riadok dostane pozadie `--bg`, v hlavičke panelu „Zavrieť" (odkaz bez `panel`).
- **Viac ako 3** znenia: 3 najnovšie + „Zobraziť všetky (n)" → `?older=all`. Otvorený panel na skrytom znení zoznam rozbalí.
- Autor sa z riadku vynecháva (pri všetkých zneniach býva rovnaký) — ostáva v Histórii.
- Prázdny stav bez zmeny textu (`flow.olderNone`), ale v tej istej karte.
- Karta platného znenia sa **nemení**.

## Prečo

- Dnes každé znenie opakuje riadok 4 odkazov → pri 2 zneniach 8 rovnakých odkazov, zoznam sa číta ako menu, nie ako história.
- Riadok nehovorí, **čím sa znenia líšia** (označenie, zmena) ani **kto za ne zodpovedal a koľko ľudí ich potvrdilo** — to je pri starom znení podstatné (doklad, D91).
- Úpravy starých znení sú zriedkavé → patria do ⋯, viditeľné ostáva len PDF.

## Rámy

- **1440** — detail dokumentu, 4 staršie znenia (3 zobrazené + „Zobraziť všetky"), ⋯ pri najnovšom otvorená.
- **834** — bez stĺpca Zodpovedná osoba (ide pod označenie), panel „Zmeniť zodpovednú osobu" otvorený pod riadkom.
- **390** — riadok v stĺpci: platnosť, označenie, zmena, osoba · základ · počet potvrdení; PDF a ⋯ vpravo hore, 44 px ciele.
- Stav: žiadne staršie znenie.

## Bez JavaScriptu

⋯ je `<details>`, položky sú dnešné odkazy `panelHref(v, panel)`, „Zobraziť všetky" je odkaz s parametrom. Nič nové nevyžaduje JS.

## i18n (sk/cs/en)

`older.count(n)`, `older.note` „Ľudia ich už nevidia; potvrdenia ostávajú ako doklad.", `older.range(from, to)` „{from} – {to}", `older.published(d)` „zverejnené {d}", `older.acks` „potvrdili", `older.noAcks` „bez potvrdení", `older.more` „Ďalšie úkony", `older.showAll(n)` „Zobraziť všetky ({n})", `older.close` „Zavrieť", `older.responsibleMissing` „chýba". Existujúce: `tflow.olderHeading`, `tflow.olderNone`, `tflow.changeResponsible`, `tflow.changeBasis`, `t.revokeVersionHeading`, `tflow.history`.

## Údaje, ktoré v modeli neexistujú / overiť

| Údaj | Stav |
| --- | --- |
| `label`, `changeNote`, `publishedAt`, `effectiveTo` | ✅ na znení (`documents.ts`) |
| počet potvrdení za znenie | ✅ `ackByVersion` sa na stránke už počíta |
| `?older=all` | ❌ nový parameter adresy, nie schéma |

🔴 Zmena schémy: **žiadna**.

## Otázky pre Jána

- **Q1** — Majú staršie znenia vôbec ponúkať „Zmeniť zodpovednú osobu"? Ľudia ich už nevidia; osoba je pri nich doklad o tom, kto zodpovedal. (návrh: ponechať len „Zmeniť právny základ" a Históriu; zmenu osoby len pri platnom znení)
- **Q2** — `effectiveTo` = deň účinnosti ďalšieho znenia (dnes „do 1. 1. 2027", hoci 1. 1. už platí nové). Zobrazovať deň predtým („– 31. 12. 2026")? (návrh: áno, len v zobrazení)
- **Q3** — Hranica 3 zobrazené znenia, zvyšok za „Zobraziť všetky"? (návrh: áno)
