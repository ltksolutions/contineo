# ADR-009 — Dve prevádzkové vetvy: Atlas ako základ, on-prem ako referenčná architektúra

> Stav: **prijaté** 2026-09-17 (Ján Letko). Nadväzuje na ADR-001 (adaptéry
> poskytovateľov), ADR-002 (dátová rezidencia) a `docs/O7_plan_overenia.md`.
> Pozn. k číslovaniu: plán ClubUp ADR počítal s číslom ADR-009; keďže tento
> dokument vznikol skôr, ClubUp dostane ďalšie voľné číslo (ADR-010).

## Kontext

Contineo má jednu inštaláciu a jeden vyhľadávací základ, ale dva typy
zákazníkov: takých, ktorým stačí cloud s dátami v EÚ, a takých, ktorých
obsah nesmie opustiť vlastnú infraštruktúru (`on-prem`, `air-gap`).
ADR-001 na to zaviedlo tri vymeniteľné adaptéry (embedding, rerank,
generovanie) volené profilom tenanta; ADR-002 zaviedlo režimy rezidencie
a úrovne izolácie, ktoré `tenantProfile.ts` vynucuje pri načítaní profilu
— nepovolená kombinácia sa odmietne spustiť.

Toto ADR zapisuje, **čo je základná cesta, ako presne vyzerá on-prem
referenčná architektúra na vlastnom hardvéri s open-weight modelmi, čo z nej
je hotové, čo je vedome zablokované a čo jej ešte chýba** — aby sa pri
prvom záujemcovi o on-prem nezačínalo od nuly a aby marketingový web mal
o čo oprieť svoje tvrdenia.

## Rozhodnutie

### Základná cesta (beží dnes): MongoDB Atlas, režim `eu-data`, tier T1

| Vrstva | Riešenie | Lokalita spracovania |
|---|---|---|
| Databáza + vyhľadávanie | Atlas M10, AWS eu-central-1, `$rankFusion` | EÚ (dáta v pokoji) |
| Embedding | Atlas Automated Embedding (`voyage-4`, 1024 dim) | mimo EÚ (GCP US — subprocesor MongoDB) |
| Rerank | `$rerank` v pipeline (`rerank-2`, model per profil) | mimo EÚ (to isté) |
| Generovanie | Anthropic API (`anthropic`), pre EÚ pripravený adaptér Bedrock | mimo EÚ / EÚ podľa adaptéra |
| Aplikácia | Next.js na Verceli, funkcie `fra1` | EÚ |
| Súbory | GridFS v Atlase (žiadne externé úložisko) | EÚ |
| E-mail | Ecomail (transakčné API) | EÚ |

`eu-data` tieto lokality pripúšťa (volanie modelov von je právne kryté
DPA/SCC — otvorené O15/O16/O18). Prechod na `eu-full` v cloude by dnes
vyžadoval Bedrock v EU regióne pre generovanie **a** vlastný embedding
a rerank — teda časť on-prem vetvy nižšie.

### On-prem referenčná architektúra (vlastný HW, open-weight modely)

Cieľ: obsah ani dotazy neopustia perimeter zákazníka; režimy `on-prem`
a `air-gap`, tier T2/T3.

| Vrstva | Riešenie | Stav v kóde |
|---|---|---|
| Databáza + vyhľadávanie | MongoDB Community ≥ 8.2 (s `mongot` pre `$search`/`$vectorSearch`), ten istý `$rankFusion` dotaz | hotové v `mongoSearch.ts` (`vectorPath: "embedding"`), beh na Community zatiaľ neoverený (O7 fázy 1–5) |
| Embedding | Infinity (`voyage-4-nano`) alebo TEI (`BGE-M3`); TEI voyage-4-nano NEPODPORUJE (O7 nález A) | adaptér `HttpEmbeddingProvider` napísaný; `embed()` zámerne tvrdo zlyhá, kým sa nedorobí fáza 0 (viď Blokátory) |
| Rerank | Infinity/TEI cez `HttpRerankProvider`; `useStageRerank: false` → rerank v aplikačnej vrstve | hotové vrátane vetvy v `/api/chat` |
| Generovanie | vLLM / SGLang / Ollama cez OpenAI-kompatibilný adaptér; open-weight modely podľa výberu (Qwen3, EuroLLM, Gemma…) | adaptér hotový; citácie sa žiadajú promptom (Citations API je len anthropic/bedrock) |
| Aplikácia | ten istý Next.js build, self-hosted (Node), `proxy.ts` beží na Node runtime, teda funguje aj mimo Vercelu | build je prenositeľný; nasadzovací postup nie je napísaný |
| Súbory | GridFS v tej istej Community DB | hotové (fileStore.ts nemá cloudovú závislosť) |
| Hardvér | 1× GPU server (napr. 1–2× 24 GB VRAM pre 7–14B generatívny model + embedding/rerank modely), oddelený DB stroj alebo ten istý | referenčná zostava sa dimenzuje pri prvom nasadení |

Kontrolu, že profil neklame, robí `residency.ts`: `openai`/`infinity`/`tei`
sa počítajú ako „vlastná" lokalita len pri internej adrese
(`isSelfHostedUrl`), T3 vyžaduje `air-gap` — prísne vyzerajúci profil
s konektivitou von sa odmietne.

## Blokátory a medzery on-prem vetvy (v poradí riešenia)

1. **O7 fáza 0 (~pol dňa, len kód):** `EmbeddingProvider` nerozlišuje
   dotaz/dokument a nepozná prompty modelu (`voyage-4-nano` ich vyžaduje —
   bez nich retrieval ticho degraduje). Poistka v `http.ts` dnes vetvu
   vedome blokuje. Bez fázy 0 sa nezačína nič ďalšie.
2. **O7 fázy 1–5 (1–2 dni + stroj):** empirické overenie celej reťaze na
   Community + Infinity + vLLM (Docker, HF účet). Web dnes korektne píše
   „self-hosted zatiaľ overujeme".
3. **Re-embed korpusu:** vektory nie sú prenositeľné medzi modelmi
   (ADR-001) — prechod tenanta na on-prem znamená úplné preindexovanie.
4. **E-mail:** `ecomail.ts` je cloudová služba. On-prem potrebuje SMTP
   adaptér (rovnaký vzor ako AI adaptéry); v air-gape treba rozhodnúť, či
   prihlasovanie odkazom nahradí SSO zákazníka (Entra on-prem nebýva) alebo
   interný SMTP.
5. **Cron:** `vercel.json` cron nahradí systémový cron/K8s CronJob volajúci
   `/api/cron/overdue` s `CRON_SECRET` — kód je pripravený, postup treba
   zapísať do nasadzovacej dokumentácie.
6. **Prevádzkové okolie:** TLS/reverzná proxy, zálohy (`mongodump` namiesto
   Atlas backupov — `docs/ZALOHOVANIE_A_RETENCIA.md` treba rozšíriť),
   monitoring, aktualizácie modelov bez internetu (air-gap: modely sa nosia
   médiami).

## Kedy sa vetva staví

Podľa rozhodnutia z 2026-08-27 (O7): **keď o on-prem alebo vyhradené
prostredie požiada konkrétny zákazník alebo tender.** Do toho dňa sa
udržiava to, čo je lacné: adaptéry kompilujú, testy tvaru volaní bežia,
poistka fázy 0 bráni tichému nasadeniu nedokončenej reťaze.

## Dôsledky

- Web smie tvrdiť: jadro (`$rankFusion`) je prenositeľné, adaptéry sú
  v kóde hotové, on-prem je „pripravujeme" — nie „k dispozícii".
- Prvé on-prem nasadenie má vopred známy rozsah prác: O7 fázy 0–5 + body
  4–6 vyššie; nič z toho nevyžaduje zásah do jadra vyhľadávania.
- `eu-full` v cloude je medzistupeň zložený z tých istých dielov
  (Bedrock EU + vlastný embedding/rerank) — netreba naň samostatnú vetvu.
