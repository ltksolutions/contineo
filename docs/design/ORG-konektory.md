# ORG — konektory podľa štandardu MCP

> **Stav: rozhodnuté 9. 10. 2026 (Ján) — Q1–Q14 podľa odporúčania A.** Nahrádza zastavený návrh v1 (`_archiv/ORG-konektory-v1-zastavene.*`).

Referencia: `ORG-konektory.html`. Základ: `ZAKLAD.md`, `ZAKLAD-podmenu-a-akcie.md`, `ZAKLAD-lista-ulozenia.md` (`.set-form`, `.set-savebar`, Ďalšie akcie), `ZAKLAD-vyber-a-prepinace.md`, `ZAKLAD-vyber-skupin-a-znaciek.md` (`.select-row`), `KANALY-prehlad.md` (riadok-odkaz, `?new=1`). Zdroj: `app/organisation/ConnectorsSection.tsx`, `organisation/actions.ts`, `organisation/[section]/page.tsx`, `lib/connectors.ts`, `lib/mcp/client.ts`, `lib/mcp/profiles/*`, `api/connectors/callback/route.ts`, ADR-029.

Je to **rozdiel oproti existujúcej obrazovke**. Akcie `saveConnectorAction`, `connectConnectorAction`, `disconnectConnectorAction`, `removeConnectorAction`, polia použití `retrievalEnabled, retrievalDefaultOn, accessLevel, ingestEnabled, scopes, dropSections, scrubPatterns, skipPaths` a existujúce texty `org.connectors.*` ostávajú. Nové texty sú pomenované nižšie.

## Čo sa mení

### 1 · Prehľad `/organisation/connectors` (Q6)
- `.page-head.page-head--section` > `h1` „Konektory" + plné `a.button` `t.add` → `?new=1`. Pri `?new=1` sa nekreslí.
- `p.page-lead` `t.introShort` „Servery iných systémov, v ktorých asistent hľadá a z ktorých knižnica preberá dokumenty." Dnešných päť viet `t.intro` sa ruší a ich obsah ide do poznámok sekcií na detaile.
- `div.card > .form-list` s `a.form-row` → `/organisation/connectors/<id>`:
  - `span.sico`: ikona zo `serverInfo.icons` stiahnutá pri pripojení a uložená ako `data:` — **len PNG, JPEG alebo WebP do 32 kB, SVG nikdy** (Q11); inak prvé písmeno `name`; pri `error` `.sico.bad`;
  - `b` `name` + `span.form-row-sub` hostiteľ · `serverInfo.version` (ak je);
  - `span.row-end`: `.tag` Živý zdroj / Import / Interná|Verejná (posledný len pri zapnutom živom zdroji), štítok stavu (triedy ako dnes), `span.n` `t.toolsCount(n)`;
  - `title` riadku = `lastError`.
- Prázdny stav: `.empty` > `t.emptyTitle` „Zatiaľ žiadny konektor", `t.emptyText` „Konektor pripojí server iného systému — stačí jeho adresa.", `.empty-action` odkaz `t.add` → `?new=1`.

### 2 · Pridať konektor `?new=1` (Q1)
- `form.card.task-card` pod `page-lead`. Akcia `saveConnectorAction` + hneď `connectConnectorAction` (jedna nová akcia `addAndConnectAction`, ktorá volá obe).
- `h2` `t.newTitle` „Pridať konektor", `p` `t.newIntro` „Stačí adresa. Prihlásenie a údaje o serveri sa zistia zo servera."
- `label.field` **Adresa servera** (`endpoint`, `type="url"`, povinné), **Názov** (`name`, nepovinné, hint `t.nameAuto` „Ak ho nevyplníte, prevezme sa zo servera.").
- `details.adv` „Pokročilé prihlásenie" `t.advancedAuth` — **jediný `<details>` na obrazovke, je to zámer**. Obsahuje `clientId`, `clientSecret` (`type="password"`) a hint `t.advancedAuthHint` „Len ak server nepodporuje automatickú registráciu klienta. Údaje dostanete od správcu servera."
- `.acts`: plné `SubmitButton` `t.connect` „Pripojiť" + tiché `a` `t.cancel` „Zrušiť". Pod tým hint `t.connectHint` „Otvorí sa prihlásenie na serveri. Po prihlásení sa vrátite sem."
- Profil sa nevyberá. Uloží sa `profile = detectProfile(endpoint, serverInfo)` — pred pripojením podľa adresy, po `initialize` podľa `serverInfo.name`.
- Predvolené hodnoty pri založení: `retrievalEnabled` = profil vie hľadať; `accessLevel: "internal"`, `ingestEnabled: false`.
- Chyba (adresa, rezidencia, server nedovolil začať prihlásenie) → `?new=1&error=…&endpoint=…&name=…` a `.lnote--bad` v karte. Client Secret sa do adresy nevracia.

### 3 · Detail `/organisation/connectors/<id>` (Q2)
Poradie odhora:
1. **`.page-head`**: `span.sico.lg` + `h1` `name` + štítok stavu. Bez tlačidiel.
2. **Pásik stavu `.lnote`** (Q5). Tlačidlo je vlastný `form action={connectConnectorAction}` mimo Použití.
   | stav | trieda | text | tlačidlo | Uložiť v lište |
   |---|---|---|---|---|
   | `connected` | `.lnote` (info) | `t.connectedBy` + `small` `t.personalAccountNote` | tiché `t.reconnect` | plné |
   | `new` / `disconnected` | `.lnote--warn` | `t.bandIdle` „Nepripojený. Prihlásite sa na serveri; konektor potom beží pod vaším účtom." + `small` `t.bandIdleNote` | plné `t.connect` | tiché |
   | `error` | `.lnote--bad` | `t.lastError`: `lastError` | plné `t.reconnect` | tiché |
3. **O serveri** — `fieldset.form-group` > karta s riadkami `LabeledContent` (`.lc`), len na čítanie: Názov (`serverInfo.title` · `serverInfo.name`), Verzia, Web (`websiteUrl`, odkaz), Adresa (`code`), Prihlásenie (`t.authAuto` „automatické (dynamická registrácia)" / `t.authCustom` „vlastný klient · Client Secret nastavený"), Pokyny servera (`instructions`, `-webkit-line-clamp: 4`, odkaz `t.showAll` „Zobraziť celé" → `?instructions=1`, potom celé a odkaz `t.showLess`). Čo server nedal, sa nekreslí. Pred pripojením je tu len Adresa a Prihlásenie a `p.form-group-foot` `t.aboutAfterConnect` „Názov, verzia, pokyny a nástroje sa načítajú po pripojení."
4. **Nástroje · N** (Q3) — hlavička `.gh`: `h2`, `.quiet` `t.toolsLoaded(dátum)` „Načítané pri pripojení 8. 10. 2026. Popisy sú od servera.", tiché `t.reload` „Načítať znova" (`connectConnectorAction`: pri platných tokenoch `startAuthorization` nanovo načíta nástroje a nikam nepresmeruje). Riadok `.tool`:
   - `b` `title` + `code` `name`; bez `title` len `code`;
   - štítky z **výslovne uvedených** `annotations` (Q9): `readOnlyHint: true` → `t.annReadOnly` „Len číta"; `readOnlyHint: false` alebo `destructiveHint: true` → `.tag--warn` `t.annWrites` „Mení dáta"; `openWorldHint: true` → `t.annOpenWorld` „Mimo servera"; nástroj zvolený na hľadanie → `.tag--accent` `t.annSearch` „Hľadanie";
   - popis na 2 riadky, celý v `title`;
   - vpravo `select` `t.agentPerm` „Asistent:" vždy / so súhlasom / nikdy — `disabled`, hodnota „nikdy";
   - `p.form-group-foot` `t.agentToolsSoon` „Nástroje asistenta pribudnú — potom tu nastavíte, ktoré smie asistent volať sám, so súhlasom alebo nikdy. Teraz ich nevolá."
5. **Vyskúšať hľadanie** `#try` (Q7) — kreslí sa, len keď je pripojený a `retrievalEnabled`. Viď bod 5.
6. **Použitia** — `h2` + `.quiet` `t.usesLead`, pod tým jeden `form.card.set-form` (Q4). Viď bod 4.
7. **Ďalšie akcie** `section.card.more#more`: Odpojiť (len `hasTokens`, tiché, text `t.disconnectNote`), Odstrániť (`.button--danger` → `?remove=1#more`). Pri `?remove=1` `form.more-confirm`: `t.removeConfirm(name, rozsahy, kanály)` „Odstrániť konektor Sportnet? Rozsahy ISSF a Súťaže používajú 2 kanály — ISSF Helpdesk a Rozhodcovia. Odpovede v nich prestanú hľadať na serveri Sportnet. Dokumenty importované do knižnice ostávajú." Ďalej `.button--danger` `t.removeConfirmButton` a odkaz `t.cancel`. Dnešný `title={t.removeConfirm}` sa ruší.

### 4 · Použitia (`.set-form` + `.set-savebar`)
- **Konektor** — `name` (prázdne = `serverInfo.title || name || hostiteľ`).
- **Živý zdroj** — poznámka `t.secRetrievalNote` (skrátená: „…Výsledky sú označené ako neoverené — obišli kurátora.").
  - Pri rozpoznanom profile `div.pnote` `t.fromProfile(label)` „Nastavené podľa profilu Sportnet — dokumentácia. Môžete zmeniť."
  - Prepínače `retrievalEnabled`, `retrievalDefaultOn` (+ `t.defaultOnNote`).
  - `Select` **Nástroj na hľadanie** `searchTool` (nové pole): nástroje, ktoré majú aspoň jeden textový vstup; v zozname `title · name`.
  - `Select` **Pole otázky** `searchQueryArg` (nové pole): `string` vstupy z `inputSchema.properties` zvoleného nástroja. Predvolené `query` / `q` / prvý povinný `string`.
  - Bez JS: zmena nástroja sa prejaví po Uložiť (polia otázky a stĺpce rozsahov sa prekreslia). Hint `t.toolChangeHint`.
  - Prístupová úroveň `accessLevel` — dva `.choice-row` (Interná / Verejná), `t.accessHint`.
- **Rozsahy** (`scopes`):
  - `Select` **Nástroj s možnosťami** `optionsTool` (nové, nepovinné; Sportnet: `list-documentation-filters`). Volá sa pri pripojení a pri „Načítať znova", výsledok je v `capabilities.fieldOptions`.
  - Riadok = `scopeKey` · `scopeLabel` · `scopeFilter.<vstup>` za každý ďalší vstup typu `string`, `enum` alebo pole `string` (okrem poľa otázky; číselné ako `limit` sa vynechajú).
  - **Kľúč po uložení nemenný** — `span.field-input.locked` + skrytý `input`, lebo kanály sa naň odkazujú (`<id>:<kľúč>`). Hint `t.scopeKeyLocked`. Rozsah sa zmaže vymazaním názvu aj hodnôt.
  - Vždy jeden voľný riadok navyše. Nový sa objaví po Uložiť.
  - Hodnoty polí v poradí: `enum` z `inputSchema` → `select`; inak `<input list>` + `<datalist>` z (a) `capabilities.fieldOptions`, (b) začiatkov `uri` z `resources/list`, (c) hodnôt nájdených pri Vyskúšať (len návrh, neukladá sa samo); inak voľné pole s hintom z `description` vstupu. Do `datalist` sa vlastná hodnota napísať dá vždy.
  - ≥ 640 px stĺpce s hlavičkou (`aria-label` na poliach), pod 640 px `div.scope-card` s viditeľnými `label.field`. Jeden DOM.
  - Profil bez vstupov (žiadny nástroj na hľadanie) → sekcia sa nekreslí.
- **Import do knižnice** `ingestEnabled` — povolený, keď server má `capabilities.resources` alebo profil vie `fetch`. Inak `disabled` s `t.ingestUnavailable` „Server nesprístupňuje dokumenty."
- **Redukcia** — poznámka `t.secReductionNote` + `t.audienceNote` „Obsah, ktorý server označí len pre AI (annotations.audience), sa vynechá sám."
  - Zahodiť sekcie (`dropSections`) a Vynechať cesty (`skipPaths`) ako riadky `input` + ✕ `button name="remove" value="drop:<i>"` (uloží formulár bez riadku) + voľný riadok.
  - Vymazať v texte: `.select-row` hotové vzory `scrubPresets` (nové): `email`, `phone`, `iban`, `birthNumber` (rodné číslo); regulárne výrazy sú v kóde, s testom.
  - Vlastné vzory (`scrubPatterns`) ako riadky s ✕ + voľný. Zlý vzor → dnešná chyba `connector.badPattern` pri poli.
- `.set-savebar`: `t.save` + `.quiet` `t.saveUses` „Uloží všetky sekcie Použití."

### 5 · Vyskúšať hľadanie (Q7)
- `form method="get" action="#try"`: `q` Otázka, `scope` Rozsah (`Select`: `t.scopeAll` „Celý server" + uložené rozsahy), tiché `t.try` „Vyskúšať". Server sa volá **len pri `?try=`**, nie pri načítaní detailu.
- Výsledok vykreslí server: `withClient` → `searchTool` s `searchQueryArg` + filter rozsahu → rozklad (profil `search`, inak všeobecný — Q10) → **redukcia**. Riadok `.hit`: `b` názov, `.tag` skupina, `code` cesta (`externalId`), dĺžka v znakoch, prvé 3 riadky textu po redukcii (`[…]` na mieste vymazaných vzorov). Nadpis `t.tryCount(n)` · použitý nástroj.
- **Návrhy** `form method="post" action={applySuggestionsAction}` (nové), tri `.form-group` so `.select-row`:
  - Zahodiť sekcie: nadpisy `##`/`###` z vrátených článkov s početnosťou („Key files · 12×"), od 2 výskytov, bez tých, čo už sú v `dropSections`;
  - Vynechať cesty: spoločné úseky ciest (`-rules-`, `/internal/`), ak ich má viac než jeden výsledok;
  - Rozsahy: hodnoty skupín / filtrov z výsledkov; pri existujúcom rozsahu podnadpis „už je rozsah …".
  - Tiché `t.addSelected` „Pridať vybrané" (nie „Pridať do redukcie", lebo pridáva aj rozsahy). Doplní, uloží a vráti sa na `?try=…#try`.
- Chyba → `.lnote--bad` s textom `ConnectorError` (`connector.timeout`, `connector.unauthorized`, …) + `small` `t.tryFallback` „Odpovede asistenta idú v takom prípade len z knižnice." Prázdny výsledok → `.empty` `t.tryEmpty` „Server nič nevrátil. Skúste inú otázku alebo rozsah."

## Kde

- `app/organisation/connectors/page.tsx` (prehľad s `OrgNav`) a `app/organisation/connectors/[id]/page.tsx` (detail) — Q8.
- `ConnectorsSection.tsx` → `ConnectorList`, `ConnectorAdd`, `ConnectorAbout`, `ConnectorTools`, `ConnectorTry`, `ConnectorUses`, `ConnectorMore`.
- `organisation/actions.ts`: `addAndConnectAction` (nové), `saveConnectorAction` (nové polia, riadky namiesto textarea, `remove=…`, presmerovanie na detail), `applySuggestionsAction` (nové), connect/disconnect → detail, remove → prehľad.
- `lib/mcp/client.ts`: z `client.connect()` uložiť `getServerVersion()` (serverInfo), `getInstructions()`, `getServerCapabilities()` (resources); `listTools()` uložiť celé (`title`, `inputSchema`, `annotations`; popis bez orezania na 300); `optionsTool` zavolať a výsledok do `fieldOptions`; `resources/list` (prvá strana) → `resourcePrefixes`. OAuth `scope` brať z metadát chráneného zdroja (`scopes_supported`), nie natvrdo `"docs.read"` — Q12. Vlastný klient: `clientInformation()` vráti `clientId/clientSecret` z `clientInfoEnc`.
- `lib/mcp/profiles/*`: `matches(endpoint, serverInfo)`, `defaults: { searchTool, searchQueryArg, optionsTool }`; `generic` dostane všeobecné `search` (Q10).
- `lib/connectors.ts`: nové polia (viď Údaje), `detectProfile`, `channelsUsingConnector`, `scrubPresets` → regulárne výrazy; zámok kľúča rozsahu v `saveConnector` (existujúci kľúč sa nemení, len názov a filter).
- `lib/reduction.ts` (alebo kde je dnes): `suggestReductions(articles, policy)`, čisté, s testom.
- `globals.css`: `.sico`, `.lc`, `.tool`, `.perm`, `.pnote`, `.hit`, `.scope-grid`, `.scope-card`, `.line`, `.adv`, `.lnote` (info).
- i18n `org.connectors.*` (sk/cs/en): `introShort, toolsCount, emptyTitle, emptyText, newTitle, newIntro, nameAuto, advancedAuth, advancedAuthHint, clientId, clientSecret, secretSet, connectHint, bandIdle, bandIdleNote, about, authAuto, authCustom, showAll, showLess, aboutAfterConnect, toolsLoaded, reload, annReadOnly, annWrites, annOpenWorld, annSearch, agentPerm, agentPermAlways, agentPermAsk, agentPermNever, agentToolsSoon, usesLead, fromProfile, searchTool, searchQueryArg, toolChangeHint, optionsTool, optionsToolHint, scopeKeyLocked, ingestUnavailable, audienceNote, scrubPresets.*, saveUses, tryTitle, tryLead, tryQuestion, scopeAll, try, tryCount, tryFallback, tryEmpty, suggestTitle, addSelected, disconnectNote, removeConfirm, removeConfirmButton`. Zmazať `intro`, `profile`, `scopesField`, `scopesHint`, `edit`, `add` (ak ho nepoužíva prehľad), keď ich už nič nepoužíva.

## Prečo

- Dnešný formulár je postavený na Sportnete: profil vyberá človek, ale je to kód v repozitári, a nový server bez profilu „len ponúka nástroje". Štandard MCP dáva všetko potrebné — prihlásenie z adresy, predstavenie servera, nástroje so schémou vstupov — takže stačí adresa a správca vyberie, ktorý nástroj je hľadanie.
- Vzor „vlastný konektor" z bežných asistentov (adresa → Pripojiť → nástroje) poznajú správcovia z iných aplikácií.
- Všetko podstatné bolo v `<details>` a „Odstrániť" mazalo rozsahy kanálov na prvý klik.
- Redukcia nastavená naslepo (texty nadpisov, regulárne výrazy) sa nedá overiť. Vyskúšať hľadanie ukáže presne to, čo by dostal model, a z výsledku navrhne, čo zahodiť.
- Rozsahy ako text „kľúč | názov | project=issf" sa ľahko pokazia; vstupy nástroja sú známe zo schémy.

## Rozhodnutia v repozitári — dodržané

- **Konektor = entita organizácie s použitiami A/B/C** (D171) — Použitia sú tri sekcie, C je vypnuté.
- **OAuth rieši SDK, nepíše sa vlastný** (D172) — vlastný Client ID/Secret ide do existujúceho `clientInfoEnc` cez `clientInformation()`.
- **Tajomstvá nikdy na obrazovke** (D172, `connectorView`) — Client Secret len „nastavený".
- **Pilot pod osobným účtom; vidno, kto konektor drží** (D172) — pásik Pripojený.
- **Výsledok nástroja je obsah, nie pokyn** (D174) — `instructions` a popisy sa len zobrazujú; do promptu sa `instructions` nepridávajú (Q13).
- **Prístupová úroveň na konektore, predvolene interná** (D174).
- **Rozsah pomenovaný na konektore, vyberá ho kanál** (D175) — preto nemenný kľúč a veta o kanáloch pri odstránení.
- **Redukcia je zúženie, nie brána** (D176) — v poznámke sekcie.
- **Stopa každého volania** (D177) — Vyskúšať, nástroj s možnosťami aj `resources/list` sa zapisujú.
- **Predvolene len knižnica, `defaultOn`** (§ 5, Ján 8. 10. 2026).
- **Kontrola režimu pri uložení, pripojení a každom volaní** (§ 5) — chyba pri Pridať je `.lnote--bad` v karte úlohy.
- **D178** (ADR-029 § 6, Ján 9. 10. 2026) — profil je predvyplnenie; nástroj na hľadanie, pole otázky a nástroj s možnosťami sú nastavenie konektora. Upravuje D173.

## Rámy

- **1440 svetlá:** prehľad (Sportnet pripojený, Wiki SFZ v chybe) · celý detail Sportnetu (O serveri, 7 nástrojov so štítkami, Vyskúšať, Použitia s profilom, Ďalšie akcie) · Vyskúšať „prestup hráča" s 3 výsledkami a návrhmi (Key files 12×, Data 9×, Overview 3×; `-rules-`; `issf`, `sutaze`).
- **390 tmavá:** prehľad · `?new=1` zbalené · `?new=1` s rozbaleným Pokročilým prihlásením · detail nepripojeného neznámeho servera · Použitia neznámeho servera (výber nástroja, 2 rozsahy + voľný; `space` s ponúkanými hodnotami, `author` voľné) · Vyskúšať s chybou servera · Ďalšie akcie s potvrdením odstránenia.
- Hodnoty označené v ráme „ukážka" (pokyny servera, popisy nástrojov, `annotations`, texty článkov) sú vymyslené. Skutočné príde zo servera.

## SwiftUI

| SwiftUI | Tu |
| --- | --- |
| `List` + `NavigationLink` | prehľad, `a.form-row` s › |
| `LabeledContent` v `Section` | O serveri |
| `List` s `Label` a odznakmi | Nástroje |
| `Form` + `Section` (header/footer) | Použitia `.set-form` |
| `Toggle`, `Picker(.menu)`, `Picker(.inline)` | prepínače; nástroj a pole otázky; prístupová úroveň |
| `DisclosureGroup` | Pokročilé prihlásenie (jediná výnimka) |
| `.searchable` + výsledky | Vyskúšať hľadanie |
| `.confirmationDialog` (destructive) → potvrdenie v adrese | `?remove=1#more` |
| `ContentUnavailableView` | prázdny stav, prázdny výsledok |

## Údaje, ktoré v modeli neexistujú

V `Connector` dnes je len `capabilities.tools[{name, description(≤300)}]`, `discoveredAt`, `profile`, `auth.clientInfoEnc`. Nové (všetko voliteľné, starý záznam funguje):
- `server: { name, title?, version?, websiteUrl?, icon?, instructions? } | null` — z `initialize`. `icon` = `data:` URL, len PNG / JPEG / WebP do 32 kB stiahnuté zo `serverInfo.icons` pri pripojení; SVG sa neukladá (Q11). Bez vhodnej ikony `icon` chýba a kreslí sa písmeno.
- `capabilities.tools[]` rozšíriť o `title?`, `inputSchema`, `annotations?`; popis bez orezania.
- `capabilities.resources: boolean`, `capabilities.resourcePrefixes: string[]`.
- `capabilities.fieldOptions: Record<vstup, string[]>` — z `optionsTool`.
- `uses.retrieval.searchTool`, `uses.retrieval.searchQueryArg`, `uses.retrieval.optionsTool`.
- `uses.retrieval.reduction.scrubPresets: ("email"|"phone"|"iban"|"birthNumber")[]`.
- `auth.customClient: boolean` — na „vlastný klient · nastavený" bez dešifrovania.
- Návrhy z Vyskúšať sa **neukladajú**, počítajú sa pri každom `?try=`.
- Kanály pri odstránení sa odvodia z `channels.connectorScopes` (bez zmeny schémy).
- **Nenavrhuje sa:** katalóg MCP Registry, posledné volania, konektor na osobu.

## Rozhodnuté (Ján, 9. 10. 2026 — všetky podľa odporúčania A)

- **Q1** Pridanie len s adresou, Názov nepovinný, zbalené Pokročilé prihlásenie (Client ID, Client Secret). „Pripojiť" konektor založí a hneď presmeruje na prihlásenie servera.
- **Q2** Detail na vlastnej stránke v poradí O serveri → Nástroje → Vyskúšať hľadanie → Použitia → Ďalšie akcie.
- **Q3** Nástroje vždy viditeľné so štítkami z `annotations`. Povolenia pre asistenta sú nakreslené ako vypnuté.
- **Q4** Použitia s výberom nástroja na hľadanie a poľa otázky, rozsahy ako riadky s ponúkanými hodnotami, hotové vzory redukcie.
- **Q5** Pásik stavu; plné je Pripojiť (nepripojený, chyba) alebo Uložiť (pripojený).
- **Q6** Prehľad: riadky s ikonou, adresou · verziou a štítkami; `.empty` s odkazom na `?new=1`.
- **Q7** Vyskúšať hľadanie cez GET, volá sa len na stlačenie, s návrhmi do redukcie a rozsahov.
- **Q8** Zapísané ako **D178 v ADR-029 § 6**: profil je predvyplnenie; nástroj na hľadanie, pole otázky a nástroj s možnosťami sú nastavenie konektora.
- **Q9** Štítky nástrojov len z výslovne uvedených `annotations`. Bez údaja sa štítok nekreslí.
- **Q10** Výsledok servera bez profilu: `resource` / `resource_link` = článok; inak `structuredContent` s poľom `{title, text|content, uri}`; inak celý text = jeden článok.
- **Q11** Ikona servera **len PNG, JPEG alebo WebP do 32 kB**, stiahnutá pri pripojení a uložená ako `data:`. **SVG nie, ani po sanitizácii** — dodáva ho cudzí server a môže niesť skript. Inak prvé písmeno.
- **Q12** Rozsah oprávnení OAuth zo `scopes_supported` v metadátach chráneného zdroja. Keď server nič neohlási, `scope` sa neposiela. `docs.read` ostáva len v profile Sportnetu.
- **Q13** Pokyny servera (`instructions`) sa modelu neposielajú, len sa zobrazujú.
- **Q14** Adresa servera je na detaile len na čítanie. Iný server = nový konektor.

## Otázky

Žiadne otvorené.

## Prompt pre Claude Code

```
Stiahni design: design_handoff_contineo_intranet/ORG-konektory.html + .md.
Vetva design/org-konektory-mcp z main. ADR-029 (D171–D177, § 5).
Q1–Q14 rozhodnuté podľa A (Ján 9. 10. 2026), D178 v ADR-029 § 6.
Ikona servera len PNG/JPEG/WebP ≤ 32 kB ako data:, SVG nie (Q11).

1. Model a klient (lib/connectors.ts, lib/mcp/client.ts): nové voliteľné
   polia podľa „Údaje, ktoré v modeli neexistujú"; pri connect uložiť
   serverInfo, instructions, capabilities (resources), celé tools/list
   (title, inputSchema, annotations), fieldOptions z optionsTool,
   resourcePrefixes; scope z metadát (Q12); vlastný klient cez
   clientInformation(); detectProfile; zámok kľúča rozsahu; testy.
2. Cesty (Q8 v .md, bod Kde): organisation/connectors/page.tsx (prehľad
   s OrgNav) + connectors/[id]/page.tsx. Prehľad podľa .md §1, ?new=1
   podľa §2 (addAndConnectAction, jediný <details> Pokročilé prihlásenie).
3. Detail §3: page-head s ikonou, .lnote podľa stavu (tabuľka), O serveri
   (.lc, instructions clamp 4 + ?instructions=1), Nástroje (štítky len
   z výslovných annotations, disabled select povolení, Načítať znova),
   Ďalšie akcie s ?remove=1#more a channelsUsingConnector().
4. Použitia §4: .set-form + .set-savebar; searchTool, searchQueryArg,
   optionsTool, rozsahy ako riadky (enum → select, inak input list +
   datalist), import podľa resources/profilu, redukcia ako riadky s ✕
   (button name=remove), scrubPresets.
5. Vyskúšať §5: GET ?try=&scope=#try, volá len pri ?try, redukcia pred
   zobrazením, suggestReductions() + applySuggestionsAction; chyba
   .lnote--bad, prázdne .empty.
6. Callback OAuth → detail. i18n sk/cs/en podľa .md; inline štýly →
   triedy v globals.css; ConnectorsSection rozdeliť.

Žiadny token ani Client Secret na obrazovke; popisy a instructions sa
neprekladajú. Bez JS funguje všetko. Over 1440 svetlá + 390 tmavá,
klávesnicou, VoiceOver (ikony aria-hidden, polia rozsahov s aria-label).
tsc, eslint, vitest, build. Komentár v page.tsx: odkaz na ORG-konektory
(9. 10. 2026).
```
