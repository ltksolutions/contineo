# ADR-023 — Právny základ už v príprave znenia

> **Stav:** prijaté · **Dátum:** 2026-09-28
> **Rozhodol:** Ján Letko (2026-09-28) — návrh ku kroku 3 z `NEXT.md`
> („Právny základ už počas schvaľovania") schválený s odpoveďami na päť
> otázok: nové pole bez migrácie áno; zodpovedná osoba vidí koncept aj
> dokumentu, ktorý by inak nevidela, áno; pri zmene osoby základ zostáva;
> upozornenie už v príprave áno; opraviť aj znenie s budúcou účinnosťou áno.
> **Nadväzuje na:** ADR-014 (D109 — zodpovedná osoba v príprave), ADR-017
> (D115, D116 — viac základov, zákonná povinnosť má prednosť), D91, D92
> **Mení:** ADR-014, D109 — bod „Právny základ určuje zodpovedná osoba po
> zverejnení"
> **Implementácia:** hotová (2026-09-28) — štyri commity na vetve
> `claude/lucid-curie-9giv6d` (dáta a prenos, stránka dokumentu, knižnica
> a dokumentácia, platnosť nahradeného znenia D143).

---

## 1. Kontext

Od ADR-014 sa zodpovedná osoba nového znenia určuje už v príprave, no
právny základ určovala až **po zverejnení**. Koncept totiž nevidel nikto
bez prístupu do knižnice: PDF konceptu otvoril len správca obsahu
a menovaný schvaľovateľ, formulár na základ bol len pri platnom znení.
Znenie tak vychádzalo bez základu a obrazovka pridelenia na to upozorňovala.

Pri prehliadke kódu vyšla ešte jedna medzera: znenie zverejnené s **budúcou
účinnosťou** stránka dokumentu do dňa účinnosti neukáže
(`effectiveVersion()`), takže upozornenie zo zverejnenia posielalo
zodpovednú osobu na stránku, kde formulár na základ nebol.

## 2. Rozhodnutie

### D139 — Právny základ sa určuje už v príprave

- Uloží sa na koncept ako `draftLegalBasis` — kópia položiek z číselníka
  (D92), kto a kedy ich vybral. Nové pole na dokumente, **bez migrácie**.
- **Kto smie:** to isté pravidlo ako pri znení (`canSetLegalBasis()`), len
  s osobou z prípravy — ona, alebo správca obsahu ako náhradník, keď ju
  príprava nemá alebo už nie je aktívna.
- **Nie je súčasťou schválenia** (ako D109): nevstupuje do identity
  konceptu, nezamyká sa počas kola a mení sa **bez dôvodu** — na koncept sa
  ešte nikto nepotvrdil. Stopu nesie audit.
- **Pri zmene zodpovednej osoby v príprave zostáva.** Nová osoba ho vidí
  vybraný a môže ho zmeniť.
- **Zverejnenie ho prenesie do znenia** (`legalBasisFromDraft()`): zoznam,
  rozhodujúci druh a spojené polia (D115, D116) aj záznam v histórii
  s tým, kto a kedy základ vybral, označený „určené v príprave". Z konceptu
  potom zmizne. Prenáša sa kópia z okamihu výberu, bez nového overenia proti
  číselníku.
- Keď v príprave nikto základ neurčil, platí doterajší postup — určí sa po
  zverejnení.

### D140 — Miesto: stránka dokumentu pre čitateľa

Zodpovedná osoba z prípravy vidí na `/documents/[id]` kartu pripravovaného
znenia: účinnosť, nový názov, PDF, text a formulár na základ. **Stránka ju
pustí aj k dokumentu, ktorý by inak podľa viditeľnosti nevidela** —
správca obsahu ju vybral menovite, rovnako ako schvaľovateľov, ktorí koncept
vidia tiež. Vtedy stránka ukáže len túto kartu, nič na čítanie ani na
potvrdenie. Ostatným sa dokument naďalej tvári ako neexistujúci (D32).

Karta postupu v knižnici v krokoch 1–3 povie, či je základ určený a kto ho
určí; správcovi obsahu ako náhradníkovi ponúkne formulár.

### D141 — Upozornenia

- Pri určení osoby v príprave jej príde do zvončeka
  `draftResponsibleAssigned` s odkazom na stránku dokumentu.
- Pri zverejnení príde `responsibleAssigned` („Určte právny základ") **len
  vtedy, keď základ ešte chýba**, alebo keď sa osoba pri zverejnení zmenila
  — nová o znení ešte nič nevie.

### D142 — Znenie s budúcou účinnosťou

Zodpovedná osoba (a náhradník podľa toho istého pravidla) dostane formulár
na základ zverejneného znenia **hneď po zverejnení**, nie až v deň
účinnosti. Zmena už určeného základu vyžaduje dôvod ako pri platnom znení.

### D143 — Nahradené znenie platí do účinnosti nového

Doplnené 2026-09-28 na pokyn Jána („opravu zverejnenia urob hneď").
`publish()` starému zneniu nastaví `isActive: false` a koniec platnosti =
začiatok nového. Kým nové platí až o niekoľko mesiacov, stránka dokumentu
dovtedy nemala **žiadne** znenie: čitateľ videl len „platnosť sa ešte
nezačala", nedalo sa potvrdiť a povinnosti zmizli.

Pravidlo výberu platného znenia (`effectiveVersion()`) preto berie aj
**nahradené znenie s koncom platnosti** a to platí do toho dňa. Rovnako už
počítal filter platnosti v knižnici. Neaktívne znenie **bez** konca platnosti
(obsah z kanála, D25) sa nevyberá ako doteraz.

Dôsledky počas obdobia pred účinnosťou novely: čitateľ číta a potvrdzuje
doterajšie znenie, prideľovanie a trasy pracujú s ním, retencia ho drží ako
platné. Zmena je len v čítaní — v databáze sa nič nemení a platí aj pre
znenia zverejnené vopred v minulosti.

**Neopravené:** vyhľadávanie asistenta pracuje s úsekmi, nie so zneniami,
a pri zverejnení prepne na novelu hneď. Rieši to samostatný plán (znenia
v indexe, `docs/TODO.md`).

## 3. Čo sa tým vedome kazí

- **Viditeľnosť má výnimku.** Zodpovedná osoba z prípravy uvidí koncept
  (a názov dokumentu) aj tam, kde by podľa úrovne prístupu nevidela nič.
- **Znenie môže vyjsť s položkou, ktorá medzičasom z číselníka zmizla.**
  Je to kópia toho, čo osoba vybrala, keď v ponuke bola — rovnako ako
  potvrdenie nesie kópiu základu z okamihu potvrdenia.
- **Výnimka platí len pre koncept.** Pri zverejnenom znení (aj
  s budúcou účinnosťou) zostávajú pravidlá viditeľnosti dokumentu.

## 4. Implementácia

- Pravidlá: `legalBasisFields()`, `sameBasisKeys()`, `legalBasisFromDraft()`
  v `versionResponsibility.ts`.
- Zápis a čítanie: `setDraftLegalBasis()`, `draftBasisTaskFor()`
  v `versionResponsibilityDb.ts`; prenos v `publish()` (`libraryWrite.ts`),
  ktorý vracia `legalBasisCarried`.
- PDF konceptu: `canSeeDraftPdf()` s `isDraftResponsible`.
- Obrazovky: `/documents/[id]` (karty úloh), karta postupu v knižnici,
  história znenia; texty sk/cs/en.
- Testy: pravidlá, zápis, vykreslenie stránky dokumentu v siedmich stavoch
  a karty v knižnici.
