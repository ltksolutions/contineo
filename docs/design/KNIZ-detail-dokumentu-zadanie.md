# Zadanie pre Claude Design — KNIZ-detail-dokumentu

> Podklad pre nový návrh **detailu dokumentu v knižnici** (`/library/[id]`).
> Pripravené 12. 10. 2026 proti `main` (0d9b904). Vzorová stránka naostro:
> `/library/sfz:issf_09_kredity_prerozdelenie_eshop`. Časť „Prompt pre
> Claude Design" sa skopíruje do projektu v Claude Design; zvyšok je kontext
> pre Jána.

## Prečo

Ján 12. 10. 2026: stránka má zlý dizajn a treba ju navrhnúť celú nanovo.
„História schvaľovania", „Určiť právny základ" a „Stiahnuť kolo" sú málo
viditeľné.

Naostro (1440 px, dokument v kroku 2 Schválenie) som zistil toto:

- **Tri úkony sú rozbaľovačky `<details>` na spodku karty postupu.** Ide
  o „Stiahnuť kolo", „Určiť právny základ" a „História schvaľovania".
  - Majú sivý text 12,5–13 px, sú vysoké 20 px (terč má mať 44 px) a sú
    pod rámčekom „Potom".
  - Karta postupu je vysoká 819 px, takže na ne treba posunúť stránku.
- **Právny základ je úloha, ale tvári sa ako poznámka.** Veta znie
  „Ján Letko ho môže určiť … upozornenie má vo zvončeku". Platí to, aj keď
  stránku číta práve Ján Letko.
- **Hlavička má tri štítky.** Prvý je „Na schválenie". Druhý,
  „prevedené, nepublikované", je technický stav spracovania a pri koncepte
  je normálny. Tretí, „manual", je surový kód druhu.
- **„Pokračovať v príprave" je v hlavičke aj počas schvaľovania.** Príprava
  je vtedy hotová, takže text nesedí.
- **Panel Metadáta ukazuje surové kódy** („manual", „public", „sk")
  namiesto názvov. „Upraviť dokument" je dvakrát: v hlavičke aj v paneli.
- **Krok 2 opakuje, čo je inde.** „Čo sa schvaľuje" (PDF, text, údaje
  o znení) a rámček „Potom" s krokmi 3 a 4 opakujú krokovník priamo nad
  nimi.
- **Ďalšie akcie sú nevyvážené.**
  - Riadok „Text" má päť riadkov o súboroch, aj e-mail toho, kto súbor
    nahral.
  - „Preindexovať všetky znenia" má štvorriadkový odsek.
  - „Opraviť text" je ďalšia rozbaľovačka. Ten istý úkon je aj v paneli
    pri platnom znení.
- **Rozbaľovačky sú aj inde.** Pri platnom znení sú história zmien, opravy
  a opravy textu (`HistoryList`). V kroku 3 je „Zmeniť zodpovednú osobu"
  a pri starších zneniach ponuka •••.

## Dnes (kód)

**Súbor** `app/src/app/library/[id]/page.tsx` (1967 riadkov). Úprava
dokumentu je ten istý súbor na `/library/[id]/edit`. Podstránky sú `/text`,
`/chunks`, `/version`, `/faq` a `/edit`.

**Poradie zhora nadol:**

1. **Hlavička (`.page-head`).** Má názov a štítky (stav, spracovanie, druh)
   a riadok s identifikátorom, priečinkom a dátumom účinnosti. Vpravo sú
   „Stiahnuť ▾" (PDF/zdroj), „Upraviť dokument" a hlavná akcia:
   - „Nové znenie" (plné);
   - „Pokračovať v príprave" (tiché, odkaz na `#flow`, kým sa znenie
     pripravuje);
   - „Upraviť záznamy" pri FAQ.
2. **Hláška archivovaného predpisu** (`.lnote`) s tichým „Obnoviť".
3. **Karta úlohy „určiť právny základ"** (`VersionBasisCard`). Vidí ju
   len zodpovedná osoba zverejneného znenia, ktorá základ ešte neurčila.
4. **Karta postupu `#flow`.** Má hlavičku a krokovník 1–4 Príprava →
   Schválenie → Zverejnenie → Pridelenie. Telo závisí od kroku:
   - **krok 1:**
     - pás zamietnutého alebo zrušeného kola;
     - kontrola PDF a zdroja;
     - názov;
     - údaje o znení;
     - schvaľovatelia;
     - zodpovedná osoba;
     - poznámka;
     - plné „Uložiť a predložiť na schválenie" / „Predložiť kolo N" a tiché
       „Len uložiť";
   - **krok 2:**
     - schvaľovatelia so stavom;
     - „Čo sa schvaľuje 🔒";
     - údaje o znení;
     - „Potom";
     - `details` Stiahnuť kolo (dôvod je povinný);
   - **krok 3:**
     - údaje;
     - poznámka o zmene;
     - zodpovedná osoba (`details` Zmeniť);
     - prenos pridelení;
     - plné „Zverejniť od {d}" / „Zverejniť a prideliť";
   - **krok 4:** prenos pridelení a plné „Prideliť vybraným";
   - **pod krokom 1–3:**
     - poznámka o právnom základe a `details` Určiť / Zmeniť;
     - `details` História schvaľovania (`ApprovalRounds`).
5. **Platné znenie** (`.cur`) a prípadne **zverejnená novela, ktorá ešte
   neplatí**.
   - Karta má zodpovednú osobu, právny základ, kto prijal a autora.
   - Riadok odkazov otvára panely cez `?open=`:
     - Zmeniť zodpovednú osobu;
     - Zmeniť právny základ;
     - Odvolať potvrdenia;
     - Opraviť text;
     - Preindexovať;
     - História.
6. **Staršie znenia.**
   - Riadky majú dátumy, označenie, poznámku o zmene, kto, základ
     a potvrdenia.
   - Pri riadku je PDF a ponuka ••• s tými istými panelmi.
   - Zobrazia sa 3 riadky, ďalšie sú za `?older=all`.
7. **Ďalšie akcie** (`.more`):
   - Text (súbory, editor, členenie);
   - `details` Opraviť text;
   - pôvod z MCP konektora;
   - Preindexovať všetky znenia;
   - Archivovať s potvrdením `?archive=1`.
8. **Bočný panel** (od 1024 px vpravo, inak dole):
   - **Potvrdenia:** percento, pásik a odkazy pre personalistu;
   - **Metadáta:** druh, značky, prístupnosť, jazyk, priečinok,
     identifikátor a „Upraviť dokument".

**Stavy, ktoré stránka musí zvládnuť:**

- prvé znenie v kroku 1, 2 alebo 3;
- platné znenie bez prípravy;
- platné znenie s novým znením v kroku 1–4;
- zamietnuté a zrušené kolo;
- novela vopred (zverejnená, ešte neplatí);
- archivovaný predpis (naplánovaný aj platný);
- FAQ (ADR-028);
- dokument z MCP konektora (ADR-029);
- zlyhané spracovanie.

## Rozhodnutia v repozitári, ktoré platia

- **ADR-006, schvaľovanie:**
  - schvaľuje sa znenie;
  - schvaľovatelia sú menovaní a schvaľujú súbežne;
  - zamietnutie má povinný dôvod;
  - schvaľovateľ rozhoduje v `/approvals`, nie tu;
  - vždy beží len jedno kolo na dokument (#372);
  - **zrušené kolo nie je zamietnutie**: kreslí sa sivé, nie červené
    (dodatok 12. 10. 2026, #373);
  - „Schválil" sa pri znení volá **„Prijal (orgán)"**.
- **ADR-011, ADR-013, ADR-016 (súbory a údaje o znení):**
  - PDF je povinné a zdroj odporúčaný;
  - údaje o znení sa zamknú počas kola a po schválení;
  - dátum účinnosti je povinný na predloženie;
  - označenie znenia sa nezadáva.
- **ADR-014 a ADR-023 (zodpovedná osoba a právny základ):**
  - zodpovedná osoba sa určuje už v príprave;
  - schvaľovatelia sa predvyplnia z posledného kola;
  - prenos pridelení je voľba pri zverejnení;
  - **právny základ určuje zodpovedná osoba.** Správca obsahu ho určí len
    ako náhradník (osoba chýba alebo odišla) alebo keď je sám tou osobou
    (`canSetLegalBasis`);
  - právny základ sa **nezamyká počas kola**, lebo nie je súčasťou
    schválenia.
- **ADR-025, archivácia:**
  - dátum môže byť v budúcnosti;
  - obnovenie je tiché;
  - pri `archiveBlocked` sa namiesto tlačidla píše dôvod;
  - archivovaný predpis smie dostať nové znenie (rozhodnutie Jána
    8. 10. 2026).
- **FAQ, ADR-028:** hlavná akcia je „Upraviť záznamy" a je dostupná vždy.
- **Tlačidlá:**
  - najviac jedno plné na obrazovke;
  - **plné tlačidlo kroku je odoslanie po náhľade a ostáva pri obsahu
    na konci karty postupu** (R2);
  - kým sa znenie pripravuje, „Nové znenie" sa nedá začať a v hlavičke je
    namiesto neho tichý odkaz na postup.
- **Úprava dokumentu je `/library/[id]/edit`** (R4). Ten pohľad sa
  v tomto návrhu **nemení**.
- **Potvrdenie nebezpečného úkonu je v adrese**, napríklad `?archive=1`.
  Panely pri znení sú `?open=` (vzor bez JavaScriptu).
- **Personalista** vidí odkazy do `/hr`. Správca obsahu do `/hr` nesmie,
  odkaz na 404 sa nekreslí.
- **Všeobecné pravidlá:**
  - stránka funguje bez JavaScriptu;
  - mobile first, zlomy 640 a 1024 px, terč aspoň 44 px;
  - svetlá aj tmavá téma;
  - Apple HIG / SwiftUI;
  - texty idú cez i18n (sk/cs/en).
- **Vzory, ktoré už sú v kóde:**
  - `.labeled-row` (LabeledContent);
  - `.lnote--info/--warn/--bad`;
  - `.task-card`;
  - `.more-row` a `.more-confirm`;
  - `.empty`;
  - krokovník `FlowSteps`;
  - `.view-switch`.

## Otázky

**Q1 — Kostra stránky.**
- **A (odporúčam):** jedna stránka a stĺpec „inšpektor".
  - **Vľavo je to, čo sa robí:** karta postupu (ak beží), znenia
    a Ďalšie akcie.
  - **Vpravo od 1024 px je súhrn, ktorý sa nemení** (SwiftUI inspector):
    - Stav (jedna veta, čo sa práve deje, a kto je na ťahu);
    - Potvrdenia;
    - Dokument (názvy z číselníkov, nie kódy);
    - Text (pôvodný súbor, PDF, zdroj, odkazy Editor a Členenie).

  Pod 1024 px ide inšpektor pod hlavný stĺpec, okrem riadku Stav, ktorý
  ostane hore. Všetko je viditeľné bez rozbaľovania.
- B: podmenu dokumentu (Prehľad · Znenia · Text · História), každá časť na
  vlastnej adrese. Stránka je kratšia, ale veci sa znova skryjú, tentoraz
  za záložky.

**Q2 — Úkony kroku namiesto rozbaľovačiek.**
- **A (odporúčam):** karta postupu má pod krokovníkom dva bloky.
  1. **„Teraz"** je telo kroku. V kroku 2 ostáva zoznam schvaľovateľov
     a „Čo sa schvaľuje" je jeden riadok („PDF · text · údaje o znení
     🔒 zamknuté"). **Rámček „Potom" sa ruší**, lebo to isté hovorí
     krokovník.
  2. **„Pred zverejnením"** je kontrolný zoznam ako `.labeled-row`
     s ikonou stavu:
     - schvaľovanie (0 z 1);
     - zodpovedná osoba;
     - právny základ;
     - dátum účinnosti.

     Riadok, ktorý treba vyriešiť, má vpravo tiché tlačidlo (44 px):
     „Určiť", „Zmeniť".
- **Päta karty** má plné tlačidlo kroku (R2), ak krok nejaké má. Vedľa sú
  tiché úkony kroku ako **tlačidlá, nie rozbaľovačky**:
  - v kroku 2 „Stiahnuť kolo";
  - v kroku 3 „Zmeniť zodpovednú osobu".
- B: nechať rozbaľovačky, len ich zväčšiť a dať nad „Potom".

**Q3 — Stiahnuť kolo.**
- **A (odporúčam):** tiché „Stiahnuť kolo…" v päte karty otvorí
  `?withdraw=1#flow` (vzor `.more-confirm` ako archivácia).
  - Potvrdenie má nadpis „Stiahnuť kolo 1?" a vetu, čo sa stane: znenie
    sa vráti do prípravy, schvaľovateľom zmizne úloha a kolo sa zapíše
    ako zrušené (sivé).
  - Má povinné pole Dôvod, `.button--danger` „Stiahnuť kolo" a „Zrušiť".
- B: formulár s dôvodom stále otvorený v päte karty.

**Q4 — Právny základ ako úloha.**
- **A (odporúčam):**
  - **Riadok v „Pred zverejnením".** Text je „Neurčený" (`tag--draft`),
    určený základ sa ukáže názvom.
  - **Kto ho určí:**
    - keď ho smie určiť ten, kto stránku číta, je vpravo „Určiť". Otvorí
      panel `?open=basis#flow` s `LegalBasisForm` priamo v karte;
    - keď nesmie, pod názvom je „Určí {meno} — dostal upozornenie".
  - **Keď ten, kto stránku číta, je sám zodpovednou osobou, nikdy sa
    nepíše jeho meno v tretej osobe.**
  - Nezamyká sa počas kola. Pri riadku je drobná poznámka „Nie je súčasť
    schválenia".
- B: samostatná `.task-card` nad kartou postupu (ako `VersionBasisCard`
  pri platnom znení).

**Q5 — História.**
- **A (odporúčam):** vždy viditeľný **časový rad** (SwiftUI `List`
  s dátumami) ako posledná časť karty postupu, keď existuje aspoň jedno
  ukončené kolo.
  - Udalosti sú:
    - predložené;
    - schválil;
    - zamietol s dôvodom v `.quote`;
    - stiahnuté s dôvodom (sivé);
    - zverejnené.
  - Ukáže sa posledných 5, ďalšie sú za „Celá história (N)" →
    `?history=all#history`.
  - Pri prvom bežiacom kole bez histórie sa časť nekreslí, lebo by
    opakovala zoznam schvaľovateľov.
  - **Rovnaký časový rad má aj platné znenie.** Nahradí tri `HistoryList`
    rozbaľovačky (zmeny zodpovednej osoby a základu, opravy údajov, opravy
    textu) v paneli `?open=history`.
- B: história ako samostatná stránka `/library/[id]/history`.

**Q6 — Hlavička.**
- **A (odporúčam):**
  - **Názov a jeden štítok stavu** (Na schválenie / Platné / Archivované…).
  - **Pod tým riadok** s druhom (názov z číselníka), priečinkom, „účinné
    od" a identifikátorom v `<code>`, drobne.
  - **Štítok spracovania** sa kreslí len pri chybe alebo počas
    spracovania, nie pri „prevedené, nepublikované".
  - **Hlavná akcia podľa kroku:**
    - nič nebeží → plné „Nové znenie";
    - krok 1 → tiché „Pokračovať v príprave";
    - krok 2 → tiché „Stav schvaľovania";
    - krok 3 → tiché „Zverejniť…" (odkaz na `#flow`, plné ostáva v karte
      podľa R2);
    - FAQ → plné „Upraviť záznamy".
  - **„Upraviť dokument" je len v hlavičke.** Z bočného panelu odchádza.
- B: hlavná akcia vždy rovnaká, „Pokračovať v príprave".

**Q7 — Znenia.**
- **A (odporúčam):** jedna sekcia „Znenia" so zoznamom
  (`List`), kde je prvé platné znenie a pod ním staršie.
  - **Platné znenie** je rozbalený riadok s `.labeled-row`: zodpovedná
    osoba, právny základ, prijal (orgán), autor, potvrdenia.
  - **Úkony platného znenia** sú tiché tlačidlá v riadku: PDF,
    Zodpovedná osoba, Právny základ, Opraviť text, História. Zriedkavé sú
    v ponuke ••• (`Menu`): Odvolať potvrdenia, Preindexovať toto znenie.
    Panely ostávajú cez `?open=`.
  - **Novela vopred** je riadok nad platným so štítkom „Platí od {d}".
  - **Staršie znenia** sú riadky ako dnes (3 + „Všetky (N)").
- B: nechať samostatné karty platného a starších znení.

**Q8 — Ďalšie akcie.**
- **A (odporúčam):** len zriedkavé úkony nad celým dokumentom ako
  `.more-row`. Každý má jednu vetu popisu a tiché tlačidlo:
  - Preindexovať všetky znenia, s jednou vetou „Text sa nemení,
    potvrdenia ostávajú.";
  - Skontrolovať zmeny v zdroji (pri MCP);
  - Archivovať (`.button--danger`, `?archive=1`).

  **Text a súbory sa presúvajú do inšpektora (Q1).** „Opraviť text"
  odtiaľto odchádza, lebo je pri platnom znení (Q7). E-mail nahrávajúceho
  sa nahradí menom.
- B: nechať riadok Text v Ďalších akciách, len ho skrátiť.

## Údaje, ktoré v modeli nie sú

**Žiadne nové.** Všetko sa odvodí z toho, čo už existuje:

- kolá schvaľovania s rozhodnutiami, dôvodmi a zrušením;
- `legalBasisChanges`, `fixes` a `textFixes` pri znení;
- `draftLegalBasis` a `draftResponsible`;
- `canSetLegalBasis`;
- číselníky pre názvy druhu, prístupnosti a jazyka;
- meno nahrávajúceho podľa e-mailu z `persons`.

**Nepridávať:**
- pripomenutie schvaľovateľom z tejto stránky;
- komentáre ku kolu;
- rozhodovanie schvaľovateľa na tejto stránke (to je `/approvals`).

## Rámy

- **1440 svetlá:**
  1. **Vzorový dokument naostro**, prvé znenie v kroku 2:
     - 0 z 1 schválilo (Agáta Galková, IT);
     - právny základ neurčený;
     - stránku číta zodpovedná osoba Ján Letko, takže riadok má „Určiť";
  2. ten istý dokument s otvoreným `?open=basis#flow`;
  3. **platný predpis s novým znením v kroku 1 po zamietnutom kole 1**:
     - pás zamietnutia s dôvodom;
     - história: predložené, Agáta Galková zamietla s dôvodom;
     - 2 staršie znenia;
     - potvrdenia 82 % (41 z 50);
  4. **platný predpis bez prípravy**: Znenia s platným a 4 staršími,
     ponuka ••• otvorená.
- **834 svetlá:** krok 3 Zverejnenie s prenosom pridelení a kontrolným
  zoznamom „Pred zverejnením" celým zeleným.
- **390 tmavá:**
  1. krok 2 vzorového dokumentu (riadok Stav hore, inšpektor dole);
  2. `?withdraw=1` s potvrdením stiahnutia kola;
  3. časový rad histórie so stiahnutým (sivým) a zamietnutým kolom;
  4. archivovaný predpis (`lnote--bad`, Obnoviť);
  5. Ďalšie akcie s `?archive=1`.

## Prompt pre Claude Design

```
Navrhni KNIZ-detail-dokumentu — nový návrh detailu dokumentu v knižnici
(/library/[id]) od základu. Serverové akcie (prepareDraft, cancelApproval,
publishVersion, carryOverAssignments, setResponsible, LegalBasisForm,
fixText, reindexDocument, resyncConnectorDocument, archive/restore) a ich
polia ostávajú; existujúce texty ostávajú, nové pomenuj. Úprava
dokumentu (/library/[id]/edit) a podstránky /text, /chunks, /version,
/faq sa nemenia.

Problém dnes (naostro, dokument v kroku 2 Schválenie):
- „Stiahnuť kolo", „Určiť právny základ" a „História schvaľovania" sú
  <details> na spodku 819 px vysokej karty postupu, pod rámčekom
  „Potom": sivé, 12,5 px, 20 px vysoké.
- Právny základ je úloha, ale tvári sa ako poznámka („Ján Letko ho môže
  určiť … upozornenie má vo zvončeku", aj keď stránku číta Ján).
- Hlavička má tri štítky vrátane technického „prevedené, nepublikované"
  a surového kódu „manual"; „Pokračovať v príprave" aj počas
  schvaľovania.
- Panel Metadáta má surové kódy (manual, public, sk); „Upraviť dokument"
  je dvakrát.
- Krok 2 opakuje krokovník („Čo sa schvaľuje" + rámček „Potom").
- Ďalšie akcie: riadok Text má 5 riadkov o súboroch aj s e-mailom,
  preindexovanie 4-riadkový odsek, „Opraviť text" je rozbaľovačka
  a zároveň panel pri platnom znení.
- Ďalšie <details>: história zmien/opráv pri znení, „Zmeniť zodpovednú
  osobu" v kroku 3.

Dnešné poradie: hlavička (Stiahnuť ▾, Upraviť dokument, hlavná akcia) →
hláška archivácie → karta úlohy právneho základu (zodpovedná osoba
zverejneného znenia) → karta postupu #flow s krokovníkom 1 Príprava →
2 Schválenie → 3 Zverejnenie → 4 Pridelenie → platné znenie (+ novela
vopred) s panelmi ?open= (zodpovedná osoba, právny základ, odvolať
potvrdenia, opraviť text, preindexovať, história) → staršie znenia
(3 + ?older=all, ponuka •••) → Ďalšie akcie → bočný panel Potvrdenia
a Metadáta.

Odporúčam (Q1–Q8 v zadaní, odporúčaná A):
Q1 Jedna stránka + inšpektor: vľavo čo sa robí (postup, znenia, Ďalšie
   akcie), vpravo od 1024 px súhrn — Stav (jedna veta, kto je na ťahu),
   Potvrdenia, Dokument (názvy z číselníkov), Text (pôvodný súbor, PDF,
   zdroj, odkazy Editor a Členenie). Pod 1024 px inšpektor dole, Stav
   ostáva hore. Nič podstatné v <details>.
Q2 Karta postupu: „Teraz" (telo kroku; v kroku 2 schvaľovatelia + jeden
   riadok „PDF · text · údaje o znení 🔒 zamknuté"; rámček „Potom" sa
   ruší) a „Pred zverejnením" — kontrolný zoznam .labeled-row s ikonou
   stavu: schvaľovanie, zodpovedná osoba, právny základ, dátum
   účinnosti; nevyriešený riadok má tiché tlačidlo 44 px (Určiť /
   Zmeniť). Päta: plné tlačidlo kroku (R2) a tiché úkony kroku ako
   tlačidlá (krok 2 „Stiahnuť kolo…", krok 3 „Zmeniť zodpovednú osobu").
Q3 „Stiahnuť kolo…" → ?withdraw=1#flow, .more-confirm: „Stiahnuť kolo 1?",
   veta, čo sa stane (návrat do prípravy, schvaľovateľom zmizne úloha,
   kolo sa zapíše ako zrušené — sivé), povinný Dôvod, .button--danger
   a Zrušiť.
Q4 Právny základ je riadok v „Pred zverejnením": Neurčený (tag--draft)
   alebo názov. Kto smie (zodpovedná osoba alebo správca ako náhradník),
   má „Určiť" → ?open=basis#flow s formulárom v karte; inak „Určí {meno}
   — dostal upozornenie". Čitateľa nikdy neoslovovať v tretej osobe.
   Poznámka „Nie je súčasť schválenia" — nezamyká sa počas kola.
Q5 História ako vždy viditeľný časový rad na konci karty postupu
   (predložené, schválil, zamietol s dôvodom v .quote, stiahnuté s
   dôvodom sivé, zverejnené), posledných 5 + „Celá história (N)" →
   ?history=all#history; pri prvom bežiacom kole bez histórie sa
   nekreslí. Rovnaký časový rad v paneli História pri znení namiesto
   troch rozbaľovačiek (zmeny zodpovednej osoby/základu, opravy údajov,
   opravy textu).
Q6 Hlavička: názov + jeden štítok stavu; pod ním drobne druh (názov),
   priečinok, účinné od, identifikátor v <code>. Štítok spracovania len
   pri chybe alebo počas spracovania. Hlavná akcia podľa kroku: nič
   nebeží → plné „Nové znenie"; krok 1 tiché „Pokračovať v príprave";
   krok 2 tiché „Stav schvaľovania"; krok 3 tiché „Zverejniť…" (odkaz,
   plné ostáva v karte); FAQ plné „Upraviť záznamy". „Upraviť dokument"
   len v hlavičke.
Q7 Sekcia „Znenia" ako List: novela vopred (štítok „Platí od {d}") →
   platné znenie rozbalené (.labeled-row: zodpovedná osoba, právny
   základ, prijal (orgán), autor, potvrdenia; tiché PDF, Zodpovedná
   osoba, Právny základ, Opraviť text, História; v ••• Odvolať
   potvrdenia, Preindexovať toto znenie) → staršie riadky (3 + Všetky).
   Panely ostávajú cez ?open=.
Q8 Ďalšie akcie len pre celý dokument, .more-row s jednou vetou a tichým
   tlačidlom: Preindexovať všetky znenia („Text sa nemení, potvrdenia
   ostávajú."), Skontrolovať zmeny v zdroji (MCP), Archivovať
   (.button--danger, ?archive=1). Text a súbory sú v inšpektore; e-mail
   nahrávajúceho nahraď menom.

Pravidlá, ktoré platia: schvaľuje sa znenie, schvaľovateľ rozhoduje v
/approvals (nie tu); vždy len jedno bežiace kolo; zrušené kolo je sivé,
zamietnuté červené; „Prijal (orgán)", nie „Schválil"; údaje o znení sa
zamknú počas kola; právny základ určuje zodpovedná osoba (správca len
ako náhradník alebo keď je sám zodpovednou osobou); kým sa znenie
pripravuje, Nové znenie sa nedá začať; archivovaný predpis smie mať
nové znenie, obnovenie je tiché, pri archiveBlocked dôvod namiesto
tlačidla; odkazy do /hr len personalistovi. Najviac jedno plné .button
na obrazovke; plné tlačidlo kroku ostáva na konci karty postupu (R2);
potvrdenia v adrese; stránka bez JavaScriptu; mobile first, zlomy 640
a 1024, terč 44 px; svetlá aj tmavá téma; Apple HIG (inspector, List,
LabeledContent, Menu, confirmationDialog). Triedy: .labeled-row, .lnote,
.task-card, .more-row, .more-confirm, .empty, FlowSteps. Nenavrhuj
pripomínanie schvaľovateľom, komentáre ku kolu ani rozhodovanie
schvaľovateľa na tejto stránke. Nové dáta nie sú potrebné.

Stavy: prvé znenie v kroku 1/2/3; platné bez prípravy; platné + nové
znenie v kroku 1–4; zamietnuté a zrušené kolo; novela vopred;
archivovaný (naplánovaný aj platný); FAQ; dokument z MCP konektora;
zlyhané spracovanie.

Rámy: 1440 svetlá — (1) „Kredity z prerozdelenia príspevkov
a futbalnet.shop", prvé znenie v kroku 2, 0 z 1 (Agáta Galková, IT),
právny základ neurčený, čitateľ Ján Letko je zodpovedná osoba; (2) to
isté s ?open=basis#flow; (3) platný predpis s novým znením v kroku 1 po
zamietnutom kole 1 (pás zamietnutia, história, 2 staršie znenia,
potvrdenia 82 % — 41 z 50); (4) platný predpis bez prípravy, Znenia
s platným a 4 staršími, ••• otvorená. 834 svetlá — krok 3 s prenosom
pridelení a celým zeleným „Pred zverejnením". 390 tmavá — krok 2
vzorového dokumentu, ?withdraw=1, časový rad so stiahnutým aj
zamietnutým kolom, archivovaný predpis, Ďalšie akcie s ?archive=1.

Výstup ako doteraz: KNIZ-detail-dokumentu.html + .md so sekciami Čo sa
mení, Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
