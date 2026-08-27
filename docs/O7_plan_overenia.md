# O7 — plán overenia vlastného embeddingu a reranku

> **Stav:** ⬜ návrh, čaká na schválenie · **Dátum:** 2026-07-28
> **Súvisí:** `docs/ADR-001-provider-adaptery.md` (O1, O7), `docs/ADR-002-datova-rezidencia.md` (dodatok 14), `eval/o1/`
> **Cieľ:** overiť, že on-prem vetva **funguje** — nie ako rýchlo.

---

## 1. Načo to je

Dnes beží embedding aj rerank **u MongoDB, na infraštruktúre v USA** (`atlas-auto`
a stupeň `$rerank`). To je jediné miesto v reťazi, kde text otázky opúšťa EÚ.
On-prem vetva to má nahradiť vlastnými službami.

Kód na to už existuje — `providers/embedding/http.ts` a `providers/rerank/http.ts`,
obe s vetvou pre TEI aj Infinity. Problém je jednoduchý:

> **Metóda `.embed()` sa v celom projekte nikde nevolá.** On-prem adaptéry sú
> napísané, otestované jednotkovými testami na parsovanie odpovede — ale nikdy
> nehovorili so skutočnou službou.

Toto overenie má tú medzeru zavrieť.

---

## 2. Čo prieskum zmenil

Štyri zistenia, z ktorých dve menia plán a jedno je chyba, ktorú treba opraviť
skôr, než sa čokoľvek spustí.

### Nález A — TEI neobslúži `voyage-4-nano` 🔴

Text Embeddings Inference **tento model zatiaľ nepodporuje**. Žiadosť o podporu
je [otvorená issue #816](https://github.com/huggingface/text-embeddings-inference/issues/816)
zo 6. 2. 2026, bez priradeného človeka a bez PR, v míľniku v1.10.0.

Karta modelu síce nesie štítok `text-embeddings-inference`, ale ten je
v rozpore s issue v samotnom repozitári TEI. **Predpokladáme, že podpora nie je.**

Dôsledok: príkladový T3 profil v ADR-001 má `embedding: { kind: "tei", ... }`
s modelom `voyage-4-nano`. **Táto kombinácia dnes nie je uskutočniteľná.**

Čo funguje namiesto toho — podľa karty modelu:

| Cesta | Stav | Náš adaptér |
|---|---|---|
| sentence-transformers | ✅ oficiálne, pridal Tom Aarsen | — (knižnica, nie server) |
| vLLM | ✅ zdokumentované na karte modelu | `kind: "infinity"` (OpenAI tvar) |
| Infinity | ❓ neoverené, staví na sentence-transformers | `kind: "infinity"` |
| TEI | ❌ nepodporované | `kind: "tei"` |

Keďže vLLM aj Infinity vracajú **OpenAI tvar** (`{ data: [{ embedding, index }] }`),
naša vetva `infinity` v `http.ts` je na ne pripravená bez zmeny kódu.

**Reranker `BAAI/bge-reranker-v2-m3` je iný prípad** — je to bežná
XLM-RoBERTa architektúra a TEI ju podporuje. Vetva `tei` sa dá overiť tam.

### Nález B — chýbajúce prompty sú tichá chyba 🔴

`voyage-4-nano` používa **rozdielne prompty pre dotaz a pre dokument**:

```
dotaz:    "Represent the query for retrieving supporting documents: "
dokument: "Represent the document for retrieval: "
```

V sentence-transformers ich pridáva `encode_query()` a `encode_document()`.
Pri surovom volaní vLLM cez `/v1/embeddings` **ich nepridá nikto.**

A náš adaptér o nich nevie:

```ts
async embed(texts: string[]): Promise<number[][]>
```

Jedno pole textov, žiadne rozlíšenie dotazu od dokumentu, žiadny prompt.

Prečo je to vážne: meranie O1, ktoré uzavrelo otázku zdieľaného vektorového
priestoru, **prompty použilo správne** — na strane Voyage cez `input_type`,
na strane nano cez `encode_query`/`encode_document`. Bez nich sa vektory
posunú do inej časti priestoru a výsledok O1 **na produkčný adaptér neplatí**.

Nespadne to. Len bude horšie hľadať. To je presne ten druh chyby, ktorý
tento projekt opakovane loví až spätne.

> **Musí sa opraviť pred fázou 1.** `EmbeddingProvider.embed()` potrebuje
> vedieť, či embeduje dotaz alebo dokument — buď parameter `inputType`,
> alebo dve metódy. Pri `atlas-auto` sa nič nemení, tam prompty rieši Voyage.

### Nález C — O1 je uzavreté, ale na malých dátach

V minulej odpovedi som navrhla ako prvý krok overiť O1. **To bolo zbytočné —
O1 je uzavreté od 26. 7.**, meranie je v `eval/o1/`, výsledok v
`vysledok_o1.json`: zhoda prvého výsledku 100 %, Spearman 0,95, prekryv top-k 87 %.

Zostáva jedna vec, ktorú si ADR-001 sám ukladá: meranie bežalo na **15 dotazoch
a 40 dokumentoch** (`male_data: true`). Korpus je odvtedy naimportovaný, takže
sa dá zopakovať cez `--vzorka` na reálnych normách.

### Nález D — nano na MacBooku už bežalo

Meranie O1 spúšťalo `voyage-4-nano` **lokálne na Macu** cez sentence-transformers,
na CPU/MPS, sťahovanie ~700 MB. Otázka „vieme model rozbehať na M2" je teda už
zodpovedaná: **áno, a je to hotové.**

Čo z toho vyplýva pre rozdelenie práce: MacBook nezvláda **serving engine**
(TEI nemá arm64 image, vLLM je na macOS trápenie), nie model.

---

## 3. Rozdelenie — a prečo je menšie, než som navrhovala

Minule som navrhla dva platené HF endpointy. Po prieskume to nie je potrebné:
**Infinity sa dá nainštalovať cez `pip` a beží na macOS arm64.**

Testovali by sme teda **skutočnú Infinity**, nie napodobeninu, zadarmo a lokálne.
Platený stroj treba už len na TEI.

| Časť | Kde | Prečo |
|---|---|---|
| Embedding `voyage-4-nano` | **MacBook**, Infinity cez pip | beží na arm64, model už stiahnutý |
| Rerank `bge-reranker-v2-m3` | **MacBook**, tá istá Infinity | jeden proces obslúži oboje |
| MongoDB Atlas Local | **MacBook**, Docker | arm64 image existuje (overené) |
| Generovanie `qwen3:8b` | **MacBook**, Ollama | test bez Anthropicu |
| Aplikácia + adaptéry | **MacBook** | už tam beží |
| **TEI (len rerank)** | **HF Endpoint**, eu-west-1 | TEI nemá arm64 image |

HF Inference Endpoints: dostupné AWS regióny sú `us-east-1` a **`eu-west-1`
(Írsko)** — teda EÚ. Cena od **$0,03 za CPU jadro/hodinu**, účtuje sa po minútach,
s uspávaním pri nečinnosti. Na overenie hovoríme o jednotkách eur.

### Rozpočet pamäte (16 GB)

| Proces | Odhad |
|---|---|
| Infinity + nano (fp32) | ~1,5 GB |
| Infinity + bge-reranker-v2-m3 (fp32) | ~2,5 GB |
| Atlas Local | ~2 GB |
| Next.js dev | ~0,5 GB |
| Ollama `qwen3:8b` (Q4) | ~5,5 GB |
| **spolu** | **~12 GB** |

Tesné, ale vojde sa. Ollama sa dá spustiť až vo fáze 3, keď zvyšok stojí.

---

## 4. Fázy

### Fáza 0 — oprava promptov (pred všetkým ostatným)

Bez tohto sú všetky ďalšie merania neplatné (nález B).

1. Rozšíriť `EmbeddingProvider.embed()` o rozlíšenie dotaz/dokument.
2. Doplniť prompty do konfigurácie adaptéra — nie natvrdo do kódu, sú
   vlastnosťou modelu.
3. Jednotkový test: dotaz a dokument s rovnakým textom musia dať **rôzne** vektory.
4. Prejsť volajúcich (`mongoSearch.ts`, `import.mjs`) a odovzdať správny typ.

**Hotovo, keď:** test prejde a `atlas-auto` vetva zostane nedotknutá.

### Fáza 1 — Infinity lokálne (embedding + rerank)

1. `pip install infinity-emb[all]`
2. Spustiť s `voyage-4-nano` a `bge-reranker-v2-m3` (`--trust-remote-code`).
3. Ak Infinity model neprijme (nález A, riziko R1) → prejsť na vLLM alebo
   custom handler. **Toto je prvá vec, ktorá sa môže pokaziť.**
4. Namieriť profil tenanta: `embedding.kind = "infinity"`, `rerank.kind = "infinity"`.
5. Overiť, že `.embed()` a `.rerank()` naozaj odídu po sieti a vrátia rozumné čísla.

**Hotovo, keď:** obe HTTP volania prejdú a `parseOpenAIEmbed` / `parseInfinityRerank`
zvládnu skutočnú odpoveď, nie testovací JSON.

### Fáza 2 — Atlas Local s vlastnými vektormi

Tu sa mení najviac oproti cloudu.

1. Docker + `mongodb/mongodb-atlas-local` (arm64).
2. Overiť verziu — **`$rankFusion` vyžaduje MongoDB 8.1+.** Ak ju image nemá,
   hybridné vyhľadávanie sa musí obísť ručne a je to samostatný nález.
3. Index nad `embedding` (vektorové pole), **nie** nad textom — `vectorPath`
   sa medzi režimami mení a zámena je tichá chyba (viď komentár v `types.ts`).
4. Naimportovať korpus s vlastnými vektormi cez `import.mjs`.
5. Vyhľadávanie bez stupňa `$rerank` — rerank až v aplikačnej vrstve.

**Hotovo, keď:** rovnaká otázka vráti v cloude aj lokálne porovnateľné poradie.

### Fáza 3 — generovanie bez Anthropicu

1. Ollama + `qwen3:8b`, profil `generation.kind = "openai"`.
2. Prejsť celú reťaz od otázky po odpoveď.

**Hotovo, keď:** odpoveď dorazí a je vecne použiteľná.

### Fáza 4 — TEI na HF (len rerank)

Overí druhú vetvu `http.ts`, ktorá inak zostane nespustená.

1. HF Endpoint, `eu-west-1`, container type **TEI**, model `bge-reranker-v2-m3`.
2. Zapnúť uspávanie pri nečinnosti.
3. Prepnúť `rerank.kind = "tei"`, zopakovať otázky z fázy 2.
4. **Endpoint vypnúť.**

**Hotovo, keď:** `parseTeiRerank` zvládne skutočnú odpoveď TEI.

### Fáza 5 — zopakovať O1 na reálnom korpuse

`python3 o1_vektorovy_priestor.py --vzorka <reálne normy>` — uzavrie výhradu
`male_data` z ADR-001.

---

## 5. Čo sa tým neoverí

**Rýchlosť.** Zámerne. CPU a MacBook, čísla by boli zavádzajúce.

**Citations API — a to je vážne.** Ollama ani vLLM ho nemajú. Dnes model
nevracia holý text, ale **doslovné citácie viazané na konkrétny dokument**,
ktoré si nevymýšľa, lebo úryvky dostáva ako `document` bloky. Na tom stojí
štítok „citácie overené modelom" a s ním dôveryhodnosť celého produktu.

> **On-prem varianta túto vlastnosť stráca.** Zhodu citátu s prameňom by sme
> museli dohľadávať sami, porovnaním textu — teda slabšie a s vlastnými chybami.
>
> Patrí to do ADR-002 ako vlastnosť on-prem režimu, **nie ako detail
> implementácie**. Zákazník, ktorý si vypýta on-prem, má vedieť, čo za to platí,
> ešte pred podpisom.

---

## 6. Riziká

| ID | Riziko | Dopad | Čo s tým |
|---|---|---|---|
| R1 | Infinity neprijme `voyage-4-nano` | fáza 1 stojí | vLLM (zdokumentované na karte modelu), potom custom handler |
| R2 | Atlas Local nemá 8.1+, `$rankFusion` chýba | hybrid sa nedá porovnať | zmerať aspoň vektorovú a fulltextovú vetvu zvlášť |
| R3 | Prompty sa opravia zle | tiché zhoršenie hľadania | test z fázy 0 + zopakovať O1 (fáza 5) |
| R4 | 16 GB nestačí | pády procesov | fázy nespúšťať naraz; Ollama až nakoniec |
| R5 | `qwen3:8b` odpovedá slabo | zámena za kvalitu modelu | posudzovať reťaz, nie odpoveď; kvalita modelu je iná otázka |

---

## 7. Čo to bude stáť

| | |
|---|---|
| Fázy 0–3, 5 | zadarmo, lokálne |
| Fáza 4 (TEI na HF) | jednotky eur pri uspávaní |
| Čas | odhad 1–2 dni sústredenej práce |

---

## 8. Otvorené otázky

| ID | Otázka | Kedy sa uzavrie |
|---|---|---|
| O7-a | Zvládne Infinity `voyage-4-nano`? | fáza 1, prvý krok |
| O7-b | Má Atlas Local `$rankFusion`? | fáza 2 |
| O7-c | Ako nahradiť Citations v on-prem? | samostatné rozhodnutie, nie súčasť tohto overenia |
| O7-d | Kedy TEI podporí nano? | sledovať issue #816 |

---

## 9. Čo treba schváliť

Nič sa neinštaluje, kým nepovieš. Fáza 0 je zmena kódu bez inštalácie —
tá sa dá spraviť hneď. Fázy 1–3 vyžadujú na tvojom stroji **Docker Desktop,
Ollamu a `pip install infinity-emb`**. Fáza 4 vyžaduje účet na Hugging Face.

**Zdroje:**
[voyageai/voyage-4-nano](https://huggingface.co/voyageai/voyage-4-nano) ·
[TEI issue #816](https://github.com/huggingface/text-embeddings-inference/issues/816) ·
[HF Endpoints — vlastný kontajner](https://huggingface.co/docs/inference-endpoints/engines/custom_container) ·
[HF Endpoints — ceny](https://huggingface.co/docs/inference-endpoints/support/pricing) ·
[MongoDB — hybridné vyhľadávanie cez $rankFusion](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/)
