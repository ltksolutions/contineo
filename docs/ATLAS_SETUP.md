# Založenie MongoDB Atlas — cluster a indexy

> **Stav:** návod na prvé nasadenie (2026-07-26)
> **Súvisiace:** `docs/ADR-001-provider-adaptery.md`, `docs/DATA_MODEL_konzistencia.md`, `docs/rag-architecture.md`
> **Skripty:** `app/scripts/atlas_init.mjs` (založí) · `app/scripts/atlas_check.mjs` (overí)

Cieľ: rozbehnúť cloudový režim (T1) tak, aby fungoval hybridný dotaz `$rankFusion` nad `document_chunks`.

---

## 1. Cluster

V [cloud.mongodb.com](https://cloud.mongodb.com) založ projekt a cluster:

| Voľba | Hodnota | Prečo |
|---|---|---|
| Poskytovateľ | AWS | najširšia ponuka EU regiónov |
| Región | **Frankfurt (eu-central-1)** | dáta v EÚ, viď GDPR |
| Tier | **M0 (Free)** na začiatok | Automated Embedding je na M0 podporované |
| Verzia | najnovšia dostupná | `$rerank` vyžaduje 8.3+ |

**M0 stačí na PoC.** Má 512 MB, čo pri niekoľkých normách bohato vystačí. Na produkciu bude treba M10+, ale to až keď bude čo prevádzkovať.

> **✅ Vybavené 2026-08-28: cluster beží na M10 (AWS Frankfurt) s Cloud Backup.**
>
> **Doplnené 2026-08-27 (D31):** „keď bude čo prevádzkovať" nastalo. Fáza 8 (onboarding) zavádza
> kolekciu `acknowledgements` — auditný záznam o tom, kto potvrdil oboznámenie s ktorým znením
> smernice. **Auditný záznam bez zálohy nie je auditný záznam**, a M0 zálohy nemá. Prechod na
> **M10+ je preto podmienka pred prvým ostrým potvrdením** (nie pred vývojom). Zároveň tým vzniká
> možnosť privátneho endpointu, ktorá je len na dedikovaných clusteroch. Viď
> `docs/ADR-003-onboarding-a-potvrdzovanie.md` kap. 6.2.

> ⚠️ **Ak pôjdeš rovno na M10+**, musíš zapnúť **auto-scaling úložiska aj tieru** — Automated Embedding to vyžaduje na prvotné vybudovanie indexu. Pri M10/M20 nastav strop aspoň na M30.

Ďalej:

1. **Database Access** → vytvor používateľa s rolou `readWrite` na databáze `contineo`
2. **Network Access** → pridaj svoju IP (alebo `0.0.0.0/0` len dočasne na vývoj)
3. Skopíruj connection string (`mongodb+srv://…`)

---

## 2. Voyage API kľúč

Automated Embedding potrebuje kľúč na volanie Voyage. Odporúčaný postup je vytvoriť ho **priamo v Atlase** — v ľavom menu **SERVICES → AI Models**. Potom ho spravuješ na jednom mieste a vidíš spotrebu.

MongoDB odporúča **dva samostatné kľúče** — jeden na indexovanie, druhý na dotazy — aby dotazy nespomaľovali budovanie indexu. Na PoC stačí jeden.

---

## 3. Kolekcie a indexy — jedným príkazom

> ⚠️ **Atlas nedovolí vytvoriť search index nad neexistujúcou kolekciou.** Preto najprv kolekcie, až potom indexy. Ak v UI vidíš „Add my own data" namiesto „Create Search Index", je to presne toto.

Namiesto klikania v UI použi skript — definícia indexu tak žije v repozitári a dá sa zopakovať:

```bash
cd app
node --env-file=.env.local scripts/atlas_init.mjs --pockaj
```

`--env-file` je dôležité — skripty samy `.env.local` nenačítajú, Node ho musí dostať výslovne. Bez toho spadnú na chýbajúcom `MONGODB_URI`.

Vytvorí kolekcie `documents`, `document_chunks`, `tenant_profiles` a oba indexy, a s `--pockaj` počká, kým sa dostavajú. Prepísať existujúce indexy: `--znovu`.

Nižšie sú definície, ktoré skript používa — na nahliadnutie alebo na ručné vloženie cez **Atlas Search → Create Search Index → JSON Editor**, ak by si to chcel robiť v UI.

### Vektorový index — `rag_vector_index`

Kolekcia `document_chunks`, typ **Vector Search**:

```json
{
  "fields": [
    {
      "type": "autoEmbed",
      "modality": "text",
      "path": "text",
      "model": "voyage-4"
    },
    { "type": "filter", "path": "companyCode" },
    { "type": "filter", "path": "sectionKey" },
    { "type": "filter", "path": "accessLevel" },
    { "type": "filter", "path": "scope" },
    { "type": "filter", "path": "isActive" },
    { "type": "filter", "path": "language" }
  ]
}
```

**Dôležité — `path` ukazuje na `text`, nie na `embedding`.** Pri Automated Embedding indexuješ **textové pole**; vektory si Atlas generuje a ukladá sám do oddelenej internej kolekcie. Aplikácia žiadne pole `embedding` nezapisuje.

To je zásadný rozdiel oproti on-prem režimu, kde vektory počíta TEI/Infinity a aplikácia ich zapisuje do poľa `embedding`. Preto je cesta k vektoru **súčasťou profilu tenanta** (`providers.embedding.vectorPath`).

Filtre musia obsahovať **každé pole, podľa ktorého sa filtruje pri dotaze** — inak Atlas dotaz odmietne.

---

### Fulltextový index — `rag_text_index`

Typ **Search** (nie Vector Search):

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text":       { "type": "string", "analyzer": "lucene.standard" },
      "heading":    { "type": "string", "analyzer": "lucene.standard" },
      "articleRef": { "type": "string", "analyzer": "lucene.keyword" },
      "companyCode":{ "type": "token" },
      "sectionKey": { "type": "token" },
      "accessLevel":{ "type": "token" },
      "scope":      { "type": "token" },
      "language":   { "type": "token" },
      "isActive":   { "type": "boolean" }
    }
  }
}
```

`token` (nie `string`) pre filtrovacie polia je zámerné — porovnáva sa presná hodnota z číselníka, nie analyzovaný text.

> **Poznámka k slovenčine:** `lucene.standard` nerobí stemming. Pre lepšie výsledky pri skloňovaní zváž neskôr vlastný analyzátor. Na PoC to nerieš — hybridné vyhľadávanie to z veľkej časti dorovná vektorovou vetvou.

---

## 4. Rerank — `$rerank` (overené proti serveru 2026-07-26)

`$rerank` vyžaduje **MongoDB 8.3+** a nie je dostupný v Community edícii.

### Zapnúť projektové nastavenie

**Samotná verzia clustera nestačí.** Stage treba povoliť pre projekt:

**Project Settings → zapnúť `$rerank`**

Bez toho vráti server 403 s hláškou:

```
$rerank is not enabled for <projekt>. Enable the $rerank Project Setting to run this pipeline.
```

### Samostatný rerank index netreba

Napriek pôvodnému predpokladu **`rag_rerank_index` sa nezakladá** — `index` je v spec-e nepovinné pole.

### Tvar spec-u

Dokumentácia k tomuto stage je neúplná, takže tvar je **overený empiricky** skriptom `app/scripts/rerank_probe.mjs`, ktorý dopĺňa polia podľa toho, čo server pýta:

```js
{
  $rerank: {
    query: { text: "..." },   // objekt, NIE holý reťazec
    path: "text",
    model: "rerank-2",        // povinné
    numDocsToRerank: 20,      // povinné
  }
}
```

Názvy modelov nájdeš v **AI Model APIs → Rate Limits**. Dostupné sú `rerank-2`, `rerank-2.5`, `rerank-2-lite`, `rerank-2.5-lite` — **nie** `voyage-rerank-*`.

### Ak rerank nechceš

```bash
RERANK_KIND="none"
```

Aplikácia potom použije poradie z `$rankFusion` bez rerankingu. Funguje to, len o niečo horšie.

### Metadáta so skóre

Súvisiaca pasca: názov metadáta so skóre sa líši podľa toho, čo pipeline vyprodukovalo.

| Posledný stage | `$meta` |
|---|---|
| `$search` | `searchScore` |
| `$vectorSearch` | `vectorSearchScore` |
| `$rankFusion` | `score` |
| `$rerank` | `score` |

Zlý názov nevráti nulu — **server odmietne celú agregáciu**. Preto je v `mongoSearch.ts` `lookupDocument()` funkcia s parametrom, nie konštanta.

---

## 5. Premenné prostredia

V `app/.env.local`:

```bash
MONGODB_URI="mongodb+srv://POUZIVATEL:HESLO@CLUSTER.mongodb.net/?retryWrites=true&w=majority&appName=Contineo"
MONGODB_DB="contineo"

ANTHROPIC_API_KEY="sk-ant-..."

# Predvolený profil tenanta (viď app/src/lib/tenantProfile.ts)
EMBEDDING_MODEL="voyage-4"
EMBEDDING_DIM="1024"
VECTOR_INDEX="rag_vector_index"
RERANK_KIND="atlas-stage"     # alebo "none", ak $rerank nie je povolený
RERANK_MODEL="rerank-2"       # viď AI Model APIs -> Rate Limits
GENERATION_MODEL="claude-sonnet-5"
```

`.env.local` je v `.gitignore` — kľúče do repozitára nepatria.

> ⚠️ **Ani do dokumentácie.** Vyššie sú zámerne zástupné hodnoty (`POUZIVATEL`, `HESLO`, `CLUSTER`). Skenery tajomstiev (GitHub, GitGuardian) hlásia už samotný tvar `user:password@host` — aj keď je heslo len placeholder. Skutočné meno používateľa a hostname clustera navyše útočníkovi prezradia polovicu údajov.

> Ak heslo obsahuje `@`, `:`, `/` alebo `#`, musíš ho v URL zakódovať (`@` → `%40`). Inak sa connection string rozpadne a chyba vyzerá ako zlé prihlasovacie údaje.

---

## 6. Overenie

```bash
cd app
node --env-file=.env.local scripts/atlas_check.mjs
```

Skript overí pripojenie, existenciu kolekcií, oba indexy a ich stav. Kým nevypíše všetko zelené, nemá zmysel púšťať import.

---

## 7. Na čo si dať pozor

**Index sa buduje asynchrónne.** Po vytvorení je chvíľu v stave `PENDING` / `BUILDING`. Dotazy na nehotový index vracajú prázdne výsledky **bez chyby** — čo je zradné. Overovací skript stav kontroluje.

**Automated Embedding generuje vektory tiež asynchrónne.** Po vložení dokumentov chvíľu trvá, kým sú vyhľadateľné. Pri prvom importe to počkaj.

**Dimenzia vektora sa neurčuje v indexe.** Vyplýva z modelu. Po vytvorení indexu si over, akú dimenziu `voyage-4` v Atlase naozaj vracia, a zosúlaď ju s `EMBEDDING_DIM` v profile — nesúlad by tichým spôsobom pokazil on-prem porovnanie (viď O1 v ADR-001).

**M0 má obmedzenia.** Žiadne zálohy, obmedzená priepustnosť. Na PoC v poriadku, na produkciu nie.

---

## 8. Ceny

| Položka | Cena |
|---|---|
| Cluster M10 (AWS Frankfurt) | ~0,09 $/hod · Cloud Backup zapnutý |
| `voyage-4` embedding | 0,06 $ za 1M tokenov |
| Prvý import (100 tis. chunkov ≈ 80M tokenov) | ≈ 5 $ |

Voyage dáva na štart 200M tokenov zadarmo, takže prvý import ťa nebude stáť nič.
