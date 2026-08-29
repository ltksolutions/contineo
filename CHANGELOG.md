# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

### Added (2026-08-29 — Fáza 9 rozsah B: prideľovanie prestalo byť tiché)

- **Kolekcia `assignments` (D37).** Doteraz bolo rozposlanie úlohy tiché: pribudla nová verzia normy a `trackProgress()` ju začal rátať ako nepotvrdenú každému, koho sa trasa týkala — bez rozhodnutia a bez stopy. Model má odteraz dve pravdy s rôznym pôvodom: *čo mám urobiť* sa naďalej odvodzuje (D27), *že sa to má urobiť* je záznam. Záznam sa nemení a nemaže — odvolanie je `revokedAt`, nie `deleteOne`.
- **`persons.groups` ako tretia dimenzia (D38).** Trasa je obsah, útvar je štruktúra, skupina je adresát. Zlúčiť skupiny s trasami by znamenalo, že jednorazová úloha si vyžiada umelú trasu; zlúčiť ich s útvarmi by znamenalo, že sa nedá osloviť skupina naprieč útvarmi — a práve tá býva adresátom noriem (rozhodcovia, delegáti, štatutári). **Číselník skupín sa nezakladá**, zoznam sa odvodzuje z ľudí: číselník by bol druhá pravda a prideliť niečo prázdnej skupine je tichý spôsob, ako neprideliť nikomu.
- **Obrazovky `/hr`.** Prehľad pridelení s počtami, formulár na pridelenie a **menovitý** zoznam, kto ešte nepotvrdil. Číslo „chýba 17" sa dá pozerať mesiace; mená sú to, na základe čoho niekto zdvihne telefón.
- **Rola `hr` a brána `hrContext()`.** Rola **a** príslušnosť k organizácii, obe naraz — rovnaký vzor ako `platformContext()`, o poschodie nižšie. **Správca platformy sem prístup nemá:** D41 mu dáva počty naprieč tenantmi, nie menovitý zoznam ľudí, ktorí si niečo neprečítali. To je obsah, nie prehľad.
- **Widget vie „čaká od" a „nové".** Oboje z `assignments.assignedAt` (D39). Kde pridelenie nie je, widget o čase **mlčí** — náhradný čas by bol horší než žiadny.
- **`persons.previousLoginAt`.** Bez neho by „nové" znamenalo „pribudlo počas tejto relácie", teda spravidla nič. Posun starej hodnoty a zápis novej sú jedna operácia (aktualizácia rúrou), inak by pri prihlásení z dvoch zariadení jedno z histórie zmizlo.
- **Pridelené znenie, ktoré už neplatí, sa nedá potvrdiť**, tak sa počíta medzi zablokované, nie medzi úlohy. Inak by úloha z widgetu nikdy nezmizla: `/dokumenty/…` ukáže novšie znenie a potvrdenie by sa viazalo na inú verziu.
- 32 nových testov (spolu 579).

### Added (2026-08-29 — dokončenie rozsahu B)

- **E-mail „pridelili sme vám…" sa posiela tlačidlom, nie ako vedľajší účinok pridelenia.** Pridelenie sa dá odvolať; odoslaný e-mail nie. Preto samostatná obrazovka s náhľadom: komu presne to pôjde a **presne to znenie**, ktoré odíde (skladá ho tá istá funkcia — podobný text by sa časom rozišiel so skutočným).
- **Posiela sa len tým, ktorí ešte nepotvrdili.** Kto to má za sebou, by dostal pripomienku niečoho, čo spravil — a to je presne ten druh pošty, po ktorom si ľudia zapnú filter a prestanú čítať aj tú dôležitú.
- **`assignments.notified[]`** — pole, nie jedna hodnota. Je rozdiel medzi „poslali sme raz pred pol rokom" a „posielame štvrtý týždeň po sebe". Zapisuje sa **po** odoslaní a s počtom, ktorý naozaj odišiel; zápis dopredu by pri výpadku pošty tvrdil, že ľudia vedia, hoci nedostali nič.
- E-mail nesie **dôvod od človeka** a ide v jazyku príjemcu. Z obsahu normy len názov — do schránky, ktorá môže byť súkromná alebo mimo našej správy, obsah interného predpisu nepatrí. Odkaz vedie na dokument, nie na prihlásenie: posielať prihlasovací odkaz by znamenalo vyrobiť druhý jednorazový vstup do systému kvôli oznámeniu, ktoré nič nepotvrdzuje.
- Strop **150 e-mailov naraz**. Nad ním sa akcia odmietne a povie prečo; serverová akcia má obmedzený čas behu a rozposlať náhodnú polovicu je horšie než neposlať nič.
- **Hromadné pridelenie: N noriem × M publík**, jeden spoločný dôvod. Reálne zadanie znie „nový rozhodca dostáva päť predpisov" alebo „novela sa týka rozhodcov aj delegátov aj klubov"; prideľovať to po jednom znamená napísať ten istý dôvod pätnásťkrát — a pri pätnástom už nikto nepíše to isté, takže sa záznamy o tej istej udalosti rozídu.
- „Všetkým v organizácii" **prebije zvyšok výberu**. Inak by vzniklo pridelenie pre všetkých a k nemu pridelenia pre skupiny, ktoré sú jeho podmnožinou.
- Zaškrtávacie políčka s terčom 44 px, nie `select multiple` — ten sa na telefóne ovláda mizerne a viacnásobný výber v ňom nie je vidieť. Po chybe sa vracia **celý výber**, nie len hláška: kto zaškrtal päť noriem, tri skupiny a napísal odsek odôvodnenia, to druhýkrát nenapíše.
- 16 nových testov (spolu 595). Medzi nimi ten najdôležitejší: **prázdny výber publík je prázdny zoznam, nie „všetci"** — inak by stačilo nezaškrtnúť nič a norma by odišla celej organizácii.

### Changed (2026-08-29)

- **D30 a O13 sa rušia, nezodpovedajú sa.** Hľadala sa definícia „podstatnej zmeny" — kritérium, podľa ktorého by systém rozhodoval, kedy treba potvrdiť znova. Také kritérium neexistuje: rovnaká zmena je v jednej norme preklep a v druhej nová povinnosť. Nahradila ho **udalosť s povinným dôvodom**. „Novela čl. 12 mení lehotu na odvolanie" sa o rok dá overiť; „naplnilo sa kritérium C" nie.

### Fixed (2026-08-29 — nasadenie)

- **Dve `DYNAMIC_SERVER_USAGE` chyby v logu nasadenia.** Next sa pokúšal predgenerovať `/_not-found` a zakopol o `headers()` v obale. Zachytené to bolo, nasadenie prešlo — ale chyba, ktorá sa má prehliadať, je presne to, čo spôsobí, že sa raz prehliadne aj skutočná. Obal je odteraz `force-dynamic`, čo len hovorí nahlas, čo aj tak platí: **hostiteľ určuje tenanta** (D29), takže sa vopred nedá vygenerovať nič.
- **`npm run lint` nefungoval.** `next lint` v Next 16 už neexistuje a slovo „lint" si vyloží ako názov priečinka (`no such directory: …/app/lint`). Volá sa priamo `eslint` s plochou konfiguráciou. Pri tom vyšli najavo aj tri skutočné drobnosti: neescapované úvodzovky v troch komponentoch a zvyšné importy v `domeny.mjs` po presune hľadania tokenu do `vercel-auth.mjs`.
- `@typescript-eslint/no-explicit-any` je v `src/lib/providers/**` znížené na výstrahu — `any` je tam **dlh, nie zámer** (parsovanie JSON-u cudzích API, správne by bolo `unknown` a zúženie) a prepisovať každú generujúcu cestu bez možnosti overiť to inak než v produkcii nie je zmena, ktorá patrí sem.

### Added (2026-08-29 — ostré normy dostali platné znenie)

- **`npm run verzie`** — deväť noriem SFZ prišlo RAG importom a `versions[]` nemalo vôbec: `versionId` navrchu, text v `document_chunks`. Pre vyhľadávanie to stačilo, pre potvrdzovanie nie — `effectiveVersion()` číta výhradne `versions[]` (D6, D25), takže všetkých deväť bolo v onboardingu „bez platného znenia".
  - Verzia dostane **ten istý `versionId`**, aký už majú dokument aj jeho chunky. Potvrdenie sa tým viaže presne na to znenie, z ktorého systém odpovedá; nové číslo by vytvorilo druhú pravdu o tom istom texte.
  - Text sa poskladá z chunkov v poradí `chunkIndex`. Chunky sa neprekrývajú — sú to články, každý uvedený hlavičkou „Dokument › Článok N", ktorá je tam kvôli vyhľadávaniu; pri súvislom čítaní sa odstráni a nahradí nadpisom.
  - Dátum platnosti skript **nedopĺňa odhadom**. Musí ho zadať človek (`--od`), pretože to je presne to rozhodnutie, ktoré systém spravíť nevie (D6, D25). Bez `--zapis` nezapisuje nič.
- **`npm run platnost`** — nastaví dátum platnosti znenia. Vyžaduje `--zdroj`, teda odkiaľ ten dátum je; citácia sa uloží k verzii (`versions[].effectiveFromSource`). Dátum sa doslovne prepisuje do potvrdzovacej formulky a tým aj do záznamu v `acknowledgements` (D28) — o rok musí byť možné zistiť, či pochádza z ustanovenia o účinnosti, alebo to bol niečí odhad. Bez `--zapis` nezapisuje nič.
- **Osem noriem SFZ má skutočný dátum účinnosti**, prevzatý z ustanovenia o účinnosti v ich vlastnom texte (`scripts/datumy_sfz.sh` drží citácie):
  | norma | účinnosť od |
  |---|---|
  | Organizačný a návštevný poriadok | 1. 7. 2014 |
  | Rokovací poriadok Konferencie | 4. 6. 2016 |
  | Volebný poriadok | 4. 6. 2016 |
  | Poriadok komory pre riešenie sporov | 7. 12. 2021 |
  | Disciplinárny poriadok | 1. 7. 2023 |
  | Stanovy | 27. 2. 2026 |
  | Registračný a prestupový poriadok | 1. 6. 2026 |
  | Súťažný poriadok | 24. 6. 2026 |

  Pri **Stanovách a Súťažnom poriadku** je dátum odvodený z dvoch miest (ustanovenie „dňom schválenia" + deň schválenia poslednej novely zo záhlavia), nie odcitovaný z jedného — a je to tak aj zapísané.
- **Revízny poriadok zostáva zástupný.** Hovorí „nadobúda účinnosť dňom jeho schválenia VV SFZ" a dátum schválenia v texte nie je; z dokumentu sa určiť nedá. Je označený priamo v `effectiveFromSource` a treba ho doplniť z uznesenia VV SFZ.
- **Označenie znenia je zatiaľ všade „1.0"** a to je vymyslené číslo — normy vlastné číslovanie verzií nemajú. Objaví sa v potvrdzovacej formulke, takže sa raz bude musieť nahradiť niečím, čo naozaj niečo znamená (napr. dňom schválenia novely).

### Fixed (2026-08-29)

- **`addVersion()` padával práve na prvej verzii dokumentu.** Uzatvorenie platnosti predchádzajúcej verzie sa robí cez `arrayFilters`, a tých sa Mongo odmietne dotknúť, keď pole `versions` ešte neexistuje („The path 'versions' must exist"). Chyba teda nastala v jedinom prípade, keď niet čo uzatvárať. Podmienka `versions.0` ten krok preskočí. Doteraz si toho nikto nevšimol, lebo jediný dokument s `versions[]` vznikol seedom, ktorý pole rovno zapisuje.

### Added (2026-08-28 — správa tenantov, rozsahy B a C)

- **Úprava organizácie z obrazovky:** názov, skratka, logo, farba, kontakt, jazyky a domény. Nevyplnené pole sa **nemení, nemaže** — inak by uloženie názvu zmazalo logo (kryté testom).
- **Vypnutie si vyžiada napísanie kódu organizácie.** Je to jediná zmena, ktorá ľudí okamžite odstrihne od portálu; obyčajné „naozaj?" sa odklikne skôr, než sa prečíta. Tenant sa pritom nemaže — záznamy potvrdení musia prežiť koniec spolupráce.
- **Zakladanie novej organizácie**, vrátane priradenia domény projektu vo Verceli a odoslania pokynov zákazníkovi jedným tlačidlom. Poradie je zámerné: najprv `tenants`, potom Vercel — zápis je zdroj pravdy a výpadok cudzieho API nesmie brániť organizáciu založiť.
- **Pravidlá o doménach majú jednu definíciu.** `lib/tenantAdmin.ts` (vlastníctvo, normalizácia, zápis) a `lib/vercel.ts` (priradenie projektu, stav, znenie pokynov) volajú rovnako obrazovka aj skripty. `tenant_set.mjs` mal dovtedy vlastnú kópiu kontroly kolízie a `domeny.mjs` vlastné znenie e-mailu — dva rôzne texty o tom istom nastavení sú spoľahlivý spôsob, ako poradiť dvakrát rozdielne.
- **Serverové formuláre bez klientskeho stavu.** Správcovská obrazovka funguje aj bez jediného riadku JavaScriptu; chyby sa vracajú do adresy. Vstupy majú `font-size: 16px`, inak Safari na iPhone pri kliknutí do poľa stránku priblíži.
- **Každá akcia začína bránou.** Serverová akcia je koncový bod ako každý iný — to, že sa volá z chránenej stránky, nie je kontrola prístupu.
- 15 nových testov (spolu 547).

### Fixed (2026-08-28)

- **Parametrové vlastnosti v `UnknownHostError`** (`constructor(public readonly …)`) Node pri spúšťaní skriptov cez `--import ts-hook` odstrániť nevie (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). Kým `tenants.ts` nikto zo skriptov neimportoval, nevadilo to; odkedy `tenant_set.mjs` volá pravidlá z `lib/`, musí byť načítateľný. Prepísané na priradenie v tele — rovnaký kód, bez syntaxe, ktorú Node odmieta.
- **`node scripts/tenant_set.mjs` už nefunguje**, skript importuje z `src/lib` a potrebuje ts-hook: `npm run tenant -- …`. Príkazy v dokumentácii prepísané.

### Added (2026-08-28 — `npm run domeny`)

- **Stav domén tenantov jedným príkazom.** Pre každú doménu: či je vo Verceli, či zákazník už nastavil DNS, či mu v zóne nekolidujú staré záznamy, a ak čaká, presný `CNAME`. Odpovedá na otázku „prečo mu tá doména ešte nejde" bez klikania v dashboarde.
- **`--poslat` odošle pokyny zákazníkovi** na `branding.supportEmail` (`--komu` ju prebije) cez Ecomail. Hromadné rozposielanie zámerne nie je — `--poslat` vyžaduje `--company`.
- **Stav ani pokyny sa neukladajú.** Oboje sa číta naživo z Vercelu a odvodí z hostname; uložená kópia by klamala presne vtedy, keď na tom najviac záleží — zákazník si prestaví DNS a náš záznam by ďalej tvrdil „nastavené". Rovnaké pravidlo ako D27.
- **Zaznamenáva sa len akt:** `domainSetup { requestedAt, requestedTo, hostnames }` — komu a kedy sme pokyny poslali a čo sme pýtali. To sa odvodiť nedá; rovnaké rozlíšenie ako medzi úlohou a jej pridelením (D37).

### Added (2026-08-28 — vlastná doména zákazníka je tiež jeden príkaz)

- **`tenant_set.mjs` pridá vlastnú doménu do Vercelu sám** (`POST /v10/projects/{id}/domains`) a vypíše `CNAME`, ktorý má nastaviť zákazník. Dovtedy to bol jediný ručný úkon na zákazníka; teraz z našej strany nezostáva žiadny. Zvyšok je v zóne zákazníka a certifikát vydá Vercel automaticky.
- **Prihlásenie sa berie z lokálneho `vercel login`**, `VERCEL_TOKEN` má prednosť (beh mimo vývojárskeho stroja). Token nie je nikde v repozitári. `--no-vercel` krok vypne.
- **Poradie je zámerné: najprv `tenants`, potom Vercel.** Zápis tenanta je zdroj pravdy a zlyhanie cudzieho API nesmie brániť založiť organizáciu — skript to povie a doména sa doplní ručne.
- **Preskakuje, čo netreba,** a povie prečo: `*.contineo.app` (pokrýva wildcard), `localhost` a `*.localhost` (k Vercelu nedorazia), `*.vercel.app` (prideľuje ich Vercel).
- Overené na existujúcich tenantoch: `intranet.futbalsfz.sk` → „už v projekte je", `sfz.localhost` a `test.contineo.app` → preskočené s dôvodom.

### Added (2026-08-28 — `*.contineo.app` beží, nový zákazník je jeden príkaz)

- **Wildcard certifikát vydaný** (`cert_PdcCSg43yjBCGiGOmxOODZpL`, 90 dní, automatická obnova) po zapísaní `_acme-challenge TXT` do zóny `contineo.app`. Tým je celý reťazec kompletný: doména v projekte → `CNAME *` → certifikát.
- **Overené naživo na skúšobnom tenantovi `TEST`:** `test.contineo.app` vráti `200` a prihlasovaciu stránku so značkou „Skúšobná organizácia"; `nahodne123.contineo.app` vráti `404`, lebo v `tenants` nie je (D29).
- **Nový zákazník je odteraz jeden príkaz** — `tenant_set.mjs --company X --host x.contineo.app --name "…"`. Žiadny zásah do Vercelu, žiadne DNS, žiadne čakanie na certifikát. Vlastná doména zákazníka (ako `intranet.futbalsfz.sk`) zostáva možnosťou za cenu jedného zápisu vo Verceli.
- Tenant `TEST` je ponechaný ako terč na overovanie po zmenách; nemá ani jednu osobu, takže sa doň nedá prihlásiť.

### Fixed — otvorené (2026-08-28)

- **Neznámy hostiteľ dostane najprv `307` na `/prihlasenie` a až potom `404`.** Middleware beží pred kontrolou tenanta. Obsah neuniká a koniec je správne `404`, ale cudzia doména sa takto dozvie, že existuje cesta `/prihlasenie` — v rozpore s tým, čo D29 hovorí. Vedené v `TODO.md` (I1c); vyžaduje overenie tenanta priamo v middlewari, ktorý na edge do Atlasu nevidí.

### Changed (2026-08-28 — wildcard: DNS hotové, certifikát čaká na výzvu)

- **DNS je prestavené.** `*.contineo.app` už vedie na Vercel (`dig +short nahodne123.contineo.app CNAME` → `…vercel-dns-016.com.`).
- **Opravený môj predchádzajúci zápis.** Napísal som, že `TXT` overenie nebolo potrebné. Platilo to pre **overenie vlastníctva** domény, nie pre **certifikát**: wildcard sa vydáva cez DNS-01 výzvu a `_acme-challenge TXT` potrebuje vždy. Bežné domény certifikát dostanú automaticky, wildcard nie.
- **Postup dopísaný do `NASADENIE_app.md`** (`certs issue --challenge-only` → zapísať TXT → `certs issue`), aj s tým, ako sa chýbajúci certifikát prejaví: `curl` vráti `kod=000`, prehliadač hlási neplatný certifikát a v logoch Vercelu nie je nič — spojenie skončí skôr, než sa k aplikácii dostane.
- **Založený skúšobný tenant `TEST`** (`test.contineo.app`) na overenie celého reťazca hneď, ako certifikát bude.

### Docs (2026-08-28 — prečo nepreberáme vzor z inventaria)

- **Zapísaný rozbor otázky „na doméne zákazníka len prihlásenie a potom presmerovanie".** `inventario.estate` to tak má, ale kvôli zdieľanej cookie `COOKIE_DOMAIN=.inventario.estate` — pod cudzou doménou by prihlásená appka nefungovala. Contineo žiadnu `cookies` konfiguráciu nemá, relácia je host-only, a preto na `intranet.futbalsfz.sk` beží celá aplikácia.
- **Neušetrilo by to ani jeden zápis vo Verceli:** `majetok.futbalsfz.sk` je na projekte `inventario-app` registrovaná. Bez toho sa nevystaví certifikát a spojenie padne pri TLS, teda skôr než sa middleware spustí.
- Zapísané aj to, kedy by ten model zmysel mal: iba pri jednej relácii naprieč všetkými tenantmi, čo by pri onboardingu bolo skôr riziko (D32).

### Changed (2026-08-28 — wildcard `*.contineo.app` priradený projektu)

- **Vo Verceli je hotovo.** `*.contineo.app` je priradený projektu `contineo-app` a `verified: true`; overovací `TXT` nebol potrebný, lebo apex `contineo.app` je v účte a overený. Odteraz nová subdoména nepotrebuje vo Verceli nič.
- **Spresnenie k CLI:** tvar `vercel domains add <doména> <projekt>` naozaj neexistuje, ale jednoargumentový `vercel domains add '*.contineo.app'` spustený **v adresári projektu** doménu projektu priradí. Predchádzajúci zápis tvrdil, že cez CLI to nejde vôbec — nebola to pravda. `vercel domains inspect` pritom wildcard v sekcii „Projects" neukáže, vidno ho až cez API.
- **Zostáva jediný krok, a je mimo Vercelu:** na Websupporte má `contineo.app` zástupný `A * → 37.9.175.197`, ktorý wildcard prebíja. Treba ho nahradiť `CNAME * → 75b9ff58792d32ba.vercel-dns-016.com.` Apex a `www` sa nemenia.

### Docs (2026-08-28 — wildcard, a oprava nesprávneho príkazu)

- **Zapísaný postup pre `*.contineo.app`.** Cieľ: pri novom zákazníkovi nesiahať do Vercelu vôbec. Wildcard sa nastaví raz (doména v projekte + `CNAME *` a overovací `TXT` na Websupporte) a odvtedy stačí jediný príkaz `tenant_set.mjs`.
- **Opravený príkaz, ktorý som predtým zapísal nesprávne.** `vercel domains add <doména> <projekt>` **neexistuje** — CLI 54.1.0 berie `domains add` jediný argument a doménu pridá účtu, nie projektu. Priradenie k projektu sa cez CLI spraviť nedá, je to úkon v dashboarde. Overené pokusom, nie predpokladom.
- **Poznámka k bezpečnosti wildcardu:** doteraz museli sedieť dve nezávislé miesta (doména vo Verceli aj zápis v `tenants`). S wildcardom sa k aplikácii dostane každá `*.contineo.app` adresa a rozhoduje jediné miesto — `tenants`; ostatné dostane `404` (D29). Pre vlastné domény zákazníkov zostávajú miesta dve.

### Changed (2026-08-28 — adresy `*.vercel.app` zavreté dvakrát)

- **`*.vercel.app` sa zrušiť nedá** — Vercel ich prideľuje projektu aj každému jednotlivému nasadeniu. Dajú sa len zavrieť.
- **Prvá vrstva už bola nastavená:** `ssoProtection = all_except_custom_domains`, takže všetko okrem vlastných domén žiada prihlásenie do Vercelu.
- **Druhá vrstva pribudla:** `*.vercel.app` adresy sú odobrané z tenanta `LTK`. Aj keby ochranu niekto vypol, portál na nich odpovie `404` (D29) namiesto toho, aby ukázal obsah. Vypnutie ochrany je jedno kliknutie v cudzom rozhraní; zápis v `tenants` je náš a nezmení sa omylom.

### Changed (2026-08-28 — dodávateľské domény majú vlastného tenanta)

- **Na `app.contineo.app` visela značka SFZ.** Tenant `SFZ` mal medzi doménami aj `app.contineo.app`, `contineo-app.vercel.app` a `localhost`. Pri jedinom tenantovi to bolo neviditeľné, ale bola to nesprávna vlastnícka väzba: dodávateľská doména niesla logo zákazníka.
- **Vznikol tenant `LTK`** (značka „Contineo") pre `app.contineo.app`, `contineo-app.vercel.app`, `contineo-app-ltksolutions-projects.vercel.app` a `localhost`. `SFZ` si ponechal `intranet.futbalsfz.sk` a nový `sfz.localhost`.
- **Vedľajší efekt, ktorý stojí za zmienku: D29 je tým prvýkrát overená s dvomi tenantmi.** Doteraz existoval len jeden, takže „hostiteľ určuje organizáciu" bolo tvrdenie o kóde, nie pozorovanie. Overené naživo: `intranet.futbalsfz.sk` → SFZ s logom zväzu, `app.contineo.app` → Contineo.
- **Pre vývoj:** `npm run dev` beží na `localhost`, teda pod `LTK`. Rozhranie zväzu sa pozerá na `http://sfz.localhost:3000` — prehliadače smerujú celé `*.localhost` na `127.0.0.1`.
- V `LTK` zámerne nie je ani jedna osoba: kto sa tam prihlási, uvidí, že do tejto organizácie nepatrí (D32). Je to ukážková doména, nie druhý portál.

### Fixed (2026-08-28 — stránka 404 prezrádzala to, čo má zamlčať)

- **Neznámy hostiteľ dostával `404` s celým obalom.** Hlavička so značkou organizácie a nová pätička s názvom aplikácie, verziou a odkazom na repozitár mu povedali všetko naraz — na stránke, ktorá to má podľa D29 práve zamlčať. Bez tenanta sa odteraz nevykreslí ani hlavička, ani pätička; zostane holý text.
- **Aj názov v záložke prehliadača je informácia.** `metadata` sa zmenila na `generateMetadata`: neznámy hostiteľ dostane „Stránka sa nenašla", nie „Contineo — testovacie rozhranie".
- **Výpadok databázy sa od cudzej domény odlišuje.** `null` z `currentTenant()` znamená doménu, ktorá nepatrí nikomu; výpadok vyhodí výnimku a vtedy obal aj názov zostávajú — nejde o cudziu doménu, ale o našu vlastnú, ktorá sa práve nedá overiť.
- **Slovenská stránka 404.** Dovtedy tam bol Nextov predvolený anglický text „This page could not be found.", ktorý v slovenskom rozhraní vyzerá skôr ako porucha servera než ako preklep v adrese.
- **`npm run stav` vypisuje aj tenantov** — doména → `companyCode`. Pri „prečo mi tá doména nejde" je to prvá vec, ktorú treba vidieť.
- **`NASADENIE_app.md`: doména tenanta žije na troch miestach** (DNS, projekt vo Verceli, kolekcia `tenants`) a prečo to nesmie byť „Redirect" — presmerovanie mení hlavičku `Host`, z ktorej sa určuje tenant.

### Added (2026-08-28 — pätička a menu len pre prihlásených)

- **Neprihlásený človek videl celé menu portálu.** Stránky za ním sú chránené middlewarom, takže obsah neunikol — ale zoznam sekcií mu o vnútri systému hovorí viac, než potrebuje vedieť, a na prihlasovacej stránke ho to mätie. Menu aj tlačidlo „Odhlásiť" sa odteraz ukazujú len prihlásenému.
- **Prihlásenie sa berie zo servera (`currentEmail()` v layoute), nie z `useSession()`.** Okrem správnosti to rieši blikanie: `useSession()` začína stavom „neviem" a odpoveď dorazí až po ďalšej požiadavke, takže menu by na okamih bliklo aj tam, kde byť nemá.
- **Pätička hovorí, že systém beží na Contineu** — odkaz na `contineo.app`, odkaz na repozitár a číslo verzie. Portál nesie značku organizácie, nie dodávateľa, a to je správne: nad záväzným potvrdením smernice nemá stáť cudzia značka. Povedať sa to ale niekde musí, inak človek s problémom nevie ani to, ako sa aplikácia volá.
- **Číslo verzie nie je ozdoba.** Pri hlásení „nefunguje mi to" je prvá otázka „čo presne ti beží". Zobrazuje sa `verzia 0.1.0 · <7 znakov commitu>`; obe hodnoty vpisuje `next.config.mjs` pri builde, lebo `package.json` sa na Verceli za behu prečítať nedá a `npm_package_version` tam nikdy nie je vyplnené. Jediná pravda o čísle zostáva `app/package.json`.
- **Odkazy von majú `rel="noreferrer"`** — bez neho by sa cieľová stránka dozvedela internú doménu zväzu, z ktorej sa na ňu kliklo.
- **Značky Continea a GitHubu sú v jednom module** (`ZnakContineo.tsx`). Kresba v SVG je presne to, čo sa pri kopírovaní rozíde: jedna kópia sa opraví, druhá zostane stará a nikto si to nevšimne.
- Overené na 375 px v oboch stavoch (prihlásený aj nie), bez vodorovného posúvania.

### Verified (2026-08-28 18:17 — prihlásenie cez `persons` naostro)

- **Najdlhšie otvorený červený bod Fázy 8 je zavretý.** Log: `[auth] pouzitie-odkazu: jan.letko@futbalsfz.sk — persons povolil`. Núdzová brzda sa nezúčastnila, takže cesta, ktorou pôjde vyše sto ľudí vrátane externistov bez M365, je odskúšaná v produkcii — nie odvodená z kódu.
- **Evidencia prihlásenia sa zapisuje.** `stav=active`, `lastLoginAt=2026-08-28T18:17:54.682Z` — v tej istej sekunde ako callback. `await recordSignIn(...)` sa tým overil naostro; dovtedy sa nezapisovalo nikdy, lebo brzda vracala `true` skôr, než sa k zápisu vôbec došlo. `invited → active` prebehlo tiež.
- **Odkaz z e-mailu vedie na úvodnú stranu** (callback `302` → `GET /`), kde sa na živých dátach zobrazil widget „Nevybavené žiadosti".

### Changed (2026-08-28 — núdzová brzda má vlastnú adresu)

- **`POVOLENE_EMAILY` prestavená z `jan.letko@futbalsfz.sk` na `intranet@futbalsfz.sk`.** Brzda sa vyhodnocuje prvá, takže adresa, ktorá je v nej, sa nikdy neprihlási cez `persons`. Kým tam bola bežná pracovná adresa správcu, cesta, ktorou pôjde stovka ľudí, zostávala neodskúšaná a vyzeralo to, že prihlásenie funguje. Brzda odteraz obsahuje osobitnú správcovskú adresu, ktorá sa na bežnú prácu nepoužíva; `jan.letko@futbalsfz.sk` sa testuje ako bežný používateľ.
- **Zapísané do `NASADENIE_app.md` ako pravidlo,** nie ako jednorazová zmena — aj s tým, že sa to overuje runtime logom a nie `vercel env pull`, ktorý pre túto premennú vracia prázdnu hodnotu, aj keď nastavená je.

### Fixed (2026-08-28 — po prihlásení človek skončil späť na formulári)

- **Odkaz z e-mailu vrátil prihláseného človeka na prihlasovaciu stránku.** `signIn("email", …)` sa volalo bez `callbackUrl`, takže si ho NextAuth vzal z aktuálnej adresy — a tou bola práve prihlasovacia stránka. Relácia vznikla správne (v hlavičke bolo „Odhlásiť"), ale obsah stránky ostal formulár, takže to vyzeralo, akoby prihlásenie nefungovalo.
- **Prihlásený človek sa z `/prihlasenie` presmeruje na úvodnú stranu.** Rieši to stránka sama, nie len `callbackUrl` v odkaze: rovnaká slepá ulica vznikne aj zo záložky alebo z histórie prehliadača. Kontrola je až za overením hostiteľa — neznáma doména nedostane ani presmerovanie (D29).

### Changed (2026-08-28 — `recordSignIn` sa čaká)

- **`void recordSignIn(...)` nahradené `await`.** Fire-and-forget zápis v serverless funkcii je nespoľahlivý: funkcia končí hneď po vrátení hodnoty a rozrobený dotaz do Atlasu sa môže zahodiť. Pôvodný dôvod pre `void` (zlyhanie zápisu nesmie zhodiť prihlásenie) drží aj s `await`, lebo `recordSignIn` si chyby prehĺta sám. Regresný test v `tests/signIn.test.ts` je overený obojsmerne.
- **Poctivá poznámka k dôkazu:** prázdne `lastLoginAt` v produkcii **nie je** dôkazom tejto chyby, ako som najprv napísal. Vysvetľuje ho núdzová brzda, ktorá vracia `true` skôr, než sa `recordSignIn` vôbec zavolá. Oprava je správna sama osebe, ale odôvodnenie bolo nesprávne.
- **I1c zostáva červené.** Medzitým som ho označil za overené na základe `vercel env pull`, ktorý vrátil prázdne `POVOLENE_EMAILY`. Runtime log hovorí opak — `— cez núdzovú brzdu` — a rozhoduje beh, nie výpis premennej. Cesta cez `persons` je stále neodskúšaná.

### Added (2026-08-28 — Fáza 9a: widget „Nevybavené žiadosti")

- **`app/src/lib/pending.ts` — register zdrojov.** Widget nevie nič o normách ani tiketoch; pýta sa zdrojov a skladá z nich jeden zoznam v jednom tvare (`PendingItem`). Keby sa pýtal každého modulu zvlášť, každý ďalší zdroj by znamenal ďalšiu vetvu v komponente, ktorý má len vypísať zoznam. V rozsahu A je zdroj jediný: **nepotvrdené normy nad existujúcim `trackProgress()`** — nie druhý výpočet toho istého, ktorý by sa raz rozišiel práve pri novej verzii (D27).
- **Widget je na úvodnej strane nad hľadaním.** Odkaz na prihlásenie príde e-mailom a prvá obrazovka po kliknutí je táto — hore patrí to, čo od človeka chceme, nie ukážka toho, čo systém vie. Hľadanie zostáva pod tým. Komu nepatrí ani jedna trasa, widget sa nezobrazí vôbec: prázdna karta by mu len zabrala prvú obrazovku.
- **Zablokovaný krok sa medzi úlohy nedostane.** Úloha, s ktorou človek nemôže pohnúť (dokument bez platného znenia), nie je úloha a v zozname by len visela. Zamlčať sa ale nesmie, inak widget tvrdí „nič nečaká" — preto o nich povie jednou vetou s odkazom na `/dokumenty`, kde je aj dôvod.
- **Tá istá norma v dvoch trasách sa ukáže raz.** Identitou položky je dvojica zdroj + `id`, nie krok trasy.
- **Výpadok jedného zdroja zoznam nezhodí.** Zdroje sa pýtajú súbežne a chyba ide do logu; prázdny widget kvôli výpadku helpdesku by človeku povedal „nič nečaká", čo je horšie než neúplný zoznam.
- **13 nových testov** (spolu 516). Testuje sa to, čo môže ukázať nepravdu: zdvojenie, zablokované, poradie, výpadok zdroja, prázdny stav.

### Changed (2026-08-28)

- **„Odkedy to čaká" a príznak „nové" sa odložili do rozsahu B.** Pri implementácii vyšlo najavo, že `lastLoginAt` treba porovnávať s tým, *kedy úloha pribudla* — a to v rozsahu A neexistuje. `effectiveFrom` je právna platnosť (norma z roku 2019 by nebola „nová" ani pri prvom stretnutí), `publishedAt` je nepovinné. Widget preto neukazuje ani jedno; oboje dodá `assignments.assignedAt` (D37). Zoradenie je zatiaľ podľa `effectiveFrom` zostupne a je označené ako dočasné priamo v kóde.

### Planned (2026-08-28 — Fáza 9: udalosti a upozornenia)

- **`docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md` — návrh čaká na schválenie, kód sa nezačal.** Zadanie: widget „Nevybavené žiadosti" na úvodnej strane a interný systém upozornení.
- **Pri rozbore vyšlo najavo, že to nie je len zobrazovacia úloha.** Rozposlanie úlohy je dnes tiché: nová verzia normy sa začne rátať ako nepotvrdená všetkým, koho sa trasa týka, bez rozhodnutia a bez stopy. Widget by tomu dal viditeľné miesto na úvodnej strane — teda by problém zväčšil, nie vyriešil.
- **Nové rozhodnutia D36–D40.** Kľúčové je **D37**: úloha sa naďalej odvodzuje (D27 platí), ale **pridelenie sa zaznamenáva** — rovnaký vzor ako `acknowledgements`. Rozsah B tým uzatvára aj **D30** („podstatná zmena" prestane byť definíciou a stane sa dôvodom, ktorý vyplní človek).
- **✅ D40 rozhodnuté (2026-08-28): možnosť (a).** Jednorazové systémové hlásenia („Import zlyhal 3. 9. o 4:00") sa odvodiť nedajú, a tak v rozsahu A nebudú vôbec — widget ukazuje výhradne úlohy. Kolekcia `notifications` vznikne až s prvým skutočným odosielateľom (kurácia alebo helpdesk). Dôsledok pre rozhranie: widget sa volá „Nevybavené žiadosti", nie „Upozornenia" — inak by človek čakal aj hlásenia, ktoré tam nebudú.
- **Rozsah A je tým odblokovaný** a nepotrebuje žiadne nové pole: `since` aj príznak „nové" sa dajú zložiť z toho, čo `documents.versions[]` a `persons.lastLoginAt` už nesú.

### Fixed (2026-08-28 — prihlásenie na vlastnej doméne)

- **Odkaz v e-maile viedol na `app.contineo.app` aj tomu, kto začal na `intranet.futbalsfz.sk`.** `NEXTAUTH_URL` je jedna hodnota na celé nasadenie. `rewriteLinkHost()` prepíše hostiteľa na doménu požiadavky — ale **len ak je to známy tenant**; inak by sa podvrhnutou hlavičkou `Host` dala do cudzej schránky poslať adresa útočníka s platným tokenom. Cudzia adresa v `callbackUrl` sa necháva tak: „opraviť" ju na našu doménu by ju zamaskovalo. Nový `redirect` callback dovolí návrat len na známu doménu, takže nevzniká otvorené presmerovanie.
- **E-mail aj hlavička nesú názov, logo a farbu organizácie.** Predmet je „Prihlásenie — {organizácia}" (sk/cs/en), nie „Prihlásenie do Contineo". Odznak „testovacie rozhranie" sa nad záväzným potvrdením už neukazuje.
- **Prihlásenie hovorí, prečo nevyšlo** — NextAuth `logger` + záznam v `signIn` callbacku rozlíši žiadosť o odkaz od jeho použitia a núdzovú brzdu od `persons`. Prvá vec, ktorú to ukázalo: overené prihlásenie prešlo **cez núdzovú brzdu**, takže cesta cez `persons` je v produkcii stále neodskúšaná (`TODO.md` I1c).
- **Loga tenantov musela dostať výnimku z brány prihlásenia.** Prihlasovacia stránka načítava logo samostatnou požiadavkou, ktorá ešte nie je prihlásená; bez výnimky ju middleware presmeroval a z hlavičky zostal holý text.

### Added (2026-08-28 — tenant podľa hostiteľa, D29)

- **`app/src/lib/tenants.ts` + kolekcia `tenants`.** Hostiteľ určuje `companyCode`, vzhľad a jazyky. **Neznámy hostiteľ je zakázaný, nie predvolený** (ADR-002, ADR-003 kap. 5.4): predvolený tenant by znamenal, že ktokoľvek, kto si nasmeruje vlastnú doménu na naše nasadenie, dostane rozhranie niekoho iného — a bude to vyzerať legitímne, lebo certifikát aj obsah sedia. Odpoveď je `404`, nie vysvetľujúca hláška.
- **Prečo samostatný modul a nie rozšírenie `tenantProfile.ts`:** ten odpovedá na otázku „ktorý model a kde počíta" (ADR-001), tento na otázku „ktorá organizácia". Rôzna životnosť, rôzny vlastník; v jednom zázname by si neznámy hostiteľ priniesol aj nastavenie poskytovateľov.
- **`onboardingContext()` v `session.ts`** vracia stav požiadavky ako **jednu hodnotu** (`unknown-host` / `not-signed-in` / `not-in-tenant` / `ready`), nie ako tri nezávislé kontroly. Keby si každá stránka skladala „tenant + osoba + patria k sebe" sama, jedna z nich raz niektorú časť vynechá — a chýbajúca kontrola nevyzerá ako chyba, vyzerá ako fungujúca stránka.
- **Kontrola je aj v `POST /api/acknowledgements`,** nielen na stránke. Zápis potvrdenia je jediné miesto, kde vzniká auditný záznam, a volanie API stránku obchádza — záznam nesmie vzniknúť pod hlavičkou organizácie, ku ktorej potvrdzujúci nepatrí.
- **`app/scripts/tenant_set.mjs`** zakladá a upravuje tenanta; doménu už priradenú inému tenantovi **odmietne, nie prepíše**. Tiché prevzatie domény sa zistí až vtedy, keď ľudia z jednej organizácie uvidia hlavičku druhej. Rovnaké pravidlo drží aj unikátny index `hostname_unique` — databáza to ustráži aj vtedy, keď to skript prehliadne.
- Stav testov: **19 súborov, 489 testov** (z toho 25 nových na `tenants`).
- **Vedomé obmedzenie:** kontrola beží v serverových komponentoch a route handleroch, **nie v middleware** — to beží na hrane, kde Mongo klient nie je. Staršie plochy (`/`, `/sada`, `/api/chat`) sú tak chránené prihlásením, ale nie tenantom.
- **Portál SFZ má adresu `intranet.futbalsfz.sk`** — `CNAME` na Websupporte, doména vo Verceli overená, v `tenants` priradená tenantovi `SFZ`. Pôvodne plánovaná `internal.futbalsfz.sk` **je obsadená** (`CNAME` na `sportnet.online`) a prepnutie by odstavilo bežiacu službu; v starších zápisoch je preto `internal` neplatný stav (`NASADENIE_app.md` kap. 0b).

### Fixed (2026-08-28 — nasadenie z Gitu)

- **Projekt `contineo-app` napojený na GitHub.** Push do `main` odteraz spúšťa produkčné nasadenie sám; root directory nastavené na `app`, produkčná vetva `main`. **Dovtedy napojený nebol a nikto si to nevšimol** — posledné nasadenie bolo staré 31 dní, hoci v repozitári medzitým pribudlo desať commitov. Kód bol hotový, testy prechádzali, živá aplikácia o ňom nevedela; `/dokumenty` na `app.contineo.app` neexistovalo, lebo build ho nepoznal. Ticho zlyhávajúce nasadenie je horšie ako hlučné, preto je stav napojenia zapísaný v `docs/NASADENIE_app.md`, nie len v nastaveniach Vercelu.
- Z toho istého repozitára sa teraz nasadzujú **dva** projekty — `contineo` (root `web`, marketingový web) a `contineo-app` (root `app`). Jeden push prestavia obe, aj keď sa menili len `docs/`. Ak by build minúty prekážali, *Ignored Build Step* `git diff --quiet HEAD^ HEAD -- .` to vyrieši.

### Added (2026-08-27 — skripty onboardingu)
- **`app/scripts/import_persons.mjs`** — import osôb z CSV. **Náhľad je predvolené správanie, zápis sa musí vypýtať** (`--zapis`): nahratie stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` rollback nemá. Pri chybnom riadku nezapíše nič — zápis po častiach by nechal databázu v polovičnom stave. Hlavičky sa normalizujú (bez diakritiky, bez ohľadu na veľkosť), takže `Meno`, `meno` aj `MENO` sú to isté; prijíma slovenské aj anglické názvy stĺpcov.
- **`app/scripts/acknowledgement_report.mjs`** — výkaz potvrdení pre HR do CSV: kto potvrdil, kedy, ktorú verziu a v akom jazyku — a kto nie. Rozsah je **jeden `companyCode`, nie strom** (D32, D33). Výkaz ide na štandardný výstup, hlásenia na chybový, takže sa dá presmerovať do súboru.
- **`app/scripts/lib/csv.mjs`** — čítanie a písanie CSV bez knižnice: BOM z Excelu, bodkočiarka ako oddeľovač v slovenskom locale, úvodzovky okolo polí s oddeľovačom. 17 testov (`tests/csv.test.ts`) — keď sa hlavička netrafí, import ticho preskočí stĺpec a stovka ľudí príde o útvar alebo o jazyk.
- **`app/scripts/lib/ts-hook.mjs`** — dovolí skriptom importovať moduly zo `src/` priamo. Node 26 vie TypeScript spustiť (odstráni typy), ale nevie dohľadať bezpríponové relatívne importy; háčik ten rozdiel premostí. **Bez neho by skripty potrebovali vlastnú kópiu pravidla, ktorá verzia dokumentu platí** — a dve implementácie právneho pravidla sa raz rozídu bez toho, aby si to niekto všimol, lebo obe „fungujú".
- `src/lib/mongodb.ts`: typy z `mongodb` sa importujú cez `import type`. Node nevie, ktoré z pomenovaných importov sú typy, takže `Document` medzi hodnotami by skripty zhodil.
- Stav testov: **17 súborov, 454 testov**.


### Changed (2026-08-27 — identifikátory po anglicky)
- **Kód Fázy 8 premenovaný na anglické identifikátory.** Moduly `osoby.ts` → `persons.ts`, `dokumenty.ts` → `documents.ts`, `potvrdenia.ts` → `acknowledgements.ts`, `jazyky.ts` → `i18n.ts`; typy, funkcie, parametre aj lokálne premenné podľa toho. **Komentáre a popisy testov zostávajú po slovensky** — menia sa mená, nie reč vysvetlení.
- **Hodnoty vracané z API sú teraz strojové a anglické** (`"no-effective-version"`, `"already-acknowledged"`, `"invalid-email"`…). Sú to kľúče pre volajúceho, nie text pre človeka; ten sa priradí až v rozhraní podľa jazyka.
- Konvencia zapísaná do `docs/rag-architecture.md`. Staršie moduly (`hodnotenia.ts`, `cennik.ts`, `sada.ts`, `povoleneEmaily()`/`jePovoleny()`) sa neprepisujú naraz — premenujú sa, keď sa ich niekto aj tak dotkne.
- **Testy zamerané na funkcionalitu:** vypustené kontroly znenia českého a anglického prekladu formulky. Preklady prostredia sú samostatná vec a testovať ich reťazec po reťazci znamená udržiavať slovník dvakrát. Zostáva to, čo je funkcia — výber jazyka, fallback a invariant, že formulka v každom jazyku nesie názov, verziu aj dátum. (438 testov v 16 súboroch.)


### Changed (2026-08-27 — testy prešli na Vitest)
- **`npm test` beží cez Vitest** (`vitest run`), pribudlo `test:watch` a `test:coverage`. Vlastný beh testov (`tests/run.mjs` + bundlovanie esbuildom) sa už nepoužíva.
- **Dôvod nebol „Vitest je štandard", ale konkrétny strop:** funkcie volajúce `getCollection()` sa nedali otestovať vôbec — a boli medzi nimi tie najdôležitejšie: `personMaySignIn()` (brána medzi internými smernicami a internetom), `acknowledge()` (zápis právneho záznamu) a `zalozOsoby()` (hromadný import). Obísť sa to dalo len pridaním testovacieho švu do verejného rozhrania každého modulu; `vi.mock()` to rieši bez toho.
- **Suity sa neprepisovali.** Pôvodný tvar `t("popis", podmienka)` zostal a len registruje test do Vitestu cez `tests/helper.ts` — 2 200 riadkov ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a v testoch sa preklep neprejaví zlyhaním, ale falošným pokojom. **Nové testy sa píšu idiomaticky** (`expect(skutočné).toBe(očakávané)`), aby bolo pri zlyhaní vidieť rozdiel hodnôt.
- **Nová suita `tests/onboardingDb.test.ts`** — 17 testov nad falošnou databázou: že `acknowledge()` si verziu určí na serveri a nedá sa podvrhnúť staršia; že duplicitný zápis skončí ako `uz-potvrdene` a nie ako chyba servera; že iná chyba sa za „už potvrdené" nezamaskuje; že znenie je v jazyku človeka a `documentLanguage` v jazyku smernice; a hlavne, že **chyba databázy v `personMaySignIn()` neotvorí prístup**.
- Stav: **16 súborov, 442 testov, 0,7 s** (predtým 15 súborov bundlovaných po jednom).


### Added (2026-08-27 — viacjazyčné prostredie, D35)
- **`app/src/lib/i18n.ts`** — jazyk prostredia (SK · CS · EN): zoznam podporovaných jazykov, znenie potvrdzovacej formulky a texty prihlasovacieho e-mailu per jazyk, deterministické formátovanie dátumu.
- **Rozhodnutie D35:** viacjazyčné je **len prostredie, nie obsah**. Dokument má základný jazyk, v ktorom je napísaný (`documents.language`); dokument v inom jazyku je **samostatný dokument, nie preklad**. Zoznam jazykov prostredia je preto oddelený od číselníka `language`, ktorý tagguje obsah.
- **`persons.language`** — jazyk prostredia osoby; prihlasovací e-mail sa posiela v ňom. Pri neznámej osobe alebo nedostupnej databáze platí slovenčina: zlý jazyk je nepríjemnosť, neodoslaný odkaz sú zavreté dvere. Opakovaný import bez stĺpca jazyka jazyk **neprepíše** — rovnaká pasca ako pri `status`.
- **`acknowledgements.language` + `documentLanguage`** — záznam ukladá aj to, v akom jazyku človek formulku videl, aj to, v akom jazyku je smernica. Bez toho sa pri audite nedá odpovedať, či český rozhodca potvrdzoval slovenský text.
- **Jazyk v `app/` sa berie z profilu osoby, bez prefixu v URL** (na rozdiel od marketingového webu). Dôvod je bezpečnostný — `middleware.ts` je definovaný ako „všetko okrem" a pridávať doň jazykový segment znamená hrabať sa v jedinom mieste, ktoré stojí medzi internými smernicami a internetom.
- Anglická formulka používa slovný mesiac (`1 September 2026`), aby v právnom texte nevznikla nejednoznačnosť medzi britským a americkým poradím čísel.
- Testy: 14 nových (formulka v troch jazykoch, formáty dátumu, normalizácia `sk-SK`/`cs_CZ`, fallback pri neznámom jazyku). 15 suít prechádza, `type-check` čistý.


### Fixed (2026-08-27 — ADR-001 stálo na neplatnom predpoklade)
- **ADR-001 dodatok 10:** `voyage-4-nano` **TEI nepodporuje** (otvorená issue #816 zo 6. 2. 2026, bez PR) — štítok `text-embeddings-inference` na karte modelu je v rozpore s issue v repozitári TEI. Otázka „ktorý server pre nano" bola 26. 7. **zatvorená práve s odvolaním sa na TEI**; je **znovu otvorená** ako O7-a. Príklad T3 profilu prepísaný z `kind: "tei"` na `kind: "infinity"` (vLLM/Infinity, OpenAI tvar) — v pôvodnom znení sa nedal postaviť. Poučenie: štítok na karte modelu nie je záväzok podpory.
- **Poistka proti tichému zhoršeniu hľadania** (`app/src/lib/providers/embedding/http.ts`): `HttpEmbeddingProvider.embed()` tvrdo zlyhá, kým nie je doplnené rozlíšenie dotaz/dokument a prompty modelu (O7 nález B). `voyage-4-nano` používa iné prompty pre dotaz a pre dokument; bez nich sa vektory posunú a meranie O1 na adaptér neplatí — **nespadne to, len horšie hľadá**. Nešlo o živú chybu (reťaz beží cez `atlas-auto`, `embed()` sa nikde nevolá), ale o pascu pre prvého, kto prepne tenanta na on-prem. Drôtový tvar volania zostal v `embedRaw()`, takže testy tvaru požiadavky a parsovania odpovede platia ďalej; 13 suít prechádza, `type-check` čistý.

### Decided (2026-08-27 — O7 sa odkladá za Fázu 8)
- **Fázy 1–5 z `docs/O7_plan_overenia.md` odložené.** Nie je to zmena názoru na O7 — zmenilo sa poradie: Fáza 8 (onboarding) **nevolá žiadny model**, takže spĺňa `eu-full` bez O7; **D34** zaraďuje on-prem na vetvu veľkých organizácií, ktorá nie je primárny produkt; **O12** rozhodlo zostať na Verceli, čím sa odložil celý smer odchodu zo zdieľanej infraštruktúry. Vrátiť sa, keď o on-prem požiada zákazník alebo tender.
- **Fáza 0 (prompty) zostáva ako práca na ~pol dňa** — poistka ju vynúti pred spustením fázy 1.

### Added (2026-08-27 — dopísané zo staršej práce)
- **`docs/O7_plan_overenia.md`** — plán overenia vlastného embeddingu a reranku (O7) z 2026-07-28, stav „návrh, čaká na schválenie". Vznikol v inej relácii a **nebol commitnutý**; obsahuje nálezy A–D (TEI neobslúži `voyage-4-nano`, chýbajúce prompty ako tichá chyba, O1 meraný na malých dátach, nano na MacBooku už bežalo), rozpočet pamäte na 16 GB, fázy 0–5, riziká R1–R5 a otvorené body O7-a…d.

### Changed (2026-08-27 — diagram architektúry: CMS, kurátor, hierarchia, portál)
- **Diagram prekreslený** (`web/public/contineo_diagram{,.cs,.en}.svg`, `docs/contineo_diagram.svg`, pregenerované `.png`): pribudol **CMS ako vrstva** obopínajúca vstupné kanály a worker, **kurátorská brána** („kanál smie len predvyplniť, publikuje človek" — D-CMS-6, D25), doplnené **kolekcie** v jadre (`documents (+ versions)`, `channels`, `channel_runs`, `navigation`, `categories`, `persons`, `acknowledgements`, `onboarding_tracks`), **hierarchia tenantov** (`companyCode.parent` — centrála → dcéry → prevádzky, s výslovnou poznámkou „hierarchia nedáva prístup") a **Portál (KB + onboarding)** medzi rozhraniami. Z jadra odstránená poznámka o Atlas EU / Community 8.2 — doslovne sa opakovala v päte.
- **Diagram sa už generuje** z jedného zdroja — `web/scripts/gen_diagram.py` (rozloženie + slovník SK/CS/EN). Predtým existovali štyri ručne udržiavané kópie a už sa rozišli: `docs/` verzia niesla `rerank-2.5`, webová `rerank-2`. Zjednotené na `rerank-2` (súlad s `rag-architecture.md` a `AKO_TO_BEZI.md`).
- **Opravené neexistujúce preklady** legendy spätných cyklov — položky `① qa_pair` a `② ticket` boli vo všetkých troch jazykových variantoch po slovensky.

### Decided (2026-08-27 — hierarchia tenantov a model dodávky)
- **D32:** **každý `companyCode` vidí len svoje záznamy a svoj obsah** — cudzie len vtedy, keď je menovite zdieľané cez `sharedWithCompanyCodes[]` (alebo je `accessLevel: public`). **`companyCode.parent` neudeľuje prístup** — hierarchia slúži na relevanciu a precedenciu noriem, nie na oprávnenie. Dôvod: chyba smerom „vidí viac" je tichá, chyba smerom „vidí menej" je hlučná.
  - *Opravené v ten istý deň:* prvé znenie tvrdilo, že `scope: global` sprístupní obsah celej skupine. To zamieňalo dve osi, pred ktorými `DATA_MODEL_konzistencia.md` výslovne varuje — `scope` hovorí, **na koho sa norma vzťahuje**; `accessLevel` + `companyCode`, **kto ju smie vidieť**. Poznámka o ortogonalite doplnená priamo do `DATA_MODEL_konzistencia.md`.
- **D33:** HR vidí potvrdenia **len svojho `companyCode`** — nie potomkov, nie nadradenú jednotku, nie sesterské. Ak má centrála vidieť potvrdenia dcéry, potrebuje explicitné oprávnenie, ktoré sa zaznamená.
- **D34:** primárne **SaaS na `contineo.app`** pre malé a stredné firmy; veľké organizácie dostanú **vlastné nasadenie tej istej platformy**, nie fork zdrojáku (fork = nedoručiteľné opravy a N nekompatibilných verzií).

### Added (2026-06-29 — blok Identita a prístup)
- **Nová sekcia „Identita a prístup"** na homepage (`web/components/Identity.js`, zaradená pred Bezpečnosť v `web/app/[lang]/page.js`, odkaz v `Nav.js`): SSO/jednotné prihlásenie (Entra ID, Google Workspace, OAuth/OIDC, vlastná DB), automatické zakladanie účtov z CRM/zdroja identity, multi-tenant prístup, bezpečnosť na úrovni dotazu (default-deny) + rad odznakov poskytovateľov identity. SK+EN (`dict.identity`).
- **Hlbší blok „Identita a riadenie prístupu" na `/technologia`** (`dict.tech.identity` SK+EN + render v `Tech.js`): tabuľka poskytovateľov (NextAuth → kanonická session), princípy (server-side, default-deny, filter pred LLM, auto-provisioning), dva režimy nasadenia. Vychádza z `docs/PRISTUPOVE_PRAVA.md`; sportnet.online uvedený len ako príklad.

### Changed (2026-06-29 — univerzálny pozicioning webu, Tier 4)
- **Web prepísaný na doménovo neutrálny jazyk** (`web/lib/dictionaries.js` SK+EN, `web/components/Tech.js`, `BotDemo.js`, `OverlayDemo.js`). Generická firma ako doména ukážok: číselník sekcií (`smernice`, `hr`, `ekonomicke`, `it_aplikacie`, `gdpr`), `companyCode` príklady `ACME`/`ACME-BA`, multi-tenant ako „centrála → regionálne → lokálne jednotky", FAQ demo na home office / dovolenku / reset hesla.
- **Futbal/SFZ presunutý do označeného Case study bloku** na `/technologia` (`tech.caseStudy` SK+EN + render v `Tech.js`) + úvodná poznámka `tech.exampleNote`, že príklady sú ilustračné a produkt je univerzálny.
- **sportnet.online** uvádzaný len ako *príklad* zdroja identity vo všeobecných formuláciách; detaily v Case study.
- Plán zmien: `docs/WEB_UNIVERZALNY_POZICIONING_PLAN.md`.

### Added (2026-06-29 — koncepcia CMS)
- **Návrhový dokument** `docs/CMS_KONCEPCIA.md` — CMS s tromi zodpovednosťami: (1) media manager pre RAG, (2) content engine pre verejný web (knowledge base / helpdesk), (3) správa vstupných kanálov. Rozlíšenie typov obsahu (`document` vs `web`) v jednej kolekcii `documents`; oddelenie `processingStatus` (workre) od `status` (publikácia); kanály ako spravované inštancie adaptérov (`channels`, `channel_runs`); roly v CMS; user flows; naviazanie na fázy.
- **Doménová univerzálnosť zdôraznená** — Contineo je univerzálna aplikácia; futbal/SFZ je len ukážka nasadenia do veľkej organizácie (zapracované do `CMS_KONCEPCIA.md`).

### Decided (2026-06-29 — rozhodnutia CMS D-CMS-1..6)
- **D-CMS-1:** web obsah žije v `documents` cez `contentType` (`document`|`web`), web-polia v `webPublish` — žiadna samostatná kolekcia.
- **D-CMS-2:** editor = Markdown + náhľad, s WYSIWYG vrstvou nad Markdownom (Markdown ostáva kanonické úložisko).
- **D-CMS-3:** helpdesk štartuje cez **web widget vložený do stránky**; e-mailový kanál je druhý krok na tej istej `tickets`/`channels` štruktúre. (E-mail je dnes hlavný kanál otázok, cieľom je presun na widget.)
- **D-CMS-4:** verejná KB = len kurátorské články + kanonický odkaz na normu (žiadne auto-generovanie z noriem).
- **D-CMS-5:** EN preklady = AI-návrh → kurátor potvrdí.
- **D-CMS-6:** žiadny auto-publish z kanála; predvyplnenie áno, finálny publish potvrdzuje človek.

### Added (2026-06-26 — centrálne číselníky + multi-zdrojová ingescia)
- **Centrálne číselníky (vzory/seed)** v `app/src/codelists/` — `sectionKey` (hierarchický), `companyCode`, `scope`, `accessLevel`, `language`, `category`, `sourceType`, `tags` + `README.md` a validačná `_schema.json`. Princíp: „closed vocabulary" pre povinné parametre — čo nie je v číselníku, sa do `document_chunks` nedostane.
- **Návrhový dokument** `docs/CISELNIKY_governance.md` — katalóg parametrov, úložisko (hybrid: kolekcia `codelists` + verzovaný seed), governance, validačná brána pri ingescii.
- **Návrhový dokument** `docs/INGESTION_zdroje_reconciliation.md` — source-adapter vrstva (PDF/MD, MCP, web link, API/DB), provenance model a reconciliation pri zmene číselníka (change-request + náhľad dopadu).

### Added (2026-06-26 — prístupové práva)
- **Návrh prístupových práv** `docs/PRISTUPOVE_PRAVA.md` (Fáza 5): ABAC + multitenant hierarchia (SFZ→regionálny→oblastný, `companyCode` = CompanyID). Verejný obsah nie je izolovaný; interný izolovaný per CompanyID s per-dokument zdieľaním (`sharedWithCompanyCodes`). Identita primárne zo **sportnet.online** (OAuth + MCP + CRM `api.sportnet.online/v1`); konverzná tabuľka `sportnet_role_map` (profil→skupina); re-sync login+webhook; CMS upload = ručný allowlist; enforcement vo filtri (default-deny, oba indexy); dva režimy nasadenia (anonymný widget vs. interný portál); relevancia rozpisov cez riadiaci zväz.
- **`sectionKey` uzamknutý na štruktúru Predpisov SFZ** (`app/src/codelists/sectionKey.json`): Stanovy · Poriadky · Štatúty a kódexy · Smernice · Rozpisy a manuály · Tlačivá/formuláre; `companyCode` vzor hierarchický (parent SFZ→regionálny→oblastný).
- **Marketingový web `/technologia`** (`web/lib/dictionaries.js` SK+EN) zladený s návrhom prístupu: identita zo **Sportnet.online** (OAuth + CRM, automatické zakladanie používateľov), prístup podľa príslušnosti k zväzu/klubu a skupín, SSO (sportnet.online/Entra/Google), multitenant hierarchia (verejné vidia všetci, interné per organizácia). Diagram (SVG + PNG) — identity ribbon `ISSF/Sportnet` → `Sportnet.online`.

### Added (2026-06-26 — backlog rozhodnutí)
- **`docs/OPEN_DECISIONS.md`** — 15 rozhodnutí (D1–D15) v 4 okruhoch (vyhľadávanie, doménová logika, identita, prevádzka/compliance) s prioritou, fázou a odporúčaním; navrhnuté poradie sprintov.

### Added (2026-06-26 — D5 a D10 rozpracované)
- **`docs/PRECEDENCIA_NORIEM.md`** (D5) — normatívna hierarchia SFZ (Stanovy>Poriadky>Smernice/Štatúty>Rozpis) + hierarchia zväzov; pravidlá R1–R4 (lex superior/specialis/posterior + hierarchia zväzov); aplikácia v RAG; zoznam na potvrdenie legislatívcom.
- **`docs/GDPR_DATA_PROTECTION.md`** (D10) — role (zväz=prevádzkovateľ, Contineo=sprostredkovateľ), kategórie dát, minimalizácia, návrh retenčných lehôt s odôvodnením, sub-procesori + EU rezidencia, práva dotknutých, audit, právne TODO (DPA/DPIA). *Nie právne poradenstvo — na posúdenie DPO/právnikom.*

### Decided (2026-06-26 — všetkých 15 rozhodnutí uzavretých)
- **Vyhľadávanie:** D1 chunking štruktúrne po hraniciach normy + breadcrumb (~300–800 tok.); D2 query→filtre LLM extrakcia + kontext používateľa; D3 citačná politika bez halucinácií; D4 ranking default 60/40, ladiť podľa eval setu.
- **Doménová logika:** D5 precedencia lex specialis v medziach SFZ (uviesť oba zdroje; potvrdiť s legislatívcom); D6 verzovanie `effectiveFrom/To`+`isActive`, default platná dnes.
- **Identita:** D7 sync login+webhook+cache; D8 onboarding — doménové číselníky zdieľané, zvyšok per tenant.
- **Prevádzka/compliance:** D9 zlatá sada + prah pred go-live; D10 minimalizovať PII + retencia + audit + DPA; D11 qa_pairs tagované + v reconciliation; D12 e-mail nikdy auto-odoslať; D13 crawl manuálne/on-demand; D14 widget s companyCode kontextom + rate-limit; D15 Ollama primárny + Claude fallback.

### Changed (2026-06-26)
- **Premenovanie `associationCode` → `companyCode`** (význam ostáva: pre koho obsah platí) a `scope` hodnota `association` → `company`. Aplikované **všade**: dokumenty (`CISELNIKY_governance.md`, `rag-architecture.md`, `DATA_MODEL_konzistencia.md`, projektový plán), verejná stránka `/technologia` (`web/components/Tech.js`, `web/lib/dictionaries.js` SK+EN) aj zdroj RAG (`app/src/lib/mongoSearch.ts`: `associationCodes`→`companyCodes`, `app/src/app/api/chat/README.md`). Systém ešte nie je nasadený — žiadna DB migrácia ani preindexovanie nie je potrebné. *Nahrádza skoršie pomenovanie `associationCode` v tomto Unreleased bloku.*
- **`sectionKey` je hierarchický** (parent → sekcia); **`sourceType` rozšírený** o `md`, `mcp`, `api`.
- **Diagram** (`contineo_diagram.svg` + pregenerované `contineo_diagram.png` v `web/public/` aj `docs/`) — popisok `associationCode` → `companyCode`.

### Decided (2026-06-26)
- Tagovanie pri ingescii = **per-dokument (LLM návrh → kurátor potvrdí)** pre každý zdroj.
- Sync pri zmene číselníka = **change-request + náhľad** (plný zoznam dotknutých dokumentov pred schválením); **rollback 1 level**; historické chunky sa **preznačkujú**.
- MCP import beží pod **servisným účtom**.

### Changed (Fáza 4 — zjednotenie dátového modelu na Model B)
- **Refaktor implementácie na kanonický Model B** (`app/src/`): kolekcie `rag_chunks`→`document_chunks`, `rag_documents`→`documents`; všetky polia v **camelCase** (`document_id`→`documentId`, `access_level`→`accessLevel`, `chunk_index`→`chunkIndex`, `source_url`→`sourceUrl`). `ChunkResult` rozšírený o doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`, `heading`, `isActive`, `effectiveFrom/To`, `versionId`, `embeddingModel`).
- **Voliteľná doménová filtrácia** v `mongoSearch.ts` (`companyCodes`, `sectionKey`, `onlyActive`) — pripravená, aktivuje sa s identitou (ISSF); pri vynechaní sa správanie nemení.
- **Všetky identifikátory a enum hodnoty v angličtine** — `scope: global | company | region` (predtým `zvaz/oblast`), zladené v kóde aj na verejnej stránke `/technologia`.
- Atlas indexy (`chat/README.md`, `rag-architecture.md`) a doc schémy (`rag-architecture.md`, projektový plán) prepísané na nové názvy a polia. Index identifikátory (`rag_vector_index` atď.) ostávajú.

### Changed
- **Zjednodušený diagram architektúry** (`web/public/contineo_diagram.png`, `docs/contineo_diagram.png`) — z piatich vrstiev na tri + dva spätné cykly:
  vstupné kanály → worker (chunking + značkovanie) → MongoDB Atlas (jadro: embedding, hybrid search, rerank) → rozhrania;
  cykly: kurácia (kontrola kvality) a eskalácia na ticket. Pridaný editovateľný zdroj `contineo_diagram.svg`.
- **Zlúčenie „zdroje obsahu" + „integrácie"** do jednej vrstvy **„Vstupné kanály"** (pilier na stránke `/technologia`). ISSF/Sportnet je explicitne zdroj identity, nie obsahu; e-mail je obojsmerný kanál.
- **Premenovanie „Učiaci cyklus" → „Kontrola kvality a kurácia"** naprieč webom (pilier aj dátový tok na `/technologia`, krok „Podpora a kurácia" na úvodnej stránke). Dôvod: nejde o strojové učenie modelu, ale o ľudskú kuráciu obsahu — schválenie/oprava odpovede a jej uloženie ako `qa_pair`.
- `architectureCaption`: embedding, hybrid search a rerank sú popísané ako súčasť jadra MongoDB Atlas (Voyage Automated Embedding), nie ako samostatná vrstva.
- Zmeny aplikované v SK aj EN slovníku (`web/lib/dictionaries.js`).

### Decided
- **Kanonický dátový model = Model B** (z verejnej stránky `/technologia`): `document_chunks` · `qa_pairs` · `tickets` · `conversations` + doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`) a verzovanie (`isActive`, `effectiveFrom/To`). Implementácia (Model A: `rag_chunks`/`access_level`) k nemu dorastie po fázach — `access_level` (viditeľnosť) a `scope`/`companyCode` (platnosť pre firmu/Zväz) bežia súbežne, sú ortogonálne.
- Zladené docs: `docs/DATA_MODEL_konzistencia.md` (rozhodnutie + mapovanie A→B + fázová migrácia), `docs/rag-architecture.md` a `docs/Contineo_RAG_Projektovy_plan.md` (poznámky o cieľovom modeli; migrácia zaradená do Fázy 4/4b/5). Živý kód `app/src/` a MongoDB sa NEmenia — len dokumentácia a plán.
