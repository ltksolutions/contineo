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
ZAKLAD-segmented-control); akcie detailu dokumentu (`.detail-actions`) a
karty úloh zodpovednej osoby idú s úpravou knižnice.

**Hotové 6. 10. 2026** (PR „Formulárové kroky"): P7 (kroky nahrávania a
úpravy dokumentu, nová trasa, oddelenia a ľudia na trase), termín trasy
ako voľba s fajkou, R9 v `/dpo`, jazyky v správe organizácií. Nechané:
nadpisy `flow-section-title` v karte priebehu znenia (súčasť jej rámu) a
`Rating` v posúdení (čaká na návrh). Navyše: názov v karte prehliadača
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
| P8 | `TagSelect` (pilulky s JS na skupiny a značky) → `.select-row` + pole „nová položka" pod zoznamom | people/[id], library/[id], library/new | návrh |
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

### 1. Potvrdzovanie a prehľad — každý zamestnanec
- **documents** — plné tlačidlo pri každom ďalšom kroku trasy a „Otvoriť" pri
  každej položke (R1); stav „nie je v organizácii" je `p.card`, nie `.empty`.
- **documents/[documentId]**, **/**, **prehlad**, **more**, **guide**, **directory** — bez nálezov (directory: „nič sa nenašlo" by mohlo byť `.empty`).
- **acknowledgements** — „Stiahnuť" pod úvodom, nie v `.page-head` (P1);
  prázdny stav `p.card` → `.empty`; citácia celá v inline štýle → trieda.
- **notifications** — „Označiť všetko ako prečítané" plné pod nadpisom →
  `.page-head`, tiché (P1).
- **approvals** — bez nálezov.

### 2. Knižnica — správcovia obsahu
- **library** — v prázdnej knižnici dve plné „Nahrať dokument" (P10).
- **library/[id]** — akcie dokumentu v `.detail-actions` pod štítkami, nie
  v `.page-head`; „Nové znenie" je plné naraz s „Uložiť základ", panelom
  schvaľovania a „Prideliť vybraným" (r. 965, 993, 1299); úprava na
  `?edit=document` (R4); kroky úpravy `upload-step` a podnadpis
  `flow-section-title` (P7); značky cez `TagSelect` (P8); farby `diffStyle`
  (P13); pohľad zodpovednej osoby — plné tlačidlo v každej karte úlohy (R1).
- **library/new** — kroky `upload-step` (P7), `TagSelect` (P8).
- **library/[id]/text** — keď čaká návrh, plné „Použiť ako koncept" aj
  „Uložiť text"; nadpis mimo `.page-head`.
- **library/curation** — plné „Zverejniť" na každej karte (R1); hlavička
  (P1).
- **library/folders** — hlavička (P1).
- **library/[id]/chunks**, **library/[id]/version** — bez nálezov.

### 3. Pridelené dokumenty
- **hr** — texty natvrdo (P11).
- **hr/[id]** — „Dať vedieť e-mailom" je odkaz pri h2; nadpis mimo `.page-head`.
- **hr/[id]/notify**, **hr/reminders**, **hr/tracks/[key]/notify** — odoslanie
  na konci (R2); chyba ako karta (P2).
- **hr/evidence** — „Použiť" pri filtri je plné, hoci nie je hlavná akcia → tiché.
- **hr/overview** — CSV pri prepínači, nie v `.page-head` (na `/hr/evidence`
  je v hlavičke) → zjednotiť.
- **hr/tracks** — „Nová trasa" ako `h2` s inline štýlom → `.form-group` (P7).
- **hr/tracks/[key]** — termín v neexistujúcej triede `.check-row` →
  `.choice-row` + `.choice-field` ako na `/hr/assign`; dva holé checkboxy (P6);
  `.hr-subtitle` (P7); viac plných tlačidiel naraz (P9); stav cez inline (P3).
- **hr/assign** — chyba ako karta (P2); `npm run person` (P12).
- **hr/[id]/revoke** — bez nálezov.

### 4. Osoby a organizácia
- **people** — v zozname sa ukazuje surový kľúč roly (P11); karty aj na
  počítači (R10).
- **people/[id]** — skupiny cez `TagSelect` (P8); karta v karte (formulár je
  `.card` a skupiny majú vlastnú `.card`) → formulár bez `.card` alebo
  všeobecné polia do vlastnej skupiny (návrh); nadpis mimo `.page-head`.
- **people/import** — „Aktualizovať existujúcich" (P6); tabuľka na karty pod
  640 px; chyba ako karta (P2).
- **people/invite** — odoslanie na konci (R2). **people/new** — chyba ako karta (P2).
- **organisation** — bez nálezov.
- **organisation/[section]** — AI `?view=usage` (R5); číselníky `?list=` (R6);
  prihlásenie, GDPR a domény majú po tri a viac plných „Uložiť"/„Overiť"
  naraz (P9), tlačidlá domén s inline rozmermi; stav cez inline (P3); filter
  spotreby „Použiť" plné; placeholder s doménami SFZ (P11).
- **admin** — „Nová organizácia" v odseku pod úvodom → `.page-head` (P1);
  `npm run domains` (P12).
- **admin/new** — správa ako holá `.card` (P2).
- **admin/tenants/[code]** — jazyky ako pilulky s checkboxom → `.select-row`
  ako na `/organisation/general`, s názvom jazyka namiesto kódu; viac plných
  naraz (P9); stav a farby inline (P3).

### 5. Vzdelávanie
- **learning** — plné „Pokračovať/Začať" na každej karte kurzu (R1); hlavička
  `.lp-head` (P1).
- **learning/[courseKey]** — plné tlačidlo v bočnej karte aj v riadku ďalšej
  časti naraz → riadok tichý (R8).
- **learning/[courseKey]/[partKey]** — pri teste na opakovanie plné tlačidlo
  testu aj „Označiť ako prejdené" → test tichý.
- **…/test/[testKey]** — „Spustiť test" v karte úvodu (R2).
- **…/[attemptId]** — odpovede `.opt` (R7).
- **…/result** — „Všetky / Len chybné" z `.pill` (P4).
- **certificate** — bez nálezov. **certificate/print** — odkaz „Späť na kurz"
  vedie na certifikát → opraviť text (P11).
- **learning/manage** — ~~`?tab=` (R3)~~ ✓; hlavička (P1); dve plné pri `?new=1`
  (P10); filter stavu z `.pill` (P4); zlúčenie tém `mg-choices`/`mg-choice` →
  `.form-group` + `.choice-row` + `.choice-field`; výber tagov na zlúčenie
  (`tgv-main`) → `.select-row` (návrh); `.mg-table` (P5).
- **learning/manage/[courseKey]** — ✓ 7. 10. 2026 podľa návrhu
  `MANAGE-COURSE-akcie` (vlastné cesty R3, jedno plné tlačidlo, karta stavu
  len na koreni, „Pridať blok ▾", zdroj videa `.choice-row`, potvrdenie
  archivácie a odstránenia časti, náhľad ako študent). Pôvodne: „← Všetky
  časti", plné „Zverejniť", „Pridať časť", „Uložiť", „Pridať", „Priradiť
  test", „Prideliť" naraz; typ bloku a zdroj videa ako `.pill`.
- **learning/tests** — ~~`?tab=` (R3)~~ ✓; dve plné pri novom teste, otázke, importe
  (P10); typ otázky ako `.pill` (ako vyššie); správna odpoveď `.mc-check` v
  riadku odpovede (návrh); áno/nie `.tf-opt` → `.choice-row`; filter stavu
  (P4); tabuľka chýb importu bez kariet.
- **learning/tests/[testKey]** — bez nálezov.

### 6. Ostatné
- **ask**, **ask/a/[id]** — `Answer.tsx`: stavy na `.tag` cez inline farby (P3),
  blok „useknutá odpoveď" inline → `.lnote--warn`, texty natvrdo a
  `toLocaleString("sk")` bez jazyka (P11).
- **ask/history** — hlavička (P1); vlastné pole hľadania → `SearchStrip`.
- **evaluation** — plné „Uložiť" v každej položke (R1); hlavička (P1);
  Áno/Nie v `Rating` sú vlastné tlačidlá s inline farbami → `.choice-row`
  s rádiom, ukladanie na zmenu ostáva (návrh); podnadpisy (P7); `fieldStyle`
  namiesto `.field-input`.
- **dpo** — rozhodnutie o námietke dlaždicami `hr-choice--tile` (R9); plné
  „Rozhodnúť" v páse hore aj pri námietke → v páse tiché (skok na kotvu).
- **sign-in** — veľkosti písma natvrdo, chyba inline (P2), texty (P11).
- **verify/[registrationNumber]** — „IČO" natvrdo (P11).
- **privacy** — bez nálezov (karty pod 640 px sú zámer rámu PRIVACY-citatelnost).

## Navrhované poradie PR

1. **Prierez bez rozhodnutí:** P2, P3, P4, P5, P6, P11, P13 — malé, rovnaké
   zmeny naprieč stránkami, nemenia rozloženie.
2. **Hlavičky:** P1 + P10 (+ R1, R2 po rozhodnutí) — dotýka sa skoro každej
   stránky, preto samostatne.
3. **Formulárové kroky:** P7 + zvyšné výbery (`/hr/tracks/[key]`, `/dpo` po R9,
   `/admin/tenants`).
4. ~~**Vzdelávanie: cesty** (R3)~~ ✓ 7. 10. 2026.
5. **Knižnica: úprava dokumentu** (R4) a **AI spotreba** (R5).
6. **Návrhy v Claude Design:** `TagSelect` (P8), lišta uloženia pre stránky
   ~~s viacerými formulármi (P9)~~ ✓ 7. 10. 2026, ~~správa kurzu~~ ✓ 7. 10. 2026, karta osoby bez karty v karte,
   `Rating`.
