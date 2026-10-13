# ADR-034 — Úloha dokumentu, hierarchia dokumentov a návrhy z helpdesku do manuálov

> **Stav:** prijaté · **Dátum:** 2026-10-13
> **Zadal a odsúhlasil:** Ján Letko (13. 10. 2026) — „FAQ by som úplne zrušil
> a prerobil analýzu otázok/e-mailov/ticketov tak, aby navrhovala doplnenie
> manuálov"; „máme nejaké linkovanie, ktoré dokumenty sú nemenný zdroj
> (normy, smernice) a ktoré sú zdroj na úpravu (manuály, príručky)?";
> odpovede 1 A, 2 (poriadok, stanovy, zákon), 3 (zmazať FAQ po prerábke),
> 4 áno; „Zákon je nadradený Stanovám… vedieť nastavovať, čo je čomu
> nadradený dokument, podobne ako pri oddeleniach"; „nadradených dokumentov
> môže byť viac".
> **Nadväzuje na:** ADR-028 (kanály, D164 FAQ ako druh, D201 FAQ kanála),
> ADR-030 (ťažba histórie helpdesku), ADR-032 (kontrola súladu, D197, D198,
> D199, D200), ADR-010 (druh dokumentu), ADR-025 (archivácia)
> **Mení:** D164 a D201 sa rušia (FAQ zaniká); D197 a D198 nahrádza hierarchia
> dokumentov (D219) a poradie záväznosti druhu (D216); ADR-030 krok 3
> (návrhy FAQ) nahrádza D221; fáza 1 ADR-032 (kontrola návrhov FAQ) zaniká
> spolu s FAQ.

---

## 1. Kontext

FAQ z troch rokov helpdesku (ADR-030) prešla kontrolou proti manuálom a
normám (ADR-032). Ukázalo sa:

- Z 54 návrhov sa 42 opiera o manuály alebo normy — asistent kanála ich vie
  odpovedať priamo z dokumentov kanála. FAQ bola ich druhá kópia, ktorú
  treba po každej novele znova kontrolovať (12. 10.: 54 návrhov, 7,75 USD
  po jednej novele ISSF-01).
- Najcennejší výsledok ťažby nebola FAQ, ale **medzera v manuáli**: zmenu
  e-mailu (2 152 vlákien) manuál vôbec neopisoval. Po doplnení (ISSF-01,
  znenie od 13. 10. 2026) ju vie asistent odpovedať z manuálu.
- Systém nerozlišoval dokument, ktorý mení len orgán (zákon, stanovy,
  poriadok, smernica), od dokumentu, ktorý dopĺňa správca obsahu (manuál).
  Poradie záväznosti bolo napevno v kóde a vlastný druh „Poriadok" sa radil
  za manuál.

## 2. Rozhodnutie

### D215 — Úloha dokumentu je vlastnosť druhu

Každý druh v číselníku `category` nesie úlohu `role`:

| Úloha | Druhy | Kto a ako ho mení | Kontrola súladu | Analýza helpdesku |
|---|---|---|---|---|
| **záväzný** (`binding`) | zákon, stanovy, poriadok, smernica | len orgán, novým schváleným znením | meradlo; sám sa kontroluje len proti vyšším záväzným | nenavrhuje text — len **podnet pre legislatívu** |
| **výkladový** (`guidance`) | manuál, metodický pokyn (návod, príručka) | správca obsahu v Contineo | kontroluje sa proti záväzným | **navrhuje doplnenie konkrétnej časti** |
| **záznam** (`record`) | zápisnica, zmluva, tlačivo | nemení sa | nekontroluje sa | nepoužíva sa |

Úloha sa nastavuje pri **druhu**, nie pri dokumente — dokument si druh
vyberá aj tak. Vlastný druh organizácie dostane úlohu pri pridaní v
Organizácia → Číselníky; bez nej je výkladový (záväznosť sa neprisudzuje
potichu).

### D216 — Poradie záväznosti druhu

Druh nesie `rank` — menšie číslo je vyššie: **zákon 0 › stanovy 1 ›
poriadok 2 › smernica 3** › (vlastný záväzný druh 4) › metodický pokyn 9 ›
manuál 10. Zákon je nadradený Stanovám, Stanovy všetkým poriadkom. Poradie
druhu je predvoľba; presné vzťahy medzi dokumentmi určuje hierarchia (D219).

### D217 — Druhy Stanovy, Poriadok a Zákon; Norma zaniká

- **Všetko, čo má v názve „poriadok", je poriadok** (druh `poriadok`), aj
  Pracovný poriadok. **Stanovy SFZ** sú vlastný druh `stanovy`, nadradený
  všetkým poriadkom. **Zákon** (`zakon`, napr. zákon o športe) je aktívny.
- Druh **Norma** zaniká. Migrácia `npm run migrate:kinds` presunie dokumenty
  podľa názvu (s auditom) a odoberie vlastný druh „Poriadok" organizácie
  SFZ, ktorý je teraz základný. Kľúč `norma` ostáva v číselníku neaktívny,
  kým ho nenesie žiadny dokument, potom sa odstráni.
- Poriadky sa presunú do priečinka poriadkov organizácie.

### D218 — Kontrola súladu podľa úlohy

- Na kontrolu sa ponúka výkladový aj záväzný dokument (poriadok sa dá
  skontrolovať proti Stanovám), záznam nie.
- **Meradlom je len záväzný dokument**, zoradený od najvyššieho. Server
  odmietne kontrolu proti výkladovému dokumentu
  (`compliance.referenceNotBinding`) — manuál nie je norma, podľa ktorej
  by sa dal iný dokument opraviť.

### D219 — Hierarchia dokumentov (viac nadradených)

Dokument môže mať **jeden alebo viac nadradených dokumentov** — napríklad
Stanovy → zákon o športe; Registračný a prestupový poriadok → Stanovy;
manuál ISSF-04 → RaPP aj Súťažný poriadok. Vzťahy tvoria sieť **bez
cyklov** (dokument nemôže byť sám sebe nadradený ani cez iné). Spravuje sa
podobne ako oddelenia: v Knižnici, pri dokumente aj v prehľade celej
hierarchie.

- **Kontrola súladu** predvyplní meradlá z nadradených dokumentov a ich
  nadradených (celá cesta nahor), plus pevné väzby (D200). Pevné väzby
  ostávajú na vzťahy, ktoré hierarchia nevyjadruje.
- **Záväznosť dvoch dokumentov**: nadradený je vyšší ako podriadený; bez
  vzťahu v hierarchii rozhoduje poradie druhu (D216).
- Nahrádza D197 (väzby podľa druhu) a D198 (poradie záväznosti ako
  nastavenie organizácie).

### D220 — FAQ zaniká

FAQ ako druh dokumentu (D164), FAQ kanála (D201), editor FAQ, fronta
návrhov FAQ a kontrola návrhov FAQ (ADR-032 fáza 1) sa zrušia. Asistent
kanála odpovedá z dokumentov kanála. **Dáta FAQ sa zmažú** (rozhodnutie
Jána: nearchivovať) — ale až **po** prerábke analýzy a vytvorení návrhov na
doplnenie manuálov (D221), aby sa z 54 otvorených návrhov nestratilo nič,
čo manuálom chýba.

### D221 — Analýza helpdesku navrhuje doplnenie manuálov

Ťažba histórie (ADR-030) ostáva v krokoch zber → témy → návrh, mení sa
výstup. Pri každej téme analýza rozhodne:

1. **Pokryté** — odpoveď je vo výkladovom dokumente kanála → nič.
2. **Medzera** — odpoveď je len v záväznom dokumente alebo nikde → **návrh
   na doplnenie výkladového dokumentu**: ktorý manuál, ktorá časť, navrhnuté
   znenie a z čoho vychádza (počet vlákien, citácia záväzného dokumentu).
3. **Rozpor s praxou** — helpdesk odpovedá inak, než hovorí záväzný dokument
   → **podnet pre legislatívu** (ako tri nálezy RaPP z 11. 10. 2026).

Návrh na doplnenie ide **tou istou cestou ako nález kontroly súladu**:
rozhodnutie Ponechať / Prijať a upraviť, zápis do konceptu (D199), nové
znenie manuálu a jeho schválenie. Nová fronta nevzniká.

## 3. Čo sa tým vedome kazí

- **Hotové odpovede vo verejnom okne pomoci** — FAQ bola kurátorom
  schválená odpoveď. Po zrušení odpovedá asistent z manuálov; kvalitu
  odpovede určuje kvalita manuálu. To je zámer: oprava ide na jedno miesto.
- **Prax, ktorá do manuálu nepatrí** (výpadky, čo helpdesk robí a čo nie),
  nemá kam ísť ako záznam FAQ. Patrí do manuálu „prehľad a kam sa obrátiť"
  (ISSF-00) alebo do nastavenia kanála.
- Staré odkazy s `?category=norma` po migrácii nič nenájdu.

## 4. Postup

1. **Typizácia** (tento krok): úloha a poradie pri druhu, nové druhy,
   kontrola súladu podľa úlohy, voľba úlohy pri vlastnom druhu, migrácia.
2. **Hierarchia dokumentov** (D219) s predvyplnením kontroly súladu.
3. **Analýza helpdesku → návrhy do manuálov** (D221); 54 otvorených
   návrhov FAQ sa preklopí na návrhy doplnenia manuálov.
4. **Zrušenie FAQ** (D220) v kóde a zmazanie dát FAQ.
