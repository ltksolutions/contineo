# Ochrana údajov, audit a retencia (D10) — návrh rámca

> **Stav:** návrh na **právne posúdenie (DPO/právnik)** (2026-06-26). Uzatvára rozhodnutie D10 z `docs/OPEN_DECISIONS.md`.
> **Upozornenie:** Toto **nie je právne poradenstvo.** Je to návrh rámca pre produkt; lehoty, DPA a DPIA musí pred produkčným spustením potvrdiť právnik/DPO.
> **Súvisiace:** `docs/PRISTUPOVE_PRAVA.md` (RBAC/ABAC, identita), `docs/INGESTION_zdroje_reconciliation.md`, brand: súkromie dát.

---

## 1. Roly (GDPR)

**Rozhodnuté (2026-06-26):** **zväz = prevádzkovateľ (controller), Contineo = sprostredkovateľ (processor).**

| Subjekt | Rola | Vzťah |
|---|---|---|
| Zväz (zákazník: SFZ / regionálny / oblastný) | **prevádzkovateľ** | určuje účel a prostriedky spracovania svojho obsahu a používateľov |
| Contineo (prevádzkovateľ riešenia) | **sprostredkovateľ** | spracúva v mene zväzu → **DPA Contineo ↔ zväz** |
| sportnet.online | zdroj identity (CRM) | tok osobných údajov osôb/zväzov → potrebná zmluvná doložka pokrývajúca odovzdanie údajov zväz ↔ Sportnet ↔ Contineo |
| Sub-procesori | sprostredkovatelia Continea | viď kap. 5 |

> Keďže zákazníkov je viac (každý zväz samostatné CompanyID), DPA je šablónovaná a uzatvára sa s každým zväzom.

---

## 2. Kategórie spracúvaných údajov

| Kategória | Príklady | Osobný údaj? |
|---|---|---|
| Identita (z CRM/Sportnet) | meno, e-mail, CompanyID, profily (tréner/hráč/rozhodca/delegát/funkcionár) | áno |
| Členstvá (cache) | osoba → [{companyCode, profil}] | áno |
| Konverzácie | otázka, odpoveď, `userId`/`sessionId`, čas, model | áno (otázka môže obsahovať PII) |
| Tickety | kontakt žiadateľa, obsah, priebeh | áno |
| Audit prístupov | kto / čo / kedy videl | áno |
| Obsah (normy, rozpisy) | predpisy, smernice | nie (verejné/interné dokumenty) |
| `qa_pairs` (kurované) | schválené odpovede | spravidla nie |
| **Pridelenia** (`assignments`) | komu bolo znenie uložené, kým, prečo, dokedy, komu sa o tom ozvalo | áno |
| **Potvrdenia** (`acknowledgements`) | kto, kedy, ktoré znenie, formulka, hash, IP, odtlačok oddelenia | áno |
| **Časy čítania** (`reading_times`) | koľko sekúnd mal človek znenie otvorené | áno |
| **Otvorenia znenia** (`document_opens`) | kedy si osoba **prvýkrát** otvorila znenie, ktoré má potvrdiť | áno |
| **Kolá schvaľovania** (`approval_rounds`) | kto predložil, kto schválil alebo zamietol, kedy a prečo | áno |
| **Log pripomienok** (`reminder_log`) | komu sa v ktorý deň odoslala pripomienka | áno |
| **Upozornenia** (`notifications`) | ktorej osobe sa ukázala ktorá udalosť a kedy si ju prečítala | áno |
| **Záznamy odpovedí** (`evaluations`) | pri **každej** odpovedi: otázka človeka a odpoveď systému **doslovne**, zdroje a citácie, model, časy a cena, e-mail toho, kto sa pýtal a jeho organizácia; nepovinne „sedí/nesedí" a popis chyby od čitateľa, posudok hodnotiteľa a **e-mail hodnotiteľa** (`evaluatedBy`) | áno |
| **Evidenčné údaje osoby** (`persons`) | meno a priezvisko zvlášť, tituly, pracovná pozícia, oddelenie, **mobilný telefón**, pracovisko (mesto/obec) | áno |

> **Šesť riadkov vyššie pribudlo 2026-09-10 a päť z nich popisuje údaje, ktoré
> sa už zbierali.** Tento dokument vznikol pre RAG časť systému a onboarding
> s potvrdzovaním doňho nikdy nedopísali. Nie je to formalita: údaj, ktorý sa
> zbiera a nie je v dokumentácii, je presne to, čo pri audite robí problém.

> **`evaluations` je to isté prehliadnutie, len staršie (dopísané 2026-09-15).**
> Kolekcia vznikla s hodnotením odpovedí (D9) a od začiatku ukladá **otázku aj
> odpoveď doslovne pri každej odpovedi**, nie len pri tej, ktorú niekto posúdi.
> Riadok „Konverzácie" vyššie to popisoval všeobecne a kolekciu nepomenoval,
> takže sa dalo čítať tak, že ide o niečo iné. Nejde.

### 2.1 Interný adresár — nové sprístupnenie (D87, 2026-09-14)

**Mobilný telefón a pracovisko sú od D87 viditeľné každému prihlásenému
človeku vo vlastnej organizácii** (obrazovka `/directory`). Je to **zmena
okruhu príjemcov**, nie len nové pole: doteraz boli evidenčné údaje osoby
prístupné personalistovi (`people-admin`), teraz ich vidia kolegovia.

| Otázka | Stav |
|---|---|
| Právny základ | oprávnený záujem zamestnávateľa na vnútornej komunikácii (čl. 6 ods. 1 písm. f) — **posúdenie je na zákazníkovi**, nie na nás |
| Okruh príjemcov | prihlásené **aktívne** osoby tej istej organizácie; nie verejné, nie naprieč tenantmi (D32) |
| Povinnosť vyplniť | **žiadna** — mobil je nepovinný a kto ho nevyplní, v adresári ho nemá |
| Vyradené osoby | v adresári **nie sú** (`status: "inactive"`), hoci záznam v `persons` zostáva kvôli potvrdeniam |
| Zdroje údaja | ručný zápis, CSV import, Entra adresár (`mobilePhone`, `officeLocation`/`city`) — z adresára **len keď je pole prázdne** |

**Čo z toho vyplýva pre zákazníka (nie pre kód):**

1. Doplniť mobilný telefón a pracovisko do **záznamu o spracovateľských
   činnostiach** a do informačnej povinnosti voči zamestnancom.
2. Rozhodnúť, či sa pri mobile uplatní oprávnený záujem alebo súhlas. Ak súhlas,
   pole sa jednoducho nechá prázdne — systém ho nevyžaduje.
3. Pri rozsahu 130k+ osôb naďalej platí odporúčanie **DPIA** pred ostrou
   prevádzkou (kap. 1).

**Čo je vyriešené v kóde:** izolácia organizácie v dotaze (`lib/directory.ts`,
overené testom), vylúčenie vyradených, fotka osoby sa aj naďalej vydáva len
prihlásenému a len z jeho organizácie (`/api/photo`).
> Šiesty riadok (`document_opens`) je nový a **zapísal sa skôr, než sa začal
> zbierať** (ADR-005, D64).

**Osobitná pozornosť pri `document_opens` a `reading_times`.** Oboje hovorí
niečo o správaní konkrétneho človeka, nie o jeho povinnosti. Preto:

- zapisuje sa **len tomu, kto povinnosť má** — personalista, ktorý si znenie
  otvorí na kontrolu, sa nezapisuje;
- `document_opens` je **jeden riadok na dvojicu osoba × znenie**, nie záznam
  o každom zobrazení: nie je to sledovanie, je to fakt „server mu ten text
  odoslal";
- čas čítania **nie je dôkaz** a v rozhraní musí byť ako informatívny
  označený. Kto nechá kartu otvorenú, „číta" hodinu.

**Žiadne osobitné kategórie** (čl. 9) sa zámerne nespracúvajú. Pri rozsahu (130k+ osôb) odporúčame **DPIA** (posúdenie vplyvu) pred produkciou.

---

## 3. Minimalizácia údajov (zásady)

- `userId`/`sessionId` **pseudonymizovať**; neukladať zbytočné PII do logov konverzácií.
- Osobné údaje **nikdy** do URL/query parametrov (už platné bezpečnostné pravidlo).
- Identitu držať len v nevyhnutnom rozsahu; zdroj pravdy je Sportnet — Contineo drží minimálnu kópiu potrebnú pre prístup a maže ju pri odobratí príslušnosti.
- Obsah odpovedí filtrovaný prístupovými právami (PRISTUPOVE_PRAVA) — používateľ nikdy nedostane údaje, ktoré nesmie vidieť.

---

## 4. Retenčné lehoty (návrh s odôvodnením — na potvrdenie)

| Údaj | Návrh lehoty | Odôvodnenie |
|---|---|---|
| **Konverzácie** (logy otázok/odpovedí) | **12 mesiacov** (pseudonymizované) | dosť na ladenie kvality, eval a spätnú väzbu; po roku nízka hodnota → minimalizácia |
| **Audit prístupov** | **24 mesiacov** | bezpečnostné vyšetrovanie a preukázanie compliance si vyžaduje dlhší horizont než konverzácie |
| **Tickety** | **24 mesiacov po uzavretí** | história podpory; predĺžiť len ak existuje právny/účtovný dôvod |
| **`qa_pairs`** (kurované) | **kým platí podkladová norma** | expirujú s normou (D11); bez osobných údajov |
| **Cache členstiev** (`person_memberships`) | **len aktuálny stav** | obnova login+webhook (D7); pri zrušení príslušnosti **bezodkladne** vymazať/deaktivovať |
| **Identita** (kópia z CRM) | **počas aktívneho vzťahu** | zrkadlo zo Sportnet; pri ukončení vzťahu vymazať lokálnu kópiu |
| **Potvrdenia** (`acknowledgements`) | **otvorené — patrí k O16** | je to doklad o oboznámení so záväzným predpisom. Lehota nie je technická otázka: odvíja sa od toho, ako dlho sa taký doklad môže hodiť, a to určí právnik |
| **Pridelenia** (`assignments`) | **ako potvrdenia** | bez pridelenia sa nedá vysvetliť, prečo mal človek povinnosť; samotné potvrdenie by zostalo bez kontextu |
| **Otvorenia znenia** (`document_opens`) | **ako potvrdenia** | je to súčasť tej istej reťaze (D64). Otvorenie **bez** potvrdenia je tiež údaj — hovorí, že človek vedel a nepotvrdil |
| **Časy čítania** (`reading_times`) | **12 mesiacov** (rozhodnuté 2026-09-06) | nie je to dôkaz, je to meranie na klientovi. Preto kratšia lehota než pri zvyšku reťaze a TTL priamo v databáze |
| **Kolá schvaľovania** (`approval_rounds`) | **ako potvrdenia** | schválenie je dôvod, prečo znenie vôbec smelo ísť ľuďom |
| **Log pripomienok** (`reminder_log`) | **90 dní** (TTL) | prevádzkový záznam proti dvojitému odoslaniu, nie dôkaz. Dôkazom je `notified[]` na pridelení |
| **Upozornenia** (`notifications`) | **90 dní** (rozhodnuté 2026-09-15) | prevádzková správa o dobehnutej operácii, nie dôkaz. Je to údaj o **správaní** — čo kto kedy videl — takže lehota je krátka a zhodná s `reminder_log`: jedno pravidlo namiesto dvoch |
| **Záznamy odpovedí** (`evaluations`) | **12 mesiacov** (návrh, nie rozhodnutie) | **dnes sa nemažú — lehota nie je zavedená.** Je to najstaršia diera v tejto tabuľke: kolekcia zbiera od D9 a doteraz tu nebola. Otázka je text, ktorý napísal človek, takže môže obsahovať osobný údaj; bez nej sa ale odpoveď nedá spätne posúdiť |

| **Osoby** (`persons`) | **otvorené — patrí k O16** | doklady na ňu ukazujú cez `personId` a majú prežiť odchod. Nestačí jedno číslo: `docs/ZALOHOVANIE_A_RETENCIA.md` kap. 3 pomenúva tri cesty (nechať / anonymizovať / zmazať oboje) |
| **Fotky osôb** (`person_photos`) | **s osobou** | nemá vlastný dôvod existovať dlhšie než osoba |
| **Audit** (`audit`) | 24 mesiacov | dnes sa **nemaže** — TTL nie je zavedený |

> Lehoty sú **návrh** — finálne čísla potvrdí DPO/právnik podľa účelu a prípadných zákonných povinností.
> **Ako sa to reálne maže a čo s tým robia zálohy** je v `docs/ZALOHOVANIE_A_RETENCIA.md`.

---

## 5. Sub-procesori a rezidencia dát

| Sub-procesor | Účel | Rezidencia / režim |
|---|---|---|
| MongoDB Atlas | DB, vektory, fulltext | **EU región** |
| Hosting (Vercel) | beh aplikácie | EU región (podľa konfigurácie) |
| Voyage AI | embedding + rerank | overiť zero-retention + región |
| Anthropic Claude (fallback LLM) | generovanie pri fallbacku | **zero-retention, no-training**, EU |
| Ollama (lokálne) | primárny LLM | **self-hosted** — dáta neopúšťajú infraštruktúru |

**Voľba režimu AI (brand):** (a) plne self-hosted (Ollama) — dáta neopustia infra; (b) enterprise API so zero-retention + EU. Verejná spotrebiteľská AI sa nepoužíva; na dátach sa **netrénuje**.

---

## 6. Práva dotknutých osôb

- **Prístup, oprava, výmaz, obmedzenie, namietanie.**
- **Výmaz (right to erasure):** na žiadosť vymazať konverzácie, tickety a audit viazané na osobu cez `userId`; identitné údaje riešiť cez Sportnet (zdroj) + lokálne kópie. Pseudonymizácia umožní cielený výmaz podľa `userId`.
- **Výmaz sa nevzťahuje na doklad o oboznámení.** Potvrdenie, pridelenie a otvorenie znenia sú záznamy o splnení povinnosti voči zamestnávateľovi, nie údaje spracúvané so súhlasom — na žiadosť sa nemažú, kým trvá dôvod, pre ktorý existujú. **Túto vetu musí potvrdiť právnik (O15):** je to tvrdenie o právnom základe, nie o technike, a systém sa podľa nej bude správať pri prvej žiadosti o výmaz.
- **Čas čítania sa vymazať dá** a zmizne aj sám po roku — nie je to doklad, je to meranie.
- **Prenosnosť** podľa relevancie (obsah zväzu nie je osobný údaj dotknutého).
- Žiadosti smerované na prevádzkovateľa (zväz); Contineo ako sprostredkovateľ poskytuje súčinnosť.

---

## 7. Audit a bezpečnosť

- **Audit prístupov** „kto / čo / kedy videl" (najmä interný obsah) — na preukázanie compliance.
- **Šifrovanie** at-rest aj in-transit; **RBAC/ABAC** a **default-deny** (PRISTUPOVE_PRAVA).
- **EU rezidencia** dát (Atlas EU).
- Logy bez zbytočného PII; prístup k logom obmedzený.

---

## 8. Čo treba pred produkciou (právne TODO)

1. **DPA Contineo ↔ zväz** (šablóna pre každého zákazníka).
2. **Zmluvná doložka pre tok dát zo Sportnetu** (zväz ↔ Sportnet ↔ Contineo) — vyjasniť rolu Sportnetu.
3. **Zmluvy so sub-procesormi** + aktuálny zoznam sub-procesorov; overiť zero-retention u Voyage.
4. **DPIA** (posúdenie vplyvu) vzhľadom na rozsah (130k+ osôb).
5. **Potvrdiť retenčné lehoty** (kap. 4) a postup výmazu.
6. **Záznam o spracovateľských činnostiach** (čl. 30) pre rolu sprostredkovateľa.
7. **Potvrdiť, že doklad o oboznámení sa na žiadosť nemaže** (kap. 6) — je to tvrdenie o právnom základe a systém sa podľa neho bude správať pri prvej žiadosti o výmaz.
8. **Posúdiť „otvoril a nepotvrdil"** ako údaj. Reťaz dôkazov (ADR-005) vie ukázať, že si človek znenie otvoril a nepotvrdil ho. Je to legitímny údaj o plnení povinnosti, ale má bližšie k hodnoteniu človeka než čokoľvek, čo systém dovtedy držal — patrí do rozhovoru s DPO, nie do prvého nasadenia bez neho.

> Po právnom posúdení sa tento dokument aktualizuje na záväznú politiku.
