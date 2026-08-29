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

## 8. Rozhodnutia

| # | Otázka | Stav |
|---|---|---|
| **D43** | Vlastná Entra/Google aplikácia zákazníka, nie jedna naša | ✅ 2026-08-29 |
| **D44** | Poskytovatelia sa skladajú podľa hostiteľa, nie pri štarte | ✅ 2026-08-29 |
| **D45** | Konto overuje adresu, vstup povoľuje `persons` | ✅ 2026-08-29 |
| **D46** | Správa osôb má vlastnú rolu `people-admin`, oddelenú od `hr` | ✅ 2026-08-29 |
