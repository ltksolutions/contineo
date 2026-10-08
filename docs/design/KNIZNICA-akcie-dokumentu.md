# KNIZNICA — akcie dokumentu (`/library/[id]`)

> **Stav: rozhodnuté 8. 10. 2026** — Q1–Q4 podľa odporúčania, pripravené na implementáciu.

Referencia: `KNIZNICA-akcie-dokumentu.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-lista-ulozenia.md` (`.more`, `.more-confirm`), `KNIZNICA-postup-znenia` (karta postupu, R2), `MANAGE-COURSE-akcie.md` (`<details>` ponuka). Zdroj: `app/src/app/library/[id]/page.tsx` (hlavička r. ~968–1025, archivácia r. 1379–1392 a 1491–1515, pôvod r. 1518–1528, text r. 1530–1650, preindexovanie r. 1652–1665, zodpovedná osoba r. ~1882), `library/actions.ts`. DESIGN_ODCHYLKY §2 (library/[id]).

Je to **rozdiel oproti existujúcej obrazovke**. Karta postupu znenia (`#flow`), platné a staršie znenia, pravý panel, serverové akcie a ich polia ostávajú.

## Čo sa mení

### Hlavička (správca obsahu)
- `div.detail-chips` + riadok faktov + `div.detail-actions` → **`.page-head`**:
  - vľavo `div.page-head-main`: `h1.page-title` (názov) a `p.page-lead` so štítkami (`statusTagClass`, spracovanie, kategória) a faktami `documentId · priečinok · platí od`.
  - vpravo `div.page-tools` (toolbar) v poradí: **Stiahnuť ▾** (tiché), **Upraviť** (tiché, `/library/[id]/edit`, `tflow.editDocument`), **Nové znenie** (plné, `newVersionHref`).
- **Stiahnuť ▾** = `<details class="menu">` so `summary.button.button--quiet` a odkazmi: PDF (znenie, veľkosť), Zdrojový súbor (typ, veľkosť). Od 640 px je to popover pod tlačidlom, pod 640 px plachta zdola (rovnaký vzor ako ponuka 9 bodiek). Keď existuje len PDF, kreslí sa namiesto ponuky obyčajné tiché „Stiahnuť PDF" (Q1).
- **FAQ:** namiesto „Nové znenie" plné „Upraviť záznamy" (`/library/[id]/faq`), vždy dostupné, ako dnes.
- **Počas prípravy znenia** (flow krok 1–3): namiesto „Nové znenie" je **tiché `a.button.button--quiet` „Pokračovať v príprave" → `#flow`** (nový `tflow.continuePrep`). `span.is-disabled` s `title` sa ruší. Plné tlačidlo kroku ostáva v päte karty postupu (R2). V kroku 2 nie je plné tlačidlo nikde.
- **Prvé znenie chýba** (`!latest`, dnes `newVersionFirst`): plné „Nahrať prvé znenie" → `newVersionHref`.
- **Telefón (< 640 px):** `.page-tools` je mriežka `1fr 44px 44px`: plné tlačidlo cez šírku, potom Upraviť a Stiahnuť ako `.button--icon` (44 × 44, ikona z `Icon`, `aria-label` a `title` s celým textom). Pri FAQ a „Pokračovať v príprave" rovnako.

### Ďalšie akcie (namiesto `<details class="detail-tools">` „Správa")
`section.card.more#more` na konci hlavného stĺpca (`.detail-main`), riadky `.more-row`:

| Riadok | Kedy | Tlačidlá |
| --- | --- | --- |
| Text dokumentu | vždy | „Otvoriť editor" (`/text`), „Členenie pre asistenta" (`/chunks`) — tiché. Opravu textu (`loadTextForFixAction`) a stavy `noDraftPdf` / čaká na schválenie hovorí veta v riadku |
| Skontrolovať zmeny zo zdroja | len pri `d.source` (konektor) | veta `tci.sourceLine`, tiché „Skontrolovať" (`resyncConnectorDocumentAction`) |
| Preindexovať | vždy | tiché „Preindexovať" (`reindexDocumentAction`) |
| Archivovať predpis | `!archive.archived && versions.length > 0` | `a.button.button--danger` „Archivovať…" → `?archive=1#more`. Pri `archiveBlocked` je namiesto tlačidla veta `tflow.archive.blocked` + dôvod (Q2) |

- **`?archive=1`**: tlačidlo v riadku sa skryje a pod riadkom sa otvorí `.more-confirm`: `h3` „Archivovať {názov}?", `until` (dátum, aj budúci, `untilHint`), `reason` (`reasonHint`), `button.button--dangerfill` `tflow.archive.submit`, „Zrušiť" (odkaz bez parametra). `archiveDocumentAction` bez zmeny; chyba presmeruje na `?archive=1#more`.
- Inline `style` z formulárov (`maxWidth: 200`, `display: grid`) sa nahradí triedami (`.field-input--date`, `.more-confirm`).

### Archivovaný predpis
- `section.card.archive-banner` → **`.lnote`** hneď pod `.page-head` (pred `#flow`):
  - naplánované (`!archive.inEffect`): `.lnote--warn`, nadpis `bannerScheduled`;
  - archivované: `.lnote--bad`, nadpis `bannerInEffect`.
  - Pod nadpisom dôvod (`entry.reason`) a `bannerMeta` (kto, kedy). Vpravo, na telefóne pod textom cez šírku, je formulár `restoreDocumentAction` s tichým `tflow.archive.restore`. `restoreHint` je `title` a text pre čítačku.
- Pri archivovanom predpise (`inEffect`) sa „Nové znenie" nekreslí (Q3). Pri naplánovanom ostáva.

### Stránka zodpovednej osoby (bez roly správcu)
- Obal `div.page-narrow` (max 760) namiesto inline `maxWidth`.
- `.page-head` s `h1.page-title` (názov dokumentu) a `p.page-lead`: veta úlohy („Ste zodpovedná osoba pre znenie 1.1. Určte jeho právny základ." — nový `tr.ownerLead(version)`) · odkaz „Čítať dokument" (`/documents/[id]`).
- Karty úloh „Určiť právny základ" (`LegalBasisForm`, plné „Uložiť" v karte) bez zmeny. Pri viacerých kartách platí R1: tlačidlá v kartách tiché (Q4).

## Kde

`app/src/app/library/[id]/page.tsx`, `globals.css` (`.page-head-main`, `.page-tools`, `.button--icon`, `.menu` ako popover/plachta, `.more*` z ZAKLAD-lista-ulozenia, `.lnote` s akciou, `.field-input--date`; zrušiť `.detail-actions`, `.detail-chips`, `.detail-tools*`, `.archive-banner` ak ich nič iné nepoužíva), i18n `library.flow` (`continuePrep`, `download`, `downloadMenu`, `uploadFirst`, `moreActions`, `archive.open`, `archive.confirmHeading`, `textRowNote*`, `reindexRowNote`), `library.responsibility.ownerLead`.

## Prečo

- Štyri tlačidlá v samostatnom riadku pod faktami sú vizuálne oddelené od nadpisu, ku ktorému patria. SwiftUI `toolbar` ich dáva do riadku s nadpisom, vpravo.
- Zošedené „Nové znenie" s `title` je na dotyku nemé. Človek nevie, prečo sa nedá, ani kam ísť. Odkaz „Pokračovať v príprave" povie oboje.
- Dve tlačidlá „Stiahnuť…" zaberajú polovicu riadku pre úkon, ktorý je zriedkavý a má jeden cieľ.
- `<details>` „Správa" skrýval všetky štyri úkony vrátane nevratnej archivácie s formulárom stále otvoreným. Riadky „Ďalších akcií" ukazujú, čo sa dá urobiť, a nevratný krok otvoria až na vyžiadanie (rovnako ako karta osoby a prihlásenie organizácie).
- Pás archivácie bola karta s rovnakou váhou ako obsah. Hláška `.lnote` nad obsahom je stav dokumentu, nie ďalšia sekcia.

## Rozhodnutia v repozitári — dodržané

- **Nové znenie je hlavná akcia; kým sa pripravuje znenie, nové sa začať nedá** — dodržané: plné len keď sa dá, inak odkaz na postup.
- **FAQ má „Upraviť záznamy", vždy dostupné** (ADR-028, D164) — dodržané.
- **Úprava dokumentu je `/library/[id]/edit`** (R4, 6. 10. 2026) — dodržané.
- **Plné tlačidlo kroku v karte postupu je odoslanie po náhľade a ostáva pri obsahu** (R2) — dodržané.
- **Archivácia môže mať dátum v budúcnosti; obnovenie je tiché; server overí `archiveProblem()` znova** (ADR-025, D156) — dodržané.
- **Zodpovedná osoba vidí len svoje karty úloh** (`versionBasisTasks`, `canSetLegalBasis`) — dodržané.
- **Bez JavaScriptu** — ponuka je `<details>`, potvrdenie je adresa.
- **Preindexovanie ostáva v detaile dokumentu** (komentár `chunks/page.tsx`) — dodržané.

## Rámy

- **1440 svetlá:** platný dokument (ponuka Stiahnuť otvorená, dole Ďalšie akcie) · schvaľovanie beží, krok 2 („Pokračovať v príprave") · Ďalšie akcie s `?archive=1`.
- **390 tmavá:** hlavička s nástrojmi (plné + dve ikony) · archivovaný predpis s Obnoviť · stránka zodpovednej osoby s jednou kartou úlohy.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `toolbar` (`.primaryAction` posledná) | `.page-tools` vpravo v `.page-head` |
| `Menu` | Stiahnuť ▾ (`<details>`) |
| `Label` s `.labelStyle(.iconOnly)` | tlačidlá s ikonou na telefóne |
| `Section` s `Button(role: .destructive)` | Ďalšie akcie → Archivovať |
| `.confirmationDialog` | `?archive=1` → `.more-confirm` |

## Údaje, ktoré v modeli neexistujú

Žiadne. Veľkosť a typ súborov v ponuke sú v `FileRef` (`bytes`, `name`). Nové sú len texty i18n (pozri Kde).

## Rozhodnuté (8. 10. 2026 — všetky podľa odporúčania)

- **Q1** „Stiahnuť ▾" ako ponuka len pri dvoch súboroch; pri jedinom tiché „Stiahnuť PDF".
- **Q2** Keď sa archivovať nedá, v riadku dôvod namiesto tlačidla.
- **Q3** Pri archivovanom predpise (`inEffect`) sa „Nové znenie" nekreslí, kým sa neobnoví.
- **Q4** Zodpovedná osoba: pri jedinej karte úlohy plné „Uložiť", pri viacerých tiché (R1).

## Otázky

Žiadne otvorené.

<!-- pôvodné znenie otázok:
- **Q1** — „Stiahnuť ▾" ako ponuka len vtedy, keď sú dva súbory (PDF a zdrojový). Pri jedinom súbore obyčajné tiché „Stiahnuť PDF"?
  **Odporúčam áno.** Ponuka s jednou položkou je zbytočný krok navyše. Zdrojový súbor má len časť dokumentov.
- **Q2** — Keď sa predpis archivovať nedá (`archiveBlocked`), ukázať v riadku dôvod namiesto tlačidla (žiadne zošedené tlačidlo)?
  **Odporúčam áno.** Pravidlo zakazuje zošedené tlačidlo bez viditeľného dôvodu. Veta „Archivovať sa nedá: …" je dôvod aj odpoveď naraz.
- **Q3** — Pri archivovanom predpise (`inEffect`) „Nové znenie" nekresliť, kým sa predpis neobnoví?
  **Odporúčam áno.** Nové znenie archivovaného predpisu by nikto nevidel. Obnovenie je jeden tichý klik v hláške hneď pod nadpisom.
- **Q4** — Zodpovedná osoba s viacerými úlohami: tlačidlo „Uložiť" v kartách úloh tiché (R1), pri jedinej karte plné?
  **Odporúčam áno.** Pri jednej karte je to hlavná akcia stránky. Pri viacerých platí rozhodnutie R1 pre zoznam kariet.

-->

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/KNIZNICA-akcie-dokumentu.html + .md.
Vetva design/kniznica-akcie-dokumentu z main. DESIGN_ODCHYLKY §2 library/[id].

1. Hlavička správcu: .page-head = .page-head-main (h1 + p.page-lead so štítkami
   a faktami) + .page-tools vpravo: Stiahnuť ▾ (<details>, popover ≥640 / plachta
   <640; pri jedinom súbore tiché „Stiahnuť PDF"), Upraviť (tiché, /edit),
   Nové znenie (plné). FAQ: plné „Upraviť záznamy". Prvé znenie: plné „Nahrať prvé
   znenie". Zrušiť .detail-chips, .detail-actions, span.is-disabled.
2. Počas prípravy (flow krok 1–3): namiesto Nové znenie tiché a.button--quiet
   „Pokračovať v príprave" → #flow. Plné tlačidlá v karte postupu bez zmeny.
3. <640: .page-tools grid 1fr 44px 44px; Upraviť a Stiahnuť .button--icon
   s aria-label + title.
4. Ďalšie akcie section.card.more#more na konci .detail-main namiesto
   details.detail-tools: Text dokumentu (Otvoriť editor, Členenie pre asistenta),
   Skontrolovať zmeny zo zdroja (len d.source), Preindexovať, Archivovať
   (a.button--danger → ?archive=1#more; pri archiveBlocked veta s dôvodom bez
   tlačidla). ?archive=1 → .more-confirm (until, reason, button--dangerfill,
   Zrušiť odkaz); chyba → ?archive=1#more.
5. Archivovaný: .lnote--warn (naplánované) / .lnote--bad (inEffect) pod
   .page-head s dôvodom, bannerMeta a tichým Obnoviť (restoreDocumentAction).
   Pri inEffect Nové znenie nekresliť.
6. Zodpovedná osoba: .page-narrow, .page-head, p.page-lead (ownerLead · Čítať
   dokument); karty úloh bez zmeny, pri viacerých kartách Uložiť tiché (R1).
7. Inline štýly v týchto častiach → triedy. i18n sk/cs/en podľa .md.

Bez JS musí fungovať všetko. Over 1440 svetlá + 390 tmavá (platný, krok 1/2/3,
FAQ, prvé znenie, ?archive=1, naplánovaná a platná archivácia, zodpovedná osoba),
len klávesnicou; tsc, eslint, vitest, build. Komentáre: odkaz na
KNIZNICA-akcie-dokumentu (8. 10. 2026). DESIGN_ODCHYLKY §2 library/[id]: stav ✓.
```
