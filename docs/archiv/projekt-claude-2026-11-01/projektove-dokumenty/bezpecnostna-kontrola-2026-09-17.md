# Bezpečnostná kontrola pred prvou ostrou verziou — zhrnutie (2026-09-17)

Plné znenie v repe: `docs/BEZPECNOSTNA_KONTROLA_2026-09.md` a
`docs/ADR-009-on-prem-referencna-architektura.md`.

## Výsledok

V kóde aplikácie **žiadna kritická diera**. D90 (galvanické oddelenie tenantov)
drží konzistentne, brány (`proxy.ts`, kontexty, roly) sú fail-closed, tajomstvá
v repozitári nie sú, `clientSecret` zákazníkov je šifrovaný AES-256-GCM,
rezidencia a izolácia sa vynucujú pri načítaní profilu.

## Stav nálezov k 2026-09-18 večer — **žiadny blokátor ostrej prevádzky**

1. **N1 / O12 — Atlas allowlist `0.0.0.0/0`** — ♻️ REVIDOVANÉ (`9bd0354`, rozhodol Ján): Static IPs sa pri jednom tenantovi nezapínajú (100 $/mes./projekt + Private Data Transfer, overené vo Vercel docs). Spúšťače návratu: druhý platiaci tenant, verejný widget, tender/bezpečnostný dotazník. **Prestáva blokovať prvé ostré potvrdenie.** Riziko kryjú kompenzačné kroky v TODO — ⏳ otvorené: samostatný aplikačný DB používateľ (nález pri zápise: aplikácia sa dnes pripája ako `janletko_db_user` s `atlasAdmin` + `readWriteAnyDatabase` — správcovský účet clustra; po výmene otočiť jeho heslo), Atlas alerty na neúspešné prihlásenia, rotácia hesla.
2. **N2 — závislosti** — ✅ (`5a6a747` + `6226bb8`): `xlsx` 0.20.3 z oficiálnej distribúcie SheetJS, `dompurify` 3.4.15 cez `overrides`; `npm audit` 0 zraniteľností. WYSIWYG editor overený naživo v produkcii (sanitizácia payloadov v oboch režimoch, bez uloženia). Pozn.: `npm install` ťahá SheetJS tarball z cdn.sheetjs.com.
3. **N3 — CSV formula injection** — ✅ (`5a6a747`): `toCsv()` neutralizuje `=`,`+`,`-`,`@`, tab, CR; testy v `tests/csv.test.ts`.
4. **N4 — bezpečnostné hlavičky** — ✅ (`dfebf93`): frame-ancestors 'none' + X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; overené curl-om na intranet.futbalsfz.sk vrátane HSTS (max-age 2 roky). Plná CSP s nonce = samostatný krok, nižšia priorita.
5. **N6 — únik `err.message` do streamu** — ✅ (`dfebf93`): `generateAnswer()` posiela `answer.failed` v jazyku prostredia, príčina do logu; test `tests/llmGeneratorError.test.ts`.
6. N5/N7 (rate limiting, timingSafeEqual na CRON_SECRET) — až s verejným widgetom.

Ďalšie otvorené (mimo tejto kontroly): O15/O16 (právny základ, retencia — čakajú na ľudí), O18 + zero-retention Anthropic (žiadosť na sales support odoslaná 2026-09-18).

## On-prem cesta (ADR-009)

Základná vetva = Atlas `eu-data` (beží). On-prem referenčná architektúra:
MongoDB Community ≥ 8.2 + Infinity (voyage-4-nano) / TEI (BGE-M3) + vLLM
s open-weight modelmi (Qwen3, EuroLLM, Gemma), rerank v aplikačnej vrstve,
GridFS v tej istej DB, self-hosted Next. Blokátory: O7 fáza 0 (dotaz/dokument
prompty v embeddingu — poistka dnes vetvu vedome blokuje), overenie fáz 1–5,
SMTP adaptér namiesto Ecomailu, cron mimo Vercelu, zálohy/nasadenie.
Stavia sa, keď príde konkrétny zákazník/tender.
**Pozor: ADR-009 je obsadené touto témou; ClubUp ADR dostane ADR-010.**

## Web /sk/technologia vs. repo — ✅ VYRIEŠENÉ 2026-09-18 (commit `94131a1`)

Opravy nasadené v `web/lib/dictionaries.js` (SK/CS/EN), build prešiel:

1. **D90:** hierarchia a `scope: global` preformulované — viditeľnosť je
   výhradne vlastná organizácia, „zdieľanie v hierarchii pripravujeme";
   prípadová štúdia SFZ hovorí o samostatných organizáciách s vlastným obsahom.
2. **Vertex AI odstránený**, Bedrock zostáva (jediná cesta k eu-full
   generovaniu bez vlastného GPU; adaptér v kóde existuje).
3. **„Infinity (voyage-4-nano) / TEI (BGE-M3)"** — zosúladené s O7 nálezom A.
4. **Zero-retention pri Anthropic zmiernené na „potvrdzujeme zmluvne"** —
   keď príde písomné potvrdenie od Anthropic, vrátiť silné znenie
   (SK 220 / CS 953 / EN 1687 + sekcia Bezpečnosť a „otvorený bod" rezidencie).
5. Zmienka o „eval sade D9" už na webe nebola — TODO položka bola zastaraná.
