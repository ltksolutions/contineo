# ADR-006 — Schvaľovanie znenia pred jeho zverejnením

> **Stav:** schválené · **Dátum:** 2026-09-10
> **Zadal:** Ján Letko („áno, ideme")
> **Odsúhlasil:** Ján Letko — D69 a D70 výslovne (2026-09-10), D74 a D75 pri
> zadaní o nahradení skúšobného korpusu. Zvyšok rozhodnutí je môj návrh, ktorý
> prijal ako celok.
> **Nadväzuje na:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` (D6, D24, D27, D28, D30, D51, D57), `docs/ADR-005-retaz-dokazov.md`
> **Súvisiace:** `docs/design/README.md` časť 6 (nahrávanie má tretí krok „Schválenie"), `docs/DESIGN_GAP.md`
> **Implementácia:** hotová (2026-09-10), kroky 1–6 vrátane brány pri prideľovaní.
> Odchýlky sú pomenované v `CHANGELOG.md` pri jednotlivých krokoch.

---

## 1. Čo problém odhalilo

Schvaľovanie v systéme **neexistuje** a blokuje to už tretiu vec:

1. **Nahrávanie** (krok 5b návrhu) má v prototype tri kroky — Súbor, Metadáta,
   **Schválenie** — so schvaľovateľmi a schvaľovacou cestou. Postavili sa dva.
2. **Prehľad** má dlaždicu „Čaká na schválenie 3". Nahradili sme ju „Konceptmi",
   lebo nebolo čo počítať.
3. **História schvaľovania** (zadanie z 2026-09-10) sa nedá ukázať, kým nie je
   čo schvaľovať.

Dnešný stav: dokument má `status: "draft" | "published"` — jeden príznak na
**celom dokumente**, ktorý slúži len na filtrovanie v knižnici. Znenie
(`Version`) má `effectiveFrom/To`, `isActive` a `fixes[]`, teda **právnu
platnosť** (D6), nie súhlas človeka.

Desať noriem SFZ je dnes zverejnených bez toho, aby ich niekto v systéme
schválil. Nie je to nedbalosť — nebolo čím.

---

## 2. Rozhodnutie

### D68 — Schvaľuje sa **znenie**, nie dokument

Toto je celá os návrhu. Schvaľuje sa text, ktorý bude ľuďom predložený na
potvrdenie a ktorý sa doslova ocitne vo formulke („verzia 4.2, platná od…",
D28). Dokument je len identita naprieč zneniami.

Dôsledok: `status` na dokumente prestáva byť zdrojom pravdy o zverejnení a
stáva sa **odvodeným** (D27) — „dokument je v knižnici viditeľný, keď má aspoň
jedno schválené znenie". Príznak sa nezruší hneď, ale prestane sa naň
rozhodovať.

### D69 — Schvaľovatelia sú **menovaní ľudia**, nie rola

Rola sa použije na **predvyplnenie** zoznamu, nie ako schvaľovateľ.

Prečo: „schválil niekto z útvaru Právne" je slabší záznam než „schválil Marek
Horák". Rola môže byť medzitým prázdna, môže mať dvadsať členov, a o rok sa
z nej nedá zistiť, kto to vlastne bol. Je to ten istý dôvod, pre ktorý je
`reason` pri pridelení povinný (D30) a pre ktorý potvrdenie nesie odtlačok mena
(D24). Návrh to má tak isto: *„Schvaľovatelia · Marek Horák · Právne · 1/6"*.

Kto smie **predložiť** na schválenie: `content-manager`, teda tá istá rola, čo
dnes nahráva. Kto smie schvaľovať: ktokoľvek, koho predkladateľ menoval —
**okrem seba**. Kto text nahral, ho neschvaľuje; inak je schválenie podpis pod
vlastnú prácu.

### D70 — Súbežne, nie za sebou

Musia schváliť **všetci menovaní**, na poradí nezáleží.

Postupné schvaľovanie („najprv právne, potom generálny sekretár") pridáva
čakanie a stav navyše. Nikto oň nežiadal a v tomto type organizácie je bežné,
že traja ľudia pozrú ten istý text nezávisle. Model to neznemožňuje na večné
časy — poradie sa dá doplniť poľom neskôr —, ale prvá verzia ho mať nebude.

### D71 — Zamietnutie je **záznam**, nie zmazanie

Jedno zamietnutie zastaví celé kolo. Znenie sa vráti do konceptu, zamietnutie
zostáva v histórii aj s **povinným dôvodom** — rovnaká úvaha ako pri D30.

Bez dôvodu je zamietnutie neopakovateľné: predkladateľ nevie, čo opraviť, a
o rok sa nedá povedať, prečo prvé kolo neprešlo. „Väčšinové schválenie" sa
nezavádza; pri záväznom predpise nie je dôvod prehlasovať toho, kto namieta.

### D72 — Schválené znenie sa **textovo nemení**

Schválením sa text zmrazí. Iný text znamená **nové znenie** — nie opravu
existujúceho. Kontrolou je `contentHash`, ktorý sa už dnes ukladá.

Metadáta sa opravovať dajú ďalej: `fixVersion()` a `fixes[]` existujú a nesú
kto, kedy a prečo siahol na označenie alebo platnosť. Rozdiel je vecný —
oprava preklepu v označení nemení to, s čím ľudia súhlasili; zmena vety
v článku 4 áno.

### D73 — Schválené ≠ účinné

Sú to dve nezávislé osi a **žiadna nenahrádza druhú**:

- **Schválené** — ľudia v organizácii sa zhodli, že text je správny.
- **Účinné** (`effectiveFrom`, D6) — odkedy zaväzuje.

Znenie sa dá schváliť v septembri s účinnosťou od januára. Prideliť sa dá až
to, čo je **schválené aj účinné** — k dnešnej bráne (`effectiveFrom` musí
existovať) pribúda druhá. Obe hlásia inú vetu, aby personalista vedel, čo mu
chýba.

**Doplnené 2026-09-12 — brána stojí aj pri publikovaní.** Dovtedy stála len pri
prideľovaní, a to je brána na nesprávnom mieste: neschválené znenie sa
zverejniť **dalo**, objavilo sa v knižnici a RAG z neho odpovedal — len sa
nedalo prideliť na potvrdenie. Kto si predpis nájde sám, číta ho bez ohľadu na
to, či ho niekto schválil, a systém, ktorý z neho odpovedá, za to ručí rovnako.

Schvaľuje sa preto **koncept**, nie hotové znenie. `versionId` vzniká až vnútri
`publish()` ako odtlačok textu (D57), takže pred publikovaním znenie ešte
neexistuje a nie je na čom viesť kolo. Kolo sa vedie na odtlačku
`draftMarkdown` a znenie, ktoré z neho vznikne, má ten istý `versionId` —
schválenie a zverejnené znenie sa teda nemôžu rozísť. Cena za to je viditeľná
a treba ju povedať nahlas: **každá úprava textu po schválení odtlačok zmení
a schválenie prestane platiť.** Nie je to chyba, je to presne to, čo žiada D28
aj D72; pre už zverejnené znenia zostáva východiskom `fixVersion()` s povinným
dôvodom.

Brána stojí **v `publish()`, nie v serverovej akcii** — akcií môže raz pribudnúť
viac a brána, ktorú sa dá obísť iným vstupom, nie je brána. A stojí **až za
kontrolou idempotencie**: opätovné zverejnenie rovnakého textu sa má naďalej
ticho nič-nedeje, inak by sa dnešný korpus spred zavedenia schvaľovania (D74)
prestal dať publikovať.

### D74 — Desať dnešných noriem sa **spätne neschvaľuje** (a čoskoro zmiznú)

> **Doplnené 2026-09-10 po informácii od Jána Letka:** dnešný korpus je
> skúšobný a **bude nahradený oficiálnymi zneniami**. To mení povahu tohto
> rozhodnutia — nie jeho obsah.

Zverejnené znenia spred tohto ADR zostanú, ako sú, a v histórii budú označené
ako *„zverejnené pred zavedením schvaľovania"*.

Dopísať im schválenie by znamenalo vyrobiť súhlas, ktorý nikto nedal — to isté,
čo sme odmietli pri termínoch (D61) a pri chýbajúcom čase čítania (D65).

**Označenie je ale dočasné lešenie, nie vlastnosť modelu.** Keďže tie znenia
budú nahradené, nemá vzniknúť trvalý pojem „schválené kedysi predtým", ktorý
by prežil svoj dôvod a o rok mýlil toho, kto ho nájde. Príznak sa zavedie ako
migračný a zmizne spolu so skúšobným korpusom.

### D75 — Oficiálne znenia musia prejsť schvaľovaním, nie okolo neho

Z toho istého dôvodu vzniká **poradie, ktoré sa nedá otočiť**:

1. schvaľovanie musí **fungovať**,
2. až potom sa nahrávajú oficiálne znenia — **cezeň**, nie mimo neho,
3. až potom sa skúšobný korpus odstráni (rozhodnutie Jána Letka, nie skriptu).

Keby sa oficiálne normy nahrali skôr, boli by druhým prípadom pre D74 — a to
už by nebolo lešenie, ale ostrý korpus bez súhlasu. Práve preto, že sa korpus
mení, je toto **jediná príležitosť mať úplnú reťaz dôkazov od prvého dňa**:
každé oficiálne znenie by malo mať skutočný záznam o schválení, nie výnimku.

Súvisí s tým dvoje už zapísané v `docs/TODO.md`, čo dozreje v tom istom
okamihu: porovnať dátumy platnosti s webom SFZ a nahradiť vymyslené označenie
znenia „1.0" skutočným.

---

## 3. Model

```ts
/** Kolo schvaľovania jedného znenia. Append-only, ako `acknowledgements`. */
interface ApprovalRound {
  companyCode: string
  documentId: string
  versionId: string
  round: number                 // druhé kolo po zamietnutí je nové kolo
  submittedBy: string
  submittedAt: Date
  note?: string                 // čo sa v znení mení — pre schvaľovateľa
  approvers: {
    email: string
    fullName: string            // odtlačok, nie odkaz (D24)
    decidedAt: Date | null
    decision: "approved" | "rejected" | null
    reason?: string             // povinný pri zamietnutí (D71)
  }[]
  closedAt: Date | null
  outcome: "approved" | "rejected" | null
}
```

Stav znenia je **odvodený** z posledného kola (D27), nie uložený:

| stav | podmienka |
| --- | --- |
| `draft` | kolo neexistuje, alebo posledné skončilo zamietnutím |
| `in-review` | kolo beží, niekto ešte nerozhodol |
| `approved` | posledné kolo skončilo schválením |

---

## 4. Čo to znamená v kóde

| krok | súbory | poznámka |
| --- | --- | --- |
| 1. model a stav | `lib/approvals.ts` (nová), čistá funkcia `versionState()` | testovateľná bez Monga |
| 2. brána pri prideľovaní | `lib/assignments.ts` | druhá podmienka vedľa `effectiveFrom` · hotové 2026-09-10, až po krokoch 3–5 |
| 2b. brána pri publikovaní | `lib/libraryWrite.ts`, `lib/approvals.ts` | `publishBlock({ state })` **za** kontrolou idempotencie · schvaľuje sa koncept (odtlačok `draftMarkdown`) · hotové 2026-09-12 |
| 3. predloženie | `app/library/new`, `app/library/[id]` | tretí krok návrhu |
| 4. rozhodnutie | `app/library/[id]` + serverová akcia | bez JavaScriptu, ako potvrdzovanie (formulár nad akciou, nie API — inak CSRF na úkone s následkom) |
| 5. upozornenia | `lib/ecomail.ts` | menovaným ľuďom, nie hromadne — tu automatické odosielanie problém nie je |
| 6. Prehľad a knižnica | dlaždica „Čaká na schválenie", facet `Stav` | facet dostane tretiu hodnotu |
| 7. história | podľa ADR-005 | tá istá časová os, druhý druh udalosti |

### Riziká

- **Brána pri prideľovaní zastaví doterajší priebeh.** ~~Kým sa desať noriem
  neoznačí ako grandfathered (D74), personalista by nemohol prideliť nič.~~
  **Vybavené 2026-09-10:** `scripts/migrate_published_before.mjs` označil
  11 znení v 10 dokumentoch SFZ; 10 auditných záznamov. Po nahradení korpusu
  (D75) riziko zaniká spolu s príznakom.
- **Brána bez cesty cezeň je horšia než žiadna brána.** Pôvodné poradie krokov
  (2 hneď po migrácii) má dieru: medzi krokom 2 a krokom 4 by sa nové znenie
  dalo nahrať, ale nie schváliť — a teda ani prideliť, bez toho, aby s tým
  vedel ktokoľvek čokoľvek urobiť. Migrácia to nekryje: príznak dostali len
  znenia, ktoré v knižnici **už boli**, a nové ho zámerne nedostávajú nikdy.
  **Poradie sa preto mení: 1 → migrácia → 3 (predloženie) → 4 (rozhodnutie)
  → 2 (brána) → 5, 6, 7.** Brána ide až vtedy, keď cez ňu vedie cesta.
- **Schvaľovateľ, ktorý odíde z organizácie**, kolo zablokuje. Prvá verzia to
  rieši tým, že predkladateľ môže kolo zrušiť a otvoriť nové; automatické
  preväzovanie na nástupcu je pasca (kto potom schválil?).
- Zamietnutie s dôvodom je text, ktorý číta autor. Je to **spätná väzba na
  prácu človeka** — v rozhraní má byť pri ňom meno toho, kto ho napísal, nie
  anonymné „zamietnuté".

---

## 5. Čo tento dokument nerieši

- **Postupné schvaľovanie** (najprv X, potom Y) — vedome odložené (D70).
- **Kto smie meniť zoznam schvaľovateľov po predložení.** Prvá verzia: nikto;
  kolo sa zruší a otvorí nové.
- **Retencia** kôl schvaľovania — patrí k O16 spolu s auditom a potvrdeniami.
