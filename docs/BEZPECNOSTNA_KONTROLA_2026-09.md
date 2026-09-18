# Bezpečnostná kontrola pred prvou ostrou verziou

> Stav k 2026-09-17, `main` = `6809b39` (deň po audite D90). Rozsah: kód
> aplikácie (`app/src`), závislosti, infraštruktúra a konfigurácia, súlad
> marketingového webu (`/sk/technologia`) so stavom repozitára.
> Kontrolu vykonal asistent na žiadosť Jána Letka; každý nález je overený
> priamo v kóde, nie odhadnutý.

## Zhrnutie

V kóde aplikácie sa nenašla žiadna kritická diera. Prístupový model je po
D90 konzistentný: organizácia je všade daná doménou a prihlásenou osobou,
nikdy telom požiadavky, a `companyCode` je v podmienke každého čítania aj
zápisu. Pred prvou ostrou verziou zostávajú tri veci s prioritou: dokončiť
**O12** (Atlas allowlist je dnes `0.0.0.0/0`), rozhodnúť o dvoch
**zraniteľných závislostiach** (`xlsx`, `dompurify` cez `@toast-ui/editor`)
a doplniť **ochranu CSV exportov pred formula injection**. Zvyšok sú
odporúčania na prehĺbenie obrany, nie blokátory.

## 1. Čo je spravené dobre (overené v kóde)

- **Izolácia tenantov (D90):** `requireCompanyCode()` v `tenantScope.ts` je
  povinná brána, vyhľadávanie (`mongoSearch.ts`) bez organizácie vyhodí
  výnimku; GridFS (`fileStore.ts`), fotky, logá aj hodnotenia majú
  organizáciu v podmienke dotazu, nie v kontrole nad ním (D32).
- **Brána pred rozhraním (`proxy.ts`):** poradie doména → preklad → verejné
  cesty → prihlásenie; neznámy hostiteľ dostane 404 bez ďalších informácií;
  zoznam chránených ciest je „všetko okrem…", takže nová stránka je chránená
  automaticky. Náhľady `*.vercel.app` vracajú 404 (zámer).
- **Prihlasovanie:** overenie OAuth profilu (`tid` proti zoznamu, Google
  `email_verified` + `hd` na odpovedi, nie v požiadavke); prepis hostiteľa
  v odkaze len na známeho tenanta (obrana proti podvrhnutej hlavičke Host);
  núdzová brzda `ALLOWED_EMAILS` fail-safe (prázdny zoznam = nikto).
- **Tajomstvá:** žiadne v repozitári (overené grepom aj `git ls-files`);
  `.env*.local` v `.gitignore`; `clientSecret` zákazníkov šifrovaný
  AES-256-GCM s verziovaným formátom a hlasným zlyhaním.
- **Cron:** `/api/cron/overdue` fail-closed — bez `CRON_SECRET` sa beh
  odmietne; výnimka z kontroly domény je len pre `/api/cron/`.
- **XSS:** nikde `dangerouslySetInnerHTML`; formátovanie odpovedí je dátová
  transformácia (`formatText.ts`), e-maily escapujú HTML.
- **Rezidencia a izolácia (ADR-002):** `checkResidency()` aj
  `checkIsolation()` sú vynútené pri načítaní profilu — nepovolená
  kombinácia profil odmietne, presne ako tvrdí web.
- **Dôkazné záznamy:** verziu, znenie a jazyk potvrdenia určuje server
  (D24/D28); potvrdenia sa nemažú, odvolanie je `revokedAt`.
- **Vstupy:** typ nahratého súboru sa určuje z obsahu (magic bytes) a
  prípony, nie z `content-type` klienta; dĺžkové stropy na poliach
  hodnotení; strop 32 MB na súbor.

## 2. Nálezy

### N1 — Atlas allowlist `0.0.0.0/0` (vysoká priorita, známe ako O12)

Jediný skutočný blokátor ostrej prevádzky, už vedený v `docs/TODO.md`.
Prístup do clustra dnes chráni len meno/heslo a TLS. Postup zostáva podľa
O12: zapnúť Static IPs pre región `fra1` vo Verceli a zúžiť allowlist na
tieto adresy (+ adresa správcu na údržbu).

> ♻️ **Revízia 2026-09-18 (Ján Letko):** Static IPs sa pri jednom tenantovi
> nezapínajú — 100 $/mes. na projekt + metrovaný Private Data Transfer je
> neúmerný náklad. Riziko (únik prihlasovacích údajov = plný prístup
> odkiaľkoľvek) kryjú kompenzačné opatrenia v `docs/TODO.md`: samostatný
> aplikačný DB používateľ len s `readWrite` na `contineo` (kontrola pri
> zápise ukázala, že aplikácia sa pripája správcovským účtom s `atlasAdmin`),
> Atlas alerty a rotácia hesla. Spúšťače návratu: druhý platiaci tenant,
> verejný widget, tender/bezpečnostný dotazník. Revízia je pri O12
> v `OPEN_DECISIONS.md`; N1 tým prestáva byť blokátor ostrej prevádzky.

### N2 — Zraniteľné závislosti (stredná priorita)

`npm audit` (2026-09-17): 3 zraniteľnosti — 1 high, 2 moderate.

- **`xlsx` 0.18.5 (high):** prototype pollution (GHSA-4r6h-8v6p-xvw6)
  a ReDoS. V npm registri oprava nie je — SheetJS distribuuje opravené
  verzie (≥ 0.20.x) len cez vlastný register `cdn.sheetjs.com`.
  Vektor: zámerne škodlivý `.xlsx` pri nahrávaní dokumentu. Zmierňuje ho,
  že nahrávať smie len prihlásený `content-admin` vlastnej organizácie.
  Odporúčanie: prejsť na oficiálnu distribúciu SheetJS (`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`)
  alebo zvážiť `exceljs`; dovtedy je riziko prijateľné, ale vedomé.
- **`dompurify` ≤ 3.4.12 cez `@toast-ui/editor` (moderate):** reťaz XSS
  advisories. Editor používa len `content-admin` pri úprave vlastného
  obsahu; uložený tvar je Markdown a čitateľom sa renderuje bezpečnou
  cestou (`FormattedText`), takže dosah je obmedzený na samotného editora.
  Odporúčanie: vynútiť novší `dompurify` cez `overrides` v `package.json`
  a overiť, že editor funguje; sledovať, či toast-ui vydá opravu.

Ostatné balíky sú prakticky aktuálne (Next 16.3.3 → 16.3.5 patch, mongodb
6.21 — major 7.x netreba pred ostrou verziou).

### N3 — CSV exporty bez ochrany pred formula injection (stredná priorita)

`toCsv()` v `lib/csv.ts` neescapuje bunky začínajúce `=`, `+`, `-`, `@`.
Do exportov (`/hr/evidence/csv`, `/hr/overview/csv`, `/library/csv`,
`/api/acknowledgements/export`) vstupujú hodnoty, ktoré píše človek alebo
prehliadač (meno osoby, názov dokumentu, poznámka, User-Agent). Bunka
`=HYPERLINK(...)` alebo `=cmd|...` sa v Exceli personalistu vyhodnotí ako
vzorec aj v úvodzovkách. Oprava je malá: v `escape()` predradiť `'` pred
bunky začínajúce na `=`, `+`, `-`, `@`, tab. Útočníkom by musel byť
prihlásený člen vlastnej organizácie, preto stredná, nie vysoká.

### N4 — Chýbajú bezpečnostné hlavičky (stredná/nízka priorita)

Aplikácia nenastavuje `Content-Security-Policy`, `X-Frame-Options` /
`frame-ancestors`, `Referrer-Policy` ani `Permissions-Policy` (grep naprieč
`src`, `next.config.mjs`, `vercel.json`). React escapuje výstupy, takže CSP
je obrana do hĺbky, nie záplata na dieru. Odporúčanie: `headers()` v
`next.config.mjs` — minimálne `frame-ancestors 'none'`,
`Referrer-Policy: strict-origin-when-cross-origin`, a CSP aspoň v
report-only režime na začiatok. Overiť, že Vercel posiela HSTS na
zákazníckych doménach (posiela predvolene, ale patrí to do kontroly pred
spustením).

### N5 — Bez rate limitingu (nízka priorita)

Nikde v kóde nie je obmedzenie frekvencie. Dva dotknuté body: `/api/chat`
(prihlásený používateľ vie generovať náklady na LLM bez stropu) a žiadosť
o prihlasovací odkaz (povolenej adrese sa dá zaplniť schránka odkazmi).
Pre intranet so ~100 ľuďmi to nie je blokátor; pri otvorení verejného
widgetu alebo ďalších tenantov to bude treba. Poznačiť ako podmienku
verejného režimu.

### N6 — Únik textu výnimky do streamu (nízka priorita)

`generateAnswer()` v `llmGenerator.ts` posiela do udalosti `error` surové
`err.message`. `/api/chat` má vlastnú vetvu s všeobecnou hláškou, ale chyby
vzniknuté vnútri generovania (napr. z SDK poskytovateľa) odídu klientovi
doslovne a môžu niesť interné detaily (názvy modelov, URL). Zjednotiť so
správaním route: do streamu všeobecná veta, podrobnosti do logu.

### N7 — Porovnanie `CRON_SECRET` nie je konštantné v čase (informatívne)

`request.headers.get("authorization") !== 'Bearer ...'` je porovnanie
reťazcov. Timing útok cez verejný internet na Vercel funkciách je
teoretický; keď sa bude route niekedy upravovať, použiť
`crypto.timingSafeEqual`.

### N8 — Dokumentačné drobnosti (informatívne)

- `.env.local.example` je zastaraný: uvádza `OLLAMA_URL/OLLAMA_MODEL`
  a `BLOB_READ_WRITE_TOKEN` (Vercel Blob sa nepoužíva — súbory sú v GridFS),
  chýba `CRON_SECRET`, `ALLOWED_EMAILS`, `OAUTH_SECRET_ENCRYPTION_KEY`,
  `PLATFORM_TENANT`, `VERCEL_TOKEN`, `ECOMAIL_*`. Príklad je prvé, čo si
  otvorí nový správca — mal by zodpovedať skutočnosti.
- O15/O16 (právny základ, retencia) a O18 (Voyage zero-retention) zostávajú
  otvorené a čakajú na ľudí — pred prvým ostrým potvrdením ich treba
  uzavrieť aspoň rozhodnutím, s kým a dokedy.

### N9 — Prompt injection cez obsah dokumentov (informatívne, prijaté riziko)

Text úsekov ide do kontextu modelu. Obsah kurátorsky spravuje vlastná
organizácia (`content-admin`), takže vektor „škodlivý dokument riadi
odpoveď" predpokladá zlomyseľného správcu vlastného obsahu. Systémový
prompt obmedzuje odpoveď na poskytnutý kontext a citácie sa pri Anthropic
overujú Citations API. Riziko prijateľné; pri kanáloch tretích strán
(web/RSS/e-mail, zatiaľ „pripravujeme") ho bude treba prehodnotiť.

## 3. Súlad webu contineo.app/sk/technologia s repozitárom

Stránka je vo veľkej väčšine presná a poctivá — on-prem vetvu označuje
„pripravujeme; adaptéry sú v kóde hotové", dnešný režim uvádza `eu-data`,
váhy 60/40, `voyage-4`/1024, `rerank-2`, Next 16 aj zoznam poskytovateľov
prihlásenia sedia s kódom. Nesúlady:

1. **`scope: global` a hierarchia centrála → jednotky vs. D90.** Sekcie
   „Značkovanie obsahu" („scope: global + centrála → platí pre celú
   firmu"), „Multi-tenant" a prípadová štúdia SFZ (hierarchia SFZ →
   regionálne → oblastné) opisujú zdieľanie obsahu naprieč jednotkami.
   Po D90 je jediný zdroj viditeľnosti zhoda `companyCode` — pole `scope`
   v dátach zostalo, ale krížovú viditeľnosť nedáva. Buď preformulovať web
   (hierarchia ako „pripravujeme"/vízia), alebo vedome rozhodnúť, že
   hierarchická viditeľnosť sa raz vráti — dnes text sľubuje viac, než kód
   robí. **Najvážnejší nesúlad z tejto kontroly.**
2. **„Claude cez AWS Bedrock / Vertex AI"** v tabuľke rezidencie: adaptér
   Bedrock v kóde je, Vertex AI nie (residency.ts to výslovne priznáva).
   Vertex buď vypustiť, alebo označiť „pripravujeme".
3. **„Infinity / TEI (voyage-4-nano, BGE-M3)"**: TEI `voyage-4-nano`
   nepodporuje (O7 nález A, ADR-001 dodatok 10). Presnejšie je
   „Infinity (voyage-4-nano) / TEI (BGE-M3)".
4. **EN verzia: „we have a zero-retention, no-training agreement with
   Anthropic"** — tvrdenie v prítomnom čase. Ak zmluvná záruka podpísaná
   nie je, preformulovať rovnako opatrne ako pri Voyage („confirming").
   Voyage časť je s O18 konzistentná.

Úpravy textov webu sa v tejto kontrole nerobili — čakajú na schválenie.

## 4. On-prem pripravenosť

Zmapovaná v `docs/ADR-009-on-prem-referencna-architektura.md` — vrátane
zoznamu, čo je hotové (adaptéry, rezidencia, `useStageRerank`), čo je
vedome zablokované (O7 fáza 0: rozlíšenie dotaz/dokument v embeddingu)
a čo on-prem vetve ešte chýba mimo AI reťaze (e-mail, cron, hosting).

## 5. Odporúčané poradie krokov

1. O12 — Static IPs `fra1` + zúžiť Atlas allowlist (blokuje ostrú prevádzku).
2. N3 — ochrana CSV (malá zmena v `csv.ts` + test).
3. N2 — rozhodnúť `xlsx` (oficiálna distribúcia SheetJS alebo exceljs)
   a `overrides` na `dompurify`.
4. N4 — bezpečnostné hlavičky v `next.config.mjs`.
5. N6 — všeobecná chybová hláška v `generateAnswer()`.
6. Web — schváliť a nasadiť úpravy z časti 3.
7. N5/N7 — pri otvorení verejného widgetu, nie skôr.
