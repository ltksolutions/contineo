# ADR-006 — Schvaľovanie znenia pred jeho zverejnením

> **Stav:** návrh na schválenie · **Dátum:** 2026-09-10
> **Zadal:** Ján Letko („áno, ideme") · **Rozhodnutia nižšie sú môj návrh**, nie jeho pokyn
> **Nadväzuje na:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` (D6, D24, D27, D28, D30, D51, D57), `docs/ADR-005-retaz-dokazov.md`
> **Súvisiace:** `docs/design/README.md` časť 6 (nahrávanie má tretí krok „Schválenie"), `docs/DESIGN_GAP.md`
> **Implementácia:** zatiaľ žiadna — toto rozhodnutie predchádza kódu.

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

### D74 — Desať dnešných noriem sa **spätne neschvaľuje**

Zverejnené znenia spred tohto ADR zostanú, ako sú, a v histórii budú označené
ako *„zverejnené pred zavedením schvaľovania"*.

Dopísať im schválenie by znamenalo vyrobiť súhlas, ktorý nikto nedal — to isté,
čo sme odmietli pri termínoch (D61) a pri chýbajúcom čase čítania (D65).
Prázdne miesto bez vysvetlenia vyzerá ako stratený záznam; pomenované miesto je
poctivý stav.

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
| 2. brána pri prideľovaní | `lib/assignments.ts` | druhá podmienka vedľa `effectiveFrom` |
| 3. predloženie | `app/library/new`, `app/library/[id]` | tretí krok návrhu |
| 4. rozhodnutie | `app/library/[id]` + serverová akcia | bez JavaScriptu, ako potvrdzovanie (formulár nad akciou, nie API — inak CSRF na úkone s následkom) |
| 5. upozornenia | `lib/ecomail.ts` | menovaným ľuďom, nie hromadne — tu automatické odosielanie problém nie je |
| 6. Prehľad a knižnica | dlaždica „Čaká na schválenie", facet `Stav` | facet dostane tretiu hodnotu |
| 7. história | podľa ADR-005 | tá istá časová os, druhý druh udalosti |

### Riziká

- **Brána pri prideľovaní zastaví doterajší priebeh.** Kým sa desať noriem
  neoznačí ako grandfathered (D74), personalista by nemohol prideliť nič.
  Krok 2 preto **nesmie ísť pred** migráciou označenia.
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
