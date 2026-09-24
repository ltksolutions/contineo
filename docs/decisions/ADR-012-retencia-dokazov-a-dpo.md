# ADR-012 — Retencia reťaze dôkazov, rola DPO a námietka

> **Stav:** prijaté · **Dátum:** 2026-09-24
> **Zadal:** DPO SFZ (Švehlová) — odpovede k O15/O16, druhé kolo (2026-09-24),
> `docs/O15_O16_otazky_pre_DPO.md`
> **Odsúhlasil:** Ján Letko (2026-09-24) — strop **5 rokov**; strop len pre
> **vyradené** osoby; nová rola **DPO**; mazanie sa zapína **najprv ako výkaz**,
> ostro až po kontrole.
> **Nadväzuje na:** ADR-005 (reťaz dôkazov), ADR-006 (schvaľovanie), D24, D27,
> D91, D92, O15, O16
> **Mení:** D24 — dôkazné záznamy sa **po uplynutí lehoty mažú**. Nemenia sa
> ďalej a nemažú sa inak než touto dávkou alebo rozhodnutím o námietke.
> **Implementácia:** po krokoch, viď kap. 6.

---

## 1. Čo sa zmenilo

Doteraz platilo D24 bez výnimky: potvrdenie, pridelenie, otvorenie a kolo
schvaľovania sa nemenia ani nemažú. Bolo to správne, kým lehota nebola určená.
Mazať skôr by znamenalo stratiť doklad, ktorý sa ešte môže hodiť. Nemazať nikdy
je však v rozpore so zásadou minimalizácie uchovávania (čl. 5 ods. 1 písm. e) GDPR).

DPO v dvoch kolách určila (O15/O16):

| | Rozhodnutie |
|---|---|
| B1a | doklad o oboznámení sa drží **3 roky od skončenia pomeru** |
| B10b | pri osobách bez pracovného pomeru plynie lehota od **skončenia vzťahu so zväzom** |
| B10a | keď dátum skončenia nepríde, plynie lehota od **vyradenia**; absolútny strop **5 rokov** |
| B8 | po lehote sa záznam **maže celý**, neanonymizuje sa |
| B4a, B11 | schválenie a zodpovedná osoba sa držia, **kým existuje aspoň jeden doklad** o oboznámení so znením |
| B5, B7 | čas čítania 12 mesiacov, log pripomienok 90 dní (bez zmeny) |
| B6 | audit **24 mesiacov** |
| A8 | námietka pri oprávnenom záujme sa posúdi jednotlivo; doklad sa do rozhodnutia nemaže |
| A10 | právny základ určuje zodpovedná osoba, DPO ho **raz za štvrťrok** kontroluje |

---

## 2. Rozhodnutie

### D100 — Odkedy plynie lehota

Pri osobe sa evidujú dva dátumy:

- **`endedAt`** — skončenie pomeru alebo vzťahu so zväzom (koniec licencie,
  funkcie, spolupráce). Zadáva ho **HR** na karte osoby. Je to údaj z personalistiky,
  systém ho sám nevie.
- **`deactivatedAt`** — kedy bola osoba v systéme vyradená. Zapisuje sa pri vyradení
  a pri vrátení sa maže.

**Prečo sa `deactivatedAt` ukladá, keď je v audite** (výnimka z D27): audit sa
po 24 mesiacoch maže (D103), lehota dokladov je dlhšia. Dátum, od ktorého lehota
plynie, nesmie zmiznúť skôr než doklady, ktorých sa týka. Existujúce vyradenia
sa doplnia z auditu migráciou.

**Kedy sa doklady osoby zmažú:**

| Osoba | Lehota |
|---|---|
| vyradená, `endedAt` známy | 3 roky od `endedAt` |
| vyradená, `endedAt` chýba | 3 roky od `deactivatedAt` (poistka 1) |
| vyradená, nemá ani jeden dátum | **5 rokov od poslednej udalosti** v reťazi: potvrdenie, otvorenie alebo pridelenie (poistka 2, strop) |
| aktívna alebo pozvaná | **nič sa nemaže** |

**Strop sa na aktívne osoby nevzťahuje** (Ján, 24. 9.). Aktívnemu človeku by
zmiznuté doklady znamenali, že mu predpisy naskočia ako nepotvrdené, a doklad
o oboznámení s platným predpisom je dôvod, pre ktorý systém existuje. Aktívne
osoby, ktoré 5 rokov nič nepotvrdili ani neotvorili, sa **vypíšu HR na kontrolu**
(„je ešte vo zväze?"). Keď HR osobu vyradí, platia riadky vyššie.

### D101 — Čo sa maže

Pri osobe po lehote, v rámci jej organizácie (`companyCode` v podmienke, D32):

- `acknowledgements` — všetky záznamy osoby (potvrdenie, odvolanie aj oprava);
- `document_opens` — všetky otvorenia osoby;
- `assignments` — pridelenia **osobe** (`audience.kind = person`). Pridelenia
  skupine, útvaru alebo trase sa týkajú mnohých a zostávajú;
- `reading_times` sa maže samo po 12 mesiacoch (TTL).

**Kolo schvaľovania a zodpovedná osoba znenia (B4a, B11)** sa zmažú, keď
po výmaze nezostane **žiadny** doklad o oboznámení s tým znením **a** znenie už
nie je platné. Platné znenie si kolá drží vždy: jeho stav sa z kôl odvodzuje
(D27) a bez nich by zverejnené znenie vyzeralo ako neschválené. Pri znení sa
maže `responsiblePerson` a `responsibleChanges`; text, PDF a právny základ
zostávajú, lebo nie sú osobným údajom.

**Osoba samotná (`persons`) sa zatiaľ nemaže.** Otázka „zmazať, anonymizovať
alebo nechať" (`ZALOHOVANIE_A_RETENCIA.md`, kap. 3) je samostatná a DPO na ňu
neodpovedala. Po výmaze dokladov na osobu nič neukazuje, takže ju jej ďalší
osud neobmedzuje.

### D102 — Ako sa maže: dávka, výkaz, záznam o výmaze

- Maže **denná úloha** v existujúcom crone `/api/cron/overdue`, po upozorneniach,
  rovnako ako `purgeExpired()`. Nová položka vo `vercel.json` nevzniká.
- **Režim** určuje premenná `RETENTION_MODE`:
  - `report` (predvolený) — úloha len spočíta, čo by zmazala, a vráti to vo
    výsledku cronu;
  - `delete` — maže.
  Ostré mazanie zapne Ján na Verceli, keď uvidí výkaz.
- Každý výmaz zapíše **záznam o výmaze** do `retention_log`: organizácia,
  `personId`, dôvod (lehota alebo námietka), dátum a počty po kolekciách. Nie je
  v ňom meno ani e-mail. Záznam slúži na **zopakovanie výmazu po obnove zo zálohy**
  (`ZALOHOVANIE_A_RETENCIA.md`, kap. 5). Drží sa **13 mesiacov** (TTL), teda
  dlhšie než najdlhšia plánovaná retencia záloh. Po jej overení sa lehota zosúladí.
- Mazanie je **jediná** cesta, ktorou doklad zanikne. Mimo tejto dávky
  a rozhodnutia o námietke (D105) platí D24 ďalej: záznam sa nemení, oprava je
  nový záznam.

### D103 — Audit 24 mesiacov

`audit` dostane TTL index na `at` s lehotou 730 dní. Maže databáza sama. Audit
vznikol v auguste 2026, takže zavedenie indexu dnes nič nezmaže.

### D104 — Rola **DPO** a štvrťročný výkaz právnych základov

- Nová rola `dpo`, prideľuje sa v Ľuďoch ako ostatné roly.
- DPO má vlastnú stránku **`/dpo`**:
  - **výkaz právnych základov** — každé platné znenie, jeho právny základ, odkaz
    na predpis, zodpovedná osoba a čo chýba; aj ako CSV;
  - **námietky** (D105).
- **Raz za štvrťrok** (prvý deň kvartálu, v dennom crone) dostane každá osoba
  s rolou `dpo` e-mail s počtami a odkazom na výkaz. Odoslanie sa zapíše, takže
  opakovaný beh cronu v ten istý deň druhý e-mail nepošle.
- Právny základ ďalej určuje zodpovedná osoba (D91). DPO ho **kontroluje**,
  neschvaľuje (A10).

### D105 — Námietka (čl. 21)

- Námietku **zaeviduje HR alebo DPO** na karte osoby: kedy a ako prišla a jej znenie.
- **Rozhoduje DPO** — `vyhovené` alebo `zamietnuté`, s odôvodnením.
- Do rozhodnutia sa **nič nemaže**.
- **Vyhovené:** zmažú sa doklady osoby pri zneniach, ktorých právny základ bol
  v čase potvrdenia **oprávnený záujem**. Pri zákonnej povinnosti sa námietka
  neuplatňuje, tie doklady zostanú. Výmaz ide tou istou cestou ako pri lehote
  (D102), s dôvodom `objection`. Zápis sa robí vždy ostro a nezávisí od
  `RETENTION_MODE` — o výmaze rozhodol človek, nie dávka.
- **Zamietnuté:** nič sa nemaže; odôvodnenie zostáva pri námietke.
- Námietka je sama osobný údaj. Zmaže sa spolu s ostatnými dokladmi osoby (D101).

---

## 3. Čo sa tým vedome kazí

- **Doklad po lehote nie je.** Spor, ktorý príde po 3 rokoch od odchodu, sa
  dokladom z Continea nepodloží. Lehotu určila DPO, nie IT.
- **Pridelenie skupine po výmaze neukáže, že daný človek bol jej členom.**
  Pridelenie skupine zostáva a osoba z neho zmizne spolu s dokladmi. Je to
  správne: doklad o nej už nemá byť.
- **Zálohy.** Zmazaný záznam žije v snímkach, kým neexpirujú. Pri obnove sa výmazy
  zopakujú podľa `retention_log`.

---

## 4. Čo tento dokument nerieši

- Osud záznamu osoby (`persons`, `auth_users`, `person_photos`) po výmaze dokladov.
- Retenciu `evaluations` (12 mesiacov je návrh, nie rozhodnutie).
- Informovanie zamestnancov (C1), záznam o spracovateľských činnostiach (C2)
  a DPIA (C3) — texty sú v `docs/C1_…`, `docs/C2_…`, `docs/C3_…`.

---

## 5. Súvisiace dokumenty

`docs/O15_O16_otazky_pre_DPO.md` · `docs/GDPR_DATA_PROTECTION.md` §4, §6 ·
`docs/ZALOHOVANIE_A_RETENCIA.md` kap. 3, 5

---

## 6. Implementácia

Po krokoch, každý samostatný PR:

1. Dátumy pri osobe: `deactivatedAt` pri vyradení, `endedAt` na karte osoby,
   migrácia z auditu; TTL na `audit` (D100, D103).
2. Retenčná dávka v režime `report`/`delete`, `retention_log`, výpis aktívnych
   bez udalosti 5 rokov (D100–D102).
3. Rola `dpo`, stránka `/dpo` s výkazom právnych základov a štvrťročný e-mail (D104).
4. Námietky (D105).
5. Informovanie zamestnancov v rozhraní (C1).
