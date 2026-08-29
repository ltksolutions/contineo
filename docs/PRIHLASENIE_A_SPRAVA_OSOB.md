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
