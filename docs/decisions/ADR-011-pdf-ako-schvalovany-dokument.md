# ADR-011 — Schvaľuje a potvrdzuje sa PDF; text je na vyhľadávanie

> **Stav:** prijaté · **Dátum:** 2026-09-23
> **Zadal:** Ján Letko — „dokumenty často obsahujú aj prílohy, kde sú formuláre,
> tabuľky, obrázky a podobne, preto potrebujeme schvaľovaný dokument schváliť ako
> celok a aj v náhľade pri schvaľovaní je potrebné, aby tie prílohy osoby videli
> a schválili, verzia dokumentu ‚markdown' je len pre účely RAG a vyhľadávania"
> (2026-09-23)
> **Odsúhlasil:** Ján Letko (2026-09-23) — dokumenty **do 25 MB**; správca nahrá
> **povinne PDF** a voliteľne `.docx` alebo iný zdroj pre lepší text; úložisko
> **zostáva v Atlase** (GridFS).
> **Nadväzuje na:** ADR-002 (dátová rezidencia), ADR-005 (reťaz dôkazov),
> ADR-006 (schvaľovanie, D68), ADR-007 (oprava textu, D76), D24, D28, D53, D57
> **Mení:** D68 — schvaľuje sa PDF **a** text, nie len text.

---

## 1. Čo problém odhalilo

Pri prvom nahratí ostrého dokumentu cez rozhranie (Pracovný poriadok SFZ, 2,5 MB
`.docx`) sa ukázali tri veci naraz:

1. **Schvaľuje a potvrdzuje sa Markdown.** Schvaľovateľ vidí text prevedený na
   vyhľadávanie, zamestnanec pri potvrdení tiež. Prílohy — formulár, tabuľka,
   obrázok — v ňom nie sú alebo sú rozbité. Človek teda schvaľuje a potvrdzuje
   niečo iné, než je predpis.
2. **Odtlačok originálu neexistuje.** Kolo schvaľovania aj potvrdenie nesú
   odtlačok Markdownu (`versionId`, D57). Že sa schválilo *toto* PDF, sa dnes
   dokázať nedá. Zverejnené znenie (`versions[]`) si ani nepamätá, z ktorého
   súboru vzniklo — `originalFile` je jeden na dokument a nové nahratie ho prepíše.
3. **Strop 4 MB nestačí.** Súbor ide v tele serverovej akcie a Vercel pustí do
   funkcie najviac 4,5 MB (request aj response). Dokumenty SFZ majú do 25 MB.

Popri tom sa našlo, že obrazovka „Na schválenie" ukazovala platné znenie namiesto
konceptu (opravené v PR #91) — ten istý druh chyby: schvaľovalo sa niečo iné,
než človek videl.

---

## 2. Rozhodnutie

### D94 — Dôkazom je **PDF**, Markdown je odvodenina na vyhľadávanie

Každé znenie má **povinné PDF** — to je predpis tak, ako ho ľudia vidia, schvaľujú
a potvrdzujú, vrátane príloh. Markdown zostáva, ale jeho úloha sa zužuje: je to
**text na vyhľadávanie a odpovede** (RAG), nie schvaľovaný dokument.

Prečo PDF a nie `.docx`: prehliadač PDF zobrazí verne a bez ďalšej služby.
`.docx` verne nezobrazí nič — 34 MB obrázok EMF z pracovného poriadku nevykreslí
žiadna knižnica v prehliadači, a rozloženie, ktoré sa líši od Wordu, nie je
podklad pre schválenie.

### D95 — Voliteľný **zdroj textu**

Popri PDF môže správca nahrať **zdroj textu** — `.docx`, `.xlsx`, `.md`, `.txt`,
`.csv`. Markdown sa potom robí zo zdroja, lebo z Wordu vychádza čistejší text než
z PDF (nadpisy, zoznamy, tabuľky). Bez zdroja sa Markdown robí z PDF.

Zdroj **nie je dôkaz** — ukladá sa pre ďalší prevod a pre správcu, schvaľovateľ
ani zamestnanec ho nevidia.

### D96 — Odtlačok PDF je súčasťou identity konceptu

K PDF sa pri nahratí spočíta **SHA-256 z bajtov**. Identita konceptu, na ktorej
beží kolo schvaľovania (ADR-006), je odteraz **odtlačok PDF a odtlačok textu
spolu** (`draftIdentity()`), nie len text:

- zmena PDF po schválení **schválenie zruší** — presne ako dnes zmena textu;
- zmena textu (úprava pre vyhľadávanie) schválenie **tiež zruší**. Text je síce
  odvodenina, ale systém z neho odpovedá a ručí zaň (ADR-006) — schvaľovateľ ho
  vidí ako druhú časť toho istého rozhodnutia.

Pre znenia bez PDF (spred tohto ADR) zostáva identita odtlačkom textu, takže
existujúce kolá, znenia a potvrdenia sa nemenia.

`versionId` zverejneného znenia vzniká z tej istej identity. Chunky ho nesú
ďalej ako doteraz (D57 platí: vyladenie chunkera identitu nemení, lebo do nej
nevstupuje).

### D97 — PDF je **kópia pri znení**, nie odkaz na dokument

Pri zverejnení sa do `versions[]` zapíše `file` — identifikátor v GridFS, názov,
veľkosť a SHA-256. Nové nahratie dokumentu ho neprepíše. Potvrdenie (D24) nesie
**SHA-256 a názov PDF** v čase potvrdenia — o rok sa dá overiť, že súbor
v úložisku je bajt po bajte ten, ktorý človek potvrdil.

PDF znenia sa **nemaže** (D24): je súčasťou dôkazu.

### D98 — Nahrávanie po kúskoch do GridFS, čítanie prúdom

Úložisko zostáva **GridFS v Atlase** (D53, ADR-002) — žiadne druhé miesto pre
dáta zákazníka.

- **Nahrávanie:** prehliadač rozdelí súbor na kúsky po 3 MB a pošle ich jeden po
  druhom na `/api/library/upload`. Každý kúsok sa zapíše ako chunk GridFS; záznam
  súboru vznikne až po poslednom, keď server spočíta SHA-256 a overí počet.
  Nedokončené kúsky nesú `pendingUntil` a zmaže ich TTL index — nahratie, ktoré
  niekto prerušil, po sebe nenechá smeti.
- **Strop 25 MB** na súbor (`MAX_BYTES`).
- **Bez JavaScriptu** zostáva odoslanie formulárom, so stropom 4 MB — to, čo
  funguje dnes, sa nerozbije.
- **Čítanie:** súbor sa posiela **prúdom** z GridFS. Odpoveď v prúde strop
  4,5 MB nemá (Vercel, overené v dokumentácii 2026-09-23); načítanie celého
  súboru do pamäte a poslanie naraz by ho malo.

Priebeh nahrávania je teraz skutočný — prehliadač vie, koľko kúskov odoslal —
takže pruh ukazuje percentá, nie len „pracuje sa".

### D99 — PDF vidí každý, kto smie vidieť znenie

Dnes originál otvorí len správca obsahu. Odteraz:

- **PDF zverejneného znenia** — každý, komu je znenie dostupné (tie isté pravidlá
  ako stránka dokumentu);
- **PDF konceptu** — správca obsahu a **menovaní schvaľovatelia** otvoreného kola
  na tomto koncepte;
- **zdroj textu** — len správca obsahu.

`companyCode` je v podmienke dotazu (D32), identifikátor súboru sám nič neotvára.

---

## 3. Čo sa zobrazuje

- **Schvaľovanie:** PDF konceptu vložené na stránke (na telefóne odkaz „Otvoriť
  PDF", lebo vložené PDF sa tam zobrazí len prvou stranou), pod ním zbalený text
  na vyhľadávanie. Schvaľovateľ schvaľuje oboje, jedným rozhodnutím.
- **Potvrdenie:** PDF znenia ako hlavný obsah, text na vyhľadávanie zbalený.
  Potvrdzovacia formulka (D28) sa nemení.
- **Znenia spred ADR-011** bez PDF zobrazujú text ako doteraz, s vetou, že PDF
  k zneniu nie je. PDF sa k nim **spätne nepripája** — dopísať, že ľudia videli
  súbor, ktorý nevideli, by bol vyrobený dôkaz (rovnaká zásada ako D74).

---

## 4. Čo sa tým vedome kazí

- **Úprava textu na vyhľadávanie počas kola ho zruší.** Je to cena za to, že
  systém ručí za odpovede z textu. Opravy platného znenia podľa ADR-007
  (`fixText()`) zostávajú bez nového kola — tie sa PDF nedotýkajú.
- **Veľké súbory potrebujú JavaScript.** Bez neho funguje nahratie do 4 MB.
- **Dva súbory namiesto jedného** pri nahrávaní — o krok viac pre správcu.
  Automatický prevod `.docx` → PDF (Microsoft Graph) by krok ušetril, ale
  vyžaduje nové povolenia v Entra ID; je to samostatné rozhodnutie.

---

## 5. Čo tento dokument nerieši

- Automatický prevod `.docx` → PDF (Graph, Gotenberg).
- Kotvu citácie na stranu PDF v odpovedi (D16).
- Náhľad a porovnanie dvoch PDF (rozdiel medzi zneniami je dnes nad textom).

---

## 6. Implementácia

Po krokoch, každý samostatný PR:

1. ✅ Oprava obrazovky schvaľovania — koncept namiesto platného znenia (PR #91).
2. Úložisko: SHA-256 pri ukladaní, čítanie prúdom, nahrávanie po kúskoch,
   strop 25 MB (D98).
3. Model a nahrávanie: povinné PDF + voliteľný zdroj, `draftIdentity()`,
   `versions[].file` pri zverejnení (D94–D97).
4. Zobrazenie a prístup: PDF pri schvaľovaní a potvrdení, SHA-256 v potvrdení
   (D97, D99).
