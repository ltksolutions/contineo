# ADR-003 — Onboarding a potvrdzovanie noriem ako schopnosť Continea

> **Stav:** návrh na schválenie · **Dátum:** 2026-08-27
> **Nadväzuje na:** `docs/ADR-001-provider-adaptery.md` (adaptéry), `docs/ADR-002-datova-rezidencia.md` (rezidencia a izolácia)
> **Súvisiace:** `docs/ONBOARDING_KONCEPCIA.md`, `docs/PRISTUPOVE_PRAVA.md`, `docs/CMS_KONCEPCIA.md`, `docs/GDPR_DATA_PROTECTION.md`, `docs/DATA_MODEL_konzistencia.md`
> **Implementácia:** zatiaľ žiadna — toto rozhodnutie predchádza kódu.

> ⚠️ Tento dokument nie je právne posúdenie. Dôkazná hodnota potvrdenia a retencia
> záznamov patria právnikovi a DPO (otvorené body O15, O16).

---

## 1. Čo problém odhalilo

SFZ prijal nové smernice vo Worde. Vyše sto zamestnancov si ich má prečítať a potvrdiť,
že ich prečítali a súhlasia s nimi. Termín je **týždeň**.

Prvá odpoveď sa ponúkala sama: SharePoint, Microsoft Forms s povinným prihlásením,
Power Automate na pripomienky. Za deň hotové. Pri bližšom pohľade sa ale ukázalo, že
zadanie nie je *„dajme podpísať štyri smernice"*, ale *„zaveďme jednotný vstup do
organizácie"*. To je iná úloha a M365 ju nerieši ani náhodou.

### Prečo to nie je jednorazová úloha

**Opakuje sa.** Netýka sa len dnešných zamestnancov, ale každého, kto do SFZ nastúpi.
Jednorazová kampaň by o pol roka nemala kto zopakovať a o rok by nikto nevedel, či
sa vôbec konala.

**Netýka sa len zamestnancov.** Externí tréneri, rozhodcovia a funkcionári nemajú
licenciu M365. Práve oni sú pritom tí, ktorých vzťah k organizácii je najvoľnejší a
u ktorých je doložené oboznámenie s pravidlami najcennejšie. Riešenie, ktoré ich
nepokrýva, rieši ľahšiu polovicu problému.

**Smernice sa menia.** Pri každej novelizácii vzniká otázka, kto musí potvrdiť znova —
a to sa nedá zodpovedať zo zoznamu odpovedí vo Forms, ktorý nevie, ktoré znenie
človek videl.

**Onboarding je viac než dokumenty.** Uvítanie, organizačná štruktúra, úlohy prvého
týždňa, kontakty. Potvrdzovanie noriem je jeden krok z niekoľkých, nie celý produkt.

---

## 2. Kto to má niesť — tri kandidáti

| Kandidát | Čo hovorí pre | Čo hovorí proti |
|---|---|---|
| **ClubUp** | existujúci systém pre vzdelávanie, má používateľov, má obsahovú vrstvu | je to **LMS s akreditáciou ŽU** — kurzy, testy, certifikáty. Onboarding do organizácie nie je vzdelávanie a pridaním by sa ClubUpu rozostrila identita. Akreditovaný produkt sa neohýba kvôli cudziemu use-case. |
| **Nový projekt** | čistý štít, žiadne kompromisy | postavil by druhýkrát to, čo Contineo už má: multi-tenant hierarchiu, prístupové práva, správu dokumentov s verziami, prihlásenie bez hesla. A vznikol by tretí systém na údržbu. |
| **Contineo** | má **všetky** podkladové vrstvy (nižšie), doménovú univerzálnosť má priamo v pozicionovaní | onboarding predbehne fázy 4 a 5, ktoré ešte nie sú hotové (kap. 7) |

### Čo z Continea sa použije bez zmeny

| Potreba onboardingu | Čo v Contineu už je |
|---|---|
| viac organizácií, hierarchia | `companyCode` + `parent` — `PRISTUPOVE_PRAVA.md` kap. 8 |
| kto čo smie vidieť | `accessLevel` `public`/`internal`, ABAC, default-deny, `securityFilter()` |
| prihlásenie ľudí bez M365 | odkaz v e-maile cez Ecomail — `AKO_TO_BEZI.md` krok 0, `src/lib/auth.ts` |
| prihlásenie zamestnancov cez firemné konto | NextAuth provider Microsoft Entra ID — `PRISTUPOVE_PRAVA.md` kap. 4 (plán Fáza 5) |
| správa smerníc a ich znení | `documents` + `effectiveFrom/To` + `isActive` |
| **ktoré znenie platilo kedy** | `PRECEDENCIA_NORIEM.md` — právna platnosť oddelená od technickej verzie |
| štruktúra obsahu, kurátorský review | `CMS_KONCEPCIA.md` — `navigation`, `categories`, `contentType` |
| že to nie je len pre futbal | `WEB_UNIVERZALNY_POZICIONING_PLAN.md` |

Toto nie je zoznam náhod. Contineo je stavané ako systém, ktorý organizácii spravuje
jej vlastný záväzný obsah a vie, kto sa naň smie pozerať. Potvrdenie *„prečítal som"*
je prirodzené pokračovanie tej istej myšlienky — pridáva k obsahu druhú stranu vzťahu:
nielen **čo platí**, ale aj **kto o tom vie**.

---

## 3. Rozhodnutie

**Onboarding a potvrdzovanie noriem je nová schopnosť Continea.** Nie nový projekt,
nie rozšírenie ClubUpu.

ClubUp zostáva nezmenený ako solo LMS s akreditáciou ŽU.

### 3.1 Hranica voči LMS — čo onboarding zámerne nemá

Toto je najdôležitejšia veta celého ADR, lebo bez nej sa onboarding do roka zvrhne
na druhý LMS:

> **Onboarding dokladuje, že si čítal. LMS overuje, či si pochopil.**

| Vec | Patrí | Prečo |
|---|---|---|
| Zoznam dokumentov na prečítanie, poradie, stav dokončenia | **Contineo** | je to navigácia nad obsahom, nie výučba |
| Potvrdenie *„prečítal som a súhlasím"* + auditný záznam | **Contineo** | dôkaz o oboznámení, nie hodnotenie |
| `Course` / `Level` / `Module` / `Part` | ClubUp | štruktúra kurzu |
| Testy, otázky, bodovanie, opravné termíny | ClubUp | overovanie vedomostí |
| Certifikáty, akreditácia | ClubUp | má za tým ŽU |
| Video, lektor, platby | ClubUp | — |

Ak sa raz ukáže, že SFZ potrebuje ku smernici aj test, **nepridáva sa test do Continea** —
prepojí sa s ClubUpom. Contineo si o výsledku uloží nanajvýš odkaz.

### 3.2 Nasadenie: doména, nie projekt

Portál pobeží na **`intranet.futbalsfz.sk`** ako vlastná doména nad **jedným** nasadením
Continea, nie ako samostatná inštancia. Vyplýva to z multi-tenant architektúry, ktorá
už existuje — tenant je dátová vlastnosť (`companyCode`), nie samostatný beh aplikácie.

Praktický dôsledok: aplikácia musí vedieť **z hostiteľa určiť tenanta a vzhľad**. Dnes
to nevie (kap. 5.4).

**Meno domény niečo hovorí.** Pôvodne sa uvažovalo o `vitaj.futbalsfz.sk`; zvolené je
**`intranet.futbalsfz.sk`** (rozhodnuté 2026-08-27). Nie je to kozmetika — mení to
pozíciu portálu. „Vitaj" by sľubovalo uvítaciu bránu pre nováčikov, „internal" hovorí
**interný portál zväzu**, v ktorom je onboarding jednou z častí, nie celkom. Zodpovedá to
druhému režimu nasadenia z `PRISTUPOVE_PRAVA.md` (interný portál so SSO, `public` +
`internal`) a necháva to priestor pre chat nad normami, internú KB a helpdesk na tej istej
doméne, bez toho, aby meno prestalo sedieť.

> **Pozor na dvojznačnosť slova.** `internal` v doméne a `accessLevel: internal` sú dve
> rôzne veci. Doména hovorí, **kde** portál beží; `accessLevel` hovorí, **kto** smie vidieť
> konkrétny obsah. Na `intranet.futbalsfz.sk` môže byť aj `public` obsah a v dokumentácii
> ani v kóde sa tie dva významy nesmú zliať.

---

## 4. Prečo nie premostenie cez M365

Zvažovali sa tri cesty k tomu akútnemu týždňu:

| Cesta | Pokryje | Čo z toho zostane |
|---|---|---|
| SharePoint + Forms + Power Automate | len držiteľov licencie M365 | tabuľka odpovedí bez IP a bez väzby na znenie; neskôr migrácia |
| To isté + e-mailové odpovede pre ostatných | všetkých | k tomu ručná evidencia v Exceli a archív e-mailov |
| **Ultra-MVP priamo v Contineu** | **všetkých** | **cieľové záznamy, žiadna migrácia** |

**Rozhodnuté 2026-08-27: tretia cesta.**

Dôvod je vecný, nie estetický. Prvé dve cesty nechávajú nepokrytú práve tú skupinu,
kvôli ktorej sa portál stavia — a keby stačilo pokryť zamestnancov s M365, nebol by
dôvod stavať portál vôbec. Zároveň by vznikli záznamy v inom tvare, než aký potrebujeme,
a migrácia by prišla o dve veci, ktoré sa spätne nedoplnia: IP adresu a jednoznačnú
väzbu na konkrétne znenie smernice.

**Cena rozhodnutia je riziko termínu.** Týždeň je málo a ultra-MVP nemá záložnú cestu.
Ako sa to riziko drží v uzde, je v `ONBOARDING_KONCEPCIA.md` kap. 7 — v skratke:
najprv ide do prevádzky potvrdzovanie, nie dashboard, a HR dostane výkaz aj keby ho
mal prvý týždeň generovať skript z príkazového riadka.

---

## 5. Čo z toho plynie pre architektúru

### 5.1 Potvrdenie je záznam, nie príznak

Prvá myšlienka býva pridať do `documents` pole *„kto potvrdil"*. To je chyba, ktorú by
sme objavili až pri prvom spore.

Potvrdenie musí byť **samostatný, nemenný záznam** v novej kolekcii `acknowledgements`,
ktorý nesie **znenie formulky v podobe platnej v čase potvrdenia**. Nie odkaz na text
formulky — samotný text. Keby sa formulka o rok upravila, všetky staré záznamy by
inak spätne tvrdili niečo, s čím nikto nesúhlasil.

Kolekcia je **append-only**: potvrdenie sa nikdy neprepisuje ani nemaže. Odvolanie
alebo oprava je nový záznam, nie úprava starého. Auditný záznam, ktorý sa dá upraviť,
nie je auditný záznam.

### 5.2 Potvrdenie sa viaže na znenie, nie na dokument

Otázka, na ktorú musí systém vedieť odpovedať, neznie *„potvrdil Novák Smernicu o GDPR?"*,
ale *„potvrdil Novák **to znenie** Smernice o GDPR, ktoré bolo platné v čase, keď mal
podľa nej konať?"*. Preto záznam nesie `versionId`, nie len `documentId`.

**Tu je konkrétny nález:** `documents` dnes **nemá** `versions[]`. Schéma v
`rag-architecture.md` je plochá (`status: draft|published`, `contentHash`) a
`versions[]` je zatiaľ len zámer v `CMS_KONCEPCIA.md` (A.3) a v `TODO.md`.
`versionId` existuje na `document_chunks`, ale ten patrí RAG vrstve.

Onboarding teda **musí zaviesť verzovanie dokumentu skôr, než ho zavedie CMS**. Je to
najmenší kus Fázy 4, ktorý si berie dopredu — a berie si ho preto, že bez neho je
potvrdenie právne bezcenné. Detail v `ONBOARDING_KONCEPCIA.md` kap. 3.

### 5.3 Zoznam pozvaných musí z premennej do databázy

`src/lib/auth.ts` dnes rieši, kto sa smie prihlásiť, zoznamom v premennej
`POVOLENE_EMAILY`. V komentári je to aj zdôvodnené:

> *„Zámerne nie databáza: pri piatich až desiatich ľuďoch je zmena premennej jednoduchšia
> a hlavne prehľadnejšia než admin rozhranie, ktoré by samo potrebovalo správu prístupov."*

To bola pri piatich hodnotiteľoch správna úvaha. Pri **stovke ľudí prestáva platiť**, a
to z troch dôvodov naraz: zoznam sa nedá udržiavať, každá zmena znamená nasadenie, a
hlavne — k adrese treba priviazať ďalšie údaje (meno, oddelenie, dátum nástupu, ktorý
onboarding sa jej týka), ktoré do reťazca oddeleného čiarkami nepatria.

Zavádza sa preto kolekcia **`persons`** a prihlásenie sa opiera o ňu. Premenná
`POVOLENE_EMAILY` **zostáva ako núdzová brzda pre správcov** — nie ako hlavná cesta.

Kolekcia `auth_users`, ktorú už zakladá `src/lib/authAdapter.ts`, sa nezahadzuje;
`persons` je doménová vrstva nad ňou (kto to je v organizácii), `auth_users` zostáva
technickou vrstvou prihlásenia (kto sa vie prihlásiť).

### 5.4 Tenanta treba vedieť určiť z domény

`src/lib/tenantProfile.ts` dnes vracia `defaultProfile()` — jeden tenant, jedno
nastavenie. `intranet.futbalsfz.sk` a `app.contineo.app` musia viesť na to isté nasadenie,
ale na iný `companyCode`, iný vzhľad a iný rozsah obsahu.

Rozšírenie je malé (mapa hostiteľ → profil) a nemení nič z ADR-001 ani ADR-002 — profil
sa len prestane brať z prostredia a začne sa brať z hostiteľa. Platí pritom pravidlo
z ADR-002: **neznámy hostiteľ sa správa ako zakázaný**, nie ako predvolený tenant.

### 5.5 Onboarding nevolá žiadny model

Toto stojí za zaznamenanie, lebo je to prvý raz.

Celá reťaz z `AKO_TO_BEZI.md` — prepis dotazu, embedding, rerank, generovanie — pri
onboardingu **nebeží**. Človek si otvorí dokument a klikne. Žiadny text neopustí
Frankfurt, žiadny model sa nevolá.

Onboarding je teda **prvá časť Continea, ktorá spĺňa `eu-full` bez toho, aby sa čokoľvek
muselo vyriešiť** — vrátane otvoreného bodu O7. Nemení to nič na tom, že chat na tej
istej doméne pod `eu-data` beží ako doteraz; hovorí to len, že onboardingový modul sám
o sebe nie je prekážkou pre tenanta, ktorý žiada `eu-full`. Pri predaji do verejnej
správy je to použiteľný argument.

---

## 6. Dôsledky pre bezpečnosť a ochranu údajov

### 6.1 `0.0.0.0/0` v Atlase sa mení z ústupku na prekážku

`NASADENIE_app.md` kap. 2 to pomenúva presne:

> *„Prijateľné pre testovacie prostredie s verejnými normami; **pred pridaním interných
> smerníc** treba buď Vercel Secure Compute (vyhradené IP, platený doplnok), alebo iné
> umiestnenie aplikácie."*

Onboarding privádza **oboje naraz** — interné smernice aj osobné údaje o tom, kto ich
kedy čítal. Podmienka, ktorá bola v dokumente napísaná do budúcnosti, tým nastáva.

**Toto je jediná vec v celom ADR, ktorá blokuje ostrú prevádzku.** Nie vývoj, nie
testovanie — ostrú prevádzku so skutočnými ľuďmi. Otvorený bod **O12**.

#### V čom presne je problém

Vercel nemá pri predvolenom nastavení pevné odchodzie IP adresy — funkcia sa spustí, kde sa
spustí. Atlas pritom filtruje prístup podľa IP. Aby sa aplikácia vôbec spojila s databázou,
je allowlist otvorený na `0.0.0.0/0`, čo znamená, že **pripojiť sa smie pokúsiť ktokoľvek na
internete** a jediné, čo cluster chráni, je meno a heslo databázového používateľa.

Nie je to exotika — takto beží veľká časť aplikácií na Vercelu s Atlasom. Problém je v tom,
čo do databázy pribudne: interné smernice **a** menný zoznam ľudí s časom a IP adresou.
Sieťová vrstva prestane existovať ako obrana a zostane jedno tajomstvo. Únik premennej
prostredia — cez log, závislosť, cudzí commit, kohokoľvek s prístupom do Vercel projektu —
znamená úplný prístup k osobným údajom odkiaľkoľvek. A pri audite alebo v tendri je odpoveď
„chráni to heslo" slabá.

#### Štyri cesty von

| # | Riešenie | Cena | Čo rieši | Čo nerieši |
|---|---|---|---|---|
| **1** | **Vercel Static IPs** (zdieľaný pool) | **100 $/mesiac na projekt** + regionálny „Private Data Transfer"; dostupné na pláne **Pro** | Allowlist v Atlase sa zúži na **dve IP adresy**. Aplikácia, nasadenie ani kód sa nemenia. | Zdieľaná VPC s malou skupinou iných zákazníkov (izolácia na úrovni podsiete) — z pohľadu ADR-002 stále T1 |
| **2** | **Vercel Secure Compute** | vlastná cenotvorba, **len Enterprise** | Vyhradená VPC, VPC peering, PrivateLink do Atlasu | Cena a plán — na dnešný rozsah neúmerné |
| **3** | **Presun aplikácie na vlastný stroj v EÚ** (VPS alebo AWS `eu-central-1`) | rádovo jednotky až desiatky € mesačne | Pevná IP, plná kontrola nad umiestnením, posun k **T2** a k `eu-full` podľa ADR-002 | Prevádzku si robíme sami: záplaty, TLS, monitoring, zálohy. **Nezáplatovaný vlastný server je horší príbeh než `0.0.0.0/0` so silným heslom.** |
| **4** | **Nechať a spevniť** (dočasne) | 0 € | Samostatný Atlas projekt a cluster pre produkciu, používateľ s minimálnymi právami len na jednu databázu, dlhé náhodné heslo, zapnutý audit log a upozornenia na neúspešné prihlásenia | Sieťovú vrstvu nevráti. Je to zmiernenie, nie riešenie. |

K cestám 1–3 boli preverené aj konkrétne alternatívy k Vercelu (2026-08-27):

| Alternatíva | Stav | Verdikt |
|---|---|---|
| **Render** — dedikované IP | plán Pro a vyššie, mesačný príplatok za sadu (sada = tri IPv4); **dostupnosť v EÚ regiónoch dokumentácia nepotvrdzuje** | pohyb do strany — podobný príplatok ako Vercel **plus** migrácia |
| **Railway** — statické odchodzie IP | plán Pro; regióny v dokumentácii neuvedené | to isté |
| **Vlastný stroj v EÚ** — Hetzner (DE), Websupport (SK), Scaleway/OVH (FR) | pevná IP je súčasť stroja; Next.js `output: 'standalone'` v Dockeri, Coolify/Dokploy vráti deploy z gitu a TLS | vecne najsilnejšie — jediná cesta, ktorá aj **posúva `T2` a `eu-full`** (ADR-002 dodatky 10 a 11), nielen platí za odklad. Cena je vlastná prevádzka. |
| **Vercel + SOCKS5 proxy na lacnom VPS** | Mongo driver pre Node SOCKS5 podporuje (zdokumentované) | zamietnuté — stroj, ktorý prevádzkujeme sami, v **kritickej ceste každého dotazu do databázy** |

> Cesta cez **Atlas Data API** by tu kedysi bola, ale tá služba bola vyradená — nepočítame s ňou.

#### Rozhodnutie (2026-08-27)

**Cesta 1 — Vercel Static IPs. Cesta 3 zostáva smerom, ale nie teraz.**

Static IPs sú primeraná odpoveď: 100 $/mesiac (~1 200 $/rok) je pri zákazke tejto veľkosti
malá položka a odstránia problém **bez týždňa inžinierskej práce** v čase, keď je týždeň
presne to, čo nemáme. Aplikácia sa nemení. Obmedzenie, že Static IPs neplatia pre middleware
(beží na edge), nás **netrápi** — `src/middleware.ts` overuje token a do Atlasu nesiaha.

Cesta 3 zostáva smerom, ale nie kvôli O12. ADR-002 (dodatky 10 a 11) už pomenoval, že Vercel
je prekážkou pre `eu-full` aj pre izoláciu T2. Presun aplikácie je rozhodnutie o produkte, nie
o odblokovaní jedného spustenia — a robiť ho pod termínom by bola chyba. Static IPs
medzitým nič nezahadzujú: keď sa aplikácia raz presunie, zrušia sa.

**Za rozhodnutie sa platí a treba to vedieť:** 1 200 $ ročne je cena za odklad sťahovania, ktoré
je v ADR-002 už napísané ako nevyhnutné. Vedomé rozhodnutie znie, že prevádzka vlastného stroja
by dnes stála viac než tá suma — nezáplatovaný vlastný server je horší bezpečnostný príbeh než
`0.0.0.0/0` so silným heslom. Prehodnotiť pri najbližšom kroku k `eu-full` alebo `T2`, alebo keď
sa uvoľní kapacita na prevádzku.

Sťahovať by sa aj tak muselo len `app/` — marketingový `web/` môže na Verceli zostať trvale.

Cesta 4 platí **súbežne s ktoroukoľvek z nich** — samostatný produkčný cluster a používateľ
s minimálnymi právami sú lacné a majú zmysel aj za pevnou IP.

### 6.2 Cluster M0 nemá zálohy — a to je väčší problém než allowlist

Nález z 2026-08-27. `ATLAS_SETUP.md` kap. 1 to hovorí rovno:

> *„M0 má obmedzenia. Žiadne zálohy, obmedzená priepustnosť. Na PoC v poriadku, na produkciu nie."*

Kým išlo o deväť verejných noriem, bolo to jedno — korpus sa dá znovu naimportovať z originálov.
Pri `acknowledgements` to jedno nie je: **auditný záznam bez zálohy nie je auditný záznam.**
Keby sa cluster stratil, neexistuje spôsob, ako doložiť, že sto ľudí niečo potvrdilo. A na rozdiel
od otvoreného allowlistu, ktorý niekto musí zneužiť, strata dát nepotrebuje útočníka.

**✅ Rozhodnuté (2026-08-27):** prechod na **M10+ pred prvým ostrým potvrdením** (D31). Ultra-MVP
sa smie dovyvinúť na M0, ale skutočný človek nepotvrdí nič, kým nie sú zálohy. Pri prechode treba
zapnúť **auto-scaling úložiska aj tieru** so stropom aspoň M30 — Automated Embedding to vyžaduje
(`ATLAS_SETUP.md` kap. 1).

Vedľajší dôsledok: privátny endpoint (PrivateLink) Atlas ponúka len na dedikovaných clusteroch,
teda M10+. Na M0 cesta 2 ani 3 z predchádzajúcej kapitoly technicky neexistovali.

### 6.3 `acknowledgements` sú osobné údaje

Kolekcia obsahuje meno, e-mail, čas a IP adresu. IP je v nej preto, že bez nej má
potvrdenie výrazne slabšiu dôkaznú hodnotu — ale je to osobný údaj a nesmie sa tam
ocitnúť len preto, že sa hodí.

Nadväzuje to na `GDPR_DATA_PROTECTION.md` a na D10: zväz je prevádzkovateľ, Contineo
sprostredkovateľ. Nové oproti D10 sú dve veci, ktoré tam nie sú vyriešené:

- **právny základ** — plnenie zmluvy alebo oprávnený záujem zamestnávateľa, nie súhlas
  (súhlas sa dá odvolať a odvolateľný dôkaz o oboznámení je protirečenie),
- **retencia** — auditný záznam má prežiť pracovný pomer, čo je iná lehota než pri
  konverzáciách.

Obe patria právnikovi/DPO. Otvorené body **O15** a **O16**.

### 6.4 Prístup k obsahu onboardingu

Smernice sú `accessLevel: internal` a idú cez ten istý `securityFilter()` ako všetko
ostatné. Onboarding nezavádza **žiadnu** vlastnú cestu k obsahu — keby ju zaviedol,
vznikol by druhý filter, ktorý raz zaostane za tým prvým.

Zoznam *„kto nepotvrdil"* je citlivejší než samotné smernice a vidí ho len HR a vedenie.
Rola pre to v `CMS_KONCEPCIA.md` kap. E zatiaľ nie je — dopĺňa ju
`ONBOARDING_KONCEPCIA.md` kap. 6.

---

## 7. Čo to spraví s poradím fáz

Onboarding vzniká ako **Fáza 8** v `Contineo_RAG_Projektovy_plan.md`, ale beží **teraz** —
teda pred dokončením Fázy 4 (Import & CMS) aj Fázy 5 (Prístupové úrovne). To je
nezvyklé a treba to pomenovať nahlas, nie zamlčať.

Berie si z nich dopredu presne tri veci a nič viac:

| Z fázy | Čo si berie | Čo si **neberie** |
|---|---|---|
| Fáza 4 (CMS) | `documents.versions[]` a `versionId` | knižnicu, review UI, `processingStatus`, kanály |
| Fáza 5 (práva) | `persons` + prihlásenie proti DB | Sportnet OAuth, `sportnet_role_map`, `person_memberships` |
| Fáza 4 (CMS) | zobrazenie dokumentu človeku | editor, publikačný workflow, i18n |

**Riziko dvojitej práce je reálne.** Držíme ho malé tým, že si onboarding neberie
zjednodušené verzie tých vecí, ale **cieľové** — `versions[]` vzniká rovno v tvare,
v akom ho potrebuje CMS, `persons` rovno v tvare, v akom ju potrebuje Fáza 5. Ak sa
niekde neskôr ukáže rozdiel, je to chyba návrhu, nie plánovaná dočasnosť.

---

## 8. Čo sme zámerne odložili

| Vec | Prečo teraz nie |
|---|---|
| Zaručený elektronický podpis (eIDAS) | zvolená úroveň je klik + auditný záznam; podpis je iný projekt a dá sa doplniť nad ten istý záznam |
| Microsoft Entra ID ako druhý provider | magic-link pokryje všetkých vrátane ľudí bez M365; Entra pridáva pohodlie, nie dosah — patrí do Fázy 5 |
| Sportnet OAuth pre rozhodcov a trénerov | to isté; navyše čaká na CRM connector (D7) |
| Obsahové stránky onboardingu (uvítanie, štruktúra, prvý týždeň) | vyžadujú web-obsahovú vrstvu CMS (D-CMS-1, D-CMS-2, D-CMS-5); rozsah B ich nechá pribudnúť bez prepisovania |
| Import historických potvrdení | zvolením ultra-MVP žiadne nevzniknú |
| Prepojenie na ClubUp (test ku smernici) | nikto oň zatiaľ nepožiadal; hranica z kap. 3.1 platí |

---

## 9. Otvorené otázky

| # | Otázka | Prečo na nej záleží |
|---|---|---|
| ~~**O12**~~ | ~~`0.0.0.0/0` v Atlase~~ | ✅ **Uzavreté 2026-08-27:** Vercel Static IPs (100 $/mes., plán Pro), zapnúť pred prvým ostrým potvrdením. Analýza v kap. 6.1; presun z Vercelu zostáva dlhodobým smerom. |
| **O13** ✅ | ~~Čo je „podstatná zmena" smernice, ktorá vyžaduje opätovné potvrdenie?~~ **Uzavreté 2026-08-29: otázka sa ruší.** Definícia neexistuje — rovnaká zmena je v jednej norme preklep a v druhej nová povinnosť. Nahradila ju **udalosť s povinným dôvodom**: pridelenie (`assignments`, D37). Kto chce, aby ľudia potvrdzovali znova, to musí prideliť a napísať prečo. „Novela čl. 12 mení lehotu na odvolanie" sa o rok dá overiť; „naplnilo sa kritérium C" nie. |
| **O14** | Má sa merať čas strávený nad dokumentom, prípadne doskrolovanie na koniec? | Zvyšuje dôkaznú hodnotu, ale je to sledovanie správania zamestnanca. Rozhodnúť **pred** implementáciou, nie po nej. |
| **O15** | Aký je právny základ spracúvania `acknowledgements`? | Návrh: oprávnený záujem/plnenie zmluvy, nie súhlas. Potvrdí DPO. |
| **O16** | Ako dlho sa auditný záznam uchováva po skončení pracovného pomeru? | Iná lehota než pri konverzáciách (D10). Potvrdí právnik. |

---

## 10. Čo sa zmenilo v ostatných dokumentoch

| Dokument | Zmena |
|---|---|
| `OPEN_DECISIONS.md` | poznámka k číslovaniu (D18–D23 rezervované pre D-CMS-1..6) + nové D24–D30 |
| `Contineo_RAG_Projektovy_plan.md` | nová Fáza 8 |
| `DATA_MODEL_konzistencia.md` | kolekcie `acknowledgements`, `persons`, `onboarding_tracks` |
| `TODO.md` | sekcia I — onboarding |
| `ATLAS_SETUP.md` | poznámka o M10+ ako podmienke ostrej prevádzky (D31) |
| `ONBOARDING_KONCEPCIA.md` | **nový** — koncepcia, dátový model, toky, fázovanie |
