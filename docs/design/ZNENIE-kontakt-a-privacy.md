# ZNENIE — kontakt a ochrana údajov (`/documents/[documentId]`)

Základ: `ZAKLAD.md`, `ZNENIE.md`. Referencia: `ZNENIE-kontakt-a-privacy.html`.
Zdroj: `app/src/app/documents/[documentId]/page.tsx`, `PdfView.tsx`, `VersionMetaLine.tsx`, `LegalBasisForm.tsx`, i18n `onboarding`, `responsibility`, `privacy`.

## Čo už funguje — nemení sa

Poradie blokov: späť · názov · verzia + termín · údaje o znení · [úloha zodpovednej osoby] · PDF · text na vyhľadávanie · čas čítania · kontakt · potvrdenie (formulka, tlačidlo, odkaz na `/privacy`).
Všetky texty z i18n. Formulka (`statement`) bez zmeny (D28).

## Čo sa mení (len podoba)

1. **Hlavička** — riadok verzie je `display:flex; flex-wrap:wrap; gap:6px 10px`, termínový chip v ňom. `VersionMetaLine` ide do spoločného obalu `.zn-head { display:grid; gap:4px; margin:0 0 24px }` namiesto `margin: -20px 0 24px`.
2. **Karta kontaktu** (`contactHeading`)
   - iniciály 40 px v `--accent-soft`, meno 600,
   - e-mail a telefón ako `.contact-link` (rámik, 32 px, pod 640 px 44 px) — dnes holé odkazy tesne vedľa seba, na telefóne sa zle trafia,
   - „profil v adresári" tichý odkaz,
   - právny základ pod čiarou ako `<dl>` (`dt` = `legalBasis`, `dd` = label · reference).
   - `contactGone` v rámčeku `--warn-*` namiesto šedej vety — človek sa má dozvedieť, že kontakt nefunguje.
3. **Odkaz na ochranu údajov** — pätička karty potvrdenia: `border-top`, ikona ⓘ, `linkBefore` + odkaz v `--ink`. Ostáva aj po potvrdení.
4. **Úloha zodpovednej osoby** — karta s okrajom `--accent` (ako `.duty-card.is-next`). V `LegalBasisForm` sú `.hr-choice` dlaždice na celú šírku (padding 10/12, rámik, vybraná = `--accent-soft`), `reference` na novom riadku pod názvom. Zbalený stav (`<details>`) bez zmeny obsahu.
5. **PDF na telefóne** — `.pdf-view-link` pod 640 px ako dlaždica 56 px (ikona, „Otvoriť PDF", názov · veľkosť, ↗). Od 640 px bez zmeny.

6. **Zbalený právny základ** (zodpovedná osoba, základ určený) — summary `--fs-body`/600 namiesto zdedených 17 px; `reference` na vlastnom riadku v `--muted`. Na snímke 390 sú to dnes 4 riadky veľkým písmom.
7. **Čas čítania** — medzi `readingElapsed` a `readingNote` chýba oddeľovač („1 s Zaznamenáva sa…"). Doplniť ` · ` alebo dať poznámku na nový riadok.

## Pozorované na snímkach 24. 9. (`uploads/ZNENIE-*`)

- Spodná lišta na telefóne: Prehľad · Voľné otázky · Knižnica · Úlohy · Viac — rám 390 opravený podľa nej.
- Na snímke 390 prekrýva pás „Potvrdzujem" kartu kontaktu — je to len artefakt snímky celej stránky (pás je `position: fixed`), nie chyba.

## Otázky pre Jána

- **Označenie znenia** `verzia Pracovný poriadok SFZ 20260907, platná od 7. 9. 2026` — `label` opakuje názov dokumentu, aj vo formulke. Je to údaj (import), nie podoba. Opraviť dáta, alebo nechať?
- **Právny základ dvakrát** pre zodpovednú osobu: v zbalenom súhrne hore aj v karte kontaktu. Skryť ho v karte kontaktu, keď je súhrn hore? (Mení to, čo sa zobrazí — preto otázka.)

- Bod 2: `contactGone` v `--warn-*` mení farbu hlásenia — súhlas?
- Bod 5: je dlaždica v poriadku, alebo nechať tlačidlo + riadok?

## Rámy

| Šírka | Stav |
| --- | --- |
| **1440** | zamestnanec, nepotvrdené, termín `--soon` |
| **834** | zodpovedná osoba bez určeného základu — úloha hore |
| **390** | dlaždica PDF, kontakt s 44 px odkazmi, pás „Potvrdzujem" nad lištou |
| stavy | `contactGone`, potvrdené, základ určený (zbalené) |

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Fotka zodpovednej osoby | ❌ — iniciály z mena |
| Telefón | ⚠️ `mobilePhone` je nepovinný — bez neho sa odkaz nekreslí |

🔴 Zmena schémy: **žiadna.**
