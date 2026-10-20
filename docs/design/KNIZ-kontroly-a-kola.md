# KNIZ — kontroly a kolá (`/library/compliance`)

> **Stav: rozhodnuté** 20. 10. 2026 — Q1–Q6 podľa A (používateľ: „S odporúčaniami súhlasím").

Referencia: `KNIZ-kontroly-a-kola.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-segmented-control.md`, `ZAKLAD-vyber-a-prepinace.md`, `ZAKLAD-lista-ulozenia.md` (`.more`, `.more-confirm`), `KNIZ-kontrola-suladu-detail.md` (dvojstĺpec `.cf-*`, D199). Zdroj: `app/library/compliance/page.tsx`, `app/library/compliance/[runId]/page.tsx`, `library/complianceActions.ts`, `lib/complianceCheck.ts`, `lib/complianceRequests.ts`, ADR-032 (D196–D200), ADR-034 (D218, D219, D221).

## Vzory SwiftUI
| Časť | SwiftUI | V aplikácii |
|---|---|---|
| Zoznam kontrol | `List` so `Section` | `.grp` „Čaká na kontrolu" / „Na rozhodnutie" / „Uzavreté", karty `.ck` |
| Nová kontrola | `Form` + `Section`, `Picker(.inline)` | `fieldset.form-group`, `.choice-row` + `.choice-field` |
| Kolá | `Picker(.segmented)` | `.view-switch` (sivý), `?round=n` |
| Dokumenty / nálezy | `NavigationSplitView` | `.cf-*` ako dnes |
| Akcie kontroly | `toolbar` | `.page-tools` |
| Zrušiť kontrolu | `confirmationDialog` | `?cancel=1#more` + `.more-confirm` |

## Čo sa mení

### 1 · Zoznam kontrol `/library/compliance`
- `.page-head`: `h1` `t.heading` (ostáva), `p.page-lead` `t.introChecks` (nové), `.page-tools` **jediné plné** `t.newCheck` „Nová kontrola" → `/library/compliance/new`.
- Formulár spustenia na zozname **zaniká**. Karta „Návrhy z helpdesku do manuálov" na kanál (`helpdeskChannels`) **zaniká** — druh sa volí v Novej kontrole.
- **Čaká na kontrolu** `#requests` (D200): `.task-card` na požiadavku — `b` `t.requestTitle` (ostáva), `span` `t.requestWhen` + `t.requestFor(názov kontroly)` „v pevnej väzbe s kontrolou „…"". Tiché `t.requestStartRound(n)` „Spustiť kolo {n}…" → `/library/compliance/confirm?check=<id>&request=<id>` (Q2). Odkaz `t.requestDismiss` „Netreba" → `?dismiss=<id>#requests` → pod kartou formulár s povinným `reason` (`dismissRequestAction`); dnešný `<details class="cf-rename">` sa ruší.
- **Na rozhodnutie** a **Uzavreté** — `section.grp` s `h2` + počet. Do „Na rozhodnutie" patrí kontrola, ktorej posledné kolo má nerozhodnuté nálezy, beží, je zastavené alebo zlyhalo; ostatné sú „Uzavreté". Poradie: dátum posledného kola, najnovšie hore.
- Karta kontroly `a.ck` (celá je odkaz na `/library/compliance/<checkId>`):
  - ikona stavu (tabuľka v `.html`): „!" výstražná · krúžok farbou organizácie · „✕" červená · „✓" zelená;
  - `b` názov + `.tag` druhu `t.kind.documents` „Súlad dokumentov" / `t.kind.helpdesk` „Návrhy z helpdesku";
  - riadok stavu posledného kola: `t.openOf(14, 62)` „**14 nerozhodnutých** z 62 nálezov · kolo 3 dobehlo" / `t.roundRunning(n, x, y)` / `t.roundStopped` / `t.roundFailed` / `t.allDecided(23)` „Všetkých 23 návrhov rozhodnutých";
  - `.quiet` `t.checkScope` „8 manuálov ISSF proti 3 normám" (helpdesk: „51 otázok kanála ISSF Helpdesk proti 8 manuálom") · `t.rounds(3)` „3 kolá" · `t.lastRound(dátum, meno)` „posledné 18. 10. 2026, Ján Letko".
  - Na rozhodnutie: jemný podklad `--warn-bg` zľava, počet tučne `--warn-fg`. Rozdiel nesie aj sekcia, ikona a slovo — nie len farba.
- **Pevné väzby** `#links`: `section.card.more` > `.more-row` — `b` `l.subjectTitle` + počet, `span` `t.against(…)` + `t.linkFrom(kontrola)` „z kontroly …" (odkaz; zrušená = „(zrušená)" bez odkazu); tiché `t.linkRemove` „Zrušiť väzbu" (`removeLinkAction`, ostáva).
- Prázdny stav: `.empty` `t.noneTitle` „Zatiaľ žiadna kontrola" · `t.noneText` „Kontrolu spustíte tlačidlom vpravo hore."

### 2 · Nová kontrola `/library/compliance/new`
Jeden `form` (GET na `/library/compliance/confirm`, ako dnes po odoslaní):
1. **Druh** `fieldset.form-group` > `.choice-row` `radio name="kind"`: `documents` „Súlad dokumentov" (`t.kindDocumentsSub` „dokumenty proti normám") · `helpdesk` „Návrhy z helpdesku do manuálov" (`t.kindHelpdeskSub` „otázky kanála proti verejným manuálom"). Predvolené `documents`; `?kind=helpdesk&channel=<key>` predvyplní.
2. **Kanál** — `div.choice-field` za riadkom helpdesku: `radio name="channelKey"`, riadok = názov + `t.helpdeskIntro(n)` počet otázok (len kanály s otázkami, dnešný `questionCounts`). Ak pre kanál kontrola už existuje: `.lnote--warn` `t.channelHasCheck(názov, kolá)` + odkaz `t.startRoundThere(n)` „Spustiť v nej kolo {n}" a `small` `t.newCheckNoCarry` „Nová kontrola začne bez prenesených ponechaní." Bez JS je pole vždy viditeľné; pri `documents` sa ignoruje.
3. **Názov** `name` (`t.nameLabel`, ostáva). Pri helpdesku predvyplnené `t.helpdeskHeading(kanál)`; inak prázdne, hint `t.nameHint` (ostáva).
4. **Kontrolované dokumenty** `subjectIds` — `MultiSelect` ako dnes. Pri helpdesku predvyplnené verejnými manuálmi kanála.
5. **Normy** `documentIds` — `MultiSelect`; pod ním `.inh` `t.referencesInherited` „Prázdne = nadradené z hierarchie" + zoznam, ktorý sa použije (D219 + pevné väzby). Pri helpdesku veta `compliance.referenceNotBinding`.
6. Na konci jediné plné `t.continueToConfirm` „Pokračovať na rekapituláciu" + `.quiet` `t.nothingStarts` „Nič sa ešte nespustí." (výnimka „Odoslať po náhľade" — v hlavičke tlačidlo nie je).

### 3 · Detail kontroly `/library/compliance/<checkId>`
- Cesta `Knižnica › Kontrola súladu dokumentov › {názov}`.
- `.page-head-main`: `h1` názov kontroly, `p.page-lead` `t.checkBrief` „{druh} · {dokumenty} proti {normy}" (názvy, pri > 3 „a {n} ďalším").
- `.page-tools` (akcie kontroly): tiché `t.rename` „Premenovať" → `?rename=1` (pod hlavičkou `form` s poľom `name` a tichým „Uložiť", odkaz „Zrušiť"; `renameRunAction` → premenuje kontrolu) · tiché `t.saveLinks` „Uložiť ako pevné väzby" (`saveLinksAction`; keď už existujú, tiché `t.linksSaved` „Pevné väzby ✓" → `/library/compliance#links`) · **plné** `t.newRound` „Nové kolo" → `/library/compliance/confirm?check=<id>`. Počas behu „Nové kolo" chýba.
- **Kolá** `.rounds`: `nav.view-switch` `t.roundN(n)` „Kolo 3 · Kolo 2 · Kolo 1", posledné predvolené (bez `?round`). Viac než 4 kolá: posledné tri + `t.olderRounds` „Staršie…" → `?rounds=all` (zoznam kôl ako `.form-list` s dátumom a stavom). Vedľa `.quiet` `t.roundMeta(dátum, meno)`. Pri jedinom kole sa prepínač nekreslí (len riadok dátumu).
- **Pás priebehu kola** `section.card`:
  - dobehlo: `b` `t.decidedOf(48, 62)` + `t.remaining(14)`, `.bar`, druhy nálezov `.tag`, vpravo `.usage` model · `t.duration(min)` · cena USD. Podrobné „Údaje o behu" (tokeny, volania, kroky) ostávajú ako odkaz `t.usageMore` → `?usage=1` (riadky `.labeled-row`).
  - beží: `t.roundRunning(4, 10)` „Beží · 4 z 10 dokumentov", `.bar` farbou organizácie, priebežná cena, `t.runningNote` „Stránku môžete zavrieť, kolo beží ďalej…", tiché `t.stopRound` „Zastaviť kolo" (existujúca akcia).
  - zastavené: `t.stopped` + tiché `t.resumeRound` „Pokračovať"; zlyhalo: `.lnote--bad` s chybou.
  - **Zmena oproti predošlému kolu** `.delta` (od kola 2): `t.deltaNew(5)` „5 nových nálezov" · `t.deltaCarried(9)` „9 ponechaní prenesených — už rozhodnuté, nepýta sa znova" · `t.deltaGone(4)` „4 nálezy zmizli (prijaté v kole 2)" · odkaz `t.showNew` „Zobraziť nové" → `?view=new`.
- **Dvojstĺpec** `.cf-*` bez zmeny (KNIZ-kontrola-suladu-detail). Nové: štítok `.tag--info` `t.newInRound(n)` „Nový v kole {n}" pri náleze, ktorý v predošlom kole nebol; prenesené ponechanie je v „Rozhodnuté" so stavom `t.carriedFrom(n)` „Ponechané v kole {n}".
- **Staršie kolo** (`?round=n`, nie posledné, Q3): pod prepínačom `.lnote--info` `t.olderReadOnly` „Staršie kolo — len na čítanie." + odkaz `t.goToLatest(n)` „Prejsť na kolo {n}". Nálezy bez „Rozhodnúť", formulára aj „Zmeniť rozhodnutie". Akcie kontroly ostávajú.
- **Ďalšie akcie** `section.card.more#more` na konci: `.more-row` `t.cancelCheck` „Zrušiť kontrolu" + veta, `.button--danger` → `?cancel=1#more` → `form.more-confirm`: `h3` `t.cancelTitle(názov)`, zoznam dôsledkov (archív, kolá a rozhodnutia v audite, prijaté zmeny v konceptoch ostávajú, ponechania sa neprenesú; pri bežiacom kole „Bežiace kolo sa zastaví"), nepovinný `reason`, `.button--danger` `t.cancelCheck`, odkaz `t.keep` „Ponechať".

### 4 · Šírky
- **≥ 1024** (macOS): zoznam do 1040 px; detail `.split` 320 px + obsah.
- **640–1023** (iPadOS): Nová kontrola do 760 px; detail bez panela, riadok `.pick` „Dokument x z y ›".
- **< 640** (iOS): „Nová kontrola" cez celú šírku pod nadpisom; prepínač kôl cez celú šírku (štyri voľby vrátane „Staršie…" sa zmestia pri 390 px); tlačidlá v páse a v `.more-confirm` cez celú šírku, 44 px. Dole len hlavná lišta.

## Kde
`app/library/compliance/page.tsx` (zoznam), nové `app/library/compliance/new/page.tsx`, `app/library/compliance/[runId]` → `[checkId]` (detail s `?round=`; staré adresy behov presmerovať na `/<checkId>?round=n`), `app/library/compliance/confirm` (prijme `check`), `library/complianceActions.ts`, `lib/complianceCheck.ts`, `lib/complianceRequests.ts`, `globals.css` (`.ck`, `.grp`, `.delta`, `.inh`), i18n sk/cs/en.

## Prečo
- Jedna karta na beh: 20. 10. boli v zozname štyri karty „Návrhy z helpdesku do manuálov — ISSF Helpdesk" a nebolo jasné, ktorá je aktuálna.
- Rozhodnutia „Ponechať" sa prenášajú medzi behmi — patria teda k jednej kontrole, nie k behu.
- Dva vstupy na spustenie (formulár + karta helpdesku) robili tú istú vec inak.
- Kontrola na rozhodnutie vyzerala rovnako ako uzavretá.

## Rozhodnutia v repozitári — dodržané
- **ADR-036 v repozitári (`main`, 20. 10. 2026) zatiaľ nie je** — v `docs/decisions/` je posledné ADR-035. Návrh vychádza z modelu v zadaní; ak ADR-036 povie inak, platí ADR.
- Rola `compliance`, kontroly sú spoločné pre všetkých s rolou (D198, Ján 11. 10. 2026).
- Rozhodnutie Ponechať / Prijať a upraviť, povinný dôvod, zápis do konceptu (D199); dvojstĺpec a „Uložiť a ďalší" (KNIZ-kontrola-suladu-detail, nasadené 11. 10.).
- Pevné väzby a požiadavka pri zverejnení nového znenia, zamietnutie požiadavky s dôvodom (D200).
- Kontrola podľa úlohy dokumentu, meradlo len záväzný dokument; predvyplnenie noriem z hierarchie (D218, D219).
- Návrhy z helpdesku idú cestou nálezu kontroly súladu (D221) — preto jeden vstup.
- Kto spustil — menom, nie e-mailom (komentár v `page.tsx`, Ján 13. 10. 2026).
- Prázdny výber dokumentov pri novej kontrole, žiadne predvyplnenie poslednými (Ján 11. 10. 2026) — ostáva pri druhu Súlad; pri helpdesku sa predvypĺňajú manuály kanála (to je zadanie, nie posledný výber).
- Rekapitulácia `/library/compliance/confirm`, „Zastaviť kolo", „Zrušiť kontrolu" existujú — návrh ich len umiestňuje.

## Rámy
1. **1440 svetlá** — zoznam: 1 požiadavka, „Kontrola manuálov ISSF voči platným normám SFZ" (kolo 3, 62 nálezov, 14 nerozhodnutých, 3 kolá) v „Na rozhodnutie", „Návrhy z helpdesku do manuálov — ISSF Helpdesk" (2 kolá, všetko rozhodnuté) v „Uzavreté", 2 pevné väzby.
2. **1440 svetlá** — detail tej istej kontroly, Kolo 3, zmena oproti kolu 2 (5 nových, 9 prenesených ponechaní), otvorený nový nález.
3. **1440 svetlá** — Kolo 1 len na čítanie (`?round=1`).
4. **834 svetlá** — Nová kontrola, druh „Návrhy z helpdesku" s výberom kanála a upozornením na existujúcu kontrolu.
5. **390 tmavá** — zoznam.
6. **390 tmavá** — detail počas behu kola 4 (4 z 10) so „Zastaviť kolo", prepínač so „Staršie…".
7. **390 tmavá** — `?cancel=1#more`.

## Stav v adrese
`?round=n` · `?rounds=all` · `?rename=1` · `?cancel=1#more` · `?usage=1` · `?view=new` · na zozname `?dismiss=<id>#requests` · na Novej kontrole `?kind=&channel=`. Detail ďalej `?doc=`, `view`, `f`, `change`, `docs` ako dnes. Bez JS funguje všetko; skrytie poľa Kanál je len CSS `:has`.

## Údaje, ktoré v modeli neexistujú
1. **Kontrola ako záznam** (`compliance_checks`: `checkId`, `kind`, `name`, `subjectIds`, `referenceIds`, `channelKey`, `createdBy`, `cancelledAt/By/reason`) a **kolo** = dnešný `ComplianceRun` s `checkId` a `round`. Migrácia: behy so zhodným druhom + dokumentmi + normami (helpdesk: kanálom) zlúčiť do jednej kontroly podľa dátumu. `ComplianceRun.name` sa presúva na kontrolu.
2. **Prenos ponechaní** medzi kolami — nález v novom kole treba spárovať s nálezom predošlého (dokument + miesto + citované znenie). Bez toho nejde „9 prenesených" ani „Nový v kole 3".
3. **„Zmizli"** (počet nálezov predošlého kola, ktoré v novom nie sú) — z toho istého párovania.
4. **Väzba ↔ kontrola** — `compliance_links` dnes nemá `checkId`; treba ho, aby požiadavka vedela, ktorej kontrole spustiť kolo (Q2). Staré väzby bez kontroly: požiadavka založí novú kontrolu.
5. **Dôvod zrušenia kontroly** — ak „Zrušiť kontrolu" dnes dôvod neukladá, pole je nové (nepovinné).
6. **Priebežná cena** počas behu — ak sa spotreba ukladá až na konci, riadok ukáže len model a minúty.
7. Verejné manuály kanála (predvyplnenie pri helpdesku) — z dnešnej logiky `startHelpdeskReviewAction`.

## Rozhodnuté
Všetky otázky rozhodnuté 20. 10. 2026 podľa **A**.

## Otázky
**Q1 ✅ A — Ako prepínať kolá na detaile?**
A: `.view-switch` „Kolo 3 · Kolo 2 · Kolo 1" nad pásom priebehu, nad 4 kolá posledné tri + „Staršie…" · B: rozbaľovací výber kola · C: zoznam kôl pod pásom priebehu.
**Odporúčam A** — 2–4 kolá sú typický prípad a prepínač pohľadu je zavedený prvok.

**Q2 ✅ A — Čo spustí požiadavka na kontrolu (nové znenie v pevnej väzbe)?**
A: nové kolo existujúcej kontroly s tými istými dokumentmi · B: samostatnú kontrolu ako dnes.
**Odporúčam A** — väzba vznikla z kontroly, patrí k nej, a ponechania sa prenesú.

**Q3 ✅ A — Dá sa rozhodovať v starých kolách?**
A: len na čítanie, rozhoduje sa len v poslednom · B: v ktoromkoľvek.
**Odporúčam A** — rozhodnutie v starom kole by sa do posledného nepremietlo.

**Q4 ✅ A — Nová kontrola na vlastnej adrese `/library/compliance/new`, alebo formulár rozbalený na zozname (`?new=1`)?**
A: vlastná adresa · B: na zozname.
**Odporúčam A** — časť, ktorú má cesta pomenovať, má vlastnú adresu, a zoznam ostane krátky.

**Q5 ✅ A — Čo s pevnými väzbami, keď sa kontrola zruší?**
A: ostávajú, pri ďalšej požiadavke vznikne nová kontrola · B: zrušia sa s kontrolou · C: voľba v potvrdení.
**Odporúčam A** — väzba chráni dokument pred zabudnutou novelou normy; zrušenie kontroly to nemá vypnúť potichu.

**Q6 ✅ A — Nová kontrola pre kanál, ktorý už kontrolu má: upozorniť a ponúknuť nové kolo, alebo zakázať?**
A: upozorniť a ponúknuť kolo, novú kontrolu dovoliť · B: zakázať druhú kontrolu kanála.
**Odporúčam A** — zabráni duplicitám z 20. 10., ale nechá možnosť začať odznova bez prenesených ponechaní.

## Prompt pre Claude Code
```
Prečítaj design_handoff_contineo_intranet/KNIZ-kontroly-a-kola.md a .html
a prestav kontrolu súladu na model kontrola → kolá (Q1–Q6 rozhodnuté
podľa A, 20. 10. 2026). Ak už je v repozitári ADR-036, má prednosť —
rozdiely zapíš do DEVLOG.
- Model: compliance_checks + ComplianceRun.checkId/round, migrácia
  existujúcich behov, párovanie nálezov medzi kolami (prenos ponechaní,
  nové, zmizli), checkId v compliance_links.
- /library/compliance: požiadavky, sekcie Na rozhodnutie / Uzavreté, karta
  na kontrolu, pevné väzby; jediné plné „Nová kontrola". Formulár spustenia
  a karta helpdesku zanikajú.
- /library/compliance/new: druh (.choice-row), kanál (.choice-field),
  názov, dokumenty, normy (prázdne = z hierarchie) → /confirm.
- /library/compliance/[checkId]: ?round=, pás priebehu, zmena oproti
  predošlému kolu, dvojstĺpec .cf-* bez zmeny, staršie kolá len na čítanie,
  „Nové kolo" plné, Premenovať, Uložiť ako pevné väzby, Zastaviť kolo,
  Zrušiť kontrolu cez ?cancel=1#more. Staré /[runId] presmeruj.
- Triedy .labeled-row, .lnote, .task-card, .more-row, .more-confirm, .empty,
  .view-switch; nové .ck, .grp, .delta, .inh z tokenov (svetlá aj tmavá).
- Bez JavaScriptu, terč 44 px, texty sk/cs/en.
- Testy: zlúčenie behov, párovanie nálezov, sekcie zoznamu podľa stavu.
Zapíš do docs/DEVLOG.md a do github.md v Claude Design.
```
