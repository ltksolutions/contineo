# APPROVALS — PDF konceptu (`/approvals`)

Referencia: `APPROVALS-pdf-konceptu.html`. Základ: `ZAKLAD.md`, `APPROVALS.md`, `KNIZNICA-postup-znenia.md` (krok 2).
Zdroj: `app/src/app/approvals/page.tsx`, `PdfView`, `VersionMetaLine`, i18n `approvals`, ADR-006, ADR-011, ADR-013.

## Čo funguje — nemení sa

Vlastná obrazovka pre menovaných schvaľovateľov (nie knižnica). Schvaľuje sa presne predložený koncept: PDF + text + údaje o znení (D96, D107). Upozornenie `draftChanged`. Ostatní schvaľovatelia bez ich rozhodnutí (D70). Jeden formulár, dve tlačidlá, dôvod povinný pri zamietnutí — stráži server (D71). Rozbalené pri jednom kole, zbalené pri viacerých. Texty z i18n.

## Snímka `uploads/APPROVALS-*`

Len prázdny stav (nič nečaká). Prázdny stav je v poriadku — nemení sa.

## Čo sa mení (podoba)

1. **Karta v troch pásoch**: `.ap-head` (štítok znenia, kolo · predložil · dátum, názov) · `.ap-body` · `.ap-decide` (päta so sivým pozadím `--bg` a hornou čiarou). Rozhodnutie je vizuálne oddelené od čítania.
2. **„Čo schvaľuješ"** — nadpis sekcie + pomocný text „PDF, text a údaje o znení — jedným rozhodnutím" (nový text). Pod ním `PdfView` a zbalený text (`searchText`).
3. **Údaje o znení** — namiesto `VersionMetaLine` (sivý riadok) mriežka `<dl>` Autor · Schválil · Dátum schválenia · Dátum účinnosti v rámčeku `--bg`; nadpis „Údaje o znení" (`versionMeta.heading`) + „súčasť schválenia · po predložení sa nedajú meniť" (nový text). Chýbajúci údaj sa vynechá ako dnes. Pri zverejnenom znení to isté zo znenia.
4. **Poznámka predkladateľa** (`r.note`) v rámčeku s menovkou „Poznámka od predkladateľa" (nový text).
5. **Rozhodujú aj** — mená ako čipy s iniciálami, bez stavu (D70). Text `alsoDeciding` sa rozdelí na nadpis + mená.
6. **Dôvod** — pole v päte na bielom pozadí, 2 riadky (bez zmeny). Tlačidlá bez zmeny poradia; na telefóne `column-reverse`, 44 px.
7. **Telefón** — PDF ako dlaždica 56 px (rovnako ako `ZNENIE-kontakt-a-privacy`, bod 5).
8. **`draftChanged`** — hláška `--warn-*` hore v tele karty, nie namiesto textu.

## Otázky pre Jána

**Odpovede Jána 24. 9. 2026:** Q1 ✅ áno · Q2 ✅ áno · Q3 ❌ nie — „Schváliť" ostáva aktívne ako dnes, len s upozornením `draftChanged`.

Overené v kóde k Q3: `decide()` v `approvalsDb.ts` identitu konceptu nekontroluje (kontroluje ju len `submitForApproval`). Schválenie zmeneného konceptu sa teda zapíše, ale týka sa pôvodnej podoby (`versionId` = identita v čase predloženia) — zverejniť aktuálny koncept na jeho základe nepôjde.

- **Q1 — Štítok znenia pri koncepte.** Dnes `versionLine(version?.label ?? r.versionId, …)` — koncept nemá označenie, takže sa ukáže technické `versionId`. Návrh: „Nové znenie od {dátum účinnosti}" / „Prvé znenie od {dátum}", ako karta na detaile (`KNIZNICA-postup-znenia`). Súhlas?
- **Q2 — Viac kôl ako riadky.** Pri 2+ kolách je `summary` riadok (štítok, kolo · predložil, názov, „Prečítať a rozhodnúť"), nie karta s odkazom „prečítať znenie". Súhlas?
- **Q3 — „Schváliť" pri `draftChanged` neaktívne.** Zamietnuté — správanie sa nemení.

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | jedno kolo, rozbalené |
| **834** | dve kolá ako riadky (Q2) |
| **390** | jedno kolo, PDF dlaždica, tlačidlá pod sebou |
| stavy | `draftChanged`, po rozhodnutí (`Notice`) |

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Rola/oddelenie ostatných schvaľovateľov | ❌ `approvers` nesie `fullName`, `email` — len meno a iniciály |
| „Nové znenie" vs. „Prvé znenie" (Q1) | ✅ odvoditeľné: má dokument platné znenie? |

🔴 Zmena schémy: **žiadna.**
