# Zadanie pre Claude Design — ORG-konektory

> Podklad pre prerobenie časti **Organizácia → Konektory**
> (`/organisation/connectors`) podľa štandardu MCP. Pripravené 9. 10. 2026
> proti `main`. Prepísané v ten istý deň podľa Jánovho nápadu: obrazovka sa
> má riadiť štandardom MCP, nech sa dá pripojiť akýkoľvek server, nielen
> Sportnet. Časť „Prompt pre Claude Design" sa skopíruje do projektu
> v Claude Design; zvyšok je kontext pre Jána.

## Prečo

Ján 9. 10. 2026 uviedol dva dôvody:

1. **Dôležité veci sú schované.** „Nástroje servera", „Upraviť" a „Pridať
   konektor" sú v rozbaľovačkách `<details>`. Formulár „Upraviť" má päť
   blokov a natiahne kartu zoznamu na niekoľko obrazoviek.
2. **Pridať konektor má byť univerzálne.** Dnes sa vypĺňa názov, adresa
   a „profil servera" (Sportnet / Všeobecný). Profil je kód v repozitári,
   takže nový server s hľadaním potrebuje programátora. MCP má štandard,
   ktorý z toho väčšinu robí zbytočnou.

V kóde sú ešte tieto nálezy:

- **„Odstrániť" maže na prvý klik.** Varovanie je len v `title`.
- **Rozsahy sa píšu ako text** v tvare `kľúč | názov | project=issf`.
- **Úvod má päť viet** a chýba `.page-head` časti „Konektory".
- **Rozsah oprávnení pri prihlásení je napevno `docs.read`**
  (`lib/mcp/client.ts`). Ten patrí Sportnetu, nie štandardu.

## Čo dáva štandard MCP (stav na 9. 10. 2026)

| Štandard | Čo dáva | U nás dnes |
|---|---|---|
| **Autorizácia MCP** (OAuth 2.1 + PKCE, metadáta chráneného zdroja, metadáta autorizačného servera, dynamická registrácia klienta) | Z jedinej adresy servera klient zistí, kde sa prihlasuje, sám sa zaregistruje a získa token. Server môže povedať aj podporované rozsahy oprávnení. | Robí to SDK (`auth()`), dynamická registrácia funguje. Obrazovka sa však pýta aj na profil a oprávnenie je napevno `docs.read`. |
| **`initialize` → `serverInfo`** (`name`, `title`, `version`, v novšej verzii `icons`, `websiteUrl`) + `instructions` | Server sa predstaví: ako sa volá, aká je to verzia a ako ho používať. | Neukladá sa. Názov píše správca ručne. |
| **`tools/list`** (`name`, `title`, `description`, `inputSchema` ako JSON Schema, `annotations`: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) | Nástroj má presne popísané vstupy a príznaky, či len číta alebo mení dáta. | Ukladá sa len `name` a `description` (orezaný na 300 znakov). |
| **`resources/list`, `resources/read`** | Štandardný spôsob, ako zo servera čítať dokumenty. | Nepoužíva sa. Import ide cez profil (`fetch`). |
| **Vzor „vlastný konektor"** v klientoch (Claude, ChatGPT) | Pri pridaní sa zadá len názov a URL, pokročilé (OAuth Client ID/Secret) je zbalené. Potom „Pripojiť" a zoznam nástrojov, pri každom povolenie (vždy / so súhlasom / nikdy). | — |
| **MCP Registry** (verejný katalóg, `server.json`) | Výber známeho servera zo zoznamu. | — (do budúcna, **nenavrhovať**) |

**Štandard nerieši, ktorý nástroj je „hľadaj" a ako čítať jeho výsledok.**
To je dnes profil (D173). Návrh to zovšeobecní:

- Správca pri použití „Živý zdroj" vyberie nástroj na hľadanie.
- Pole pre otázku a polia rozsahu sa zoberú z jeho `inputSchema`.
- Výsledok sa číta ako text, prípadne ako odkazy na zdroje (`resource_link`).
- Profil ostáva ako **hotové nastavenie pre známy server**. Sportnet má
  nástroj aj polia predvyplnené a navyše vie vyčistiť preambuly odpovede.

## Dnes (kód)

**Súbor** `app/src/app/organisation/ConnectorsSection.tsx`, vykresľuje ho
`app/src/app/organisation/[section]/page.tsx` (`now === "connectors"`).

**Karta na každý konektor** (`.card.detail-block`) obsahuje:
- názov a štítok stavu (Nepripojený / Pripojený / Odpojený / Chyba);
- adresu a profil;
- „Pripojil X (dátum)", poslednú chybu a poznámku o osobnom účte;
- tiché tlačidlá Pripojiť (znova), Odpojiť a Odstrániť;
- rozbaľovačku `details` Nástroje servera;
- rozbaľovačku `details` Upraviť.

**Formulár** (`saveConnectorAction`):
- Základ: Názov, Adresa servera, Profil.
- `set-sec` **Živý zdroj**: prepínač, „predvolene pri otázke", Prístupová
  úroveň Interná / Verejná.
- `set-sec` **Import do knižnice**: prepínač.
- `set-sec` **Rozsahy**: textarea.
- `set-sec` **Redukcia**: tri textarea (nadpisy sekcií, regulárne výrazy,
  cesty).

**Naostro (SFZ):** jeden konektor, „Sportnet dokumentácia", je pripojený
a má 7 nástrojov:

- `list-documentation-filters`
- `search-sportnet-documentation`
- `get-documentation-file`
- `generate-sportnet-documentation`
- `generate-user-manual`
- `publish-user-manual`
- `whoami`

**Model** (`lib/connectors.ts`):

| Pole | Obsah |
|---|---|
| `name`, `endpoint`, `profile` | základné údaje |
| `status`, `lastError` | stav pripojenia |
| `auth` | `connectedBy`, `connectedAt`, `hasTokens` |
| `scopes[]` | `{key, label, filter}` |
| `uses.retrieval` | `{enabled, defaultOn, accessLevel, reduction}` |
| `uses.ingest` | `{enabled}` |
| `uses.agentTools` | `{allowed}` |
| `capabilities` | `{tools[{name, description}], discoveredAt}` |

## Rozhodnutia v repozitári, ktoré platia

- **ADR-029** (D171–D177) platí ďalej, okrem jedného bodu:
  - Tajomstvá nikdy na obrazovku.
  - Prístupová úroveň je vlastnosť konektora (D174).
  - Rozsahy filtruje server a vyberajú ich kanály (D175).
  - Redukcia je zúženie pre interných, nie brána pre verejnosť (D176).
  - Každé volanie má stopu (D177).
  - **D173 („profil je jediné miesto so znalosťou servera") sa mení.**
    Pred implementáciou sa to zapíše ako dodatok ADR-029.
- **Najviac jedno plné tlačidlo**, vpravo v `.page-head`. Otvorená úloha
  (`?new=1`) ho preberá.
- **Časť, ktorú má cesta pomenovať, má vlastnú adresu.**
- **Ďalšie akcie** (`.more`) s potvrdením v adrese (`?remove=1#more`).
- **Nastavenia** sú `.set-form` + `.set-sec` + `.set-savebar`.
- **Vzor je prehľad kanálov** (KANALY-prehlad):
  - riadky `a.form-row` vedú na detail;
  - nový záznam sa zakladá cez `?new=1` `.task-card` s minimom polí.
- Stránka funguje bez JavaScriptu. Platí mobile first, zlomy 640 a 1024
  a terč aspoň 44 px.
- Texty idú cez i18n (sk/cs/en). Popisy nástrojov a `instructions` sú dáta
  zo servera a neprekladajú sa.

## Otázky

**Q1 — Pridať konektor.**
- **A (odporúčam):** plné „Pridať konektor" v `.page-head` otvorí
  `?new=1` `.task-card`.
  - Úloha má jediné povinné pole **Adresa servera**.
  - **Názov je nepovinný.** Keď ostane prázdny, doplní sa zo
    `serverInfo.title`, inak zo `serverInfo.name`.
  - Zbalená časť **„Pokročilé prihlásenie"** obsahuje OAuth Client ID
    a Client Secret pre server, ktorý nepodporuje dynamickú registráciu.
    Je to jediná rozbaľovačka na obrazovke a je to vedome, lebo väčšina
    ľudí ju nepotrebuje.
  - Tlačidlo je **„Pripojiť"**: založí konektor a hneď odíde na
    prihlásenie servera. Po návrate sa ide na detail.
  - Profil sa nevyberá. Známy server sa rozpozná podľa adresy alebo
    `serverInfo.name` a profil sa nastaví sám.

  Je to rovnaký vzor ako „vlastný konektor" v Claude a ChatGPT.
- B: Názov aj Adresa povinné a „Založiť" bez okamžitého pripojenia.

**Q2 — Detail konektora na vlastnej adrese.**
- **A (odporúčam):** `/organisation/connectors/<id>`. Zhora nadol:
  1. `.page-head` s ikonou servera (`icons`, inak písmeno), názvom
     a štítkom stavu.
  2. Pásik `.lnote` so stavom pripojenia (Q5).
  3. **„O serveri"**: názov a verzia zo `serverInfo`, odkaz na web
     (`websiteUrl`), adresa a `instructions` servera. Instructions sú
     orezané na 4 riadky; celý text je v odkaze „Zobraziť celé"
     (`?instructions=1`), nie v `details`.
  4. **„Nástroje"** (Q3).
  5. **„Vyskúšať hľadanie"** (Q7).
  6. **„Použitia"** ako `.set-form` (Q4) s `.set-savebar`.
  7. **Ďalšie akcie**: Odpojiť; Odstrániť s potvrdením
     `?remove=1#more` a `.button--danger`.
- B: všetko na jednej stránke cez `?edit=<id>`.

**Q3 — Nástroje.**
- **A (odporúčam):** vždy viditeľný `.form-list`. Riadok nástroja má:
  - `title` alebo `name` a pod ním `name` v `<code>`;
  - popis orezaný na 2 riadky, celý v `title`;
  - vpravo štítky z `annotations`: „Len číta" (`readOnlyHint`), „Mení
    dáta" (`destructiveHint`, `tag--warn`), „Mimo servera"
    (`openWorldHint`);
  - štítok „Hľadanie" pri nástroji vybranom pre živý zdroj.

  Nad zoznamom je „Načítané pri pripojení <dátum>" a tiché „Načítať
  znova". **Prepínače povolení pre asistenta (vždy / so súhlasom /
  nikdy) sa nakreslia**, ale ako **vypnuté s poznámkou „Nástroje
  asistenta pribudnú"**. Návrh ich ukáže, kód ich zatiaľ neurobí.
- B: zoznam bez štítkov a bez náznaku povolení.

**Q4 — Použitia (to, čo štandard nerieši).**
- **A (odporúčam):** sekcie `.set-sec`:
  - **Živý zdroj:**
    - prepínač zapnutia;
    - **Nástroj na hľadanie** (`Select` z nástrojov, predvolený je
      nástroj s `search` v názve a pole typu string v `inputSchema`);
    - **Pole otázky** (`Select` zo string vstupov nástroja);
    - „predvolene pri otázke";
    - Prístupová úroveň.

    Pri rozpoznanom profile (Sportnet) sú nástroj a pole predvyplnené
    a pod nimi je poznámka „Nastavené podľa profilu Sportnet —
    dokumentácia".
  - **Rozsahy:** riadky namiesto textu. Riadok má **Kľúč**, **Názov**
    a pole pre každý ďalší vstup nástroja na hľadanie z `inputSchema`
    (okrem poľa otázky a limitu). Vždy je jeden voľný riadok navyše
    a funguje to bez JS.
    - **Kľúč sa po uložení nedá meniť.** Kanály si rozsah pamätajú podľa
      konektora a tohto kľúča (`scopeRef`). Mení sa len Názov.
    - **Odkiaľ sa berú možné hodnoty polí**, v poradí, v akom sa skúšajú:
      1. `enum` vo vstupe `inputSchema` → `Select`;
      2. **nástroj s možnosťami**, ktorý vyberie správca (nový `Select`
         „Nástroj s možnosťami", nepovinný). Pri Sportnete je
         predvyplnený `list-documentation-filters`. Jeho výsledok sa
         načíta pri pripojení a pri „Načítať znova", nie pri každom
         zobrazení;
      3. **zdroje servera** (`resources/list`): ponúkne sa začiatok
         adresy zdroja ako hodnota;
      4. hodnoty nájdené pri **Vyskúšať hľadanie** (Q7);
      5. inak voľné textové pole. Nápoveda sa vezme z `description`
         vstupu.

      Pri poli s ponúkanými hodnotami ostáva možnosť napísať vlastnú
      (`Select` s poslednou voľbou „Iná…" alebo pole s `datalist`).
    - MCP doplňovanie (`completion/complete`) platí len pre prompty
      a šablóny zdrojov, nie pre vstupy nástrojov. Na rozsahy sa preto
      **nepoužíva**.
  - **Import do knižnice:**
    - Prepínač je povolený, keď server ponúka `resources` alebo keď
      profil vie čítať celý článok.
    - Inak je vypnutý s poznámkou „Server nesprístupňuje dokumenty".
  - **Redukcia:** server ju neopíše, je to naše pravidlo nad vráteným
    textom. Ostávajú tri zoznamy, ale nie ako holé textarea:
    - **Zahodiť sekcie** a **Vynechať cesty** sú zoznamy riadkov s
      odstránením a jedným voľným riadkom. Pridávajú sa aj
      zaškrtnutím vo Vyskúšať hľadanie (Q7).
    - **Vzory v texte:** hotové vzory ako `.select-row` (e-mail, telefón,
      IBAN, rodné číslo) a pod nimi riadky pre vlastný regulárny výraz.
      Sportnet má predvyplnený `T_[A-Z_]+`.
    - Poznámka: ak server pri obsahu uvádza, komu je určený
      (`annotations.audience`), obsah len pre AI sa vynechá sám.
- B: ponechať profil ako povinnú voľbu a meniť len vzhľad.

**Q5 — Stav pripojenia a plné tlačidlo na detaile.**
- **A (odporúčam):** pásik `.lnote` pod hlavičkou.
  - **Pripojený** (`--info`): kto a kedy pripojil, poznámka o osobnom
    účte, tiché „Pripojiť znova". Plné je „Uložiť" v lište.
  - **Nepripojený alebo odpojený** (`--warn`): plné „Pripojiť". „Uložiť"
    je vtedy tiché.
  - **Chyba** (`--bad`): text chyby a plné „Pripojiť znova".
- B: stav len štítkom v hlavičke.

**Q6 — Prehľad.**
- **A (odporúčam):**
  - `.page-head` časti „Konektory" s plným „Pridať konektor".
  - Úvod je jedna veta („Pripojenia k MCP serverom — zdroj pre asistenta
    a import do knižnice.").
  - Riadok `a.form-row` má ikonu a názov, pod ním adresu a verziu. Vpravo
    sú štítky použití („Živý zdroj", „Import", „Interná/Verejná"), štítok
    stavu a počet nástrojov.
  - Prázdny stav je `.empty` s odkazom na `?new=1`.
- B: ponechať karty s tlačidlami.

**Q7 — Vyskúšať hľadanie.**
- **A (odporúčam):** sekcia na detaile medzi Nástrojmi a Použitiami,
  viditeľná, keď je zapnutý živý zdroj a vybraný nástroj na hľadanie.
  - **Formulár GET:** pole otázky, voliteľne rozsah (`Select`), tiché
    „Vyskúšať". Otázka ide do adresy (`?try=…#try`) a výsledok
    vykreslí server, takže to funguje bez JS.
  - Volá cudzí server, preto **len na výslovné stlačenie**, nikdy pri
    obyčajnom zobrazení detailu. Volanie má stopu (D177).
  - **Výsledok** je zoznam vrátených článkov: názov, cesta
    (`externalId`), skupina, dĺžka a prvé riadky textu **už po
    redukcii**. Hneď je vidieť, čo by asistent dostal.
  - **Pod výsledkom sú tri návrhy:**
    - **Nadpisy** vo vrátených článkoch s početnosťou („Key files ·
      12×") ako `.select-row`. Zaškrtnuté sa pridajú do „Zahodiť
      sekcie". Už zahodené sú označené.
    - **Spoločné časti ciest** ako `.select-row` → do „Vynechať cesty".
    - **Hodnoty filtrov**, ktoré sa vo výsledkoch objavili (skupina,
      projekt) → ponúknu sa v Rozsahoch.
  - Tlačidlo „Pridať do redukcie" je tiché (uloží len zaškrtnuté).
    Plné tlačidlo obrazovky sa nemení.
  - Chyba servera alebo prekročený čas sa zobrazí ako `.lnote--bad`
    s textom chyby, prázdny výsledok ako `.empty`.
- B: bez skúšania; redukcia a rozsahy len ručne.

## Údaje, ktoré v modeli nie sú

Pri pripojení sa ich dá získať zo štandardu, preto **návrh ich smie
použiť**:

- `serverInfo` (`name`, `title`, `version`, `icons`, `websiteUrl`) a
  `instructions` z `initialize`;
- pri nástroji `title`, `inputSchema` a `annotations` z `tools/list`;
- či server ponúka `resources` (capabilities);
- nastavenie hľadania (nástroj a pole otázky) a v `scopes[].filter`
  hodnoty podľa vstupov nástroja (rovnaký tvar ako dnes);
- vlastné OAuth Client ID a Client Secret (tajomstvo, šifrované, na
  obrazovke len „nastavené");
- nástroj s možnosťami a jeho naposledy načítaný výsledok (hodnoty pre
  Rozsahy, spolu s `discoveredAt`);
- začiatky adries zdrojov z `resources/list`;
- výsledok Vyskúšať hľadanie sa **neukladá**. Je len v odpovedi na
  `?try=`.

**Nepridávať:**
- posledné volanie a počet volaní (stopa D177 existuje, prehľad ju
  nečíta);
- katalóg MCP Registry;
- konektor na osobu (`auth.mode = person`).

## Rámy

- **1440 svetlá:**
  - prehľad s dvomi konektormi: Sportnet pripojený a „Všeobecný" server
    v chybe;
  - celý detail pripojeného Sportnetu (O serveri, 7 nástrojov so štítkami,
    Použitia s predvyplneným profilom);
  - Vyskúšať hľadanie s otázkou „prestup hráča", troma výsledkami
    a návrhmi (nadpisy „Key files 12×", „Data 9×", „Overview 3×", jedna
    cesta `-rules-`, projekty issf a sutaze).
- **390 tmavá:**
  - prehľad;
  - `?new=1` so zbaleným aj rozbaleným „Pokročilým prihlásením";
  - detail nepripojeného neznámeho servera (pásik `--warn`, plné
    Pripojiť);
  - Použitia neznámeho servera s výberom nástroja a dvomi riadkami
    rozsahov (jedno pole s ponúkanými hodnotami, jedno voľné);
  - Vyskúšať hľadanie s chybou servera;
  - Ďalšie akcie s otvoreným potvrdením odstránenia.

## Prompt pre Claude Design

```
Navrhni ORG-konektory — prerobenie časti Organizácia → Konektory
(/organisation/connectors) podľa štandardu MCP, aby sa dal pripojiť
akýkoľvek MCP server, nielen Sportnet. Je to DIFF proti existujúcej
obrazovke; serverové akcie (save/connect/disconnect/remove), polia
použití (retrievalEnabled, retrievalDefaultOn, accessLevel,
ingestEnabled, scopes, dropSections, scrubPatterns, skipPaths) a
existujúce texty ostávajú, nové texty pomenuj.

Problém dnes: všetko podstatné je v <details> („Nástroje servera",
„Upraviť" s 5 blokmi rozbalený v karte zoznamu, „Pridať konektor" na
konci zoznamu); „Odstrániť" maže na prvý klik; rozsahy sa píšu ako text
„kľúč | názov | project=issf"; pri pridaní sa vyberá „profil servera"
(Sportnet / Všeobecný), čo je kód v repozitári.

Štandard MCP, z ktorého vychádzaj:
- Autorizácia MCP (OAuth 2.1 + PKCE, metadáta chráneného zdroja a
  autorizačného servera, dynamická registrácia klienta): z adresy servera
  sa všetko zistí samo. Vlastné Client ID/Secret len ako pokročilé.
- initialize → serverInfo (name, title, version, icons, websiteUrl) a
  instructions: server sa predstaví sám.
- tools/list: name, title, description, inputSchema (JSON Schema),
  annotations (readOnlyHint, destructiveHint, idempotentHint,
  openWorldHint).
- resources: štandardné čítanie dokumentov.
- Vzor „vlastný konektor" v Claude/ChatGPT: URL → Pripojiť → zoznam
  nástrojov s povolením pri každom (vždy / so súhlasom / nikdy).
Štandard nerieši, ktorý nástroj je „hľadaj" — to vyberá správca
(Použitia), profil je len predvyplnenie pre známy server (Sportnet).

Odporúčam (Q1–Q7 v zadaní, odporúčaná A):
Q1 plné „Pridať konektor" v page-head → ?new=1 .task-card: povinná len
   Adresa servera, Názov nepovinný (doplní sa zo serverInfo), zbalené
   „Pokročilé prihlásenie" (Client ID, Client Secret) — jediná
   rozbaľovačka, vedome; tlačidlo „Pripojiť" založí a hneď odíde na
   prihlásenie servera, po návrate detail. Profil sa nevyberá, rozpozná
   sa sám.
Q2 detail /organisation/connectors/<id>: page-head (ikona servera alebo
   písmeno, názov, štítok stavu) → pásik stavu → „O serveri" (názov,
   verzia, web, adresa, instructions orezané na 4 riadky + „Zobraziť
   celé" cez ?instructions=1) → „Nástroje" → „Vyskúšať hľadanie" →
   „Použitia" (set-form +
   set-savebar) → Ďalšie akcie (Odpojiť; Odstrániť s potvrdením
   ?remove=1#more, .button--danger, veta o kanáloch, ktoré prídu o
   rozsahy).
Q3 Nástroje vždy viditeľné, .form-list: title/name, <code>name</code>,
   popis na 2 riadky (celý v title), štítky z annotations („Len číta",
   „Mení dáta" tag--warn, „Mimo servera"), štítok „Hľadanie" pri
   vybranom nástroji; nad zoznamom „Načítané pri pripojení <dátum>" +
   tiché „Načítať znova". Povolenia pre asistenta (vždy / so súhlasom /
   nikdy) nakresli ako vypnuté s poznámkou „Nástroje asistenta pribudnú".
Q4 Použitia (set-sec): Živý zdroj — prepínač, Nástroj na hľadanie
   (Select z nástrojov), Pole otázky (Select zo string vstupov
   inputSchema), „predvolene pri otázke", Prístupová úroveň; pri
   rozpoznanom profile predvyplnené s poznámkou „Nastavené podľa profilu
   Sportnet — dokumentácia". Rozsahy ako riadky: Kľúč (po uložení
   nemenný — kanály sa naň odkazujú), Názov + pole pre každý ďalší vstup
   nástroja; vždy jeden voľný riadok, bez JS. Možné hodnoty polí v
   poradí: enum z inputSchema → Select; „Nástroj s možnosťami" (nový
   nepovinný Select, Sportnet: list-documentation-filters, načítaný pri
   pripojení); začiatky adries z resources/list; hodnoty nájdené vo
   Vyskúšať hľadanie; inak voľné pole s nápovedou z description. Vždy
   sa dá napísať vlastná hodnota. Import do knižnice — prepínač povolený,
   keď server ponúka resources alebo to vie profil, inak vypnutý
   s „Server nesprístupňuje dokumenty". Redukcia: Zahodiť sekcie a
   Vynechať cesty ako zoznamy riadkov s odstránením (+ voľný riadok);
   Vzory v texte ako hotové vzory .select-row (e-mail, telefón, IBAN,
   rodné číslo) + riadky vlastných regulárnych výrazov; poznámka, že
   obsah s annotations.audience len pre AI sa vynechá sám.
Q7 Vyskúšať hľadanie (sekcia medzi Nástrojmi a Použitiami, keď je živý
   zdroj zapnutý): formulár GET — otázka, voliteľne rozsah, tiché
   „Vyskúšať" → ?try=…#try, výsledok vykreslí server. Volá sa len na
   stlačenie. Výsledok: vrátené články (názov, cesta, skupina, dĺžka,
   prvé riadky už po redukcii). Pod ním návrhy ako .select-row: nadpisy
   s početnosťou („Key files · 12×") → Zahodiť sekcie; spoločné časti
   ciest → Vynechať cesty; nájdené hodnoty filtrov → Rozsahy. Tiché
   „Pridať do redukcie". Chyba servera .lnote--bad, prázdny výsledok
   .empty.
Q5 pásik .lnote: Pripojený --info (kto, kedy, osobný účet, tiché
   „Pripojiť znova", plné je Uložiť); Nepripojený/Odpojený --warn s
   plným „Pripojiť" (Uložiť tiché); Chyba --bad s textom a plným
   „Pripojiť znova".
Q6 prehľad: page-head „Konektory", úvod jedna veta, riadok a.form-row
   (ikona, názov, pod ním adresa · verzia; vpravo štítky použití, stavu,
   počet nástrojov); prázdny stav .empty s odkazom na ?new=1.

Pravidlá: najviac jedno plné .button na obrazovke, otvorená úloha ho
preberá; nič podstatné v <details> (výnimka Pokročilé prihlásenie);
potvrdenie odstránenia v adrese; tajomstvá nikdy na obrazovke (len
„nastavené"); popisy nástrojov a instructions sú dáta zo servera
(neprekladať, len orezať); stránka bez JavaScriptu; mobile first, zlomy
640 a 1024; terč 44 px; svetlá aj tmavá téma; Apple HIG (Form + Section,
List). Nenavrhuj katalóg MCP Registry, posledné volania ani konektor na
osobu.

Rámy: 1440 svetlá — prehľad (Sportnet pripojený, Všeobecný server v
chybe), celý detail Sportnetu (O serveri, 7 nástrojov so štítkami,
Použitia s profilom), Vyskúšať hľadanie „prestup hráča" s 3 výsledkami
a návrhmi (Key files 12×, Data 9×, Overview 3×; cesta -rules-; projekty
issf, sutaze). 390 tmavá — prehľad, ?new=1 so zbaleným aj rozbaleným
Pokročilým prihlásením, detail nepripojeného neznámeho servera,
Použitia neznámeho servera s výberom nástroja a 2 riadkami rozsahov
(jedno pole s ponúkanými hodnotami, jedno voľné), Vyskúšať hľadanie
s chybou servera, Ďalšie akcie s potvrdením odstránenia.

Nástroje Sportnetu na rámy: list-documentation-filters,
search-sportnet-documentation (vstupy query, project, category, tags,
limit), get-documentation-file, generate-sportnet-documentation,
generate-user-manual, publish-user-manual, whoami.

Výstup ako doteraz: ORG-konektory.html + .md so sekciami Čo sa mení, Kde,
Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli neexistujú,
Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá) a Prompt pre
Claude Code.
```
