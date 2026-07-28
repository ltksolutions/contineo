# D9 — Zlatá sada a meranie kvality

> **Stav:** kostra pripravená 2026-07-25, čaká na overené odpovede od legislatívca SFZ
> **Uzatvára:** rozhodnutie D9 z `docs/OPEN_DECISIONS.md` (zlatá sada 50–100 otázok + akceptačný prah ako brána pred go-live)
> **Súvisiace:** `docs/PRECEDENCIA_NORIEM.md` (R1–R4), `docs/CISELNIKY_governance.md` (`sectionKey`, `companyCode`), `docs/PRISTUPOVE_PRAVA.md` (`accessLevel`), `docs/ADR-001-provider-adaptery.md` (porovnanie adaptérov)
> **Materiály:** `eval/`

---

## 1. Načo to je

Bez zlatej sady je každé tvrdenie o kvalite dohad. Konkrétne sa bez nej **nedá rozhodnúť**:

- ktorý model použiť (Qwen3 vs. EuroLLM vs. Claude),
- či je on-prem režim dostatočne dobrý oproti cloudu (ADR-001),
- či sa oplatí kupovať hardvér,
- či sa dá povoliť konverzačný režim, alebo treba zostať pri striktnom „len z noriem".

Preto je to **prvá vec**, nie posledná. A keďže overené odpovede vie dať len doménový expert, má zo všetkých úloh najdlhší nábeh — treba ju rozbehnúť paralelne so všetkým ostatným.

---

## 2. Čo sada obsahuje

**74 otázok** (D9 žiada 50–100). Nie je to náhodný zoznam — je zostavená podľa matice pokrytia tak, aby vyskúšala každý mechanizmus, ktorý môže zlyhať.

### 2.1 Podľa typu vyhľadávania

| Typ | Počet | Čo overuje |
|---|---|---|
| `fulltext` | 10 | presné výrazy, §, kódy noriem, krátke dotazy |
| `vector` | 31 | dlhé otázky v prirodzenom jazyku, sémantika |
| `hybrid` | 33 | kombinácia — najbežnejší reálny prípad |

> `fulltext` je zámerne najmenej zastúpený, lebo je najjednoduchší. Ak sa pri vypĺňaní ukáže, že reálni používatelia píšu skôr krátke presné dotazy, treba ho posilniť.

### 2.2 Podľa pravidla precedencie (22 otázok)

Toto je najťažšia časť domény a najčastejší zdroj tichých chýb. Pravidlá sú definované v `PRECEDENCIA_NORIEM.md`.

| Pravidlo | Počet | Čo overuje |
|---|---|---|
| **R1** — lex superior | 8 | vyššia norma ruší nižšiu; rozpis nesmie odporovať poriadku |
| **R2** — lex specialis v medziach delegácie | 5 | rozpis platí tam, kde mu to poriadok zveril |
| **R3** — lex posterior / verzia | 5 | platné znenie k dátumu, historické verzie |
| **R4** — hierarchia zväzov | 4 | SFZ → regionálny → oblastný |

Pri týchto otázkach musí odpoveď uvádzať **oba predpisy** — všeobecný aj špecifický. Konvertor to kontroluje a upozorní, ak je vyplnený len jeden.

### 2.3 Pasce (15 otázok)

Zámerné otázky, na ktoré systém **nemá** odpovedať vecne. Bez nich sada meria len to, či systém vie odpovedať — nie či vie mlčať, čo je v normatívnej doméne rovnako dôležité.

| Typ pasce | Počet | Očakávané správanie |
|---|---|---|
| `out_of_domain` | 6 | musí odmietnuť — otázka je mimo korpusu |
| `ambiguous_conflict` | 4 | nesmie rozhodnúť autoritatívne, má ponúknuť eskaláciu (výklad patrí človeku) |
| `access_control` | 3 | verejný používateľ sa pýta na interný obsah — nesmie ho prezradiť |
| `historical_version` | 2 | musí citovať verziu platnú v danom čase, nie aktuálnu |

### 2.4 Podľa očakávaného správania

| Správanie | Počet |
|---|---|
| `answer` — vecná odpoveď | 61 |
| `refuse` — odmietnuť | 9 |
| `escalate` — ponúknuť ticket | 4 |

---

## 3. Metriky a akceptačné prahy

Prahy sú prevzaté z technického konceptu (`private/investor/Contineo_Tech_Deck_v2.pdf`, strana EVAL D9).

| Metrika | Ako sa meria | Prah | Kto meria |
|---|---|---|---|
| Správnosť odpovede | ľudské hodnotenie 0/1 | ≥ 90 % | **človek** |
| Presnosť citácie | správna norma + § medzi vrátenými zdrojmi | ≥ 85 % | skript |
| Retrieval hit@5 | zlatý dokument v prvých piatich | ≥ 90 % | skript |
| Halucinácie | tvrdenie bez opory v zdroji | ≤ 2 % | **človek** |
| Správne „neviem" | odmietne / eskaluje pri pasci | ≥ 95 % | skript |
| Latencia p95 (TTFT) | čas po prvý token | < 2 s | skript |
| **Únik dát** | interný obsah vo verejnej odpovedi | **0 — tvrdá brána** | skript |

**Správnosť a halucinácie sa automatizovať nedajú.** Vyžadujú porovnanie s overenou odpoveďou, čo je úsudok. Skript preto vypíše hodnotiaci CSV hárok s dvomi prázdnymi stĺpcami (`spravna_0_1`, `halucinacia_0_1`) — až po ich doplnení je vyhodnotenie úplné.

Únik dát je **tvrdá brána**: jediný výskyt znamená neúspech bez ohľadu na ostatné metriky.

---

## 4. Postup

### 4.1 Pre legislatívca

1. Otvoriť `eval/D9_zlata_sada.xlsx`, prečítať hárok **Legenda**.
2. Vypĺňať **iba žlté stĺpce** na hárku **Sada**. Sivé sú predvyplnené.
3. Znenie otázky (stĺpec B) sa smie upraviť, ak je nepresné alebo neprirodzené.
4. Stĺpec **Stav** drží rozpracovanosť — nemusí sa to stihnúť naraz.
5. Hárok **Pokrytie** ukazuje priebežné počty; prepočítava sa sám.

Odhad: **4–8 hodín**. Otázky sú návrhy — ak niektorá nedáva zmysel, označiť `vyradene` a napísať prečo.

### 4.2 Pre vývoj

```bash
cd eval

# 1. vyplnený hárok -> JSON (berie len riadky so stavom "hotovo")
python3 sheet_to_json.py

# 2. spustenie sady proti bežiacej aplikácii
python3 run_eval.py --url http://localhost:3000 --label "cloud Claude Sonnet 5"

# 3. to isté proti inej konfigurácii — porovnanie adaptérov podľa ADR-001
python3 run_eval.py --url http://localhost:3000 --label "on-prem Qwen3-8B"

# 4. skúšobný beh na prvých 5 otázkach
python3 run_eval.py --limit 5 --label skuska
```

Výstupy idú do `eval/vysledky/`:

- `<label>.json` — všetky odpovede, zdroje, časy a automatické metriky
- `<label>_hodnotenie.csv` — hárok na ľudské hodnotenie správnosti a halucinácií

Regenerovanie hárku po zmene otázok: `python3 build_sheet.py` (prepíše XLSX zo `seed/questions_seed.json`).
Testy vyhodnocovacej logiky: `python3 test_scoring.py`.

---

## 5. Ako sa sada používa pri rozhodovaní

**Pred go-live** — brána. Nesplnený prah = nespúšťa sa.

**Pri výbere modelu** (ADR-001) — každý adaptér sa meria zvlášť, rovnakou sadou. Dôležité: prompt vyladený na Claude bude na Qwen3 podávať inak, takže **portabilita volania nie je portabilita kvality**. Sada je jediné, čo tento rozdiel ukáže v číslach.

**Pri rozhodovaní cloud vs. on-prem** — sada odpovie na otázku, ktorá je zatiaľ otvorená: o koľko horšie sú citácie bez Anthropic Citations API. Ak je rozdiel veľký, je to argument pre cloud aj pri bežných dátach; ak malý, on-prem je bez výhrad použiteľný.

**Pri rozhodovaní o konverzačnom režime** — dnešný systémový prompt („odpovedáš výlučne z kontextu") drží metriku *správne „neviem" ≥ 95 %*. Chatovací asistent ju z definície poruší. Sada ukáže o koľko, a teda či sa to oplatí.

**Pred každým väčším releasom** — regresný beh. Zmena chunkovania, promptu či modelu sa musí premietnuť do čísel.

---

## 6. Otvorené body

- **E1** — Doplniť overené odpovede a § (legislatívec SFZ). *Blokuje všetko ostatné.*
  **Odložené (2026-07-27):** hárok sa legislatívcovi **neposiela, kým si systém nebude môcť vyskúšať v aplikácii**. Dôvod: 74 otázok v Exceli je bez kontextu abstraktná domáca úloha a odpovede by boli formálne. Keď najprv uvidí, ako systém odpovedá a cituje, vie posúdiť, čo je dobrá odpoveď — a hárok vyplní vecne. Predpoklad E1 je teda **funkčné testovacie rozhranie** (viď TODO, okruh „Testovacie UI"). Tým sa E1 posúva za UI, ale nemení sa jeho postavenie brány pred go-live.
- **E2** — Overiť rozloženie typov vyhľadávania oproti reálnym dotazom používateľov; `fulltext` je zatiaľ len 10 otázok.
  **Súvisiaci nález (2026-07-27):** pri stavbe testovacieho rozhrania sa ukázalo, že **fulltext posielal modelu 20 chunkov, kým hybrid a vector po reranku 5**. Štvornásobok kontextu podľa toho, čo usúdil klasifikátor — a nikde to nebolo vidieť. Skreslilo by to hit@5 (fulltext má dvadsať pokusov namiesto piatich), cenu aj latenciu. Zjednotené na `rerankLimit`. Rerank pri fulltexte zámerne nie je: slúži na presné výrazy a § , kde je poradie podľa BM25 to, čo chceme. Či mu päť výsledkov stačí, ukáže práve tých desať fulltextových otázok.
- **E3** — Doplniť `goldChunkIds` po naplnení korpusu, aby sa hit@5 meral na úrovni chunku, nie len dokumentu.
- **E4** — Rozhodnúť, či sa sada rozšíri nad 74 otázok (D9 pripúšťa až 100) po prvom regresnom behu.
- **E5** — Zvážiť druhého nezávislého hodnotiteľa pre správnosť a halucinácie; jeden človek je pri 0/1 hodnotení jediný bod zlyhania.
  **Rozhodnuté (2026-07-27): dvaja hodnotitelia s prekryvom na 32 otázkach.**

  Jeden hodnotiteľ znamená, že nemeriame správnosť, ale **zhodu s výkladom jedného človeka**. Sada je pritom brána pred go-live — keby stála na jednom názore na sporné ustanovenie, systém by bol navždy hodnotený proti nemu.

  Celú sadu dvakrát ale netreba. Dvojito sa posudzuje **32 otázok s `precedenceRule` alebo `trapType`** — tam je výklad najťažší a experti sa najskôr rozídu. Zvyšných 42 posudzuje jeden.

  **Rozdelenie podľa odbornosti.** Sada nie je celá právna:

  | Oblasť | Otázok | Komu sedí |
  |---|---|---|
  | Rozpisy a manuály | 19 | prevádzka |
  | Súťažný poriadok | 17 | právo |
  | Smernice | 11 | právo |
  | Prestupový poriadok | 10 | právo |
  | Disciplinárny poriadok | 8 | právo |
  | IT a aplikácie | 4 | prevádzka |
  | Neurčené | 5 | ktokoľvek |

  Dvadsaťtri otázok (rozpisy, manuály, IT) patrí skôr matrikárovi než právnikovi: právnik povie, ako sa to má robiť podľa predpisu, matrikár, ako sa to robí. Pri rozpisoch je práve ten rozdiel podstatný. Rozhranie oblasť zobrazuje ako štítok — je to navedenie, nie zákaz.

  **Nezávislosť drží rozhranie, nie dohoda.** Pri prekryvových otázkach sa cudzí posudok nezobrazí, kým sa hodnotiteľ nevyjadrí sám. Vidí len, že otázku už niekto posudzoval, nie jeho záver. Bez tohto by sme merali, či prvému uveril, nie či sa zhodnú.

  **Nezhoda je nález, nie chyba merania.** Otázka, na ktorej sa dvaja experti rozídu, je otázka, kde je doména neurčitá — a teda kde systém nemá odpovedať autoritatívne, ale ponúknuť eskaláciu. Sada má na to typ pasce `ambiguous_conflict`, zatiaľ len podľa nášho odhadu; nezhoda ho overí v dátach. Zoznam sporných otázok vypíše `scripts/hodnotenia_prehlad.mjs`.

  Zhoda sa počíta ako holý podiel, nie Cohenovo kappa: pri dvoch hodnotiteľoch a niekoľkých desiatkach otázok by kappa dávala presnosť, ktorú tie čísla neunesú — a zoznam sporných otázok je aj tak užitočnejší než jedno číslo.

  **Konkrétne rozdelenie (2026-07-27):**

  | Hodnotiteľ | Oblasť | Otázok | Z toho pre dvoch |
  |---|---|---|---|
  | Miroslav Richtárik | rozpisy, Súťažný poriadok | 36 | 19 |
  | Lukáš Piťek | smernice, Disciplinárny poriadok | 19 | 6 |
  | Marek Vavro | Prestupový poriadok | 10 | 1 |
  | Ján Letko | IT a aplikácie, pasce mimo domény | 9 | 1 |

  **Dvojica na precedenciu je Miroslav + Lukáš.** Osemnásť z Miroslavových devätnástich prekryvových otázok je typu „rozpis určuje niečo inak než poriadok — čo platí?". To nie sú otázky pre dvoch ľudí od rozpisov: jeden musí vedieť, čo rozpis hovorí, druhý, či to smie hovoriť.

  Pozn.: sekcia `rozpisy_manualy` neobsahuje ani jednu otázku o manuáloch — všetkých 19 je o rozpisoch súťaže. Názov sekcie je zavádzajúci; pri ďalšej revízii sady ho premenovať.

  Text pozvánky pre hodnotiteľov: `eval/POZVANKA_hodnotitelia.md`.
- **E6** — **Rozhodnúť o preprocessingu dotazu.** Prvé meranie v testovacom rozhraní (2026-07-27) dalo rozpad času pred generovaním:

  | Fáza | Trvanie (3 behy, rovnaký dotaz) |
  |---|---|
  | Klasifikácia (heuristika) | 0–1 ms |
  | **Preprocessing (LLM)** | **1 141 / 1 556 / 1 835 ms** |
  | Vyhľadávanie a rerank | 670 / 603 / 591 ms |

  Bez preprocessingu je čas pred generovaním **~620 ms**, s ním **1,8–2,4 s** — teda celý rozpočet metriky *latencia p95 (TTFT) < 2 s* padne ešte pred tým, než sa začne generovať. A to už po presunutí na Haiku: predtým bežal preprocessing na hlavnom modeli, lebo `utility` nebol v predvolenom profile vôbec nastavený.

  Poznámka k pomenovaniu: pri `atlas-stage` je `$rerank` stupňom agregačnej pipeline, takže sa počíta vo fáze vyhľadávania. Samostatná fáza „rerank" ukazuje nulu len v cloude a neznamená, že je zadarmo.

  **Ale preprocessing nie je celý problém.** Meranie z rozhrania: prvý token 5,0 s, z toho preprocessing 1,3 s a vyhľadávanie 0,6 s — **zvyšné ~3,1 s je samotné generovanie po prvý token**. Aj keby sa preprocessing zrušil úplne, TTFT zostane okolo 3,7 s.

  Z toho plynie ďalšia otvorená otázka: **je prah 2 s vôbec dosiahnuteľný?** Bol prevzatý z technického konceptu, nie odmeraný. Pri Claude cez verejné API a kontexte ôsmich chunkov sa doň nezmestíme ani pri nulovom predspracovaní. Treba buď prah prehodnotiť oproti realite (a povedať to nahlas skôr, než sa dostane do zmluvy), alebo zmeniť architektúru — menší kontext, iný model, streamovanie skôr. Rozhodnúť až podľa merania na celej sade, nie podľa jedného dotazu.

  Otázka teda znie, či prepis dotazu zlepší retrieval natoľko, aby to vyvážilo. **To sa nedá rozhodnúť inak než sadou.** Preto sa predvoľba dá prepnúť premennou `PREPROCESSING_DEFAULT=false` a obe konfigurácie treba zmerať tou istou sadou — rovnako, ako sa porovnávajú adaptéry podľa ADR-001. Do rozhodnutia zostáva zapnutý; meniť správanie kvôli dojmu by bola tá istá chyba v opačnom smere.
