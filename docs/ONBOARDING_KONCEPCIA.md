# Onboarding a potvrdzovanie noriem — koncepčný návrh

> **Stav:** návrh na schválenie (2026-08-27). Žiadne zmeny v živom kóde.
> **Rozhodnutie o zaradení:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` — onboarding je schopnosť Continea, nie nový projekt a nie rozšírenie ClubUpu.
> **Cieľ:** jednotný vstup do organizácie — človek sa prihlási, prejde pripravenou trasou a **doloží, že sa oboznámil so záväznými dokumentmi**. HR vidí, kto to má za sebou a kto nie.
> **Prvé nasadenie:** SFZ, doména `internal.futbalsfz.sk`, vyše 100 osôb vrátane ľudí bez licencie M365.
> **Nadväzuje na:** `DATA_MODEL_konzistencia.md` (Model B), `PRISTUPOVE_PRAVA.md` (ABAC, multitenant), `CMS_KONCEPCIA.md` (obsah, verzie, role), `PRECEDENCIA_NORIEM.md` (platnosť znenia), `GDPR_DATA_PROTECTION.md` (osobné údaje).
> **Zámerne nerieši:** UI dizajn, obsahové stránky onboardingu (uvítanie, org. štruktúra — rozsah C), elektronický podpis, prepojenie na ClubUp.
>
> **Doménová univerzálnosť:** SFZ je prvé nasadenie, nie definícia produktu. „Smernica" je len druh dokumentu, „zamestnanec" len druh osoby. Celý model je doménovo neutrálny — rovnako sa použije pre firmu, úrad či inštitúciu.

---

## 0. Pozícia v systéme

Onboarding nezavádza vlastnú cestu k obsahu ani vlastné prihlásenie. Sadá si **nad**
to, čo Contineo má, a pridáva jedinú novú vec: **záznam o oboznámení**.

```
        IDENTITA                    OBSAH                       ONBOARDING
   ┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
   │ magic-link       │     │ documents            │     │ onboarding_tracks    │
   │ (Ecomail)        │ ──► │  + versions[]        │ ──► │  (poradie krokov)    │
   │ persons          │     │ accessLevel:internal │     │         │            │
   │ (kto to je)      │     │ securityFilter()     │     │         ▼            │
   └──────────────────┘     └──────────────────────┘     │ acknowledgements     │
                                                          │  (append-only)      │
                                                          └──────────┬──────────┘
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │ HR dashboard         │
                                                          │ kto / čo / kedy      │
                                                          └──────────────────────┘
```

**Žiadny model sa nevolá.** Reťaz z `AKO_TO_BEZI.md` (prepis dotazu → embedding →
rerank → generovanie) pri onboardingu nebeží; človek číta dokument a klikne. Dôsledok
pre rezidenciu je v ADR-003 kap. 5.5.

---

## 1. Čo onboarding je a čo nie je

| Je to | Nie je to |
|---|---|
| doklad, že človek dostal dokument a potvrdil oboznámenie | overenie, že mu porozumel |
| riadená postupnosť krokov so stavom dokončenia | kurz s modulmi a lekciami |
| evidencia pre HR a audit | hodnotenie zamestnanca |
| opakovateľný proces pri každom nástupe a pri každej novej verzii | jednorazová kampaň |

Hranica voči LMS je záväzne stanovená v ADR-003 kap. 3.1. Zhrnutie jednou vetou:
**onboarding dokladuje, že si čítal; LMS overuje, či si pochopil.**

---

## 2. Aktéri

| Aktér | Čo robí | Ako sa prihlási |
|---|---|---|
| **Zamestnanec** | prejde trasu, potvrdí dokumenty | odkaz v e-maile (neskôr aj Entra ID) |
| **Externista** (tréner, rozhodca, funkcionár) | to isté | odkaz v e-maile — jediná cesta, ktorú má |
| **HR** | pozýva, sleduje stav, posiela pripomienky | odkaz v e-maile, rola `hr` |
| **Vedenie** | vidí súhrn, nepozýva | rola `hr` (čítanie) |
| **Kurátor obsahu** | zakladá verzie dokumentov, skladá trasy | existujúci `cms_uploaders` |

---

## 3. Dátový model

Tri nové kolekcie a jedno rozšírenie existujúcej. Názvoslovie Model B, polia v camelCase,
doménové hodnoty z `codelists` — presne ako všade inde.

### 3.1 `documents.versions[]` — chýbajúci diel

Toto **nie je** onboardingová kolekcia a nie je to ani potreba onboardingu.
**Verzovanie je povinnosť celého systému** — dokumenty majú jedno spoločné úložisko
(`documents`) bez ohľadu na to, ktorým vstupným kanálom prišli (upload, MCP, web link, API —
`CMS_KONCEPCIA.md` časť C), a zneplatňovanie starých znení je vlastnosť **dokumentu**, nie
kanála. Onboarding túto povinnosť len zviditeľnil a implementuje ju prvý; vzniká preto rovno
v tvare, v akom ju potrebuje CMS (`CMS_KONCEPCIA.md` A.3), nie v zjednodušenom.

```js
// documents (rozšírenie)
{
  _id, title, slug, category, accessLevel, companyCode, /* … doterajšie polia … */

  versions: [
    {
      versionId:    "9f1c…",          // UUID, nemenné
      label:        "1.2",            // ľudské označenie („1.2", „novela 2026")
      effectiveFrom: ISODate,         // právna platnosť (D6)
      effectiveTo:   null,
      isActive:     true,
      contentHash:  "sha256…",        // zhoda s originálom
      originalFile: { blobUrl, filename, sizeBytes, mime },
      markdown:     "…",
      changeNote:   "Doplnený čl. 7 o hlásení incidentov.",
      requiresReacknowledgement: true, // rozhodne človek, nie systém (D30)
      publishedAt, publishedBy
    }
  ]
}
```

> **`requiresReacknowledgement` je pole, ktoré vypĺňa človek.** Systém nevie a nemá vedieť
> rozhodnúť, či je zmena podstatná. Oprava preklepu a nová povinnosť vyzerajú v diffe
> podobne. Kto to rozhodne a podľa čoho, je D30 / O13.

**Dve pravidlá, ktoré platia pre všetky vstupné kanály** (D25):

1. **Zmena obsahu = nová verzia, nikdy prepis.** Keď kanál pri re-syncu zistí iný `contentHash`
   (`INGESTION_zdroje_reconciliation.md` kap. 4), pridá **novú položku** do `versions[]`.
   Predchádzajúca zostáva a dostane `effectiveTo`. Prepis by spätne zmenil, čo bolo kedy platné —
   a tým aj to, čo ľudia potvrdili.
2. **Kanál nikdy nezneplatní platnú verziu sám.** Nová verzia prichádza ako `isActive: false`
   a čaká na kurátora, ktorý určí `effectiveFrom`. Automat vie len to, že sa zmenil súbor;
   právnu platnosť posúdiť nevie. Rovnaký princíp ako **D-CMS-6**.

> Pre onboarding to má priamy dôsledok: **automatický import nikdy sám nepošle sto ľudí
> potvrdzovať znova.** Medzi „zmenil sa súbor" a „ľudia musia potvrdiť" stojí človek — dvakrát:
> raz pri `effectiveFrom`, raz pri `requiresReacknowledgement`.

### 3.2 `acknowledgements` — auditný záznam

Jadro celého návrhu. **Append-only**: nikdy sa neprepisuje ani nemaže.

```js
{
  _id,
  type: "acknowledgement" | "revocation" | "correction",
  companyCode: "SFZ",

  // KTO — s odtlačkom údajov v čase potvrdenia
  personId:   "3b7e…",                    // persons.id
  email:      "jan.novak@futbalsfz.sk",
  fullName:   "Ján Novák",

  // ČO — s odtlačkom údajov v čase potvrdenia
  documentId,
  versionId,
  documentTitle: "Smernica o ochrane osobných údajov",
  versionLabel:  "1.2",
  effectiveFrom: ISODate,

  // ČÍM — doslovné znenie, nie odkaz naň
  statementText: "Potvrdzujem, že som sa oboznámil s dokumentom …",
  statementHash: "sha256…",

  // KEDY a ODKIAĽ
  acknowledgedAt: ISODate,
  ip:        "195.28.…",
  userAgent: "Mozilla/5.0 …",

  // KONTEXT
  trackId:   ObjectId | null,             // v rámci ktorej trasy
  origin:    "portal" | "import",         // „import" pre prípadné historické záznamy
  supersedes: ObjectId | null,            // pri type revocation/correction

  createdAt
}
```

**Prečo toľko odtlačkov (`email`, `fullName`, `documentTitle`, `versionLabel`)?**
Lebo záznam musí byť čitateľný o tri roky, keď sa človek volá inak, dokument sa
premenoval a trasa už neexistuje. Auditný záznam, ktorý na vysvetlenie potrebuje
`$lookup` do štyroch kolekcií, ktoré sa medzitým zmenili, nie je dôkaz — je to hypotéza.

**Prečo `statementText` a nie odkaz na formulku?** Keby sa znenie o rok upravilo, všetky
staré záznamy by spätne tvrdili niečo, s čím nikto nesúhlasil. `statementHash` je tam
na rýchle porovnanie, nie ako náhrada textu.

**Prečo `type` a `supersedes` namiesto mazania?** Odvolanie alebo oprava je **nový**
záznam, ktorý ukazuje na starý. Pôvodný zostáva. Auditný záznam, ktorý sa dá upraviť,
nie je auditný záznam.

### 3.3 `persons` — kto do organizácie patrí

Nahrádza premennú `POVOLENE_EMAILY` ako hlavnú cestu (ADR-003 kap. 5.3). Je to
**doménová** vrstva; technická vrstva prihlásenia (`auth_users`) zostáva, ako je.

```js
{
  _id, id: "3b7e…",                       // UUID, väzba na auth_users.id
  companyCode: "SFZ",
  email: "jan.novak@futbalsfz.sk",        // vždy lowercase
  fullName: "Ján Novák",
  department: "Úsek legislatívy",
  personType: "employee" | "external" | "referee" | "official",
  startDate: ISODate,
  status: "invited" | "active" | "inactive",

  tracks: ["nastup-2026"],                // priradené trasy
  roles:  ["hr"],                         // prázdne u bežnej osoby

  invitedAt, firstLoginAt, lastLoginAt,

  externalRef: {                          // pripravené na Fázu 5, dnes prázdne
    sportnetId: null,
    entraObjectId: null
  },

  createdBy, createdAt
}
```

> `personType` je pripravené pole, nie filtrovacie kritérium pre prístup. Prístup rieši
> `accessLevel` + `companyCode` ako všade inde — druhá cesta k obsahu by raz zaostala
> za tou prvou.

### 3.4 `onboarding_tracks` — trasa

```js
{
  _id,
  companyCode: "SFZ",
  key: "nastup-2026",
  title: "Nástup do SFZ",
  description: "Čo si treba prejsť v prvom týždni.",

  steps: [
    { order: 1, type: "document", documentId, requiresAcknowledgement: true },
    { order: 2, type: "document", documentId, requiresAcknowledgement: true },
    { order: 3, type: "page",     pageId,     requiresAcknowledgement: false }  // rozsah C
  ],

  isActive: true,
  effectiveFrom, effectiveTo,
  createdBy, createdAt
}
```

Krok typu `page` je **rezervovaný pre rozsah C** (uvítanie, org. štruktúra, kontakty).
V ultra-MVP ani v rozsahu B sa nepoužije, ale je v modeli od začiatku, aby jeho pridanie
neznamenalo prepísanie trasy.

### 3.5 Kde je stav dokončenia?

**Nikde — odvodzuje sa.** Progres = prienik krokov trasy a existujúcich záznamov
v `acknowledgements`. „Kde som skončil" = prvý krok trasy, ku ktorému záznam chýba.

Samostatná kolekcia `onboarding_progress` sa **zámerne nezakladá**. Bola by to druhá
kópia pravdy, ktorá sa raz rozíde s prvou — a rozišla by sa práve pri novej verzii
dokumentu, teda v okamihu, keď na správnosti najviac záleží. Ak sa raz pridajú kroky
bez potvrdenia (`page`), doplní sa **ľahký** záznam o dokončení kroku, nie súhrnný stav.

### 3.6 Indexy

| Kolekcia | Index | Prečo |
|---|---|---|
| `acknowledgements` | `{ companyCode: 1, personId: 1, versionId: 1 }` **unique**, `partialFilterExpression: { type: "acknowledgement" }` | dvojité potvrdenie tej istej verzie nie je chyba používateľa, ale naša — nech ho odmietne databáza, nie kontrola v kóde |
| `acknowledgements` | `{ companyCode: 1, documentId: 1, versionId: 1, acknowledgedAt: -1 }` | dashboard „kto potvrdil túto smernicu" |
| `acknowledgements` | `{ companyCode: 1, personId: 1, acknowledgedAt: -1 }` | história jednej osoby |
| `persons` | `{ companyCode: 1, email: 1 }` **unique** | jedna osoba = jedna adresa v rámci tenanta |
| `persons` | `{ companyCode: 1, tracks: 1, status: 1 }` | „kto z tejto trasy ešte nemá hotovo" |
| `onboarding_tracks` | `{ companyCode: 1, key: 1 }` **unique** | — |

---

## 4. Toky

### 4.1 Pozvanie

```
HR nahrá CSV (e-mail, meno, útvar, typ, dátum nástupu, trasa)
   → validácia (duplicity, formát adresy, existencia trasy)
   → náhľad: koľko nových, koľko už existuje, čo sa preskočí
   → zápis do persons (status: "invited")
   → odoslanie pozvánky cez Ecomail
```

**Náhľad pred zápisom je povinný**, nie voliteľný. Import stovky ľudí naslepo je presne
ten druh operácie, po ktorej sa hľadá, ako to vrátiť späť.

Import je **idempotentný**: opakovaný nahratý CSV existujúce osoby aktualizuje, nezaloží
znova. Rozpoznávacím kľúčom je `companyCode` + `email`.

### 4.2 Prihlásenie a prechod trasou

```
odkaz z e-mailu → NextAuth (magic-link) → kontrola proti persons
   → persons.status: "invited" → "active", firstLoginAt
   → zoznam krokov trasy s odvodeným stavom
   → človek otvorí dokument (accessLevel:internal, cez securityFilter)
   → prečíta → potvrdí
   → ďalší krok
```

Odkaz platí 24 hodín (ako dnes). Pri exspirácii si vie človek vyžiadať nový sám —
inak by HR trávilo týždeň preposielaním odkazov.

### 4.3 Potvrdenie

Jediné miesto, kde vzniká záznam. Postupnosť je zámerne takáto:

1. Server znovu načíta **aktuálne platnú verziu** dokumentu (nie tú, ktorú poslal klient).
2. Zloží `statementText` z názvu, `versionLabel` a `effectiveFrom`.
3. Zapíše `acknowledgements` s odtlačkami, IP a časom.
4. Až potom vráti klientovi „hotovo".

**Bod 1 je bezpečnostný.** Keby sa verzia brala z požiadavky klienta, dal by sa poslať
`versionId` starého znenia a potvrdiť niečo iné, než bolo na obrazovke.

Ak databáza odmietne zápis pre unikátny index, nie je to chyba — človek už potvrdil a
dostane to na vedomie.

### 4.4 Nová verzia smernice

```
kurátor založí novú verziu → nastaví requiresReacknowledgement
   ├── false → nič sa nedeje, staré potvrdenia platia
   └── true  → všetci, čo majú dokument v trase, dostanú krok späť do „nepotvrdené"
               (staré záznamy zostávajú — dokladujú staré znenie)
```

Toto je jediné miesto, kde sa stav niekomu „vráti". Preto musí byť rozhodnutie
vedomé a ľudské (D30 / O13), nie odvodené z diffu.

### 4.5 HR dashboard

| Pohľad | Odpovedá na |
|---|---|
| **Podľa dokumentu** | kto potvrdil túto smernicu, kto nie, kedy |
| **Podľa osoby** | čo má tento človek hotové a čo mu chýba |
| **Podľa trasy** | koľko percent má trasu dokončenú |
| **Export** | CSV pre audit a personálny spis |

**Pripomienky** posiela HR ručne alebo hromadne (nepotvrdeným v trase). Automatické
opakované pripomienky sa **zapínajú vedome** — automat, ktorý ľuďom píše každý týždeň
bez toho, aby o ňom niekto vedel, si o vypnutie e-mailov od Continea priam pýta.

---

## 5. Znenie potvrdzovacej formulky

Návrh:

> **Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label}, platná od
> {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.**

**Pozor na slovo „súhlasím".** V zadaní zaznelo *„prečítal som a súhlasím"*, ale pri
vnútornom predpise je súhlas právne zvláštny: smernica zaväzuje bez ohľadu na to, či
s ňou niekto súhlasí, a formulácia cez súhlas otvára otázku, čo platí pri nesúhlase.
Obvyklejšie a bezpečnejšie je **oboznámenie a záväzok dodržiavať**.

**✅ Rozhodnuté (2026-08-27):** ide sa cestou oboznámenia a záväzku, nie súhlasu (D28).
Formálne posúdenie právnikom SFZ sa tým nevylučuje — ak navrhne úpravu, zmení sa znenie pre
**nové** potvrdenia a staré zostanú platné v pôvodnom tvare. Presne preto je `statementText`
doslovný a nie odkaz na formulku.

Do formulky musí ísť **názov, verzia aj dátum platnosti**. Bez nich sa o rok nedá
povedať, čo presne bolo potvrdené.

---

## 6. Role a oprávnenia

Dopĺňa tabuľku rolí z `CMS_KONCEPCIA.md` kap. E. Práva sa **neodvodzujú** z rolí
sportnet.online (rovnaké pravidlo ako v CMS).

| Rola | Môže |
|---|---|
| **HR / personalista** | pozývať, vidieť stav všetkých osôb, posielať pripomienky, exportovať |
| **Vedenie** | vidieť súhrnný stav; **nevidí** obsah potvrdení mimo svojho útvaru |
| **Kurátor** | zakladať verzie dokumentov, skladať trasy, nastavovať `requiresReacknowledgement` |
| **Osoba** | vidieť **svoje** potvrdenia a stiahnuť si ich |

> **Zoznam „kto nepotvrdil" je citlivejší než samotné smernice.** Je to podklad
> k personálnemu opatreniu. Prístup k nemu je užší než prístup k obsahu.

Posledný riadok tabuľky nie je zdvorilosť: človek musí vedieť zobraziť a stiahnuť, čo
o ňom systém eviduje, aj bez žiadosti na HR.

---

## 7. Fázovanie

### 7.1 Ultra-MVP — jeden týždeň

Cieľ: **skutoční ľudia potvrdia skutočné smernice.** Nič viac.

| Ide do prevádzky | Nejde |
|---|---|
| `persons` + import z CSV (skriptom) | admin UI na pozývanie |
| prihlásenie proti `persons` | Entra ID, Sportnet OAuth |
| `documents.versions[]` + zobrazenie dokumentu | knižnica, editor, review |
| potvrdenie + `acknowledgements` | odvolanie, opravy |
| výkaz pre HR **skriptom do CSV** | dashboard |
| jedna trasa, pevné poradie | správa trás v UI |

> **Dve brány pred prvým ostrým potvrdením** (nie pred vývojom): Atlas **M10+** so zálohami (D31)
> a **Static IPs** so zúženým allowlistom (O12). Ultra-MVP sa smie dovyvinúť na dnešnej zostave;
> skutočný človek nepotvrdí nič, kým obe nestoja.

**Ako sa drží riziko termínu:** poradie prác je dané tak, aby v ktoromkoľvek momente
bolo funkčné to podstatnejšie. Keď sa nestihne výkaz, HR ho dostane z databázy ručne.
Keď sa nestihne trasa, ľudia dostanú zoznam štyroch dokumentov. Nestihnúť sa nesmie
**len potvrdenie a jeho záznam** — všetko ostatné má núdzovú náhradu.

Skript na výkaz je zámerne prvá vec po potvrdení: bez neho by ultra-MVP nebolo použiteľné,
lebo HR by nemalo ako zistiť výsledok.

### 7.2 Rozsah B — riadená trasa

Nad ultra-MVP pribúda: guided reading s progresom a návratom na rozpracované, HR
dashboard v UI, hromadné pozvánky a pripomienky z UI, správa trás, opätovné potvrdenie
pri novej verzii, vlastný vzhľad na `internal.futbalsfz.sk`.

Odhad **3–4,5 týždňa** vrátane ultra-MVP.

### 7.3 Rozsah C — obsahové stránky (nie teraz)

Uvítanie, organizačná štruktúra, úlohy prvého týždňa, kontakty — editovateľné bez
programátora. Vyžaduje web-obsahovú vrstvu CMS (D-CMS-1, D-CMS-2, D-CMS-5), ktorá
zatiaľ neexistuje.

Model to má pripravené: `onboarding_tracks.steps[].type: "page"`. Doplnenie preto
neznamená prepísanie, len pridanie.

---

## 8. Čo sa meria

| Metrika | Prečo |
|---|---|
| podiel potvrdených v trase | hlavné číslo pre HR |
| čas od pozvánky po dokončenie | ukáže, či proces drhne, alebo ľudia otáľajú |
| koľko ľudí si vyžiadalo nový odkaz | vysoké číslo = problém s doručovaním, nie s ľuďmi |
| neúspešné prihlásenia (adresa mimo `persons`) | zabudnutý človek v importe |

Metriky nesmú byť podkladom na hodnotenie jednotlivca — sú to čísla o procese.

---

## 9. Uzavreté rozhodnutia (2026-08-27)

| # | Rozhodnutie |
|---|---|
| **D24** | `acknowledgements` je samostatná **append-only** kolekcia s odtlačkami údajov a doslovným znením formulky |
| **D25** | Potvrdenie sa viaže na `versionId`; `documents.versions[]` zavádza onboarding v cieľovom tvare |
| **D26** | Zoznam pozvaných prechádza z `POVOLENE_EMAILY` do kolekcie `persons`; premenná zostáva ako núdzová brzda |
| **D27** | Guided reading nesie `onboarding_tracks`; **progres sa odvodzuje**, neukladá sa |
| **D28** | Formulka znie **„oboznámil som sa … a zaväzujem sa dodržiavať"**, nie „súhlasím"; ukladá sa doslovne |
| **D29** | Tenant a vzhľad sa určujú z hostiteľa; neznámy hostiteľ = zakázaný |
| **D31** | Atlas **M10+ pred prvým ostrým potvrdením** — M0 nemá zálohy a auditný záznam bez zálohy nie je auditný záznam |
| **O12** | `0.0.0.0/0` rieši **Vercel Static IPs** (100 $/mes., plán Pro); presun z Vercelu zostáva dlhodobým smerom |

## 10. Otvorené rozhodnutia

| # | Otázka | Kto rozhodne |
|---|---|---|
| **D30** | Čo je „podstatná zmena" vyžadujúca opätovné potvrdenie (= O13) | HR + legislatívec |
| **O14** | Meriame čas nad dokumentom / doskrolovanie? | vedenie + DPO |
| **O15** | Právny základ spracúvania `acknowledgements` | DPO |
| **O16** | Retencia auditného záznamu po skončení pracovného pomeru | právnik |

---

## 11. Naviazanie na fázy a dokumenty

| Oblasť | Fáza | Poznámka |
|---|---|---|
| `persons`, prihlásenie proti DB | **Fáza 8** | výrez z Fázy 5, cieľový tvar |
| `documents.versions[]` | **Fáza 8** | výrez z Fázy 4, cieľový tvar |
| `acknowledgements`, trasy, potvrdenie | **Fáza 8** | jadro |
| HR dashboard, pripomienky | **Fáza 8** | rozsah B |
| Obsahové stránky onboardingu | **Fáza CMS-Web** | rozsah C, po D-CMS-1/2/5 |
| Entra ID, Sportnet OAuth | **Fáza 5** | pohodlie, nie dosah |

---

*Dokument je zámer a podklad na schválenie. Po odsúhlasení doplniť do `CHANGELOG.md`
a do roadmapy na webe (`web/components/Roadmap.js`).*
