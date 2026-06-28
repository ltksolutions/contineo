# Precedencia a konflikt noriem (D5) — návrh pravidiel

> **Stav:** návrh na **potvrdenie legislatívcom SFZ** (2026-06-26). Uzatvára rozhodnutie D5 z `docs/OPEN_DECISIONS.md`.
> **Účel:** jednoznačne určiť, ktorá norma platí, keď sa pravidlá prekrývajú (napr. „Súťažný poriadok SFZ" vs „Rozpis súťaží" zväzu), aby bot odpovedal správne a citoval správny zdroj.
> **Súvisiace:** `docs/PRISTUPOVE_PRAVA.md`, `docs/CISELNIKY_governance.md` (`sectionKey`), `docs/OPEN_DECISIONS.md` (D5, D6).
> **Upozornenie:** ide o návrh logiky pre RAG, nie o právny výklad. Konkrétne § a záväznosť rozpisu treba doložiť/potvrdiť s legislatívcom SFZ.

---

## 1. Normatívna hierarchia (od najvyššej)

| Úroveň | Typ predpisu | Úloha |
|---|---|---|
| 1 | **Stanovy SFZ** | najvyšší vnútorný predpis |
| 2 | **Poriadky** (Súťažný, Registračný a prestupový, Disciplinárny, …) | vykonávajú Stanovy, záväzné celoštátne |
| 3 | **Štatúty a kódexy, Smernice** | vykonávajú poriadky v konkrétnej oblasti |
| 4 | **Rozpis súťaže** (riadiaceho zväzu, pre ročník) | najnižšia úroveň — vykonáva poriadky pre konkrétnu súťaž |

Zodpovedá `sectionKey` skupinám (`stanovy` · `poriadky` · `statuty_kodexy` · `smernice` · `rozpisy_manualy`).

**Druhá os — hierarchia zväzov** (z `companyCode.parent`): SFZ → regionálny → oblastný. Predpis nadradeného zväzu má prednosť pred predpisom podriadeného v rozsahu, kde nadradený upravuje celoštátne; podriadený upresňuje len v priestore, ktorý mu je ponechaný.

---

## 2. Pravidlá riešenia konfliktu

**R1 — Lex superior (vyššia ruší nižšiu).** Nižšia norma nesmie odporovať vyššej. Ak Rozpis súťaže odporuje Súťažnému poriadku mimo priestoru, ktorý mu poriadok zveril, v tejto časti sa **neaplikuje** (je *ultra vires*) a platí poriadok.

**R2 — Lex specialis v medziach delegácie (špecifická pred všeobecnou).** Tam, kde poriadok výslovne ponecháva úpravu na rozpis (napr. termíny, počet družstiev, vekové kategórie, hracie dni konkrétnej súťaže), platí **Rozpis** ako špecifickejší pre danú súťaž — ale len v tomto delegovanom rozsahu.

**R3 — Lex posterior (novšia pred staršou).** Pri tej istej úrovni platí novšia verzia (viazané na `effectiveFrom/To` + `isActive` — D6). Pri dotaze sa berie verzia platná k dnešku, ak sa nepýta na historickú.

**R4 — Hierarchia zväzov.** Celoštátny predpis SFZ má prednosť pred predpisom regionálneho/oblastného zväzu; nižší zväz upresňuje len v priestore, ktorý mu vyšší predpis ponecháva (kombinácia R1+R2 na osi zväzov).

---

## 3. Aplikácia v RAG (ako to bot použije)

1. **Zber kandidátov** (D2 query→filtre): pre dotaz viazaný na súťaž zostav množinu = **Poriadky SFZ (scope global)** + **Rozpis riadiaceho zväzu** danej súťaže (`companyCode` z CRM väzby súťaž→zväz).
2. **Odpoveď uvádza oba zdroje** a označí, ktorý je všeobecný (poriadok) a ktorý špecifický (rozpis), vrátane `articleRef` a verzie (D3 citačná politika).
3. **Pri rozpore:**
   - v **delegovanom** rozsahu → platí rozpis (R2), bot to takto uvedie;
   - **mimo** delegácie → platí vyššia norma (R1), bot uprednostní poriadok;
   - ak je rozpor **nejednoznačný** (nevie sa určiť, či ide o delegáciu) → bot **nerozhoduje autoritatívne**, upozorní na možný rozpor a ponúkne eskaláciu/ticket na zväz. Právny výklad patrí človeku (bezpečné správanie, súlad s D3).
4. **Verzia/ročník** (R3, D6): vždy platná verzia k dátumu; nový ročník rozpisu = nová verzia, stará archivovaná (`isActive:false`).

---

## 4. Na potvrdenie s legislatívcom SFZ

1. **Záväznosť rozpisu** — konkrétne ustanovenie Súťažného poriadku, ktoré určuje, že Rozpis súťaže je záväzný a musí byť v súlade s poriadkami (doplniť `articleRef`).
2. **Rozsah delegácie** — ktoré okruhy smie rozpis upravovať (termíny, kategórie, počty…) a ktoré sú výhradne v poriadku.
3. **Osobitné konania** — či disciplinárne/odvolacie konanie alebo iné predpisy majú vlastné prednostné pravidlá, ktoré treba zohľadniť.
4. **Hierarchia zväzov** — potvrdiť, že regionálne/oblastné predpisy sú podriadené predpisom SFZ a v akom rozsahu môžu upresňovať.

> Po potvrdení sa konkrétne § doplnia do tohto dokumentu a R1–R4 sa zafixujú ako pravidlá pre generovanie odpovede.
