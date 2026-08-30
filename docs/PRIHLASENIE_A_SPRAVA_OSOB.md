<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# Prihlásenie cez Microsoft a Google, správa osôb

> **Stav:** ✅ obe etapy postavené 2026-08-29 · **Zadanie:** 2026-08-29
> **Súvisiace:** D26 (`persons` namiesto premennej), D29 (hostiteľ určuje
> tenanta), D32 (viditeľnosť per `companyCode`), D41/D42 (správa platformy),
> I1c (overená cesta prihlásenia).

---

## 1. Zadanie a čo z neho vyplýva

Prihlasovať sa má dať aj **pracovným kontom Microsoft** (Entra ID) a **Google**,
podobne ako v projekte `inventario`. Zároveň má pribudnúť **správa
používateľov** — dnes sa osoby zakladajú a menia len skriptom.

Zo zadania vyplýva jedna vec, ktorá nie je na prvý pohľad vidieť:

> **Prihlásenie kontom nie je povolenie vstupu.**

Konto od Microsoftu hovorí „toto je naozaj tá adresa". Nehovorí, či ten človek
patrí do organizácie. To hovorí **výhradne `persons`** a to sa nemení — je to
tá istá brána, akou dnes prechádza odkaz z e-mailu. Bez tohto rozlíšenia by
prvá zle nastavená Entra aplikácia otvorila interné smernice zväzu komukoľvek
s pracovným kontom na svete.

---

## 2. Čie sú prihlasovacie údaje (D43)

**Rozhodnuté: vlastná aplikácia každého zákazníka, s núdzovým záložným
zdrojom z premenných prostredia.** Rovnaký model ako `inventario`
(ADR-0031 E3 tamtiež).

| | Vlastná aplikácia zákazníka | Jedna naša, multi-tenant |
|---|---|---|
| Súhlas udeľuje | IT správca zákazníka vo vlastnom Entre | my, raz |
| Kto vidí zoznam prihlásení | zákazník vo vlastnom Entre | my |
| Odvolanie prístupu | zákazník, bez nás | len my |
| Cena | obrazovka na zadanie údajov + šifrovanie tajomstiev | nič navyše |

Rozhoduje druhý a tretí riadok. Zväz, ktorý dá do systému vlastné predpisy,
má vedieť sám odvolať prístup a sám vidieť, kto sa prihlasoval — a nemá sa
o to prosiť dodávateľa. Cena je jednorazová, tá výhoda trvá.

**Údaje zadávame my** (`/admin/tenanti/[kod]`), nie zákazník: sú to tri polia,
ktoré IT správca pošle raz pri zavedení. Samoobslužná obrazovka pre zákazníka
je ďalší krok, nie tento.

---

## 3. Dátový model

```ts
// tenants
oauth?: {
  microsoft?: {
    clientId: string
    /** AES-256-GCM. Rozšifrovať sa dá len na serveri, na obrazovku sa nikdy nevracia. */
    clientSecretEnc: string
    /** „organizations" (predvolené) | „common" | konkrétne UUID tenanta. */
    tenantMode?: string
    /**
     * Entra tenant id, ktoré sa smú prihlásiť. Prázdne = nekontroluje sa.
     * Pri `tenantMode: "organizations"` je to jediná zábrana proti tomu,
     * aby sa cudzí zväz s rovnakou adresou dostal dnu.
     */
    allowedTenantIds?: string[]
    updatedAt?: Date
    updatedBy?: string
  }
  google?: { clientId, clientSecretEnc, hostedDomain?, updatedAt?, updatedBy? }
}
```

```ts
// persons.externalRef — už existuje od Fázy 8, teraz sa začne plniť
externalRef?: {
  sportnetId?: string | null
  entraObjectId?: string | null   // `oid` z Entra — nemenné, na rozdiel od adresy
  googleSub?: string | null
}
```

**Tajomstvo sa neukladá v čitateľnej podobe a nikdy sa nevracia von.**
Obrazovka ukazuje „nastavené / nenastavené" a umožní ho prepísať, nie
prečítať. Kto ho potrebuje vidieť, má ho vo vlastnom Entre.

---

## 4. Poskytovatelia sa skladajú podľa hostiteľa (D44)

NextAuth sa bežne nastaví raz pri štarte. Tu to nejde: **ktorý Microsoft
je „ten správny", závisí od domény** (D29). Na `intranet.futbalsfz.sk` je to
Entra zväzu, na `test.contineo.app` naša skúšobná aplikácia.

Preto sa `authOptions` skladajú **pri každej požiadavke** z tenanta hostiteľa
(NextAuth v4 to podporuje, „advanced initialization"). Zoznam tlačidiel na
prihlasovacej obrazovke tým prestáva byť konštanta a stáva sa odpoveďou na
otázku „čo má táto organizácia zapnuté".

Dôsledok, s ktorým treba počítať: **`redirect_uri` je jedna na doménu.**
Zákazník ju musí zapísať do svojej Entra aplikácie presne v tvare
`https://<jeho doména>/api/auth/callback/azure-ad`. Je to jediný krok, ktorý
musí spraviť on — a najčastejšia príčina toho, prečo prihlásenie hneď na prvý
raz nejde.

---

## 5. Brána (D45)

Poradie je záväzné a každý krok má dôvod:

1. **Adresa z profilu.** Microsoft ju vracia raz ako `email`, inokedy ako
   `preferred_username` alebo `upn` — podľa typu konta. Berie sa prvá, ktorá
   vyzerá ako adresa.
2. **Overený pôvod.** Google musí mať `email_verified`. Microsoft musí mať
   `tid` (identifikátor Entra tenanta) a ak má tenant vyplnené
   `allowedTenantIds`, musí byť medzi nimi. Bez tejto kontroly by pri
   `tenantMode: "organizations"` stačilo mať v cudzom Entre používateľa
   s rovnakou adresou.
3. **`persons`** — tá istá brána ako dnes. Neprítomnosť v kolekcii znamená
   zamietnutie bez ohľadu na to, aké dokonalé konto to bolo.
4. **Zápis `externalRef`** až po povolení. Odvtedy vieme, že tá osoba je to
   isté konto, aj keď jej organizácia zmení adresu.

**Núdzová brzda `POVOLENE_EMAILY` platí aj tu** a je stále prvá — inak by sa
pri pokazenom `persons` nedalo dostať dnu ani cez Microsoft.

### Spájanie kont

Ten istý človek sa dnes prihlási odkazom v e-maile, zajtra cez Microsoft.
NextAuth to bez povolenia odmietne (`OAuthAccountNotLinked`).

**Spájame podľa overenej adresy** — ale len preto, že adresa tu **nie je**
identitou. Identitou je záznam v `persons`; konto je len spôsob, ako dokázať,
že adresa patrí tomu, kto ju napísal. Spojenie je bezpečné presne dovtedy,
kým platí krok 2 vyššie: neoverenú adresu nespájame nikdy.

---

## 6. Správa osôb (D46)

**Vlastná rola `people-admin`**, nie `hr`.

Dôvod je vecný: sú to dve rôzne oprávnenia. `hr` prideľuje normy a vidí, kto
ich nepotvrdil — to je o obsahu. `people-admin` zakladá a vyraďuje ľudí — to je
o prístupe. V mnohých organizáciách to robia dvaja rôzni ľudia (personalista
a IT), a spojiť ich do jednej roly znamená, že IT správca zároveň uvidí, kto
si neprečítal disciplinárny poriadok.

Rola platí **vo vlastnej organizácii** (D32), rovnako ako `hr`. Správca
platformy sem prístup nemá.

### Rozsah

| | |
|---|---|
| Zoznam a hľadanie | meno, adresa, útvar, stav, posledné prihlásenie |
| Detail | vrátane toho, čo má osoba nepotvrdené a akými kontami sa prihlasuje |
| Úprava | meno, útvar, typ osoby, jazyk, skupiny, trasy, roly |
| Pozvanie | jedna osoba z obrazovky |
| Vyradenie | `status: "inactive"` — **nemazanie.** Potvrdenia sú záznamy a musia prežiť odchod človeka (O16). Vyradenie odstrihne okamžite, preto s potvrdením. |
| Import CSV | s **náhľadom pred zápisom** — nahratie stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` nemá rollback |

### Čo tu zámerne nie je

- **Mazanie osoby.** Viď vyššie. Právo na výmaz podľa GDPR sa rieši osobitným
  postupom so záznamom, nie tlačidlom v zozname (O15, O16).
- **Zmena adresy.** Adresa je kľúč, na ktorý sú naviazané potvrdenia aj
  prihlasovacie kontá. „Preklep v adrese" sa rieši vyradením a pozvaním nanovo,
  nie tichým prepísaním kľúča pod existujúcimi záznamami.
- **Prístup správcu platformy k osobám zákazníka.** Výslovná hranica D32/D41.

---

## 7. Fázovanie

**Etapa 1 — prihlásenie** ✅ hotové 2026-08-29
- [x] šifrovanie tajomstiev (`lib/tajomstva.ts`)
- [x] `tenants.oauth` + polia v `/admin/tenanti/[kod]` vrátane vypísanej adresy návratu
- [x] poskytovatelia podľa hostiteľa, brána, tlačidlá na prihlasovacej obrazovke
- [x] testy na bránu: cudzí Entra tenant, neoverená adresa, chýbajúce `tid`, cudzia doména Workspace

**Etapa 2 — správa osôb** ✅ hotové 2026-08-29
- [x] rola `people-admin`, `peopleContext()`
- [x] `/osoby` (zoznam + hľadanie), `/osoby/[id]` (detail a úprava), pozvanie, vyradenie
- [x] import CSV z obrazovky s náhľadom — tou istou knižnicou ako skript

**Zostáva**
- [ ] **`OAUTH_SECRET_ENCRYPTION_KEY` v premenných nasadenia.** Bez neho sa tajomstvo nedá uložiť a obrazovka to povie. Vygeneruje sa: `openssl rand -hex 32`
- [ ] zadať údaje Entra aplikácie SFZ, keď ich pošle ich IT
- [ ] samoobslužná obrazovka pre zákazníka (dnes údaje zadávame my)

---

## 8. Čo pošleme IT správcovi zákazníka

Text nižšie je určený na priame preposlanie. Zámerne neobsahuje nič o tom, ako
systém funguje vnútri — IT správca zväzu potrebuje vedieť štyri veci a nič viac.

> **Registrácia aplikácie v Microsoft Entra ID**
>
> 1. `https://entra.microsoft.com` → **Applications** → **App registrations** →
>    **New registration**
> 2. **Name:** napr. `Contineo — intranet`
> 3. **Supported account types:** *Accounts in this organizational directory only*
>    (jediný tenant). Stačí to a je to najužšie nastavenie.
> 4. **Redirect URI:** typ **Web**, hodnota presne:
>    `https://<vaša doména>/api/auth/callback/azure-ad`
> 5. **Register**
> 6. Na prehľade aplikácie si poznačte **Application (client) ID**
>    a **Directory (tenant) ID**
> 7. **Certificates & secrets** → **New client secret** → popis a platnosť →
>    **Add**. Hodnotu v stĺpci **Value** skopírujte hneď, **ukáže sa raz**.
> 8. Pošlite nám tie tri hodnoty bezpečným kanálom (nie e-mailom).
>
> Oprávnenia navyše nastavovať netreba — predvolené `User.Read` stačí.
> Prístup viete kedykoľvek odvolať zmazaním tajomstva alebo celej aplikácie;
> zoznam prihlásení vidíte vo vlastnom Entre pod **Sign-in logs**.

**Adresa návratu je najčastejšia príčina toho, prečo prihlásenie hneď na prvý
raz nejde.** Musí sedieť na znak vrátane `https://` a bez lomky na konci;
obrazovka `/admin/tenanti/[kod]` ju preto vypisuje v hotovom tvare.

**Google Workspace** je analogický: Google Cloud Console → *APIs & Services* →
*Credentials* → *OAuth client ID* → typ **Web application**, redirect URI
`https://<doména>/api/auth/callback/google`.

---

## 9. Rozhodnutia

| # | Otázka | Stav |
|---|---|---|
| **D43** | Vlastná Entra/Google aplikácia zákazníka, nie jedna naša | ✅ 2026-08-29 |
| **D44** | Poskytovatelia sa skladajú podľa hostiteľa, nie pri štarte | ✅ 2026-08-29 |
| **D45** | Konto overuje adresu, vstup povoľuje `persons` | ✅ 2026-08-29 |
| **D46** | Správa osôb má vlastnú rolu `people-admin`, oddelenú od `hr` | ✅ 2026-08-29 |
| **D47** | Kto sa prihlási kontom z povolenej domény, založí sa sám | ✅ 2026-08-29 |
| **D48** | Organizácia si spravuje vzhľad, prihlasovanie aj domény sama — domény s dôkazom cez DNS | ✅ 2026-08-29 |
| **D49** | Útvary sú strom, osoba patrí do práve jedného; cesta sa materializuje na osobe | ✅ 2026-08-29 |
| **D50** | Reorganizácia: úloha z útvaru platí odo dňa príchodu, bývalí členovia zostanú vidieť, potvrdenie nesie odtlačok útvaru | ✅ 2026-08-29 |
| **D51** | Audit správcovských zmien vo vlastnej kolekcii, nemenný; vidí ho `people-admin` a správca platformy | ✅ 2026-08-29 |
| **D52** | Údaje z Microsoft Graphu sa dopĺňajú, nie prepisujú — a len keď niečo chýba | ✅ 2026-08-30 |

### D47 — automatické založenie z povolených domén

Kto sa prihlási **overeným pracovným kontom** z domény, ktorú si organizácia
vypísala (`tenants.autoProvisionDomains`), a v `persons` ešte nie je, založí sa
ako bežný člen: bez rolí, bez trás, rovno `active`.

Nie je to zmäkčenie brány. Adresár zákazníka už raz rozhodol, že ten človek do
organizácie patrí, a `tid` sa overuje (D45) — pozývať ho ešte raz ručne je
práca navyše za nič.

**Platí len pre kontá, nie pre odkaz v e-maile.** Konto z adresára je dôkaz
príslušnosti; napísaná adresa nie je nič a zoznam osôb by sa zaplnil preklepmi
a skúšaním.

Porovnáva sa **celá doména**, nie koncovka: `endsWith` by pustilo aj
`zlyfutbalsfz.sk` a `futbalsfz.sk.utocnik.com`. Poddomény treba vypísať.

### D48 — organizácia si spravuje nastavenie sama

Vzhľad, jazyky, vlastné prihlasovacie údaje a domény si mení zákazník na
**svojej** doméne (`/organizacia`), rolou `people-admin`. Kód organizácie
a vypnutie portálu tam nie sú — to sú veci medzi ním a nami.

**Správca platformy si ponecháva plnú správu všetkých organizácií** cez
`/admin`, kvôli podpore a helpdesku. Táto obrazovka mu nič neuberá.

#### Prečo domény nie voľným zápisom

Otázka znela „ak to nie je nebezpečné". **Voľný zápis nebezpečný je**, a to
dvomi spôsobmi, ktoré na prvý pohľad nie sú vidieť:

1. **Cudzia doména v našom účte.** Každá doména sa pridáva do *nášho* projektu
   vo Verceli. Zákazník by mohol zapísať doménu, ktorá mu nepatrí — Vercel na
   ňu drží nárok v našom účte a jej skutočný majiteľ si ju do svojho projektu
   nepridá. To je odstávka spôsobená tretej strane, z nášho účtu, niekým, kto
   nie sme my.
2. **Naša vlastná doména.** `*.contineo.app` už dnes smeruje na naše nasadenie,
   takže voľná subdoména (`admin.contineo.app`) by sa zapísaním okamžite
   rozsvietila pod našou značkou. Kontrola „nepatrí inému tenantovi" na to
   nestačí — nepatrí zatiaľ nikomu.

Bezpečnou to robí **dôkaz o vlastníctve**, a ten vie dať len DNS. Preto:
zákazník o doménu **požiada**, dostane presný CNAME, a zapne sa až vtedy, keď
smeruje na nás. Nastaviť DNS vie len ten, kto doménu ovláda — a je to krok,
ktorý musí spraviť tak či tak. Naše vlastné domény si neprideľuje vôbec.

### D49 — útvary ako strom, skupiny ako druhá dimenzia

Útvar bol dovtedy **voľný text** na osobe. Pri desiatich ľuďoch to stačilo; pri
stovke znamená, že „Legislatíva", „legislatíva" a „Legislat." sú tri útvary
a otázka „koľko ľudí má úsek" nemá odpoveď.

**Útvar a skupina sú dve rôzne veci a nesmú sa zlúčiť.**

| | čo to je | koľko ich má človek |
|---|---|---|
| **útvar** | *kam patrím* — miesto v organizačnej schéme | práve jeden |
| **skupina** | *komu sa to posiela* — adresát naprieč útvarmi | koľko treba |

Zlúčiť ich by znamenalo, že normu pre rozhodcov nemožno poslať bez toho, aby
rozhodcovia boli útvar — čím prestane platiť, že útvar je štruktúra.

#### Prideľuje sa útvaru **aj celému jeho podstromu**

Kto pridelí normu úseku, myslí tým úsek. Pridelenie „len priamo podriadeným"
by v praxi znamenalo prekliknúť každý odbor zvlášť a pri ďalšom odbore na to
zabudnúť — a nikto by si nevšimol, že mu chýba.

#### Materializovaná cesta — vedomá výnimka z D27

Osoba nesie okrem `departmentId` aj **`departmentPath`**: identifikátory
všetkých nadriadených útvarov od koreňa po seba. Inde v projekte sa odvodené
hodnoty neukladajú (D27), takže to treba zdôvodniť.

O tom, koho sa pridelenie týka, rozhoduje `matchesAudience()` — **čistá funkcia
bez databázy**, jediné miesto s tým pravidlom, testovateľné bez clustera. Bez
cesty na osobe by musela dostať celý strom (a prestala by byť čistá), alebo by
vznikla druhá kópia pravidla v podobe agregácie — a tá by sa s prvou rozišla
presne pri reorganizácii.

Cena je jasná a je zapísaná v kóde: **pri presune útvaru sa cesty prepočítajú**
všetkým v podstrome (`prepocitajCesty()`), a zaradenie osoby sa zapisuje spolu
s cestou v jednom zápise. Keby sa cesta dopĺňala neskôr, existoval by okamih,
v ktorom človek do útvaru patrí, ale pridelenie sa ho netýka — a nikto by
neuhádol prečo.

#### Čo z toho plynie inde

- názov útvaru sa do pridelenia zapisuje ako **kópia** (`audience.label`),
  rovnako ako názov dokumentu: útvar sa premenuje a o rok musí byť čitateľné,
  komu sa vtedy prideľovalo. Príslušnosť sa vždy počíta z identifikátora;
- **strom má najviac 6 úrovní.** Nie je to technický limit — hlbší strom sa na
  telefóne nedá prehľadne ukázať a to najhlbšie v ňom býva v skutočnosti skupina;
- **zrušiť sa dá len prázdny útvar bez podriadených.** Inak by ľudia zostali
  odkazovať na niečo, čo neexistuje, a zmizli by zo štruktúry potichu;
- pôvodný textový zápis (`persons.department`) sa **nemaže**. Ostáva ako stopa,
  z čoho útvar vznikol — po nevydarenom prevode je to jediný spôsob, ako
  zistiť, kto kam patril.

#### Prevod existujúcich údajov

`npm run utvary -- --tenant SFZ` ukáže, čo by vzniklo; s `--zapis` to založí.
Strom je po prevode **plochý**: zo zápisu „Odbor médií" sa nedá vyčítať, pod
koho patrí, a hádať to podľa podreťazcov by vyrobilo štruktúru, ktorá vyzerá
hotovo a nesedí. Hierarchiu doklikne človek v `/organizacia`, záložka Útvary.

### D50 — čo robí reorganizácia s už pridelenými normami

D49 zaviedla štruktúru. Táto otázka je o tom, čo sa stane, keď sa štruktúra
zmení — a mení sa stále. Tri prípady, tri odpovede.

#### 1. Kto do útvaru pribudne, dostane úlohu **odo dňa príchodu**

Stav úloh sa odvodzuje živo (D27), takže človek zaradený do útvaru okamžite
vidí aj jeho staršie pridelenia. To je správne — normy útvaru sa ho odteraz
týkajú. Nesprávny bol dátum: s pôvodným dátumom pridelenia by mal nováčik prvý
deň v práci úlohu spred roka, teda hneď po termíne, a **bez príznaku „nové"**,
lebo pridelenie je staršie než jeho predošlé prihlásenie (D39). To je presne
ten stav, ktorý nikto nevie vysvetliť.

Preto osoba nesie `departmentHistory` a `datumPreOsobu()` vracia neskorší
z dvoch dátumov. Platí to **len pre publikum druhu útvar**: skupina ani trasa
históriu nemajú a predstierať ju by znamenalo tvrdiť niečo, čo nevieme.

Dve hranice, ktoré stoja za zapísanie:

- **prázdna história znamená „odjakživa", nie „nikdy".** Ľudia zapísaní pred
  zavedením štruktúry ju nemajú a pridelenie im má platiť odo dňa, keď vzniklo;
  opačná predvoľba by im všetky staré normy schovala;
- **presun celej vetvy nie je príchod.** Keď sa útvar presunie pod iného
  rodiča, ľuďom v ňom sa opraví cesta, ale záznam histórie sa neotvára — inak
  by to vyzeralo, že do svojho útvaru práve prišli všetci naraz.

#### 2. Kto odíde bez potvrdenia, **zostane vidieť** — ale nedostane e-mail

Bez toho by zo zoznamu nepotvrdených ticho vypadol a nikto by sa nedozvedel,
že sa to nedoriešilo. Zostáva teda v prehľade označený *už nie je v útvare*.

Pripomienku mu ale neposielame: pripomínať normu útvaru, v ktorom človek už
nie je, je nezmysel. Čo s tým, rozhodne personalista — systém na to nemá
podklad, lebo nevie, či ho previedli inam, alebo odchádza.

Hľadá sa **prekryv** úseku histórie s obdobím platnosti pridelenia, nie „bol
tam v deň pridelenia": kto prišiel týždeň po pridelení a o mesiac odišiel, mal
povinnosť tiež.

#### 3. Potvrdenie nesie **odtlačok útvaru**

`acknowledgements` si už predtým pamätali meno, adresu, názov dokumentu aj
doslovné znenie formulky — všetko v podobe z času potvrdenia. Útvar tam
chýbal, a tak by výkaz „potvrdenia po útvaroch" za minulý rok po reorganizácii
povedal niečo iné než vtedy: počítal by sa podľa dnešnej štruktúry.

Ukladá sa `departmentId` **a názvy celej cesty**. Nie len identifikátor: útvar
sa dá premenovať aj zrušiť a záznam má byť čitateľný sám o sebe. Zlyhanie
tohto čítania nesmie zhodiť potvrdenie — záznam bez útvaru je horší než
s ním, ale oveľa lepší než žiadny.

#### Čo D50 **nerieši**

- **Skupiny históriu nemajú.** Kto vypadne zo skupiny, zmizne zo zoznamu
  nepotvrdených ticho, ako doteraz. Ak sa to ukáže ako problém, je to tá istá
  konštrukcia — ale zatiaľ to problém nie je, lebo skupina sa mení vedome
  a jednotlivo, kým útvar sa mení hromadne pri reorganizácii.
- **Menovateľ v prehľade („8 z 12") sa naďalej počíta dnešnou štruktúrou.**
  Je to odvodený stav a odvodený zostane (D27); presné čísla za minulé obdobie
  dá výkaz z `acknowledgements`, ktorý má odtlačok.

### D50 dodatok — skupiny majú históriu tiež

Pôvodné znenie D50 nechávalo skupiny bez histórie s odôvodnením, že sa menia
vedome a jednotlivo. **To odôvodnenie neobstálo.** Skupina je v tomto systéme
najčastejší adresát noriem (rozhodcovia, delegáti, štatutári), a kto z nej
vypadne pred potvrdením, mizol zo zoznamu nepotvrdených presne tak ticho ako
predtým pri útvaroch. Dve dimenzie s dvomi rôznymi pravidlami by navyše nikto
nevedel udržať v hlave.

Osoba preto nesie aj `groupHistory` — zoznam úsekov `{ skupina, od, do }`,
lebo skupín má naraz viac. Platí to isté ako pri útvaroch: prázdna história
znamená „odjakživa", nezmenené členstvo sa nedotýka (inak by uloženie
formulára posúvalo dátum vstupu), a **návrat do skupiny je nový úsek**, nie
oživenie starého — „bol, odišiel, vrátil sa" je iná odpoveď na otázku, kto mal
v danom období povinnosť, než „bol celý čas".

Zapisuje sa na všetkých troch miestach, kde sa skupiny menia: obrazovka osoby,
CSV import (najčastejšia hromadná zmena) a `npm run osoba`.

Bez histórie zostáva už len **trasa**. Tá je obsah, nie adresát — mení sa
s onboardingom človeka, nie s rozhodnutím o tom, komu sa čo posiela.

---

### D51 — audit správcovských zmien

Doteraz sa pri osobe aj pri organizácii zapisovalo `updatedBy` a `updatedAt`.
To odpovedá na otázku „kto to menil naposledy" a na nič viac: kto komu udelil
rolu `hr`, kto koho vyradil, kto vymenil tajomstvo Entry — po druhej zmene sa
to už nedalo zistiť.

Pri systéme, ktorého celý zmysel je dokazovať oboznámenie s predpismi, je to
diera na nesprávnom mieste: **kto si vie zmeniť rolu, vie si zmeniť publikum.**
Potvrdenia sú neprepisovateľné (D24), ale bez stopy o tom, kto mal kedy aké
práva, sa nedá povedať, či bolo pridelenie oprávnené.

#### Vlastná kolekcia, nie pole v dokumente

`audit` je samostatná kolekcia. Zapisovať históriu do dokumentu osoby by
znamenalo, že sa dokument s časom nafukuje a že vyradenie osoby berie so sebou
aj stopu o tom, kto ju vyradil.

**Nie je to náhrada za `acknowledgements` ani za `assignments`.** Tie sú
dôkazom o obsahu a nesú si vlastné odtlačky; audit je stopa o **správe** —
o právach, prístupoch a nastaveniach. Zlúčiť ich by znamenalo, že sa dôkaz
o potvrdení dá zaplaviť záznamami o klikaní v nastaveniach.

**Nie je to zdroj pravdy.** Stav je vždy v `persons` a `tenants`; audit hovorí,
ako sa tam dostal. Nič sa z neho nedopočítava.

#### Čo sa zapisuje

Osoby (rola, stav, adresa, útvar, skupiny, trasy, jazyk, typ), útvary
(založenie, premenovanie, presun aj s počtom dotknutých ľudí, zrušenie),
pridelenia (pridelenie s dôvodom, odvolanie, odoslané oznámenie s počtom
adresátov), nastavenie organizácie, domény (žiadosť, overenie, zrušenie)
a prihlasovacie údaje.

Zapisuje sa **rozdiel, nie celý objekt**: inak by v zázname o zmene jazyka
bolo aj meno, adresa a všetky skupiny, po roku by sa v tom nedalo nič nájsť
a bola by to zbytočná kópia osobných údajov.

Odvodené polia (`departmentPath`, obe histórie) sa do rozdielu neberú —
v zázname by prehlušili to, čo človek naozaj menil.

#### Tajomstvá

Pri poli, ktorého názov obsahuje `secret`, `token`, `heslo` alebo `tajomstvo`,
sa zapíše len `(zmenené)` — nikdy stará ani nová hodnota. **Audit, ktorý zbiera
heslá, je sám o sebe únik**, a to s dlhšou retenciou než to, čo chráni.

#### Zápis nikdy nezhodí zmenu

`zapisAudit()` nevyhadzuje výnimku. Keby zlyhanie zápisu zhodilo samotnú
zmenu, jeden pokazený index v audite by zablokoval správu osôb celej
organizácii. Zlyhanie sa loguje — chýbajúci záznam je zlý stav, nefunkčný
portál horší.

Volá sa **po** úspešnej zmene. Opačné poradie by zapisovalo zmeny, ktoré sa
nestali.

#### Kto ho vidí

`people-admin` vidí audit **svojej** organizácie (`/organizacia`, záložka
Audit, s hľadaním a stropom 200 záznamov). Správca platformy vidí posledných
50 záznamov každej organizácie v `/admin/tenanti/<KOD>` — kvôli podpore.
`companyCode` je vždy v podmienke dotazu, nie v kontrole nad ňou: audit cudzej
organizácie je presne ten druh údaja, ktorý sa nesmie dať vytiahnuť uhádnutím
identifikátora (D32).

Kto spravuje práva, má vidieť, čo sa s nimi robí. Ukryť audit len pred
zákazníkom by znamenalo, že si pri kontrole musí pýtať výpis od nás — a to je
presne to, čo audit potrebuje rýchlo.

#### Čo D51 nerieši

- **Prihlásenia sa nezapisujú.** Na osobe zostáva len `lastLoginAt`
  a `previousLoginAt`. Záznam každého prihlásenia je spracúvanie údajov
  o zamestnancoch navyše a patrí najprv do GDPR dokumentácie (súvisí s O14).
- **Retencia auditu** nie je určená — otvorené v O16 spolu s retenciou
  potvrdení. Kolekcia zatiaľ rastie bez stropu; pri stovkách ľudí to nie je
  problém rokov, ale rozhodnúť sa to musí.

---

### D52 — meno, útvar a fotka z adresára

Konto z Entry vie viac než adresu. Bez toho vznikala pri automatickom
založení (D47) osoba, ktorá sa v zozname volala rovnako ako jej adresa —
a personalista ju musel prepísať ručne, hoci ten údaj bol v adresári zákazníka
celý čas.

Ťahá sa: **meno a priezvisko zvlášť**, `displayName` ako záloha, **útvar**
(textové pole, nie zaradenie do stromu), **pozícia**, **jazyk** a **fotografia**
(96 px kvôli obrazovkám s dvojnásobnou hustotou).

#### Dopĺňa sa, neprepisuje

**Adresár nie je nadriadený personalistovi.** Keď niekto meno alebo útvar
v `/osoby` opraví, ďalšie prihlásenie mu opravu neprepíše — inak by ručná
oprava vydržala len dovtedy, kým sa ten človek znova neprihlási, a nikto by
nepochopil, prečo sa zmena „neuložila".

Zvláštny prípad: **`fullName` rovné adrese sa považuje za chýbajúce.** Presne
tak vyzerá osoba založená automaticky, keď meno ešte nebolo odkiaľ vziať.

#### Volá sa len vtedy, keď niečo chýba

Väčšina prihlásení je opakovaná a vtedy je už všetko na mieste. Bez tejto
podmienky by každé prihlásenie platilo dve cudzie požiadavky za nič.

#### Zlyhanie Graphu nesmie zablokovať prihlásenie

Celé doplnenie je v `try` a obe požiadavky majú **štvorsekundový strop**.
Osoba bez fotky je nepríjemnosť; človek, ktorý sa nedostane dnu, lebo Graph
mal výpadok, je porucha.

#### `User.Read` naviac

Predvolené rozsahy `azure-ad` sú `openid profile email` a s nimi Graph
odpovie 403 — aj na fotku, ktorú si next-auth pýta sám. Pridali sme preto
`User.Read`: je to najzákladnejšie delegované oprávnenie Entry („prečítaj
profil prihláseného"), schvaľuje si ho používateľ sám a k nikomu inému
neotvára prístup. Keď ho aplikácia zákazníka nemá, do logu ide menovitá hláška
a všetko ostatné funguje ďalej.

#### Fotka je neverejná — na rozdiel od loga

Logo visí na prihlasovacej stránke a prezradí len to, že organizácia tu má
portál. Fotka je osobný údaj zamestnanca, takže `/api/fotka/<id>` vyžaduje
prihlásenie a zhodu organizácie (D32) — inak by sa dal z cudzej domény
vyťahať fotoalbum firmy skúšaním identifikátorov. Pamäť je dlhá, ale
`private`, aby si ju neodložila spoločná medzipamäť po ceste.

Uložená je vo vlastnej kolekcii `person_photos`, nie v zázname osoby —
rovnaký dôvod ako pri logu: záznam osoby sa číta pri každej požiadavke.
