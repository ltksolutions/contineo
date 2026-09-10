# ADR-005 — Reťaz dôkazov o potvrdení: od pridelenia po potvrdenie

> **Stav:** návrh na schválenie · **Dátum:** 2026-09-10
> **Rozhodol:** Ján Letko (trvalý záznam o prvom otvorení; časová os na karte osoby **aj** ako samostatná obrazovka)
> **Nadväzuje na:** `docs/ADR-003-onboarding-a-potvrdzovanie.md` (D24, D27, D28, D51), `docs/ADR-004-termin-potvrdenia.md` (D61–D63)
> **Súvisiace:** `app/src/lib/readingTime.ts`, `app/src/lib/acknowledgements.ts`, `app/src/lib/audit.ts`, otvorené body O14, O15, O16
> **Implementácia:** zatiaľ žiadna — toto rozhodnutie predchádza kódu.

> ⚠️ Nie je to právne posúdenie. Akú váhu má ktorý článok reťaze pred súdom,
> patrí právnikovi a DPO (O15). Tento dokument hovorí len o tom, **čo systém
> môže poctivo tvrdiť** — a čo tvrdiť nesmie.

---

## 1. Čo problém odhalil

Zadanie znelo: *„potrebujeme celú históriu potvrdzovania pridelených dokumentov
osobami kvôli dokázateľnosti — kedy mu bola pridelená úloha, kedy ju prvýkrát
otvoril a čítal, čas čítania už máme, a kedy to potvrdil."*

Pri kontrole sa ukázalo, že jeden článok tej reťaze nie je taký, ako znie.

| článok | kde je | trvanlivosť | čo to unesie |
| --- | --- | --- | --- |
| pridelenie úlohy | `assignments.assignedAt`, `reason`, `assignedBy` | trvalé | dôkaz |
| termín | `assignments.due` (ADR-004) | trvalé | dôkaz |
| upozornenia e-mailom | `assignments.notified[]` | trvalé | dôkaz |
| **prvé otvorenie** | `reading_times.firstSeenAt` | **rok** | — |
| **čas čítania** | `reading_times.seconds` | **rok** | **výslovne nie dôkaz** |
| potvrdenie | `acknowledgements` — čas, formulka, hash, verzia, IP, odtlačok oddelenia | trvalé | **toto je ten dôkaz** (D24, D28) |

`readingTime.ts` to hovorí sám: čas čítania je zámerne **mimo** `acknowledgements`,
lebo *„čokoľvek, čo je v `acknowledgements`, sa raz ocitne vo výkaze pre
právnika. Čas meraný na klientovi tam nemá čo hľadať: kto nechá kartu otvorenú,
‚číta' hodinu."* A má ročnú retenciu (rozhodnutie 2026-09-06).

**Reťaz dôkazov postavená nad tým by bola úplná dvanásť mesiacov a potom by jej
ticho zmizli dva zo štyroch riadkov.** Pri obhajobe vyzerá diera v zázname
horšie než záznam, ktorý ju nikdy nemal.

---

## 2. Rozhodnutie

### D64 — „Prvýkrát otvoril" je vlastná trvalá udalosť, oddelená od merania

Sú to dve rôzne veci, ktoré len vyzerajú ako jedna:

- **„Otvoril 8. 9. o 14:12"** je *fakt so serverovým časom*: server mu obslúžil
  stránku znenia. Dá sa obhájiť a zapíše sa **natrvalo**.
- **„Čítal 12 minút"** je *meranie na klientovi*. Zostáva informatívne, s ročnou
  retenciou, a v prehľade **musí byť ako informatívne označené**.

Nová kolekcia `document_opens`, append-only, jeden riadok na dvojicu
osoba × znenie:

```ts
interface DocumentOpen {
  companyCode: string
  personId: string
  documentId: string
  versionId: string     // otvorenie sa viaže na znenie, nie na dokument (D28)
  firstOpenedAt: Date
}
```

Tri vlastnosti, ktoré z toho robia záznam a nie telemetriu:

1. **Zapisuje server, nie klient.** Beacon sa dá zablokovať a stratiť; server
   vie, že obsah odoslal. (Nevie, že ho človek čítal — preto sa to volá
   „otvoril", nie „prečítal".)
2. **Zapíše sa raz a nikdy sa neprepíše.** `$setOnInsert`, teda jeden zápis na
   dvojicu za celý život, nie zápis pri každom zobrazení.
3. **Len tomu, kto má povinnosť.** Personalista, ktorý si znenie otvorí na
   kontrolu, sa nezapisuje. Je to minimalizácia údajov (O14) a zároveň presne
   to, čo reťaz potrebuje.

Retencia: **ako potvrdenie**, lebo je to jeho súčasť. Otvorenie bez následného
potvrdenia je tiež údaj — hovorí, že človek vedel a nepotvrdil.

### D65 — Časová os je pohľad, nie záznam

Potvrdenie zostáva **samonosné** (D24): nesie odtlačky mien, názvov a formulky,
takže sa dá prečítať o tri roky bez pozerania inam. Časová os je kontext okolo
neho — **nie náhrada zaň a nie nový zdroj pravdy.** Nič sa do nej neukladá.

Pri každom riadku je vidieť jeho váhu. Riadok „čítal 12 minút" je označený ako
informatívny a **môže chýbať** (po roku sa maže) — a keď chýba, os to napíše.
Prázdne miesto bez vysvetlenia vyzerá ako zmazaný záznam.

### D66 — Nie je to filter nad auditom

`AuditSubject` je `person | department | document | folder | assignment |
organisation` — sú to **administratívne zmeny**: kto čo prestavil. Otázka „čo
urobil človek so svojou povinnosťou" je iná vec. Tri dôvody, prečo to nespájať:

1. **Iné publikum.** Audit vidí `people-admin` a správca platformy (D51). Reťaz
   dôkazov potrebuje personalista, ktorý audit vidieť nemusí.
2. **Iná retencia.** Retencia auditu aj potvrdení je otvorená (O16) a nemusí
   vyjsť rovnako. Jeden pohľad nad dvomi rôznymi retenciami sa raz rozpadne.
3. **Dôkaz zložený filtrovaním logu je hypotéza, nie záznam** — presne pred tým
   varuje `acknowledgements.ts`: *„Záznam, ktorý na vysvetlenie potrebuje
   `$lookup` do štyroch kolekcií, ktoré sa medzitým zmenili, nie je dôkaz."*

### D67 — Dve miesta, jeden pohľad

Rozhodnutie Jána Letka: **aj karta osoby, aj samostatná obrazovka.**

- **Karta osoby** (`/people/[id]`) — „ako je na tom tento človek". Os pre každý
  jeho dokument, zbalená; rozbalí sa ten, ktorý niekoho zaujíma.
- **Samostatná obrazovka** (`/hr/evidence`) — „ako je na tom celé oddelenie".
  Filter cez osobu, dokument, oddelenie, stav (potvrdené / otvorené a
  nepotvrdené / ani neotvorené) a obdobie. Export CSV rovnako ako výkaz.

Obe kreslia **ten istý komponent nad tou istou funkciou**. Dva pohľady na to
isté, ktoré si každý počíta po svojom, sú dva pohľady, ktoré si raz budú
odporovať — a pri dôkaze je to horšie než nemať druhý.

Prístup: personalista vo svojej organizácii (D32, D33). Nie naprieč tenantmi.

---

## 3. Čo to znamená v kóde

| krok | súbory | poznámka |
| --- | --- | --- |
| 1. udalosť otvorenia | `lib/documentOpens.ts` (nová), `app/documents/[documentId]/page.tsx` | `$setOnInsert`, len pre adresáta; index `{companyCode, personId, versionId}` unikátny |
| 2. zloženie osi | `lib/evidence.ts` (nová) — čistá funkcia nad načítanými záznamami | testovateľná bez Monga, rovnako ako `due.ts` |
| 3. komponent | `components/EvidenceTimeline.tsx` | jeden pre obe miesta |
| 4. karta osoby | `app/people/[id]/page.tsx` | |
| 5. obrazovka + filtre + CSV | `app/hr/evidence/` | filtre v adrese, ako v knižnici |
| 6. GDPR | `docs/GDPR_DATA_PROTECTION.md` | **nový osobný údaj** — musí byť v dokumentácii skôr, než sa začne zbierať (O14) |

Krok 6 nie je formalita a ide **pred** krokom 1: začať zbierať údaj, ktorý nie
je v dokumentácii, je presne to, čo pri audite robí problém.

### Riziká

- **Zápis pri zobrazení dokumentu.** Musí byť nezhoditeľný: keď zápis zlyhá,
  stránka sa **aj tak zobrazí**. Meranie nesmie brániť plneniu povinnosti.
- **Spätne to nedoplníme.** Ľudia, ktorí znenie otvorili pred nasadením, budú
  mať v osi medzeru. Musí byť pomenovaná („pred zavedením záznamu"), nie
  prázdna — to je ten istý dôvod ako pri chýbajúcom čase čítania.
- Os ukazuje, že niekto **otvoril a nepotvrdil**. Je to legitímny údaj, ale má
  bližšie k hodnoteniu človeka než čokoľvek doteraz. Patrí k O14 a k rozhovoru
  s DPO, nie do prvého nasadenia bez neho.

---

## 4. Čo tento dokument **nerieši**

**Schvaľovanie nových dokumentov do knižnice neexistuje.** Stavy sú koncept a
publikované; schvaľovatelia ani schvaľovacia cesta v modeli nie sú, a preto
v nahrávaní chýba tretí krok z návrhu. História schvaľovania sa nedá ukázať,
kým nie je čo schvaľovať.

Ján Letko odsúhlasil, že sa to navrhne — patrí to do **vlastného ADR**, nie sem.
Rozhodnúť tam treba aspoň: kto schvaľuje (rola verzus menovaní ľudia), či je
schválení viac za sebou alebo naraz, čo sa stane pri zamietnutí, či sa schválené
znenie dá ešte zmeniť, a ako sa to má k `effectiveFrom` (D6) — schválené
a účinné nie je to isté.
