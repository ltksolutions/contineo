# Súpis odchýlok od dizajnových pravidiel

> Stav k **6. 10. 2026** (`main` po #275). Meradlo: `.design-sync/conventions.md`
> a sekcie „Dizajn: Apple HIG a SwiftUI" a „Rozhranie: navigácia a ovládače"
> v `CLAUDE.md`. Prejdených 59 stránok (`app/src/app/**/page.tsx`) a komponenty,
> ktoré kreslia.
>
> **Ako vznikol:** najprv `grep` na staré vzory, potom každý zásah prečítaný
> v kontexte (či sa dve plné tlačidlá ukážu naraz, alebo sú to vylučujúce sa
> stavy). Čo sa nedalo overiť v kóde, tu nie je. **Nie je to vizuálne
> porovnanie** — snímky obrazoviek sa nerobili; rozmery, zarovnanie a čitateľnosť
> súpis nepokrýva. Čísla riadkov platia k uvedenému dátumu.
>
> Súpis je podklad na plánovanie, nie zoznam úloh. Úlohy idú do `docs/TODO.md`
> až po rozhodnutí, ktorá sekcia ide kedy.

## Typy nálezov

- **mechanicky** — vzor existuje (v `conventions.md` alebo na hotovej obrazovke),
  stačí ho použiť. Netreba Claude Design.
- **návrh** — zmena tvaru obrazovky alebo komponentu, ktorú treba najprv
  nakresliť v Claude Design.
- **rozhodnutie** — pravidlo a kód (alebo návrh) si protirečia, alebo pravidlo
  na prípad nepamätá. Rozhoduje Ján; otázky sú nižšie.

## Rozhodnuté (6. 10. 2026)

**Ján rozhodol vo všetkých desiatich otázkach A.** Znenie otázok ostáva
nižšie, aby bolo vidieť, čo sa zvažovalo. Pravidlá, ktoré z R1, R2 a R10
vyplývajú, sú zapísané v `CLAUDE.md` (Rozhranie) a v
`.design-sync/conventions.md`; R5 dostane poznámku v ADR-026 spolu so zmenou
cesty.

**R1 — Zoznam kariet, každá s vlastnou akciou** (Potvrdzovanie, kurátorstvo,
posúdenie, `/dpo`, karty právneho základu, karty kurzov, overenie domén).
Pravidlo „najviac jedno plné tlačidlo" na to nepamätá — dnes má plné tlačidlo
každá karta.
- **A (odporúčam):** v zozname sú všetky tlačidlá tiché; plné je len v `.page-head`.
  Jednoduché, platí všade rovnako, a zoznam nekričí.
- B: plné len na prvej karte („čo teraz"), ostatné tiché.

**R2 — Odoslanie po náhľade** (`/hr/[id]/notify`, `/hr/reminders`,
`/hr/tracks/[key]/notify`, `/people/invite`; podobne „Spustiť test").
Plné „Odoslať" je na konci stránky, nie v `.page-head`.
- **A (odporúčam):** zapísať ako výnimku — je to „tlačidlo ďalšieho kroku na
  konci úlohy", rovnaký prípad ako výsledok testu. Človek ho má stlačiť až po
  prečítaní náhľadu, nie hneď po otvorení stránky.
- B: presunúť do `.page-head`.

**R3 — Vzdelávanie: časti sekcie cez `?tab=`** (✓ hotové 7. 10. 2026, `lib/learningPaths.ts`) (`/learning/manage`,
`/learning/manage/[courseKey]`, `/learning/tests`; aj `?part=`, `?q=`, `?import=`).
Pravidlo chce vlastné adresy. Prekážka: `/learning/manage/topics` sa bije
s kurzom s kľúčom `topics`.
- **A (odporúčam):** vlastné cesty so statickým segmentom
  (`/learning/manage/topics`, `/learning/tests/questions`…) a tieto slová
  vyhradiť pri tvorbe kľúča kurzu/testu. Next pri zhode uprednostní statický
  segment; staré `?tab=` prekladá `lib/legacyRoutes.ts`.
- B: predpona pre detail (`/learning/manage/c/[courseKey]`) — mení všetky
  existujúce adresy kurzov, preto nie.

**R4 — Úprava dokumentu na `?edit=document`** (✓ hotové 6. 10. 2026, `/library/[id]/edit`) (`/library/[id]`). Je to
samostatná obrazovka s vlastným nadpisom, ako `/version` a `/text`.
- **A (odporúčam):** vlastná cesta `/library/[id]/edit`, starý tvar
  presmerovať.
- B: nechať (rám KNIZNICA-uprava-dokumentu to tak opisuje).

**R5 — AI: Nastavenie | Spotreba cez `?view=usage`** (✓ hotové 6. 10. 2026, `/organisation/ai/usage`) (`/organisation/ai`).
ADR-026 (5. 10.) to zapísal takto výslovne, pravidlo v `CLAUDE.md` (2. 10.)
chce vlastnú adresu. Repozitár si protirečí sám.
- **A (odporúčam):** `/organisation/ai/usage` a v ADR-026 doplniť poznámku
  (nie prepísať) — cesta má Spotrebu pomenovať, je to iná obrazovka.
- B: ponechať podľa ADR-026 a doplniť výnimku do `CLAUDE.md`.

**R6 — Číselníky: druhé farebné podmenu `?list=`** (✓ hotové 6. 10. 2026) (`/organisation/codelists`)
vnútri časti, ktorá už má bočný zoznam. Dve farebné podmenu nad sebou sa
podľa pravidla nesmú dať zameniť.
- **A (odporúčam):** parameter ponechať (miesto sa nemení), tvar zmeniť na
  výber zo zoznamu (`Select`, ako `Picker(.menu)`) — číselníkov je viac
  než 4, takže `.view-switch` by sa nezmestil.
- B: `.view-switch`.

**R7 — Odpovede v pokuse o test** (`.opt`). (✓ hotové 6. 10. 2026) Výber odpovede je ten istý
druh voľby ako vo formulári.
- **A (odporúčam):** textové odpovede ako `.choice-row` (jedna) /
  `.select-row` (viac); dlaždice s obrázkami (`at-opts--tiles`) ponechať —
  obrázok potrebuje plochu, riadok by ho zmenšil.
- B: ponechať celé, pokus je vlastný svet (rám TEST-ATTEMPT).

**R8 — Akcia kurzu v bočnej karte** (`/learning/[courseKey]`, rám COURSE),
nie v `.page-head`.
- **A (odporúčam):** ponechať podľa návrhu — bočná karta postupu je na
  telefóne dock, je to „toolbar" tejto obrazovky. Opraviť len druhé plné
  tlačidlo v riadku ďalšej časti.
- B: presunúť do `.page-head`.

**R9 — Nevratná voľba v `/dpo`** („Vyhovieť" maže natrvalo, dnes červená
dlaždica). Riadok `.choice-row` farebný variant nemá.
- **A (odporúčam):** `.choice-row` + modifikátor `.form-row--danger` (červený
  text voľby), rovnaký ako pri tlačidle; potvrdenie ostáva na tlačidle.
- B: ponechať dlaždice len tu.

**R10 — Zoznamy osôb, ľudí v trase, správy tenantov** sú karta na všetkých
šírkach; od 1024 px tabuľka nie je. Pravidlo hovorí „karty pod 1024, tabuľka
od 1024".
- **A (odporúčam):** nechať karty — zoznamy majú 2–3 stĺpce a tabuľka by
  nepridala nič na porovnanie. Pravidlo spresniť: tabuľka tam, kde sa
  porovnávajú stĺpce.
- B: doplniť tabuľku.

## Prierezové opravy (raz a platí na mnohých stránkach)

**Hotové 6. 10. 2026** (PR „Prierezové opravy"): P2, P3, P4, P5, P6, P11, P13 —
s výnimkami zapísanými pri riadku.

**Hotové 6. 10. 2026** (PR „Hlavičky"): P1 a P10, R1 na zoznamoch kariet
(Úlohy, kurzy, kurátorstvo, posúdenie, `/dpo`), filtre „Použiť" tiché.
Výnimky: `/hr/overview` necháva CSV pod prepínačom (rozhodnutie rámu
ZAKLAD-segmented-control); ~~akcie detailu dokumentu (`.detail-actions`) a
karty úloh zodpovednej osoby~~ ✓ 8. 10. 2026 (KNIZNICA-akcie-dokumentu).

**Hotové 6. 10. 2026** (PR „Formulárové kroky"): P7 (kroky nahrávania a
úpravy dokumentu, nová trasa, oddelenia a ľudia na trase), termín trasy
ako voľba s fajkou, R9 v `/dpo`, jazyky v správe organizácií. Nechané:
nadpisy `flow-section-title` v karte priebehu znenia (súčasť jej rámu) a
`Rating` v posúdení (✓ 8. 10. 2026, EVAL-posudok). Navyše: názov v karte prehliadača
na 12 stránkach mimo sekcií menu.

| # | Čo | Kde | Typ |
|---|---|---|---|
| P1 | ✓ Hlavička stránky: `.lp-head`, `header.ch`, `.ask-history-head`, vlastné `div`y s inline okrajom → `.page-head` (+ `.page-head-spacer`, akcia vpravo) | learning, learning/manage, ask/history, hr/[id], hr/overview, hr/tracks/[key], people/[id], admin, library/[id]/text, library/curation, library/folders, evaluation, acknowledgements, notifications | mechanicky |
| P2 | ✓ Chyba ako `.card` s inline `color: var(--warn-fg)` → `Notice` (import osôb a prihlásenie: `.lnote` v riadku — stav formulára je v prehliadači a návrat na adresu by ho zahodil) | hr/assign, hr/[id]/notify, people/new, people/import, admin/new, SignIn | mechanicky |
| P3 | ✓ Stav na `.tag` cez inline `--ok-bg/--warn-bg/--bad-bg` → `tag--published` / `tag--draft` / `tag--archived` / `tag--expired` | hr/tracks/[key], organisation (domény, prihlásenie), admin/tenants/[code], evaluation, Answer.tsx | mechanicky |
| P4 | ✓ Filtre a prepínače pohľadu z `.pill` / `.lpills` → `.view-switch` | learning/manage (stav), manage/[courseKey] (zapísaní), learning/tests (stav), výsledok testu (Všetky / Len chybné) | mechanicky |
| P5 | ✓ `.mg-table` sa mení na karty až pod 640 px → pod 1024 px (`globals.css` r. 7196) | 4 stránky správy vzdelávania | mechanicky |
| P6 | ✓ Áno/nie ako holý checkbox alebo `.mc-check` → `.form-row` + `input.toggle role="switch"` | manage/[courseKey] (Povinná, Dopozerať, Povinný test), hr/tracks/[key] (vyžaduje potvrdenie, upozorniť pridaných), PeopleImport (aktualizovať existujúcich) | mechanicky |
| P7 | ✓ Kroky formulára `section.card.upload-section` + `h2.upload-step` a podnadpisy veľkými písmenami (`.hr-subtitle`, `.flow-section-title`, Rating `h3`) → `.form-group(--lg)` + `.form-group-head(--step)` | library/new, library/[id] (úprava, metaúdaje), hr/tracks, hr/tracks/[key], evaluation, Rating | mechanicky |
| P8 | ✓ 8. 10. 2026 (ZAKLAD-vyber-skupin-a-znaciek) `TagSelect` (pilulky s JS na skupiny a značky) → `.select-row` + pole „nová položka" pod zoznamom | people/[id], library/[id], library/new | návrh |
| P9 | ✓ 7. 10. 2026 (ZAKLAD-lista-ulozenia) Stránky s viacerými samostatnými formulármi, každý s plným „Uložiť" → jedna lišta na uloženie (`.set-savebar`, ako `/organisation/general`) alebo tiché tlačidlá | organisation/signin, /gdpr, /domains, admin/tenants/[code], hr/tracks/[key] | návrh |
| P10 | ✓ Formulár otvorený cez `?new=1` / `?assign=1` pridá plné tlačidlo vedľa plného v hlavičke → pri otvorenom formulári hlavičkové tlačidlo skryť; v prázdnom stave `.empty-action` tiché | learning/manage, learning/tests, library (prázdna knižnica) | mechanicky |
| P11 | ✓ Texty natvrdo mimo `i18n.ts` (navyše „Rozumiem" v `Notice`; predpona „v" verzie ostala — medzinárodná skratka) | Answer.tsx (model, tokeny, cache), hr (dnes, verzia, pridelil), hr/tracks/[key]/notify, people (surový kľúč roly), admin/tenants (kód jazyka), SignIn („alebo", placeholder s doménou SFZ), verify (IČO), organisation/admin (placeholder `futbalsfz.sk`), learning (predpona „v" verzie), certificate/print (text odkazu) | mechanicky |
| P12 | Používateľovi sa ukazuje vývojársky príkaz (`npm run person`, `npm run domains`) | hr/assign, admin | návrh (čo ukázať namiesto) |
| P13 | ✓ Natvrdo farby v `diffStyle` → `var(--ok-bg)` / `var(--bad-bg)` (tmavá téma ich dnes nemení) | library/[id] r. 384–390 | mechanicky |

Inline `style={{}}` bez natvrdo farieb (rozmery, `margin: 0`, `fontSize`) je
všade; najviac organisation/[section] (59), library/[id] (45), hr/tracks/[key]
(39), evaluation (30), admin/tenants (29), hr (27). Riešiť priebežne pri
úprave sekcie, nie samostatným PR.

## Po sekciách

Poradie podľa toho, kto stránku vidí najčastejšie. Pri každej sekcii: čo
je mechanické (jeden PR), čo čaká na rozhodnutie alebo návrh.

> **Overené proti kódu 8. 10. 2026** (`main` po #320). Pri každom náleze
> **ok** = už neplatí, **otvorené** = v kóde stále je (súbor:riadok k tomuto
> dátumu). Súhrn otvorených je na konci sekcie.

### 1. Potvrdzovanie a prehľad — každý zamestnanec
- **documents** — plné tlačidlo pri každom ďalšom kroku trasy a „Otvoriť" pri
  každej položke (R1) — ok; stav „nie je v organizácii" je `p.card`, nie
  `.empty` — **otvorené** (`documents/page.tsx:50`).
- **documents/[documentId]**, **/**, **prehlad**, **more**, **guide** — bez
  nálezov. **directory** — „nič sa nenašlo" by mohlo byť `.empty` —
  **otvorené** (`directory/page.tsx:74`, tichý riadok s počtom).
- **acknowledgements** — „Stiahnuť" v `.page-head` (P1) — ok; prázdny stav
  `.empty` — ok; citácia celá v inline štýle → trieda — **otvorené**
  (`acknowledgements/page.tsx:107`).
- **notifications** — „Označiť všetko ako prečítané" v `.page-head`, tiché
  (P1) — ok.
- **approvals** — bez nálezov.

### 2. Knižnica — správcovia obsahu
- **library** — v prázdnej knižnici dve plné „Nahrať dokument" (P10) — ok.
- **library/[id]** — akcie dokumentu v `.page-head` a jedno plné tlačidlo —
  ok (8. 10., KNIZNICA-akcie-dokumentu); úprava na `/library/[id]/edit` (R4)
  — ok; kroky úpravy `.form-group--lg` (P7) — ok; značky cez `ValueSelect`
  (P8) — ok; farby `diffStyle` (P13) — ok; pohľad zodpovednej osoby, tiché
  „Uložiť" pri viacerých kartách (R1) — ok.
- **library/new** — kroky (P7) — ok; `TagSelect` (P8) — ok.
- **library/[id]/text** — „Uložiť text" tiché, keď čaká návrh — ok; nadpis
  v `.page-head` — ok.
- **library/curation** — tiché „Zverejniť" na kartách (R1) — ok; hlavička
  (P1) — ok.
- **library/folders** — hlavička (P1) — ok.
- **library/[id]/chunks**, **library/[id]/version** — bez nálezov.
- Zvyšky mimo pôvodných nálezov (P7): `flow-section-title` v karte postupu
  znenia (zámer jej rámu), `upload-step-opt` pri „nepovinné" a
  `upload-section` v `library/new/faq` a `library/new/connector`.

### 3. Pridelené dokumenty
- **hr** — texty natvrdo (P11) — ok.
- **hr/[id]** — „Dať vedieť e-mailom" ako tlačidlo v `.page-head` — ok;
  nadpis v `.page-head` — ok.
- **hr/[id]/notify**, **hr/reminders**, **hr/tracks/[key]/notify** —
  odoslanie na konci (R2) — ok; chyba cez `Notice` (P2) — ok.
- **hr/evidence** — tiché „Použiť" pri filtri — ok.
- **hr/overview** — CSV pri prepínači, nie v `.page-head` — ok ako
  rozhodnutie (ZAKLAD-segmented-control nechal CSV pod prepínačom;
  `/hr/evidence` ho má v hlavičke).
- **hr/tracks** — „Nová trasa" ako `.form-group` (P7) — ok.
- **hr/tracks/[key]** — termín `.choice-row` + `.choice-field` — ok; dva
  prepínače `.toggle` (P6) — ok; `.hr-subtitle` (P7) — ok; jedno plné
  tlačidlo (P9) — ok; stav cez `tag--*` (P3) — ok.
- **hr/assign** — chyba cez `Notice` (P2) — ok; `npm run person` (P12) —
  **otvorené** (`hr/assign/page.tsx:253`, typ návrh).
- **hr/[id]/revoke** — bez nálezov.

### 4. Osoby a organizácia
- **people** — názov roly namiesto kľúča (P11) — ok; karty aj na počítači
  (R10) — ok (rozhodnutie A).
- **people/import** — „Aktualizovať existujúcich" (P6) — ok; tabuľka na
  karty pod 640 px — ok; chyba náhľadu ako `.lnote--warn` (P2) — ok, ale
  výsledok importu (aj chybový) je stále holá `p.card` — **otvorené**
  (`components/PeopleImport.tsx:153`).
- **people/invite** — odoslanie na konci (R2) — ok. **people/new** — chyba
  cez `Notice` (P2) — ok.
- **organisation** — bez nálezov.
- **organisation/[section]** — spotreba AI na vlastnej ceste (R5) — ok;
  číselníky `?list=` (R6) — ok; prihlásenie, GDPR a domény s jedným plným
  tlačidlom (P9) — ok; tlačidlá domén `button--sm` bez inline rozmerov —
  ok; stav cez `tag--*` (P3) — ok; tiché „Použiť" pri spotrebe — ok;
  placeholder bez domén SFZ (P11) — ok.
- **admin** — „Nová organizácia" v `.page-head` (P1) — ok; `npm run
  domains` (P12) — **otvorené** (`admin/page.tsx:137`; stránka
  prevádzkovateľa, typ návrh).
- **admin/new** — správa cez `Notice` (P2) — ok.
- **admin/tenants/[code]** — jazyky ako `.select-row` s názvom — ok; jedno
  plné v `.set-savebar` (P9) — ok; stav domén inline farbami (P3) —
  **otvorené** (`admin/tenants/[code]/page.tsx:116, 126, 136`).

### 5. Vzdelávanie
- **learning** — tiché „Pokračovať/Začať" na kartách (R1) — ok; hlavička
  (P1) — ok.
- **learning/[courseKey]** — riadok ďalšej časti tichý (R8) — ok.
- **learning/[courseKey]/[partKey]** — test na opakovanie tichý — ok.
- **…/test/[testKey]** — „Spustiť test" ako posledný prvok (R2) — ok.
- **…/[attemptId]** — textové odpovede `.choice-row` / `.select-row` (R7)
  — ok (obrázkové dlaždice ostávajú `.opt`, ako R7 dovoľuje).
- **…/result** — „Všetky / Len chybné" `.view-switch` (P4) — ok.
- **certificate** — bez nálezov. **certificate/print** — „Späť na
  certifikát" (P11) — ok.
- **learning/manage** — `?tab=` (R3) — ok; hlavička (P1) — ok; jedno plné
  pri `?new=1` (P10) — ok; filter stavu `.view-switch` (P4) — ok;
  `.mg-table` na karty pod 1024 px (P5) — ok; zlúčenie značiek (nie tém)
  `mg-choices`/`mg-choice` → `.form-group` + `.choice-row` +
  `.choice-field` — **otvorené** (`learning/manage/page.tsx:307`); výber
  značiek na zlúčenie `tgv-main` → `.select-row` (návrh) — **otvorené**
  (`learning/manage/page.tsx:350`).
- **learning/manage/[courseKey]** — ✓ 7. 10. 2026 podľa návrhu
  `MANAGE-COURSE-akcie` (vlastné cesty R3, jedno plné tlačidlo, karta stavu
  len na koreni, „Pridať blok ▾", zdroj videa `.choice-row`, potvrdenie
  archivácie a odstránenia časti, náhľad ako študent) — ok.
- **learning/tests** — `?tab=` (R3) — ok; hlavičkové tlačidlá skryté pri
  novom teste, otázke a importe (P10) — ok; filter stavu (P4) — ok; typ
  otázky ako `.lpills`/`.pill` — **otvorené** (`learning/tests/page.tsx:308`);
  správna odpoveď `.mc-check` v riadku odpovede (návrh) — **otvorené**
  (`:342`); áno/nie `.tf-opt` → `.choice-row` — **otvorené** (`:348`);
  tabuľka chýb importu bez kariet — **otvorené** (`:422`).
- **learning/tests/[testKey]** — bez nálezov.

### 6. Ostatné
- **ask**, **ask/a/[id]** — `Answer.tsx`: stavy cez `tag--*` (P3) — ok;
  texty a dátumy cez `i18n` s jazykom (P11) — ok; blok „useknutá odpoveď"
  inline → `.lnote--warn` — **otvorené** (`components/Answer.tsx:188`).
- **ask/history** — hlavička (P1) — ok; vlastné pole hľadania →
  `SearchStrip` — **otvorené** (`ask/history/page.tsx:118`).
- **evaluation** — tiché „Uložiť" pri príprave odpovede (R1) — ok;
  hlavička (P1) — ok; posudok bez inline štýlov — ok (8. 10., EVAL-posudok).
- **dpo** — rozhodnutie o námietke `.choice-row` (R9) — ok; „Rozhodnúť"
  v páse tiché — ok.
- **sign-in** — chyba ako `.lnote--bad` (P2) — ok; texty (P11) — ok;
  veľkosti písma natvrdo — **otvorené** (`components/SignIn.tsx:88, 121, 127`).
- **verify/[registrationNumber]** — „IČO" (P11) — ok.
- **privacy** — bez nálezov (karty pod 640 px sú zámer rámu PRIVACY-citatelnost).

### Otvorené k 8. 10. 2026

Mechanické (vzor existuje, jeden PR):

1. `documents` — „nie je v organizácii" → `.empty`.
2. `directory` — „nič sa nenašlo" → `.empty`.
3. `acknowledgements` — citácia z inline štýlu do triedy.
4. `PeopleImport` — výsledok importu → `Notice` / `.lnote` namiesto `p.card`.
5. `admin/tenants/[code]` — stav domén cez `tag--*` / triedy namiesto
   inline farieb (P3).
6. `learning/manage` — zlúčenie značiek `mg-choice` → `.choice-row`.
7. `learning/tests` — typ otázky `.pill` → `.view-switch`; áno/nie
   `.tf-opt` → `.choice-row`; chyby importu ako karty pod 1024 px.
8. `Answer.tsx` — useknutá odpoveď → `.lnote--warn`.
9. `ask/history` — pole hľadania → `SearchStrip`.
10. `SignIn` — veľkosti písma z tokenov.

Návrh: `tgv-main` → `.select-row` (learning/manage), `.mc-check` v riadku
odpovede (learning/tests), P12 (`npm run person` na `/hr/assign`,
`npm run domains` na `/admin`).

## Navrhované poradie PR

1. **Prierez bez rozhodnutí:** P2, P3, P4, P5, P6, P11, P13 — malé, rovnaké
   zmeny naprieč stránkami, nemenia rozloženie.
2. **Hlavičky:** P1 + P10 (+ R1, R2 po rozhodnutí) — dotýka sa skoro každej
   stránky, preto samostatne.
3. **Formulárové kroky:** P7 + zvyšné výbery (`/hr/tracks/[key]`, `/dpo` po R9,
   `/admin/tenants`).
4. ~~**Vzdelávanie: cesty** (R3)~~ ✓ 7. 10. 2026.
5. ~~**Knižnica: úprava dokumentu** (R4) a **AI spotreba** (R5)~~ ✓ 6. 10. 2026.
6. **Návrhy v Claude Design:** ~~`TagSelect` (P8)~~ ✓ 8. 10. 2026, lišta uloženia pre stránky
   ~~s viacerými formulármi (P9)~~ ✓ 7. 10. 2026, ~~správa kurzu~~ ✓ 7. 10. 2026, ~~karta osoby bez karty v karte~~ ✓ 8. 10. 2026,
   ~~`Rating`~~ ✓ 8. 10. 2026.
