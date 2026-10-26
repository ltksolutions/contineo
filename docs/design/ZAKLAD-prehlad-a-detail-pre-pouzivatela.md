# ZAKLAD — Prehľad a detail dokumentu pre bežného používateľa

Návrh bez `.html` (vzniká v repozitári, nie v Claude Design). Základ:
`ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `PREHLAD.md`, `ZNENIE.md`,
`DETAIL-starsie-znenia.md`, `KNIZ-detail-dokumentu.md`.
Rozhodnutie: `docs/decisions/ADR-041-dokument-pre-pouzivatela.md` (D270–D274).
Zadanie Jána 26. 10. 2026: „bežný používateľ nerozlišuje knižnicu a register
zdrojov, on registruje len dokumenty a jediné zmysluplné delenie je podľa
druhu"; „čo najviac info na dashboarde a na prvý klik na dokument detail so
všetkými potrebnými údajmi"; „každá rola nech vidí iba svoje funkcionality".

Zdroj dnešného stavu: `app/src/app/page.tsx` (dlaždice `.kpi`, panel
„Čo máte k dispozícii" z #447, dlaždice sekcií, „Pre vás" s panelmi
Čo vás čaká + Novinky), `app/src/app/documents/[documentId]/page.tsx`
(čitateľský detail: `.zn-head`, `VersionMetaLine`, PDF/text, kontakt,
potvrdenie), `app/src/components/LibraryReader.tsx` (Knižnica na čítanie,
`/library` bez roly), `app/src/app/organisation/[section]/web/[id]/[...act]/page.tsx`
(detail predpisu zo Slov-Lexu — len správca osôb).

Poradie práce: **B → C → A** (detail → zákon → Prehľad), každý krok vlastná
vetva a PR. Prehľad odkazuje na detaily, tak nech má kam.

---

## B. Čitateľský detail dokumentu (`/documents/<id>`)

### Čo sa mení

Nad text znenia pribúda **hlavička dokumentu** a **prepínač znení**; všetko
ostatné (PDF alebo text, merač čítania, karta kontaktu, potvrdenie) ostáva
tam, kde je.

```
Názov dokumentu                                  [Opýtať sa]  (Upraviť v knižnici)
Smernica · znenie 2026-01 · platí od 1. 1. 2026         [do 30. 11. 2026]

┌ Údaje ─────────────────────────────────────────────────────────────────┐
│ Zodpovedná osoba   Mgr. Jana Nováková                                  │
│ Právny základ      § 8 ods. 2 zákona o športe                          │
│ Prijal (orgán)     Výkonný výbor SFZ · 12. 12. 2025                     │
│ Autor              Legislatívno-právne oddelenie                        │
│ Nadradené          Stanovy SFZ · Zákon č. 440/2015 Z. z. o športe       │
│ Jazyk              Slovenčina                                           │
│ Pôvod              Nahraté ručne                                        │
│ Potvrdenie         potvrdili ste 3. 2. 2026 · znenie 2025-07            │
└────────────────────────────────────────────────────────────────────────┘

┌ Znenia (3) ────────────────────────────────────────────────────────────┐
│ 2026-01   platí od 1. 1. 2026                 [platí]      zobrazené   │
│ 2025-07   1. 7. 2025 – 31. 12. 2025           [neplatí]    Zobraziť    │
│ 2024-01   1. 1. 2024 – 30. 6. 2025            [neplatí]    Zobraziť    │
└────────────────────────────────────────────────────────────────────────┘

PDF / text znenia … (bez zmeny)
```

- **Riadok pod názvom** (dnešný `.zn-version`): **druh** (názov z číselníka
  `category`), označenie znenia, „platí od"; termínový chip ostáva. Druh je
  prvý, lebo je to jediné delenie, ktoré bežný človek pozná (D270).
- **Karta údajov** je `.lrs` > `.labeled-row` (`LabeledContent`) — ten istý
  prvok ako v správcovskom detaile `KNIZ-detail-dokumentu.md`. Polia
  v poradí: Zodpovedná osoba, Právny základ, Prijal (orgán), Autor,
  Nadradené, Jazyk, Pôvod, Potvrdenie. **Nekreslí sa** Priečinok, Prístup,
  Značky ani počet potvrdení iných ľudí (rozhodnutie Jána 26. 10. 2026,
  D272) — sú to pojmy správcu obsahu. Prázdne pole sa vynechá, nie „—".
  `VersionMetaLine` (autor, prijal, dátum) sa tým presúva do karty a riadok
  pod názvom ju už nekreslí.
- **Potvrdenie** je *moje*: „potvrdili ste {dátum} · znenie {označenie}"
  z reťaze dôkazov; keď chýba a je povinnosť, riadok sa nekreslí — povinnosť
  hovorí termínový chip a karta potvrdenia dole.
- **Zodpovedná osoba** v karte je meno; karta kontaktu (e-mail, telefón,
  profil) pod textom ostáva — otázka vzniká pri čítaní (D91).
- **Znenia** je `.card.more` so zoznamom ako v detaile predpisu
  (`[...act]/page.tsx`): označenie, rozsah platnosti, štítok stavu
  (`platí` / `neplatí` / `platí od …`), vpravo tiché `Zobraziť`
  (`?version=<versionId>`) alebo text „zobrazené". Karta sa kreslí len pri
  **dvoch a viac** zverejnených zneniach. Predvolené je platné znenie
  (`versionToShow` z `lawCatalog.ts`, zovšeobecnené); koncepty nikdy.
  Zobrazené staré znenie má nad textom riadok „Toto znenie už neplatí;
  platné je {označenie}" s odkazom — potvrdzuje sa **len platné** znenie,
  karta potvrdenia sa pri inom nekreslí.
- **Akcie v `.page-head`**: `Opýtať sa` (plné, z #448 `?doc=`) — jediné
  plné tlačidlo. Správca obsahu vidí navyše tiché `Upraviť v knižnici` →
  `/library/<id>` (D274); nikto iný žiadnu správcovskú akciu nevidí.
  DPO, HR, hodnotiteľ na čitateľskom detaile nič navyše nemajú — ich práca
  je na vlastných obrazovkách.

### Prečo

- Dnes vie čitateľ z detailu len názov, označenie znenia a dátum; kto za
  dokument zodpovedá, zistí až pod textom, a čo je nadradené, vôbec.
- Prepínač znení dnes má len správca (`/library/<id>`) a správca osôb pri
  zákone; čitateľ, ktorému sa od januára zmení smernica, nemá ako si
  prečítať, čo platilo predtým. Zákon to už vie — dokument organizácie má
  vedieť to isté.
- Jedna karta údajov s rovnakým prvkom ako správcovský detail: človek, ktorý
  má obe role, vidí tie isté polia na tom istom mieste, len bez tlačidiel.

### Rámy

- **1440** — hlavička, karta údajov v dvoch stĺpcoch (`.lrs` od 1024 px),
  karta znení, text; `Opýtať sa` a tichá úprava vpravo v `.page-head`.
- **834** — karta údajov v jednom stĺpci, znenia s rozsahom pod označením.
- **390** — riadok pod názvom sa láme (druh · označenie / platí od), chip
  pod ním; `Zobraziť` 44 px; karta potvrdenia ako dnes.
- Stavy: jedno znenie (bez karty znení) · zobrazené staré znenie (riadok
  „už neplatí", bez potvrdenia) · bez zodpovednej osoby (riadok vynechaný,
  karta kontaktu sa nekreslí) · správca obsahu (tichý odkaz navyše).

### Bez JavaScriptu

Prepínač znení sú odkazy `?version=`; `Opýtať sa` je odkaz na `/ask?doc=`.
Nič nové JS nevyžaduje.

### i18n (sk/cs/en)

Nové v `onboarding` (alebo nový blok `reader`): `facts.heading` „Údaje",
`facts.responsible`, `facts.basis`, `facts.approvedBy`, `facts.author`,
`facts.parents`, `facts.language`, `facts.origin`, `facts.acknowledged(d, label)`
„potvrdili ste {d} · znenie {label}", `versions.heading(n)` „Znenia ({n})",
`versions.show` „Zobraziť", `versions.shown` „zobrazené",
`versions.notCurrent(label)` „Toto znenie už neplatí; platné je {label}.",
`editInLibrary` „Upraviť v knižnici". Štítky stavu prebrať z
`org.law.detail.stateNow/statePast/stateLater`, názvy polí z
`library.rows.*`, `t.origin.*`, `t.language.*` (už existujú).

### Údaje, ktoré v modeli neexistujú / overiť

| Údaj | Stav |
| --- | --- |
| `category`, `language`, `source` (pôvod), `parents` (ADR-034) | ✅ na dokumente |
| `responsiblePerson`, `legalBasis[Label]`, `author`, `approvedBy`, `approvedOn` | ✅ na znení (ADR-013, ADR-017) |
| staršie zverejnené znenia pre čitateľa | ✅ `versions[]`; dnes ich `loadDocumentFor` čitateľovi nedáva — rozšíriť čítanie, **nie** práva (len `published`, nikdy koncept) |
| moje potvrdenie (dátum, znenie) | ✅ reťaz dôkazov (`acknowledgements`); overiť, či sa číta aj pre nepovinných čitateľov |
| `?version=` v adrese čitateľa | ❌ nový parameter adresy (`lib/urlParams.ts` nič neprekladá — nový kľúč, anglicky) |

🔴 Zmena schémy: **žiadna**.

---

## C. Zákon pre bežného používateľa (`/documents/law/<actId>`)

### Čo sa mení

Predpis z katalógu (ADR-039) dostane **čitateľskú adresu**
`/documents/law/SK/ZZ/2018/18[?version=<timepoint>]` pre každého
prihláseného človeka organizácie, ktorá má predpis odobraný. Telo je
dnešný správcovský detail (`[...act]/page.tsx`: karta znení, celý text
`.cut-doc`) **v tvare B**: rovnaký riadok pod názvom (druh **Zákon** ·
znenie · platí od), rovnaká karta údajov, rovnaká karta znení.

- Karta údajov pri zákone kreslí len to, čo katalóg má — nič sa
  nedomýšľa (Prijal (orgán) sa pri predpise nevypĺňa, hoci by sa dalo
  napísať „Národná rada SR"): **Pôvod** „Slov-Lex" s odkazom na portál
  (`portalUrl`), **Jazyk** slovenčina, **Nadradené** nič, **Zodpovedná
  osoba** nič (otázka Q3). Pri predpise
  odobranom aj do knižnice (ADR-039, D260) vedie riadok „V knižnici ako …"
  na `/documents/<id>`, kde sú údaje organizácie.
- Čo sa **nekreslí**: dátum poslednej kontroly, chyba kontroly, odber od,
  počet úsekov, PDF zo Slov-Lexu ako samostatný stĺpec — to je správa
  zdroja (#445, #446) a ostáva na `/organisation/sources/web/slov-lex/<actId>`.
  Správca osôb tam má tichý odkaz `Spravovať zdroj` (D274), ostatní nie.
- Akcie: `Opýtať sa` → `/ask?src=slov-lex` (rozsah na jeden predpis dnes
  neexistuje — otvorené v ADR-029 § 7).
- Odkazy: z Prehľadu (A), z Knižnice na čítanie, z odpovede Opýtať sa pri
  citácii zákona vedie **čitateľská** adresa; správcovská sa používa len
  v Organizácia → Zdroje. Odkaz na portál Slov-Lex z Prehľadu pre
  ne-správcov (dnes) zaniká.

### Prečo

Detail predpisu je dnes najlepší „jednoduchý formát" dokumentu v aplikácii
a vidí ho jediná rola. Bežný človek ide na portál, kde sú tri iné znenia
a žiadna súvislosť s organizáciou. Verejné cesty sa neprejmenúvajú
(`CLAUDE.md`): správcovská adresa ostáva, čitateľská je nová.

### Bez JavaScriptu · i18n · dáta

Všetko odkazy. i18n zdieľa B (`reader.*`) + `law.detail.*`. Dáta
✅ `actById`, `versionsOf`, `versionToShow`, `subscriptionsFor`; nový je
len súbor `app/src/app/documents/law/[...act]/page.tsx` (verejná cesta —
pri výbere názvu `law` je to zmluva; `documents/law` nekoliduje
s `documents/[documentId]`, lebo `law` nie je `documentId` — overiť
v Next, segment so statickým názvom má prednosť).

---

## A. Prehľad bežného používateľa (`/`)

### Čo sa mení

```
Dobrý deň, Ján Letko                                  [Opýtajte sa …    ⌘K]

Moje úlohy  5
┌──────────────────────────────────────────────────────────────────────┐
│ Registračný a prestupový poriadok   znenie 2026-01   [do 30. 11.]  Otvoriť │
│ Smernica o ochrane údajov           znenie 2026-02   [po termíne]  Otvoriť │
│ Stanovy SFZ — nové znenie           predložil J. N.               Rozhodnúť │
│ Kurz: GDPR pre funkcionárov         3 z 5 častí     [do 15. 12.]  Pokračovať │
│ Test: Pravidlá futbalu              1 pokus          [do 20. 12.]  Spustiť │
└── Všetky úlohy → ────────────────────────────────────────────────────┘

Dokumenty  29
┌──────────────────────────────────────────────────────────────────────┐
│ Manuály ISSF — prehľad              Manuál · znenie od 24. 10. [nové] Opýtať sa │
│ Zákon č. 18/2018 Z. z. o ochrane…   Zákon · znenie od 18. 8. 2026     Opýtať sa │
│ Finančná smernica SFZ               Smernica · znenie od 1. 7. [končí] Opýtať sa │
│ …                                                                     │
└── Všetky dokumenty → ────────────────────────────────────────────────┘

Organizácia
[Adresár] [Knižnica] [Vzdelávanie]

Správa   (len roly, bez zmeny)
```

- **Dlaždice KPI (`.kpi`) a blok „Pre vás" zanikajú.** Ich obsah sa
  nestráca: „Na potvrdenie" a „Čaká na schválenie" sú riadky a počet
  v hlavičke **Moje úlohy**; „Nové" je chip `nové` pri riadku v
  **Dokumenty**; „Expiruje" je chip `končí` (dnešný `due-chip--soon`
  s `t.expiringChip`) tamtiež. `PREHLAD.md` („KPI pás — hotové, nerob
  znova") sa týmto prekonáva (D271).
- **Moje úlohy** = dnešný panel „Čo vás čaká" (`.card.panel`) na celú
  šírku: povinnosti z `acknowledgementDuties` s termínovým chipom, kolá
  schválenia (len kto rozhoduje), **a navyše** kurzy a testy s termínom
  (Vzdelávanie zapnuté; rovnaké funkcie ako `/learning`). Riadok:
  názov · meta · chip · tichá akcia (`Otvoriť` / `Rozhodnúť` /
  `Pokračovať` / `Spustiť`). Najviac 6 riadkov, päta „Všetky úlohy →"
  na `/documents` (keď panel niečo skrýva, s počtom — dnešné pravidlo).
  Prázdny stav dva riadky (PREHLAD úloha 1) ostáva.
- **Dokumenty** = jeden panel namiesto „Knižnica" + „Ďalšie zdroje"
  (#447): platné znenia dokumentov knižnice (`readableDocuments`)
  **a** predpisy z katalógu, ktoré má organizácia odobrané, v jednom
  zozname podľa dátumu účinnosti zostupne, 6 riadkov. Meta riadku:
  **druh** (názov z číselníka; predpis má pevne „Zákon") · „znenie od".
  Názov vedie na `/documents/<id>` alebo `/documents/law/<actId>` (C);
  akcia `Opýtať sa` → `/ask?doc=<id>` (#448) alebo `/ask?src=slov-lex`.
  Počet v hlavičke = dokumenty + predpisy. Päta „Všetky dokumenty →"
  na `/library` (Knižnica na čítanie), ktorá dostane prepínač pohľadu.
  Pripojené systémy (MCP konektory) z panelu **miznú** — bežný človek ich
  nepozná ako dokumenty; ostávajú vo výbere zdrojov na `/ask` a v registri.
- **Organizácia** — dlaždice bez zmeny. **Správa** — bez zmeny, len roly.
- **Knižnica na čítanie** (`/library`, `LibraryReader`): pribúda
  `.view-switch` **Všetky · Smernica · Zákon · Manuál · …** (`?kind=<key>`
  — kľúč číselníka `category`; `zakon` zahŕňa aj predpisy z katalógu),
  voľby len pre druhy, ktoré v zozname sú; riadok dostane druh do meta.
  Hľadanie ostáva. Predpisy z katalógu sú v zozname s odkazom na C.

### Prečo

- Štyri dlaždice a dva panely hovoria to isté dvakrát (3 na potvrdenie
  hore aj dole); „Novinky" sú knižnica z druhej strany. Jeden zoznam úloh
  a jeden zoznam dokumentov sú dve otázky, ktoré bežný človek má: *čo odo
  mňa chcú* a *čo mám k dispozícii*.
- Delenie Knižnica / Ďalšie zdroje je delenie podľa toho, odkiaľ obsah
  prišiel — to vie správca, nie čitateľ. Druh dokumentu je delenie podľa
  toho, čo to je (ADR-027, D179), a to vie každý.

### Rámy

- **1440** — Moje úlohy a Dokumenty pod sebou na celú šírku (nie dva stĺpce:
  riadky s chipom, metou a akciou potrebujú šírku); Organizácia v mriežke
  dlaždíc ako dnes.
- **834** — rovnaké, akcia riadku pod metou vpravo.
- **390** — riadok v stĺpci (názov / meta / chip + akcia 44 px); päta
  panelu ako dnes.
- Stavy: bez úloh (prázdny stav dva riadky) · bez dokumentov · človek
  s rolami (Správa pod tým; v Moje úlohy aj kolá schválenia).

### Bez JavaScriptu · i18n · dáta

Všetko odkazy. i18n: `overview.tasks.heading` „Moje úlohy",
`overview.tasks.actions.*` (open, decide, continue, start),
`overview.documents.heading` „Dokumenty", `overview.documents.newChip`
„nové", `overview.documents.all` „Všetky dokumenty", `library.reader.kind.all`
„Všetky"; `overview.available.*` (#447) a `overview.tiles.*` zanikajú.
Dáta ✅ (`acknowledgementDuties`, `roundsWaitingFor`, `recentLibrary`,
`subscribedActs`, `codelistFor("category")`); kurzy/testy s termínom —
overiť, čo `learning` vie dať pre osobu (`myCourses`?). `?kind=` je nový
parameter adresy.

🔴 Zmena schémy: **žiadna** v A ani C.

---

## Otázky pre Jána

- **Q1** — Má čitateľ vidieť aj znenie s účinnosťou **v budúcnosti**
  (zverejnené, platí od 1. 1. 2027)? (návrh: **áno**, so štítkom „platí od
  …" ako pri zákone — človek, ktorému sa od januára mení poriadok, si ho
  chce prečítať vopred; potvrdzuje sa stále len platné)
- **Q2** — Panel Dokumenty: 6 riadkov ako dnes, alebo 8? (návrh: **6**;
  dva panely pod sebou s 8 riadkami zatlačia Organizáciu pod ohyb na
  notebooku)
- **Q3** — Zodpovedná osoba pri **zákone**: katalóg ju nemá. Doplniť ju
  k odberu (`law_subscriptions.responsiblePerson`) neskôr, alebo nič?
  (návrh: **neskôr, samostatne** — dnes riadok vynechať; je to zmena
  schémy a vlastné rozhodnutie)

## Rozhodnuté

- 26. 10. 2026, Ján: poradie B → C → A; v hlavičke bežnému **neukazovať**
  Priečinok, Prístup, Značky ani počet potvrdení.
