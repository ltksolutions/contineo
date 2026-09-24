# C3 — Posúdenie vplyvu (DPIA): predbežné posúdenie a postup

> **Čo to je:** návrh, **kedy** a **v akom rozsahu** treba posúdenie vplyvu
> podľa čl. 35 GDPR, a osnova samotného posúdenia s tým, čo k nemu IT už vie dodať.
> **Čo to nie je:** posúdenie vplyvu samo. To vypracuje prevádzkovateľ (zväz)
> s DPO; IT dodá technický opis a opatrenia.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 24. 9. 2026
> **Súvisiace:** ADR-012 · `C1_…` · `C2_…` · `GDPR_DATA_PROTECTION.md`

---

## 1. Návrh riešenia

| Fáza | Rozsah | DPIA |
|---|---|---|
| **Pilot** | jedno oddelenie, jednotky ľudí, desiatky predpisov | **nie je podmienkou.** Pred pilotom stačí toto predbežné posúdenie so záverom podpísaným DPO |
| **Plošné nasadenie** v SFZ (zamestnanci) | stovky ľudí | **áno, pred spustením** |
| **Rozšírenie** na rozhodcov, funkcionárov a regionálne zväzy | desaťtisíce ľudí | **áno, alebo aktualizácia** DPIA z predošlej fázy |

**Prečo pilot nie:** pilot nespĺňa dve a viac kritérií zo zoznamu nižšie
v miere, ktorá zakladá vysoké riziko. Pri plošnom nasadení to už neplatí.

---

## 2. Predbežné posúdenie — kritériá (usmernenie WP248 a zoznam ÚOOÚ SR)

| # | Kritérium | Pilot | Plošné nasadenie | Prečo |
|---|---|---|---|---|
| 1 | hodnotenie alebo bodovanie osoby | nie | nie | systém nič nevyhodnocuje; čas čítania je informatívny a nevyvoláva nič |
| 2 | automatizované rozhodovanie s právnym účinkom | nie | nie | o nikom nerozhoduje systém |
| 3 | **systematické monitorovanie** | **čiastočne** | **áno** | prvé otvorenie, čas nad znením a stav „otvoril a nepotvrdil" sú údaje o správaní |
| 4 | osobitné kategórie údajov (čl. 9, 10) | nie | nie | zámerne sa nezbierajú |
| 5 | **rozsiahle spracúvanie** | nie | **áno** | pri rozhodcoch a funkcionároch desaťtisíce osôb |
| 6 | kombinovanie dátových súborov | nie | čiastočne | identita zo Sportnetu a Entra ID |
| 7 | **zraniteľné osoby — zamestnanci** vo vzťahu k zamestnávateľovi | **áno** | **áno** | nerovnováha síl; WP248 zamestnancov výslovne uvádza |
| 8 | **inovatívna technológia** | **áno** | **áno** | odpovede tvorí jazykový model (AI) |
| 9 | spracúvanie bráni uplatniť právo alebo využiť službu | nie | nie | potvrdenie nepodmieňuje nič iné |

**Pilot:** kritériá 7 a 8 platia, kritérium 3 čiastočne. Riziko zmierňuje malý
rozsah, dobrovoľné polia a to, že AI nerozhoduje o ľuďoch. **Záver návrhu: DPIA
pred pilotom nie je povinná.** Posúdenie sa zopakuje pred plošným nasadením,
kde platia kritériá 3, 5, 7 a 8.

---

## 3. Osnova DPIA pred plošným nasadením

| Časť (čl. 35 ods. 7) | Kto | Čo už existuje |
|---|---|---|
| a) systematický opis spracúvania a účelov | IT | `C2_…` kap. 2, `GDPR_DATA_PROTECTION.md` kap. 2, ADR-003, ADR-005 |
| b) nevyhnutnosť a primeranosť | DPO + IT | balančný test (A3, A11), minimalizácia v `GDPR_DATA_PROTECTION.md` kap. 3, lehoty v ADR-012 |
| c) riziká pre práva osôb | DPO | tabuľka rizík nižšie ako východisko |
| d) opatrenia | IT | `C2_…` kap. 5 |

### Východisková tabuľka rizík

| Riziko | Pravdepodobnosť / dopad | Opatrenie v systéme | Zostáva |
|---|---|---|---|
| personalista vyvodzuje dôsledky z času čítania | stredná / stredný | čas je označený ako informatívny, nie je súčasťou dokladu, maže sa po 12 mesiacoch | pravidlo pre personalistov (interný pokyn) |
| únik údajov inej organizácie | nízka / vysoký | `companyCode` v každom dotaze, testy | — |
| osobný údaj v otázke pre AI odíde mimo EÚ | stredná / stredný | zero-retention, bez trénovania; upozornenie pri poli otázky | záruky prenosu (C4) |
| nepresná odpoveď AI o povinnosti | stredná / stredný | citácie zdrojov, hodnotenie odpovedí; záväzný je predpis, nie odpoveď | — |
| doklad sa drží dlhšie, než treba | nízka / nízky | automatické mazanie po lehote, záznam o výmaze (ADR-012) | — |
| doklad chýba, keď je potrebný pri spore | nízka / stredný | doklad je nemenný; PDF a odtlačok SHA-256 (ADR-011) | lehota 3 roky je rozhodnutie DPO |
| človek o sledovaní nevie | stredná / stredný | informovanie C1, odkaz pri každom potvrdení | — |

---

## 4. Otvorené pre DPO

1. **Záver predbežného posúdenia pre pilot.** Odpoveď: „súhlasím — DPIA pred
   pilotom nie je potrebná", alebo „potrebná hneď" s dôvodom.
2. **Kto vypracuje DPIA pred plošným nasadením a dokedy.** Odpoveď: meno, termín.
