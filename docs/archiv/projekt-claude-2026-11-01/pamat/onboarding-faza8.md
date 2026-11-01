---
name: onboarding-faza8
description: "Fáza 8 Continea — onboarding a potvrdzovanie noriem pre SFZ na internal.futbalsfz.sk; kľúčové rozhodnutia a prečo"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# Fáza 8 — Onboarding a potvrdzovanie noriem (rozhodnuté 2026-08-27)

**Zadanie:** SFZ má nové smernice, 100+ ľudí ich musí potvrdiť („prečítal som"), termín ~týždeň.
Musí pokryť aj ľudí BEZ licencie M365 (externí tréneri, rozhodcovia, funkcionári).

**Doména: `internal.futbalsfz.sk`** (NIE vitaj.futbalsfz.sk — používateľ zmenil 2026-08-27).
Doména nad jedným nasadením Continea, nie samostatný projekt. Pozicionuje portál ako
interný portál zväzu, kde je onboarding jedna z častí.

## Uzavreté rozhodnutia

- Nositeľ = **Contineo**, nie ClubUp (ten zostáva solo LMS s akreditáciou ŽU), nie nový projekt.
- **Contineo NEDOSTÁVA LMS vrstvu.** Hranica: „onboarding dokladuje, že si čítal; LMS overuje, či si pochopil."
- [stated] 2026-09-17: tréneri, ktorým používateľ Contineo ukázal, by LMS chceli; používateľ zvažuje, že ClubUp by po funkčnej stránke bežal priamo na platforme Contineo (využiť LMS/CMS obsah aj na interné vzdelávanie zamestnancov a trénerov) — nerozhodnuté, otvára znova hranicu vyššie.
- Akútny týždeň: **žiadne premostenie cez M365** — ide sa rovno ultra-MVP v Contineu (užívateľ chcel tak či tak začať programovať app). M365 by nepokryl externistov a záznamy by prišli o IP a väzbu na znenie.
- Právna váha potvrdenia: **klik + auditný záznam** (nie eIDAS podpis).
- Prihlásenie ľudí bez M365: **magic-link e-mail** (Ecomail, už existuje).
- Rozsah prvej ostrej verzie: **B** = potvrdzovanie + guided reading (nie celý portál s obsahovými stránkami — tie sú rozsah C a čakajú na CMS-Web).
- **D28 formulka:** „Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label}, platná od {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať." NIE „súhlasím" — pri vnútornom predpise je súhlas právne zvláštny. Ukladá sa doslovne do `statementText`, takže neskoršia úprava právnikom nevyžaduje migráciu.
- **O12 hosting:** zostávame na **Verceli + Static IPs** (plán Pro, 100 $/mes. na projekt). Preverené aj Render a Railway (dedikované IP na Pro, ale je to pohyb do strany), vlastný stroj v EÚ (Hetzner/Websupport/Scaleway — vecne najsilnejšie, posúva aj T2 a eu-full, ale prevádzka je naša) a Vercel + SOCKS5 proxy (zamietnuté — vlastný stroj v kritickej ceste každého dotazu do DB). Presun z Vercelu zostáva dlhodobým smerom.
- **D31 Atlas tier:** prechod **M0 → M10+ pred prvým ostrým potvrdením**.
- **D32 viditeľnosť (opravené):** každý `companyCode` vidí **len svoje** záznamy a obsah; cudzie len keď je **menovite zdieľané** cez `sharedWithCompanyCodes[]` (alebo je `accessLevel: public`). **`companyCode.parent` neudeľuje prístup.** Detail v [[contineo-project]].
- **D33 HR:** HR vidí potvrdenia **len svojho `companyCode`** — nie potomkov, nie nadradenú jednotku, nie sesterské. Centrála potrebuje explicitné, zaznamenané oprávnenie. Osoba môže byť v `person_memberships` viackrát, ale záznam o potvrdení patrí jednej jednotke — tej, ktorej trasa ho vyvolala.

## Dokumenty (2026-08-27, stav „návrh na schválenie")

- `docs/ADR-003-onboarding-a-potvrdzovanie.md` — zaradenie a architektonické dôsledky
- `docs/ONBOARDING_KONCEPCIA.md` — dátový model, toky, fázovanie, role
- Upravené: `OPEN_DECISIONS.md` (D24–D34), `Contineo_RAG_Projektovy_plan.md` (Fáza 8),
  `DATA_MODEL_konzistencia.md`, `TODO.md` (sekcia I), `rag-architecture.md`, `CMS_KONCEPCIA.md`, `ATLAS_SETUP.md`, `WEB_UNIVERZALNY_POZICIONING_PLAN.md`, `CHANGELOG.md`
- Commity na main: `34d0dfa` (ADR + koncepcia), `2c208ed` (O12 + D31), `7e60103` (diagram + D32–D34), `8c26cbe` (oprava D32/D33 + doplnený `docs/O7_plan_overenia.md`)

## Číslovanie rozhodnutí — pozor

D16 a D17 obsadili rozhodnutia o extrakcii z PDF, hoci `CMS_KONCEPCIA.md` avizovala D16+ pre
D-CMS-1..6. **D18–D23 sú rezervované pre D-CMS-1..6**, ďalšie rozhodnutia idú od **D24** (zatiaľ po D34).
Otvorené body ADR pokračujú od **O12** (O1–O11 sú v ADR-002 a `O7_plan_overenia.md`).

## Technické nálezy, ktoré z toho vyplynuli

- `documents` NEMÁ `versions[]` — je plochý. Onboarding ho musí zaviesť **skôr než CMS**, inak je potvrdenie právne bezcenné. Vzniká v cieľovom tvare pre CMS.
- **Verzovanie je povinnosť celého systému, nie potreba onboardingu** (potvrdil používateľ). `documents` je spoločné úložisko pre obsah zo všetkých vstupných kanálov. Dve pravidlá (D25): zmena `contentHash` = nová položka vo `versions[]`, nikdy prepis; a **kanál nikdy nezneplatní platnú verziu sám** — nová prichádza ako `isActive:false`, `effectiveFrom` určí kurátor. Dôsledok: automatický import nikdy sám nepošle sto ľudí potvrdzovať znova.
- `src/lib/auth.ts` drží povolené adresy v env `POVOLENE_EMAILY` (zámerne, pre 5–10 ľudí). Pri stovke to nestačí → nová kolekcia `persons` nad existujúcou `auth_users`. Env zostáva ako núdzová brzda.
- `src/lib/tenantProfile.ts` vracia `defaultProfile()` — treba profil podľa hostiteľa; neznámy hostiteľ = zakázaný (pravidlo z ADR-002).
- **Onboarding nevolá žiadny model** → prvá časť Continea, ktorá spĺňa `eu-full` bez riešenia O7.
- **Cluster beží na M0, ktorý nemá zálohy.** Auditný záznam bez zálohy nie je auditný záznam — väčšie riziko než otvorený allowlist, lebo strata dát nepotrebuje útočníka. Na M0 navyše neexistuje privátny endpoint (len dedikované clustery M10+). Pri prechode zapnúť auto-scaling úložiska AJ tieru, strop aspoň M30 (vyžaduje Automated Embedding).

## Dve brány pred prvým ostrým potvrdením (nie pred vývojom)

1. Atlas **M10+** so zálohami (D31)
2. **Vercel Static IPs** zapnuté + Atlas allowlist zúžený z `0.0.0.0/0` na tie IP (O12)

Ultra-MVP sa smie dovyvinúť na dnešnej zostave; skutočný človek nepotvrdí nič, kým obe nestoja.

## Čaká na ľudí, nie na kód

- D30/O13 — čo je „podstatná zmena" vyžadujúca opätovné potvrdenie (HR + legislatívec). Pole `requiresReacknowledgement` vypĺňa človek, nikdy sa neodvodzuje z diffu.
- O14 — meriame čas nad dokumentom / doskrolovanie? Rozhodnúť PRED implementáciou.
- O15, O16 — právny základ (návrh: oprávnený záujem, nie súhlas) a retencia po skončení pracovného pomeru.
