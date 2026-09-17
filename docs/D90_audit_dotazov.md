# D90 — audit dotazov: má každý `companyCode` v podmienke?

> **Stav:** ✅ **všetky nálezy A, B a C opravené 2026-09-17** (Ján: „oprav všetko, čo si našla") —
> commity `5aa9608` (A1–A4), `1125fe4` (A5), `4e83bf3` (B1–B3), `8c6a386` (C1–C5). Pôvodný výpis
> nižšie zostáva ako zápis stavu pred opravou.
>
> **Pôvodný stav:** výpis nálezov, bez opráv (zadanie Jána Letka 2026-09-17: opravy až po schválení).
> **Nadväzuje na:** `OPEN_DECISIONS.md` D90 (tenanti oddelení galvanicky), D32 („`companyCode`
> patrí do podmienky dotazu, nie do kontroly nad ním").
> **Metóda:** skript prešiel všetky volania `find/findOne/aggregate/countDocuments/update*/delete*/
> replaceOne/distinct` v `app/src` a `app/scripts` **vrátane viacriadkových** a vypísal tie, v ktorých
> texte volania `companyCode` nie je (149). Tie, kde je podmienka v premennej, som dohľadal ručne.
> Grep po riadkoch na to nestačil — väčšina dotazov je na viacerých riadkoch.

## Zhrnutie

- **Únik obsahu cez hranicu tenanta sa nenašiel** — ten jediný (chat) opravil D90.
- **Tri miesta dovoľujú zápis do záznamu inej organizácie**, keď človek pozná jeho `_id`
  (ObjectId nie je tajomstvo — skladá sa z času a počítadla). Všetky tri sú v hodnoteniach a kurácii.
- **Jedna funkčná chyba:** osoba s tou istou adresou v dvoch organizáciách sa načíta náhodne.
  Zlyhá hlučne („nemáte prístup"), nič neotvorí.
- Zvyšok je buď zámerne naprieč (správa platformy, cron, prihlásenie), alebo bezpečný dnes,
  lebo identifikátory prichádzajú z dotazu už obmedzeného na organizáciu.

## A. Skutočné medzery — navrhujem opraviť

| # | Kde | Čo | Dôsledok | Návrh |
|---|---|---|---|---|
| A1 | `lib/ratings.ts` `saveVerdict(id)` | `updateOne({ _id })` | hodnotiteľ **ktorejkoľvek** organizácie zapíše posudok do záznamu inej, keď pozná `_id`; posudok ovplyvní frontu aj kuráciu tej organizácie | `companyCode` z prihlásenej osoby do podmienky |
| A2 | `lib/ratings.ts` `saveReaderFeedback(id)` | `updateOne({ _id })` | ktorýkoľvek prihlásený zapíše „nesedí" + poznámku k odpovedi inej organizácie | to isté |
| A3 | `lib/curation.ts` `saveCurationDraft(recordId)`, `publishCuration(recordId)` | záznam sa načíta podľa `_id`, organizácia sa berie **zo záznamu**, nie z konajúceho | hodnotiteľ A pripraví pár nad záznamom B; správca obsahu A ho **zverejní do znalostí B** | `companyCode` konajúceho do podmienky; záznam inej organizácie = „neexistuje" |
| A4 | `lib/ratings.ts` `recordAnswer()` | `companyCode` nepovinné | záznam o odpovedi bez organizácie; do žiadnej fronty sa nedostane, ale leží v kolekcii | po D90 má chat organizáciu vždy → povinné |
| A5 | `api/brand/[code]/route.ts` | logo sa vydá podľa kódu v adrese na **ktorejkoľvek** doméne | `localhost/api/brand/sfz` → logo SFZ na portáli LTK (overené); prezradí, že organizácia existuje | kód musí byť tenant domény, inak `404` |

## B. Funkčná chyba — hlučná, nič neotvára

| # | Kde | Čo | Dôsledok |
|---|---|---|---|
| B1 | `lib/session.ts` `currentPerson()` → `findPerson(email)` | osoba sa hľadá **len podľa e-mailu** | kto je v dvoch organizáciách s tou istou adresou, dostane náhodne jeden záznam; na portáli druhej organizácie uvidí „nemáte prístup" (kontexty porovnávajú `person.companyCode` s tenantom, preto hlučne) |
| B2 | `lib/persons.ts` zápisy pri prihlásení (`lastLoginAt`, `firstLoginAt`, `status: active`, externé ID) | `updateOne({ email })` | pri osobe v dvoch organizáciách sa zapíše len do jedného záznamu — evidencia prihlásení druhej organizácie klame |
| B3 | `scripts/person.mjs`, `scripts/admin_set.mjs` | podľa e-mailu bez `--company` | ten istý problém v správcovských skriptoch |

**Návrh:** osoba = (tenant domény, e-mail). `personMaySignIn()` môže zostať podľa e-mailu
(prihlásenie ešte doménu tenanta nemusí mať), ale všetko po ňom pracuje s dvojicou.

## C. Obrana do hĺbky — dnes bezpečné, navrhujem sprísniť

Identifikátory tu pochádzajú z dotazu už obmedzeného na organizáciu alebo z relácie, takže sa cez
hranicu nedá dostať. Pravidlo D32 („identifikátory sa dajú uhádnuť") ale hovorí, že na tom stavať
netreba — a D90, že filter má byť **vždy**.

| # | Kde | Čo |
|---|---|---|
| C1 | `lib/acknowledgements.ts` `validAcknowledgements()` | `companyCode` nepovinné; bez neho volajú `hrReport.ts:233`, `libraryProgress.ts:87`, `acknowledgements.ts:417, 448, 567` |
| C2 | `lib/acknowledgements.ts` `personAcknowledgements(personId)` | len `personId` |
| C3 | `lib/readingTime.ts` `readingFor()`, `readingTimes()` | `{ personId, versionId }` |
| C4 | `lib/libraryWrite.ts` `uploadDocument()` (`findOne({ documentId })`) a úseky podľa `documentId` (riadky 538, 701, 832, 854) | organizáciu nesie len predpona `documentId` (`sfz:…`); volajúci dokument predtým načítali s `companyCode` |
| C5 | `lib/documents.ts` `loadDocument()`, `recordVersion()` | podľa `documentId`; čítanie ide cez `loadDocumentFor()` s `canSeeDocument()` |

**Návrh:** C1 urobiť povinným rovnako ako v `mongoSearch.ts` (výnimka pri chýbajúcej organizácii);
C2–C5 doplniť `companyCode` do podmienky, keď sa budú tie súbory meniť, nie samostatnou akciou.

## D. Zámerne naprieč organizáciami — v poriadku

`tenants` podľa domény (`resolveTenant`, `customerDomains`), naplánovaný beh `/api/cron/overdue`,
retencia `notifications`, `auth_users` a overovacie tokeny NextAuth (`authAdapter.ts`), správa
platformy (`admin.ts`, `tenantAdmin.ts` — D41, len prehľadové údaje), `personMaySignIn()`.

Migračné a diagnostické skripty (`migrate_*`, `reembed`, `audit_chunks`, `atlas_check`, `status`,
`check` bez `--company`, `ratings_overview`) bežia naprieč zámerne — spúšťa ich správca a nič
nezobrazujú človeku organizácie. `smoke` a `rerank_compare` po D90 hľadajú v jednej organizácii.

## Ako sa opravilo

- **Spoločné pravidlo** je v `src/lib/tenantScope.ts`: `requireCompanyCode()` vyhodí
  `MissingTenantError`, keď organizácia chýba. Používa ho vyhľadávanie aj všetky opravené miesta.
- **A1–A4:** posudok, spätná väzba aj kurácia hľadajú záznam podľa `_id` **a** organizácie konajúceho;
  `recordAnswer()` organizáciu vyžaduje; `/api/rating` berie organizáciu z `onboardingContext()`.
- **A5:** logo sa vydá len na doméne svojej organizácie; výnimka pre `platform-admin` na doméne
  dodávateľa, s `Cache-Control: private, no-store`.
- **B1–B3:** osoba = (organizácia domény, adresa) v `currentPerson()`, pri prihlásení, v evidencii
  prihlásení aj v skriptoch `person.mjs` a `admin_set.mjs`. **Prihlásenie na doméne organizácie, kde
  človek nie je, sa odmietne už pri žiadosti o odkaz** (predtým až stránkou). Núdzová brzda
  `ALLOWED_EMAILS` sa nemenila.
- **C1–C5:** povinná organizácia vo `validAcknowledgements()`, v časoch čítania, pri načítaní dokumentu
  a pri práci s úsekmi podľa `documentId`.

Pred zmenou overené na ostrých dátach: potvrdenia (7), časy čítania (6) aj hodnotenia (10) majú
organizáciu zhodnú s osobou; žiadna adresa nie je v dvoch organizáciách; dokumenty majú predponu
`documentId` zhodnú s organizáciou. 115 úsekov bez dokumentu sú archivované úseky zmazaného
`sfz:nacvik_dp` (O19), nie iná organizácia.

## Mimo auditu, ale zistené pri ňom

- **Funkcie produkcie bežia v regióne `iad1` (USA, Washington)** — `get_deployment` pre `contineo-app`.
  Atlas je vo Frankfurte. Či je to v súlade s ADR-002 (rezidencia) a O18, **neviem** — v dokumentácii
  som `iad1` ani `fra1` nenašiel. Otázka pre Jána, nie zmena.
- **Logo v upozorňovacích e-mailoch je relatívna adresa.** Prihlasovací e-mail ju robí absolútnou
  (`auth.ts`), ale e-maily z cronu (`/api/cron/overdue`), schvaľovania (`notifyApprovers`) a pozvánok
  posielajú `brandingView(tenant).logoUrl` tak, ako je — `/api/brand/sfz?v=…`. V schránke nemá byť
  k čomu relatívna. Či to poštoví klienti zobrazia, **neoverené**; nesúvisí s oddelením tenantov,
  preto neopravené — zapísané v `TODO.md`.
