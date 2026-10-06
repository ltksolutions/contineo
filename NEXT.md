# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-10-06 večer** (helpdesk ADR-028: FAQ, kanály a schránka, tickety, `/helpdesk`, widget pre ISSF; Kanály ako sekcia s typom; PR #273, #276, #278, #285; D161–D169)

---

## Kde sme teraz

**Helpdesk (ADR-028, 6. 10.) je celý v `main`, naostro neoverený.** Päť
krokov: FAQ ako druh dokumentu (D164), kanály so schránkou cez Microsoft
Graph a ťažba histórie do FAQ (D161, D162, D165), e-mail je ticket (D163),
obrazovka riešiteľa `/helpdesk` (rola `helpdesk`, D167), widget s tokenom pre
ISSF (D166), druh osoby `internal`/`employee`/`external` (D168) a **Kanály
ako sekcia v menu s typom widget / portál (D169, PR #285)**. Čaká na
ľudí mimo kódu: registrácia aplikácie v Entra a zúženie na schránku
(`docs/NASADENIE_app.md` § 5, správca M365), prvý kanál v sekcii Kanály (typ widget, D169) a rola `helpdesk`, tajomstvo widgetu pre prevádzkovateľa ISSF
(`docs/WIDGET_ISSF.md`). Poradie overenia: FAQ → kanál a Overiť spojenie →
Synchronizovať → ťažba FAQ → ticket a odpoveď → widget
(`npm run widget:test` bez ISSF). Otvorené po nasadení: upozornenie
riešiteľom na nový ticket, tickety v „čo čaká na mňa“, IMAP adaptér, cron
častejšie než denne (Pro), text účelu „helpdesk“ na `/privacy` (DPO).

Všetko je **zlúčené v `main` a nasadené** na `intranet.futbalsfz.sk`. Hash
nasadeného commitu je v pätičke. Staršia história je v `CHANGELOG.md`
a `docs/DEVLOG.md`. **Od 27. 9. pracujú v repe dve sessions naraz** —
každá vo vlastnom `git worktree` (ADR-020); rozrobené vetvy druhej session
vidno v `git branch -a`, nie v tomto súbore. Zvyšok z 29. 9.: worktree
`.claude/worktrees/worktree-parallel-design-2a590b` (odpojený) — odstrániť, keď ho Ján pustí.

**Potvrdzovanie je overené naostro (30. 9. – 1. 10., PR #196–#208)** na
`sfz:test_znenia`: pridelenie osobe, oddeleniu, trase aj krok trasy dajú
jednu úlohu a jedno potvrdenie ich splní; e-mail s výzvou, potvrdenie
z počítača aj z iPhonu, záznam s odtlačkom PDF a kópiou oddelenia, výkaz HR.
Cestou opravené: D50 mimo trás, náhľad PDF (strany cez pdf.js aj na
telefóne, bez textu na vyhľadávanie), odvolanie pridelenia cez potvrdzovaciu
stránku, „adresát" namiesto „publikum", pätička e-mailov **Contineo.app**,
po potvrdení späť na „Na potvrdenie", menu 9 bodiek pod tlačidlom a **druhé
potvrdenie z iného zariadenia sa odmieta**. **D151** (dodatok ADR-023):
úloha „určiť právny základ" je na karte v správe, zodpovedná osoba bez roly
správcu tam vidí len ju. **D152:** formulka podľa rodu (`persons.gender`,
nevyplnené „oboznámil(a)"). Zvyšky v `docs/TODO.md`, „Test potvrdzovania naostro".

**Osoby SFZ sú v systéme (27. 9.):** 153 osôb z licenčného zoznamu M365
(150 nových + 3 doplnené), bez technických kont. Zaradenie do oddelení je
ručné a čaká (`docs/TODO.md`, I4). **ADR-019:** import existujúcim dopĺňa
len prázdne polia; prepis je prepínač „Aktualizovať existujúcich".
Náhľad importu je tabuľka s rozdielom „dnes → po" a hľadaním.
**Pozvánky odišli 28. 9.** (146 hromadne + 1); stav osoby je „Nová", kým
pozvánka neodíde, potom „Pozvaná". Portál sa volá **Intranet SFZ**.

**Rámy z Claude Design sú zapracované všetky** (`docs/design/`, PR #113–#123).
Postup: Ján navrhne rám, napíše **„stiahni design"**, archív sa stiahne cez
Share → Project HTML → Project archive, rámy idú do `docs/design`, každý rám
jeden PR. Priebeh nahrávania zostáva modálne okno (CLAUDE.md projektu v Claude
Design).

**Znenie predpisu po štyroch rozhodnutiach (24.–25. 9.):**

- **ADR-014** — karta Príprava → Schválenie → Zverejnenie → Pridelenie;
  zodpovedná osoba už v príprave, schvaľovatelia z posledného kola, prenos
  pridelení pri zverejnení.
- **ADR-015** — názov dokumentu so zverejneným znením sa mení len novým
  znením a schvaľuje sa s ním.
- **ADR-016** — bez označenia znenia, zdroja dátumu a opravy údajov; formulka
  „… v znení účinnom od {dátum} …".
- **ADR-017** — viac právnych základov pri znení; zákonná povinnosť má
  prednosť (námietka nemaže).

**ADR-012 (retencia a DPO)** beží v režime `report`; DPO je Ján. **ADR-013**
(údaje o znení) je súčasťou schválenia.

**ADR-023:** právny základ určuje zodpovedná osoba už v príprave;
nahradené znenie platí do účinnosti nového (D143).

**Naostro overené 29. 9.:** predloženie → schválenie (Michaela Žikavská)
→ zverejnenie cez kartu, trikrát na `sfz:test_znenia`, vrátane novely
s budúcou účinnosťou. Formulka „v znení účinnom od" a kombinácia právnych
základov v zázname potvrdenia overené 1. 10. **Naostro neoverené:**
zverejnenie s novým názvom, prenos pridelení, určenie základu v príprave
(ADR-023), vyradená osoba.

**`/dpo` je overené naostro (1. 10.):** výkaz, CSV (so stĺpcom
`categories`, PR #214), dve námietky podané v aplikácii a zamietnuté — nič
sa nezmazalo; zvonček, e-maily a záložka GDPR len na čítanie pre správcu
osôb bez roly DPO. **D153** (ADR-012, Dodatok 1): kontakt GDPR organizácie
(*Ján Letko, gdpr@futbalsfz.sk*) na `/privacy`; námietku podá prihlásená
osoba priamo tam, DPO dostane e-mail aj zvonček, osoba potvrdenie.
**D154** (ADR-022, Dodatok 1): kontakt, lehoty a doplnok sú v Nastaveniach
organizácie, **záložka GDPR**; upravuje len DPO, správca osôb ju vidí na
čítanie. Výkaz DPO s hľadaním a filtrami (PR #218) nahradil dlaždice pásom
čakajúcej námietky.

**Asistent odpovedá podľa znenia platného k dňu otázky (ADR-024, PR
#170–#176).** Hľadá v zneniach platných k dňu (z `documents`, nie podľa
`isActive` úseku), rozpozná otázku „k dátumu" aj „čo sa zmenilo" (porovná
dve znenia po článkoch), nad odpoveďou je štítok dňa, pri zdroji znenie.
Overuje sa `npm run versions:questions` na skúšobnom `sfz:test_znenia`
(6 z 6). Ostré normy majú zatiaľ po jednom znení.

**Knižnica (2. 10., PR #223–#227):** deväť pôvodných noriem má PDF pri
platnom znení (`npm run files:version-pdf`), takže „Stiahnuť PDF" aj PDF pri
potvrdzovaní; právny základ smie určiť aj **správca obsahu** (D155, ADR-023
Dodatok 2); predpis sa dá **archivovať ku dňu** (aj v budúcnosti, s dôvodom;
pridelenia sa odvolajú, potvrdenia ostávajú; D156, **ADR-025**). Skúšobná
smernica `sfz:test_onboarding` je zmazaná; `sfz:test_znenia` ostáva.

**Trasy (2.–3. 10., PR #228–#239, druhá session):** trasy sú v Pridelených
dokumentoch („Pridelené normy" → „Pridelené dokumenty"), ľudia na trase,
termín potvrdenia pri trase, e-mail pridaným, náhodný kľúč trasy.

**Karta dokumentu (PR #183–#186):** platné znenie = platí dnes, novela vopred
ako „Pripravované znenie“; preindexovanie každého znenia; oprava textu platného
aj pripravovaného znenia (**D150**, dodatok k ADR-007), minulé nie.

**Nové rozhranie (29.–30. 9., PR #188–#194):** menu 9 bodiek v hlavičke,
Prehľad ako rozcestník, spodná lišta rovnaká pre každého; **Knižnica pre
každého** (platné dokumenty organizácie, čitateľský detail). **Otázka sa kladie
v hlavičke**, odpoveď s citáciami vedľa seba (≥ 1180 px). **História otázok**
(`/ask/history`, skrytie, vymazanie, lehota `answersMonths`) je nasadená —
súhlas DPO sa získava dodatočne (`docs/TODO.md`, 🔴).

**Vzdelávanie (modul `learning`, ADR-018) je L0–L3 v produkcii** (PR
#130–#153): kurzy s verziami a videom, banka otázok a testy, výsledky pre
zodpovedné osoby, certifikát s overením `/verify/…?h=`, tlačou a PDF s QR.
Pre SFZ **zapnutý**, Ján je `learning-admin`. **Naostro zatiaľ nikto kurz
nedokončil** — žiadny certifikát v databáze, PDF ani odvolanie neboli
skúšané na živých dátach. Rozpis zvyšku je v `docs/TODO.md`, sekcia P.

**Pohlavie osoby** (`persons.gender`, muž / žena): formulár, pozvanie,
import CSV (stĺpec `pohlavie`). Na certifikáte „absolvoval / absolvovala",
nevyplnené = „absolvoval(a)". Zatiaľ ho nemá nikto.

**Ochrana osobných údajov** — text `/privacy` schválil DPO 28. 9. (C1).
**ADR-021:** vzdelávanie má lehotu dokladov, podrobnosti sa orežú rok po
dokončení, **vydaný certifikát sa nemaže**. **ADR-022:** krajina sídla,
sprostredkovatelia z profilu, lehoty a doplnkový text si organizácia
nastaví v Nastaveniach, záložka GDPR (D154). Otvorená karta po nasadení ponúkne
„Obnoviť" (inak posiela akcie starej verzii).

## Čo čaká na rozhodnutie Jána

**🔴 Ako DPO: súhlas s účelom „história otázok“** (H1) — nasadené 30. 9.
pred súhlasom, na pokyn Jána; záznam o spracúvaní a `/privacy` sú doplnené.

**Lehota uloženia certifikátov** podľa registratúrneho plánu zväzu — DPO
doplní do záznamu o spracúvaní (C2, D132).

**22 osôb z `@sfzmarketing.sk`** sú v tenante SFZ ako `employee` — nechať,
alebo typ `external` / vlastný tenant? A či doplniť ľudí mimo Basic/Standard
licencií (Ján v exporte nebol).

**Ako DPO:** C1 schválené 28. 9.; zostáva záznam o spracovateľských
činnostiach prepísať do záznamu zväzu (C2, doplnené o Vzdelávanie
a pohlavie), DPIA pred pilotom (C3), termín balančného testu (A3, A11).

**Skúšobný poriadok `sfz:test_znenia`** — zmazať, keď kontrola asistenta
(`npm run versions:questions`) prejde na ostrú normu s viacerými zneniami.
Skúšobná smernica je zmazaná (2. 10.).

**Staré pridelenia Oddeleniu IT** — Revízny poriadok (10. 9., Branislav
nepotvrdil) a Skúšobná smernica (8. 9.): odvolať, alebo nechať?

**9 zo 14 platných predpisov nemá právny základ** (výkaz `/dpo`,
1. 10.) — doplní zodpovedná osoba (pri ôsmich je to Ján, pri Smernici
o pracovných cestách Michaela Žikavská).

**Atlas → AI Models → Usage:** či úpravy search indexov 29. 9. prepočítali
vektory (skóre pred a po sú zhodné — nasvedčuje, že nie).

**Zapnúť ostré mazanie** — `RETENTION_MODE=delete` po kontrole výkazu
`retention` v odpovedi cronu; tá istá premenná zapína aj retenciu
Vzdelávania (ADR-021).

**Automatický prevod `.docx` → PDF** (Graph, povolenia v Entra ID) a **D93**
(`docs/D93_plan_vyber_podla_filtra.md`) čakajú ako doteraz.

## Najbližšie kroky

0. **Zaradiť 153 osôb do oddelení** v `/organisation` — bez toho sa im
   normy podľa oddelenia nepridelia (D49). Pri tom istom importe doplniť
   **pohlavie** (stĺpec `pohlavie`) — vyplnené má 3 zo 154, ostatní
   potvrdzujú „oboznámil(a)" (D152).
0. **Prvý kurz naostro:** Ján zverejní kurz, prejde ho sám s testom
   a stiahne certifikát aj PDF — overiť `/verify` z QR na telefóne.
1. **Prvé ostré nové znenie cez kartu** — samotné kolo je overené; pri ňom
   overiť nový názov, základ určený v príprave (ADR-023, od D151 na karte
   v správe) a prenos pridelení
   (`docs/TODO.md`, O15/O16). Potom asistenta: `npm run versions:questions`
   má zmysel doplniť o otázky na tú normu.
2. **Čas po prvý token, fáza 3:** fázy 1 a 2 sú nasadené (PR #205, #209;
   hodnotenia už majú časy fáz aj tokeny). Pár dní zbierať hodnotenia,
   potom `node --env-file=.env.local scripts/ratings_overview.mjs`
   a rozhodnúť o hlavnom modeli — ten (2,8–6,2 s po prvý token) je
   najväčšia položka, prah D9 je p95 pod 2 s.
3. **Dátum skončenia na karte osoby** — overiť pri prvom skutočnom odchode
   (zadáva sa pri vyradení; zvyšok `/dpo` je overený, `docs/TODO.md`).

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva (6. 10.): **0 errors, 40 warnings,
2452 testov v 199 súboroch.** Pri paralelnej session pred zlúčením PR
zmergovať `main` do vetvy a pustiť `tsc` — 6. 10. prešiel zelený PR a build
`main` padol na zmene z druhej vetvy (`Notice` s povinným `language`). Pri veľkej záťaži stroja pomôže
`npx vitest run --maxWorkers=3` (inak niektoré testy stránok padajú na 5 s). Nová chyba alebo nové varovanie znamená regresiu, nie šum.

**Tieto štyri brzdy nevidia chyby za behu.** 23. 9. prešli všetky štyri
a produkcia aj tak spadla (dočasná mŕtva zóna v `library/page.tsx`). Preto
je odteraz `@typescript-eslint/no-use-before-define` zapnuté ako **chyba** —
`tsc` túto triedu chýb chytiť nevie, hlási len priamy odkaz v tom istom
mieste, nie odkaz vnútri callbacku.

**Stránka sa overuje telom odpovede, nie stavovým kódom.** Next servíruje
chybovú stránku s kódom **200**, takže `curl -o /dev/null -w '%{http_code}'`
o ničom nevypovedá. Hľadá sa reťazec „A server error occurred" v tele.

**A overuje sa to, čo ľudia s obrazovkou robia, nie to, čo sa menilo.**
Knižnica nasadená bez vyskúšaného filtra nie je overená knižnica.

Stav, ktorý sa naživo nedá vyvolať bez zápisu (karta v kroku 2, námietka),
sa overuje **testom vykreslenia** s podvrhnutými dátami
(`tests/libraryDetailFlow.test.ts`, `approvalsPage`, `dpoPage`).

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

**Lokálne SFZ je na `http://sfz.localhost:3000`, nie na `localhost`** — ten
patrí tenantovi LTK a osoba Jána tam nie je (D90), takže knižnica hlási
„Stránka sa nenašla" aj pri prihlásení. Prihlasuje sa zvlášť; odkaz z e-mailu
má v `callbackUrl` https, po prihlásení treba ručne otvoriť `http://`.
**Lokálny server píše do ostrej databázy** — zápisy (presun, audit) sa
naživo skúšajú len so súhlasom Jána.

**Marketingový web má vlastnú sadu** a púšťa sa z `web/`:

```
cd web && npx eslint . && npx vitest run && npm run build
```

Baseline: **0 errors, 0 warnings, 13 testov v 2 súboroch, 62 predgenerovaných
stránok** (z toho 18 OG a Twitter obrázkov). `next lint` tu už neexistuje —
volá sa priamo `eslint`.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
