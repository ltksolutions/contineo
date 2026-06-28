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

> Lehoty sú **návrh** — finálne čísla potvrdí DPO/právnik podľa účelu a prípadných zákonných povinností.

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

> Po právnom posúdení sa tento dokument aktualizuje na záväznú politiku.
