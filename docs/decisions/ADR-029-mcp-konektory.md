# ADR-029 — MCP konektory: pripojenie organizácie s viacerými použitiami, nie zdroj do CMS

> **Stav:** prijaté · **Dátum:** 2026-10-07
> **Rozhodol:** Ján Letko (2026-10-07) — „MCP konektory by podľa mňa nemali
> ísť cez CMS, môžu do CMS zapisovať dokumenty, ale mali by byť použiteľné
> aj inak, o tom sú konektory všeobecne"; k návrhu nižšie „súhlasím so
> všetkým", k rozsahom a redukcii „súhlasím". Prvý server:
> `mcp.sportnet.online` (dokumentácia Sportnetu a ISSF), účet pilotu
> osobný (Ján).
> **Nadväzuje na:** ADR-001 (adaptéry vyberané konfiguráciou tenanta),
> ADR-026 (tajomstvá cez `secrets.ts`, spotreba AI), ADR-028 (kanály,
> rozsah kanála D161, návrh odpovede len z verejného obsahu), D27 (stav sa
> odvodzuje), D24 (dôkazné záznamy sa nemenia), `docs/TODO.md` „Rozsah
> hľadania čaká na druhý vstupný kanál" (2026-09-22).
> **Prekonáva:** `docs/INGESTION_zdroje_reconciliation.md` kap. 2.2 (MCP ako
> *adaptér zdroja do CMS*) a rozhodnutie z 2026-06-26, že import beží pod
> servisným účtom — viď D172 a § 4.
> **Implementácia:** fáza 1 (živý zdroj) PR #307, fáza 2 (import do
> knižnice) PR #311, predvolene len knižnica PR #313 — všetko v `main`
> od 2026-10-08; fáza 3 a ďalšie otvorené body v § 5 a `docs/TODO.md` E2.

---

## 1. Kontext

Blok „Zdroje" na `contineo.app/sk/technologia` sľubuje „MCP konektory
(pripravujeme)". Jediný zápis v repe (`INGESTION_zdroje_reconciliation.md`,
kap. 2.2, jún 2026) ich opisuje ako ďalší adaptér, ktorým sa obsah dostane
do knižnice — vedľa nahraného súboru a webovej adresy. Pri prvom skutočnom
serveri sa ukázalo, že to je len jedno z použití a nie to hlavné.

**Čo je `mcp.sportnet.online`.** MCP server so sémantickým vyhľadávaním nad
dokumentáciou platformy Sportnet (18 projektov: `cms`, `crm`, `sutaze`,
`vzdelavanie`, … a `issf` — analýza starého ISSF z jeho zdrojového kódu).
Nástroje `search-sportnet-documentation` (filter `project`, `category`,
`tags` na strane servera), `get-documentation-file` (celý článok v
Markdowne), `list-documentation-filters`, `whoami`. Prihlásenie OAuth 2.1
(PKCE S256, dynamická registrácia klienta, `refresh_token`), prístup viazaný
na allowlist osôb; **každý oprávnený vidí celú dokumentáciu**. Server
nemá zoznam všetkých súborov ani dátum poslednej zmeny článku. Pred každú
odpoveď vkladá blok „SESSION CONTEXT" s profilom prihlásenej osoby (meno,
e-mail, dátum narodenia) a s pokynmi pre model („oslovuj krstným menom").

**Obsah je pre vývojárov, nie pre používateľov.** Článok o heslách v ISSF
(P52) má vedľa opisu procesu aj názvy tabuliek, cesty k Java súborom a
pravidlá s okrajovými prípadmi („token na obnovu hesla nikdy nevyprší").
Čo z toho smie von, sa nedá rozhodnúť podľa miesta v dokumente.

**Čo v Contineu už je:** rozsah kanála na priečinky (D161), návrh odpovede
na ticket len z verejného obsahu (`ticketDraft.ts`), šifrované tajomstvá
na organizácii aj na kanáli (`secrets.ts`), prístupová úroveň ako filter
pred modelom, filter rozsahu hľadania odložený, kým nevznikne druhý
vstupný kanál. Chýba: akýkoľvek MCP klient, uloženie obnovovacieho tokenu,
pôvod `source.*` na dokumente.

## 2. Rozhodnutia

### D171 — Konektor je entita organizácie s viacerými použitiami

Kolekcia `connectors`. Jeden záznam = jedno pripojenie k jednému serveru,
patrí organizácii (`companyCode`). Má **pripojenie** (adresa, prihlásenie,
tokeny), **profil** (znalosť konkrétneho servera, D173) a **použitia**,
ktoré správca zapína nezávisle:

| Použitie | Čo robí | Kde |
|---|---|---|
| A — živý zdroj | pri otázke sa popri `document_chunks` zavolá aj server; výsledky idú do reranku a do citácií | `chatStream.ts`, `ticketDraft.ts` |
| B — import do knižnice | vybraný článok sa stiahne ako koncept dokumentu s pôvodom `source.*`, ďalej bežný postup (ADR-006) | `uploadDocument()` + adaptér |
| C — nástroje asistenta | model smie počas odpovede volať povolené nástroje servera | generačný adaptér (tool-use) |

Konektor **nie je podtyp zdroja do CMS**. Použitie B je jedno z použití a
stavia na tom istom klientovi ako A. Rozhodnutia z `INGESTION_zdroje_
reconciliation.md` kap. 2.2 sa prenášajú do B, nie na konektor ako celok.

### D172 — Pripojenie: MCP cez HTTP, OAuth v klientovi SDK, tajomstvá šifrované

- Protokol MCP (Streamable HTTP) cez `@modelcontextprotocol/sdk`; vlastný
  OAuth klient sa nepíše — SDK má PKCE, dynamickú registráciu aj obnovu
  tokenu. Čo SDK nevie, sa dopíše; čo vie, sa neprepisuje.
- `refreshToken`, `accessToken` a prípadný `clientSecret` sa ukladajú cez
  `secrets.ts` (AES-256-GCM, ADR-026 D157) ako `*Enc`; na obrazovku ide
  len stav a kto pripojil. Bez `OAUTH_SECRET_ENCRYPTION_KEY` sa konektory
  neponúkajú, aplikácia beží ďalej.
- Obnova tokenu je single-flight a výsledok sa ukladá späť; zlyhanie
  obnovy prepne konektor do stavu `disconnected` s dôvodom, nie do
  nekonečných pokusov.
- **Identita volania** má tri režimy a schéma ich nesie od začiatku:
  `tenant` (jeden zdieľaný token organizácie), `person` (každý si pripojí
  vlastný účet — nutné pre C, keď má nástroj odpovedať „moje členstvá"),
  `none`. Fáza 1 implementuje `tenant`.
- **Pilot beží pod osobným účtom Jána.** Je to odchýlka od rozhodnutia
  z 2026-06-26 (servisný účet) a zapisuje sa ako taká: Sportnet dnes
  ponúka len `authorization_code`, servisnú aplikáciu s
  `client_credentials` (ako má `issfconnector`) treba vyžiadať. Kým ju
  nemáme, na konektore je vidieť, čí účet ho drží (`connectedBy`), a
  odpojiť ho môže ten človek aj správca. Rozsah videného obsahu je rozsah
  toho účtu — bezpečnostné rozhodnutie, nie technický detail.

### D173 — Profil servera je jediné miesto so znalosťou servera

`lib/mcp/profiles/<nazov>.ts` vie: ktorý nástroj je „hľadaj" a ktorý „daj
celý dokument", ako sa výsledok mapuje na náš tvar zdroja (názov, text,
`externalId`, adresa, skupina), aké filtre server pozná a **čo z odpovede
vyčistiť**. Profil `sportnet-docs` zahadzuje blok „SESSION CONTEXT" —
profil osoby ani pokyny pre model sa k poskytovateľovi nedostanú. Profil
`generic` nemá mapovanie, ponúka len nástroje pre C. Všetko mimo profilu
je generické; nový server = nový profil, nie nová vrstva.

### D174 — Živý zdroj (A): výsledok je dáta, prístupová úroveň je vlastnosť konektora

- **Výsledok nástroja je obsah, nie pokyn.** Systémový prompt to hovorí
  výslovne; profil čistí známe preambuly. Sportnet je živý príklad textu
  s pokynmi vnútri odpovede.
- **`accessLevel` sa nastavuje na konektore** (`internal` predvolene), lebo
  server dáva účtu všetko a verejné od interného nerozlíši. Dôsledok bez
  výnimky v kóde: `ticketDraft` hľadá len `public`, takže interný
  konektor sa do návrhu e-mailu nedostane; verejný widget ho nevidí.
- Server vracia celé články; delia sa za behu existujúcim `chunkText()`
  a idú do reranku spolu s úsekmi z knižnice. Von idú najlepšie, nie
  všetko. *(Stav 2026-10-08: v cloude sa to zatiaľ nedeje — viď § 5.)*
- Časový limit volania; keď server nestíha alebo zlyhá, odpoveď ide bez
  neho a človek sa to dozvie. Konektor nikdy nesmie zhodiť odpoveď
  z knižnice.
- Citácia zo živého zdroja je **označená inak** než knižnica („živý zdroj,
  neoverené") — obišla kurátora a čitateľ to má vedieť. To je vedomá cena
  za čerstvosť, nie chyba.
- Živý zdroj je **druhý vstupný kanál**; s ním vzniká filter rozsahu
  hľadania („Knižnica / Sportnet"), odložený 2026-09-22 práve naň.

### D175 — Rozsah per kanál, filter na strane servera

Konektor definuje pomenované rozsahy (`scopes[]`, napr. `issf` =
`{ project: "issf" }`, `crm` = `{ project: "crm" }`). Kanál (D161) k svojim
priečinkom dostáva `connectorScopes: ["<connectorId>:<scopeKey>"]`; portál
má predvolený rozsah organizácie. Rozsah je vlastnosť použitia v kanáli,
nie konektora: jeden konektor, rôzne výseky pre rôzne kanály. Filter
posiela server pred vyhľadávaním — mimo rozsahu nič nevráti; nie je to
naše preosievanie výsledkov.

### D176 — Redukcia je zúženie pre interných, nie brána pre verejnosť

Na použití sa dá nastaviť **politika redukcie**: povolené kategórie a
vzory ciest na serveri (napr. len `business-logic`, bez `*-rules-*`),
zahodené sekcie podľa nadpisu (`Data`, `Key files`, `Side effects…`,
`Sportnet status`), vzory v texte (`T_[A-Z_]+`, `*.java:NN`, `RULE-NNN`)
a pokyn modelu („na úrovni používateľa, bez vnútorných názvov"). Všetko
deterministické a konfigurovateľné, nie natvrdo pre Sportnet.

Je to **zúženie, nie záruka**: veta s okrajovým prípadom v odseku „Ako to
funguje" prejde. Preto:

- živý zdroj je pre **interného človeka** (portál, podklady riešiteľa) —
  číta podklad a rozhoduje sám; redukcia mu šetrí čas, nechráni verejnosť;
- **čokoľvek, čo ide von** (návrh e-mailu, verejný widget), nikdy nejde
  zo živého zdroja. Len z obsahu, ktorý kurátor cez B stiahol, prepísal
  do jazyka používateľa a schválil — napr. ako záznam FAQ.

### D177 — Každé volanie konektora má stopu

Volá sa cudzí systém pod identitou organizácie (alebo osoby). Zapisuje sa:
konektor, nástroj, kto volanie vyvolal (kópia mena, D158), kanál, trvanie,
výsledok (ok / timeout / chyba) — bez znenia otázky, rovnako ako výkaz
spotreby AI (ADR-026). Záznamy sa nemenia (D24).

## 3. Poradie

1. **Fáza 1 (teraz):** `connectors` + klient + OAuth pripojenie v
   Organizácii + profil `sportnet-docs` + použitie A v internom portáli
   a ako podklad riešiteľa + rozsahy na kanáli + filter rozsahu hľadania
   + audit volaní. Nič sa nekopíruje, obsah je vždy aktuálny.
2. **Fáza 2:** použitie B — výber článkov do knižnice nad tým istým
   klientom, pôvod `source.*`, re-sync cez `contentHash` (server nedáva
   dátum zmeny ani zoznam súborov; hromadný import projektu nie je ako
   urobiť).
3. **Fáza 3:** použitie C — až keď generačný adaptér vie tool-use; Claude
   áno, vLLM/Qwen neisto; nikdy ako podmienka jadra.
4. **Neskôr:** Contineo ako MCP server (opačný smer: `search_library`,
   `get_document` pre cudzích asistentov) — rovnaká vrstva, otočená.

## 4. Dôsledky

- `docs/INGESTION_zdroje_reconciliation.md` kap. 2.2 prestáva platiť ako
  opis konektora; jej obsah (provenance, `contentHash`, servisný účet ako
  cieľ) sa uplatní vo fáze 2 ako opis použitia B.
- Konektor je **voliteľný per tenant**; jadro ho nepotrebuje, on-prem bez
  prístupu von beží bez neho (ADR-009).
- Latencia odpovede s konektorom rastie o volanie servera; preto limit
  a odpoveď bez neho, nie čakanie.
- Keď Sportnet poskytne servisnú aplikáciu, zmení sa len `auth` na
  konektore; nič v použitiach.

## 5. Dodatok (2026-10-08) — stav implementácie a dve odchýlky

**V `main`:** fáza 1 — živý zdroj, rozsahy per kanál, pilulky na `/ask`,
stopa volaní `connector_calls` (PR #307); fáza 2 — import do knižnice:
Knižnica → Nahrať → Import zo servera, koncept s Markdownom a PDF
vysádzaným u nás, `documents.source.*`, kontrola zmien cez `contentHash`
(PR #311). Overené naostro 8. 10. na `mcp.sportnet.online` v SFZ.

**Odchýlka 1 — predvolene len knižnica (PR #313).** § 3 a D174 počítali
s tým, že živý zdroj sa pri otázke volá vždy, keď je zapnutý. Po
nasadení sa pri otázke **predvolene hľadá len v knižnici**; konektor si
človek zapne pilulkou pod otázkou (voľba je v adrese, `?src=`) alebo ho
správca nastaví na *Používať predvolene pri otázke*
(`uses.retrieval.defaultOn`). Rozsah v kanáloch sa nemení — vyberá ho
správca kanála (D175). Rozhodol Ján 8. 10. 2026; rozsah hľadania je
vždy výslovný zoznam (knižnica + zapnuté konektory) a človek ho vidí
ešte pred odpoveďou.

**Odchýlka 2 — živé úseky nejdú do reranku.** D174 hovorí, že úseky zo
servera idú do reranku spolu s úsekmi z knižnice. V cloude beží rerank
ako `$rerank` stage v pipeline nad `document_chunks` a živé úseky v ňom
nie sú; `chatStream.ts` ich **pripojí za úseky z knižnice v poradí
servera**. Kým to neprekáža, ostáva to tak; náprava je aplikačný rerank
nad zlúčeným zoznamom (`docs/TODO.md` E2).

**Otvorené** (`docs/TODO.md` E2): fáza 3 — nástroje asistenta; identita
`person`; servisný účet Sportnetu namiesto osobného účtu Jána; hromadný
import a pravidelná synchronizácia; Contineo ako MCP server. Konektor
zatiaľ **nie je v kontrole režimu** (`residency.ts`, ADR-002) — v režimoch
`eu-full`, `on-prem` a `air-gap` ho nič neblokuje; § 4 („on-prem bez
prístupu von beží bez neho") dnes platí len preto, že ho tam nikto
nezapne. Verejný web to v tabuľke dátových tokov hovorí otvorene.
