# C2 — Záznam o spracovateľských činnostiach (čl. 30 GDPR)

> **Čo to je:** návrh položiek, ktoré zväz ako prevádzkovateľ doplní do svojho
> záznamu o spracovateľských činnostiach (čl. 30 ods. 1). Obsahuje aj záznam,
> ktorý vedie dodávateľ ako sprostredkovateľ (čl. 30 ods. 2).
> **Čo to nie je:** celý záznam zväzu. Pokrýva len systém Contineo.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 24. 9. 2026
> **Súvisiace:** ADR-012 · `C1_informovanie_dotknutych_osob.md` · `GDPR_DATA_PROTECTION.md`

---

## 1. Návrh riešenia

- Zväz má záznam o spracovateľských činnostiach pravdepodobne už vedený pre
  personalistiku. Contineo doň pribudne ako **tri činnosti** (kap. 2), nie ako
  nový samostatný záznam.
- **IT dodá obsah, DPO ho zapíše** do formy, ktorú zväz používa.
- Pri každej zmene toho, čo systém ukladá, sa upraví táto tabuľka **v tom istom
  PR** ako kód. Rovnaké pravidlo už platí pre `GDPR_DATA_PROTECTION.md`
  kap. 2, takže záznam nezostarne.

---

## 2. Činnosti prevádzkovateľa (zväz)

Spoločné pre všetky tri činnosti:

- **Prevádzkovateľ:** Slovenský futbalový zväz, Tomášikova 30C, 821 01 Bratislava, IČO 00 687 308
- **Zodpovedná osoba:** [meno, kontakt DPO]
- **Sprostredkovateľ:** dodávateľ systému Contineo, zmluva o spracúvaní (C4 — akceptovaná pre pilot 24. 9. 2026)
- **Prenos do tretích krajín:** viď kap. 4 — závisí od podmienok Anthropic a Voyage AI
- **Bezpečnostné opatrenia:** kap. 5

### Činnosť 1 — Oboznamovanie so záväznými predpismi

| Položka | Obsah |
|---|---|
| Účel | preukázať, že osoby, ktorých sa predpis týka, boli s ním oboznámené |
| Právny základ | čl. 6 ods. 1 písm. c) pri predpisoch, ktorých oboznámenie vyžaduje zákon (napr. BOZP, § 7 zákona č. 124/2006 Z. z.); čl. 6 ods. 1 písm. f) pri interných smerniciach — **jeden spoločný balančný test** (O15/A11); určuje sa pri každom predpise |
| Dotknuté osoby | zamestnanci, rozhodcovia, funkcionári (delegáti, členovia komisií), externí spolupracovníci |
| Kategórie údajov | identifikačné (meno, e-mail, pozícia, oddelenie, typ vzťahu); pridelenie predpisu; prvé otvorenie znenia; potvrdenie (čas, znenie, doslovný text, IP adresa, prehliadač); čas strávený nad znením; pripomienky |
| Príjemcovia | personalisti a správcovia obsahu zväzu; zodpovedné osoby za predpisy (vidia stav pri svojom predpise); DPO |
| Lehota výmazu | doklady 3 roky od skončenia pomeru alebo vzťahu, poistka od vyradenia, strop 5 rokov; čas čítania 12 mesiacov; pripomienky 90 dní (ADR-012) |

### Činnosť 2 — Schvaľovanie a správa predpisov

| Položka | Obsah |
|---|---|
| Účel | preukázať, kto znenie predpisu schválil a kto zaň zodpovedá |
| Právny základ | čl. 6 ods. 1 písm. f) — oprávnený záujem na riadnej správe vnútorných predpisov |
| Dotknuté osoby | schvaľovatelia, predkladatelia, zodpovedné osoby za predpis |
| Kategórie údajov | meno, e-mail, rozhodnutie, dôvod zamietnutia, čas; história zmien zodpovednej osoby |
| Príjemcovia | správcovia obsahu; osoby, ktoré predpis potvrdzujú (vidia zodpovednú osobu ako kontakt) |
| Lehota výmazu | kým existuje aspoň jeden doklad o oboznámení s daným znením (O16/B4a, B11) |

### Činnosť 3 — Odpovede na otázky k predpisom a interný adresár

| Položka | Obsah |
|---|---|
| Účel | odpovedať na otázky k obsahu predpisov a preveriť správnosť odpovedí; vnútorná komunikácia |
| Právny základ | čl. 6 ods. 1 písm. f) |
| Dotknuté osoby | všetci prihlásení používatelia |
| Kategórie údajov | otázka a odpoveď doslovne, pseudonymný identifikátor osoby, hodnotenie odpovede; mobil, pracovisko a fotografia, ak ich osoba vyplní |
| Príjemcovia | hodnotitelia odpovedí; kolegovia vo zväze (len adresár) |
| Lehota výmazu | otázky a odpovede 12 mesiacov (**návrh — ešte nezavedené**); adresár počas vzťahu so zväzom |

---

## 3. Záznam sprostredkovateľa (čl. 30 ods. 2)

| Položka | Obsah |
|---|---|
| Sprostredkovateľ | dodávateľ systému Contineo |
| Prevádzkovateľ | Slovenský futbalový zväz (a každý ďalší zväz podľa samostatnej zmluvy) |
| Kategórie spracúvania | uchovávanie a zobrazovanie údajov z činností 1–3; odosielanie e-mailov; tvorba odpovedí na otázky |
| Ďalší sprostredkovatelia | MongoDB Atlas (databáza, EÚ), Vercel (hosting, EÚ), Anthropic (tvorba odpovedí), Voyage AI cez MongoDB (vyhľadávanie v texte), Ecomail (e-maily, EÚ) |
| Prenos do tretích krajín | kap. 4 |
| Bezpečnostné opatrenia | kap. 5 |

---

## 4. Prenos mimo EÚ — čo treba doplniť z C4

| Sprostredkovateľ | Čo ide mimo EÚ | Stav |
|---|---|---|
| Anthropic | otázka a úseky predpisov pri tvorbe odpovede; bez uchovávania a bez trénovania | záruky (štandardné zmluvné doložky / rámec EÚ–USA) doplniť podľa zmluvy |
| Voyage AI | text predpisov a otázok pri vyhľadávaní | trénovanie vypnuté 18. 9. 2026; regionálna záruka pre automatické vektory zatiaľ nie je (O18) |

Predpis sám osobným údajom nie je. Osobný údaj môže byť v **otázke**, ktorú
človek napíše voľným textom.

---

## 5. Bezpečnostné opatrenia (čl. 32)

- oddelenie organizácií v každom dotaze (`companyCode`, D32), overené testami;
- prihlásenie jednorazovým odkazom alebo cez Microsoft Entra ID / Google; bez hesiel;
- prístup podľa rolí (personalista, správca obsahu, DPO…), zmeny rolí sa auditujú;
- šifrovanie pri prenose (TLS) a v úložisku (Atlas);
- denné zálohy v EÚ (Atlas Cloud Backup);
- audit prístupov a zmien 24 mesiacov;
- ochrana formulárov proti CSRF, obmedzenie veľkosti nahrávaných súborov;
- automatické mazanie po lehote (ADR-012) a záznam o výmaze na zopakovanie po obnove zo zálohy.

---

## 6. Otvorené pre DPO

1. **Forma zápisu.** Odpoveď: „doplním do existujúceho záznamu" alebo „treba samostatný".
2. **Kto zapíše a dokedy.** Odpoveď: meno, dátum.
