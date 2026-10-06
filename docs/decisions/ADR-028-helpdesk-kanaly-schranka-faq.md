# ADR-028 — Helpdesk: kanály, schránka cez adaptér, e-mail ako ticket, FAQ ako druh dokumentu

> **Stav:** prijaté · **Dátum:** 2026-10-06
> **Rozhodol:** Ján Letko (2026-10-06) — k šiestim bodom návrhu „1 áno aj
> IMAP aj Graph, 2 áno e-maily sa stávajú ticketmi, 3–6 ok" a dodatok:
> „takýchto helpdesk kanálov bude viac aj pre iné projekty s iným
> prideleným obsahom".
> **Nadväzuje na:** D11 (helpdesk a kurácia, revízia 2026-09-15), D12 (nikdy
> neodoslať automaticky), D14 (widget s kontextom organizácie), ADR-001
> (adaptéry vyberané konfiguráciou), ADR-011 (PDF je schvaľovaný dokument),
> ADR-022 (ochrana údajov podľa organizácie), ADR-026 (AI ako nastavenie
> organizácie, tajomstvá cez `secrets.ts`), ADR-027 (členenie podľa druhu
> dokumentu), `docs/Contineo_RAG_Projektovy_plan.md` Fáza 4b.
> **Implementácia:** po krokoch v § 4. Krok 2 (FAQ) 6. 10. 2026: druh `faq`
> so stratégiou členenia `entries` v `codelists/category.json`
> (`chunkingStrategyFor()`), `lib/faq.ts` (záznamy, Markdown, úseky, koncept),
> `lib/faqPdf.ts`, vetvy v `publish()`, `reindexVersion()` a `saveMetadata()`,
> obrazovky `/library/new/faq` a `/library/[id]/faq`, kontrola v `check.mjs`.
> Krok 3 (kanál a schránka) 6. 10. 2026: `lib/helpdeskChannels.ts`
> (kolekcia `helpdesk_channels`, tajomstvá cez `secrets.ts`, synchronizácia),
> `lib/mailbox/` (rozhranie a adaptér Graph), `lib/tickets.ts` (vlákno = ticket),
> `lib/faqMining.ts` (D165), `/api/cron/helpdesk-sync`, časť Organizácia →
> Helpdesk, rola `helpdesk` (D167), `searchScope()` zúžený na priečinky (D161),
> postup registrácie v Entra a zúženia v Exchange: `docs/NASADENIE_app.md` § 5.
> Krok 4 (obrazovka riešiteľa) 6. 10. 2026: `/helpdesk` (fronta, prepínač
> pohľadu) a `/helpdesk/[id]` (vlákno, návrh, odoslanie, pridať do FAQ),
> `lib/helpdeskAgents.ts` (brána roly a kanálov), `lib/ticketDraft.ts` (návrh
> odpovede tou istou cestou ako `/api/chat`, bez streamu, len verejný obsah),
> práca s ticketom v `lib/tickets.ts`, položka Helpdesk v navigácii s počtom
> otvorených ticketov.
> Krok 5 (widget a token) 6. 10. 2026: `lib/widgetToken.ts` (HS256, ≤ 15 min),
> `lib/widgetPersons.ts` (osoba z tokenu, `widgetOnly`), `lib/widgetApi.ts`
> (pôvod, CORS, strop, zápis odpovede zo streamu), `lib/chatStream.ts`
> (postup `/api/chat` vytiahnutý pre obe brány), `/api/widget/[kanál]/
> {script,chat,feedback,ticket}`, `lib/widgetScript.ts` (skript v Shadow DOM,
> eskalácia po dvoch negatívnych), návod `docs/WIDGET_ISSF.md`.

---

## 1. Kontext

Prvý zákazník mimo intranetu je **ISSF** (`issf.futbalsfz.sk`, vyvíja
Sportnet): prihlasujú sa tam klubové a tímoví manažéri, rozhodcovia,
tréneri, hráči, rodičia maloletých hráčov a komisie. Majú sa pýtať na normy
SFZ a na časté otázky, ktorých odpovede dnes ležia v schránke
**helpdesk@futbalsfz.sk** na Microsoft 365 — v tisícoch mailov a odpovedí
na ne. Keď asistent na druhý či tretí pokus neuspokojí, človek napíše
ticket; riešiteľ z helpdesku dostane návrh odpovede, upraví ho, odošle
e-mailom a systém sa z opravy učí.

Ján 6. 10. 2026 dodal, že **kanálov bude viac** — iné projekty, iné
publikum, iný pridelený obsah. Preto nič z tohto rozhodnutia nie je
„helpdesk SFZ", ale kanál ako entita organizácie.

Čo už existuje a na čo sa stavia:

- kurácia (D11 revízia): overená odpoveď ide do indexu ako úsek so
  `sourceType: "qa"`, pravda o páre je na zázname v `evaluations`
  (`lib/curation.ts`); nové znenie normy pár expiruje;
- hodnotenie odpovede čitateľom (`saveReaderFeedback()` v `lib/ratings.ts`);
- organizácia je daná doménou a prihlásenou osobou, nikdy telom požiadavky
  (D29, D90); rozsah hľadania je zoznam platných znení
  (`searchScope()` v `lib/searchVersions.ts`);
- osoba má `externalRef.sportnetId` (`lib/persons.ts`), zatiaľ nevyplnené;
- Microsoft Graph sa už volá delegovane pre údaje o človeku (`lib/graph.ts`);
- tajomstvá sa šifrujú (`lib/secrets.ts`, ADR-026 D157);
- virtuálne priečinky knižnice s materializovanou cestou `folderPath`
  (`lib/folders.ts`, D56).

## 2. Rozhodnutia

### D161 — Kanál helpdesku je entita organizácie

Kolekcia `helpdesk_channels`. Jeden kanál má:

- `companyCode`, `key` (stabilný, v adrese a v tokene widgetu), názov,
  popis publika;
- **rozsah obsahu:** zoznam priečinkov knižnice (`folderIds`); do hľadania
  idú platné znenia dokumentov, ktorých `folderPath` niektorý z nich
  obsahuje — zúženie `searchScope()`, nie nový index. Kanál bez priečinkov
  vidí celú knižnicu organizácie;
- **schránka** (voliteľná): druh adaptéra `imap` alebo `graph`, nastavenia,
  tajomstvá zašifrované rovnako ako kľúč AI; adresa odosielateľa odpovedí;
- **riešitelia:** osoby s rolou `helpdesk` priradené ku kanálu; ticket vidí
  len riešiteľ svojho kanálu;
- **widget:** tajomstvo na overenie podpísaného tokenu z cudzieho systému
  (D166), povolené pôvody, strop požiadaviek na osobu a hodinu;
- jazyky kanálu (podmnožina jazykov organizácie).

Prečo priečinky a nie štítky či druhy dokumentov: priečinok už je „zaradenie,
ktoré sa dá kedykoľvek zmeniť bez presúvania" a filter nad `folderPath` je
jeden index. FAQ dokumenty kanálu ležia v jeho priečinku, takže rozsah
kanálu a jeho FAQ sú jedno a to isté bez ďalšej väzby.

Tickety aj FAQ sa viažu na kanál. `/api/chat` dostane nepovinný `channel`;
bez neho sa správa ako dnes (intranet = celá knižnica).

### D162 — Schránka cez adaptér: IMAP pre bežné služby, Microsoft Graph pre M365

Rovnaký princíp ako ADR-001: **naše vlastné rozhranie**, nie cudzí drôtový
formát. `lib/mailbox/types.ts` definuje:

- `listNew(cursor)` — nové správy od značky (IMAP: UID > last; Graph: delta
  dotaz), vracia novú značku;
- `fetch(id)` — odosielateľ, adresáti, predmet, čas, text (HTML → text),
  identifikátor vlákna (IMAP: `In-Reply-To`/`References`; Graph:
  `conversationId`), zoznam príloh bez obsahu;
- `sendReply(threadRef, to, subject, text)` — odpoveď vo vlákne z adresy
  kanálu, vráti `messageId`.

**Microsoft Graph** pre M365: aplikačné oprávnenia `Mail.Read` a
`Mail.Send`, **zúžené na schránku kanála** cez RBAC for Applications v Exchange
Online (nahrádza Application Access Policy; oprávnenia sa v Entra
neprideľujú, inak by zúženie neplatilo) — Contineo technicky nevidí inú
poštu organizácie. Prečo nie IMAP na M365:
základné prihlásenie je v Exchange Online vypnuté, IMAP cez OAuth potrebuje
tú istú registráciu v Entra a nedá delta synchronizáciu, vlákna ani
odosielanie.

**IMAP** pre ostatné služby (heslo alebo OAuth2 podľa poskytovateľa) +
SMTP na odpoveď. Prvý skutočný IMAP kanál rozhodne o podrobnostiach
(prvý krok len rozhranie a Graph; IMAP adaptér vznikne so zákazníkom, ktorý
ho má — rovnaký dôvod ako ADR-027 krok 2).

Synchronizácia beží z existujúceho cronu; značka (cursor) je na kanáli.

### D163 — E-mail je ticket; jedna fronta pre oba kanály

Kolekcia `tickets`:

- `companyCode`, `channelKey`, `source: "chat" | "email"`;
- pýtajúci sa: `personId` (ak je známy), e-mail, meno **ako kópia**, roly
  a klub z tokenu (D166);
- priebeh: pri chate odkazy na záznamy v `evaluations` (otázky, odpovede,
  hodnotenia), pri e-maile `threadRef`, `messageId` došlej správy, predmet
  a text;
- stav `new → drafted → sent → closed`, `reopened` pri ďalšej správe vo
  vlákne; `assigneeId`;
- `draft` — návrh odpovede od AI (text, zdroje, model, čas);
- `sentAnswer` — **kópia odoslaného textu** (D24), kto a kedy odoslal,
  `messageId` odoslanej správy; rozdiel oproti návrhu je signál na učenie.

**Nikdy sa neodošle bez kliknutia človeka** (D12). Odpoveď ide cez adaptér
kanálu z adresy kanálu, takže vlákno je aj v schránke. Ticket sa nemaže;
zavretie je stav.

Prílohy došlých správ sa neukladajú (len názov a veľkosť) — môžu byť
doklady maloletých; riešiteľ ich otvorí v schránke.

### D164 — FAQ je druh dokumentu v knižnici

Nový druh dokumentu **FAQ** (číselník Druhy dokumentov), prvý druh, ktorý
sa nečlení po článkoch (ADR-027 krok 2) a prvý, ktorého znenie **nevzniká
z PDF**, ale píše sa v aplikácii.

- Znenie FAQ je zoznam **záznamov**: kanonická otázka, varianty otázky
  (z mailov), odpoveď, zdroje (dokument + `articleRef`), komu je určená
  (roly publika kanálu), jazyk. Záznam je v znení; znenie sa schvaľuje
  a zverejňuje ako každé iné (ADR-006, ADR-014) — správca obsahu.
- **Členenie:** jeden záznam = jeden úsek, `sourceType: "qa"`,
  `derivedFrom` = dokumenty zo zdrojov záznamu. Nové znenie zdrojovej normy
  záznam **expiruje** rovnako ako dnešný kurovaný pár
  (`expireCurationFor()`). Prístupová úroveň záznamu sa **odvodzuje**
  najprísnejšou stranou z úrovne samotného FAQ dokumentu a všetkých jeho
  zdrojov (`entryAccessLevel()` v `lib/faq.ts`); záznam bez zdroja má úroveň
  dokumentu — postup v ISSF nemá článok normy, ale FAQ má nastavenú úroveň.
- **Úsek nesie `faqVersionId`, nie `versionId`** (spresnenie z implementácie
  6. 10. 2026). Vetva „platné znenia" (`versionId` + `superseded: false`) by
  úsek našla aj po expirácii, lebo expirácia mení len `isActive`; vetva
  overených odpovedí `isActive` rešpektuje. Záznam FAQ má tak jednu cestu do
  vyhľadávania — tú istú ako kurovaný pár — a nájde sa pri otázke o dnešku.
- PDF: pri zverejnení sa zo záznamov vykreslí PDF, aby ADR-011 (potvrdzuje
  sa a archivuje PDF) platilo bez výnimky. Potvrdzovanie FAQ sa neočakáva,
  ale výnimka v dátovom modeli by bola drahšia než jedno vykreslenie.
- **Dnešná kurácia z `/evaluation` ostáva**, kým FAQ nebeží. Potom sa
  „zverejniť pár" zmení na „pridať záznam do FAQ kanálu" — pár tak dostane
  vlastníka, schválenie a priečinok. O zlúčení sa rozhodne vtedy, s
  odporúčaním zlúčiť.

### D165 — História schránky sa ťaží do návrhov, surové maily do indexu nejdú

Dávkový beh nad históriou schránky: zoskupenie vlákien podľa podobnosti,
model z nastavenia „Odpovede asistenta" (ADR-026) navrhne zovšeobecnený
záznam FAQ **bez osobných údajov** a s odkazom na článok normy; návrhy
čakajú na schválenie správcom obsahu v rozpracovanom znení FAQ.

- Telá historických mailov sa **neukladajú**; uloží sa odvodený návrh
  a `messageId` vlákien, z ktorých vznikol.
- Telo sa drží len pri **otvorenom tickete** a po zavretí ostáva ako
  dôkaz práce helpdesku s lehotou podľa ADR-022 (organizácia ju nastaví;
  predvolene ako záznamy o spracovateľských činnostiach).
- Spotreba AI pri ťažbe ide pod účel „Ťažba FAQ" bez znenia (D158).

### D166 — Identita z cudzieho systému cez podpísaný token; Contineo dodá widget

Cudzí systém (ISSF) po svojom prihlásení vydá **krátko platný podpísaný
token** (HS256, tajomstvo kanálu; `sub` = externý identifikátor,
e-mail, meno, roly, klub, `exp` do 15 minút). Widget je `<script>` z
Continea (webový komponent vo farbách organizácie, `tenantStyle`), volá
`/api/chat` s tokenom a kľúčom kanálu.

- Token nesie štandardné claimy JWT a OIDC (`iss`, `aud`, `sub`, `email`,
  `given_name`, `family_name`, `iat`, `exp`), nie vlastné názvy — každá
  knižnica ich sama nastaví aj overí (Ján 6. 10. 2026). Navyše nepovinné
  `registrationNumber` (registračné číslo v ISSF pre riešiteľa), `roles`,
  `club`, `lang`.
- Osoba sa spáruje cez `externalRef.widget[kanál]` = `sub` z tokenu
  (generické podľa kanála, nie `sportnetId`) alebo cez **e-mail** —
  zamestnanec s rovnakou adresou si intranet nechá. Inak sa založí
  s druhom **`external`** (D168), ktorý ju nepustí do intranetu
  (`personMaySignIn()`). Vidí `public` úseky z rozsahu kanála.
- Strop požiadaviek na osobu a hodinu je na kanáli (D14).
- Po **dvoch negatívnych hodnoteniach** v rozhovore sa ponúkne ticket;
  e-mail a meno sú z tokenu, človek dopíše len, čo mu chýba.
- Nie iframe s vlastným prihlásením a nie anonymný chat: pri anonymovi
  nemáme e-mail na ticket ani rolu na výber FAQ.

### D168 — Druh osoby: `internal`, `employee`, `external`; rozhodcovia a funkcionári sú skupiny

Rozhodnutie Jána 6. 10. 2026 pri D166. `personType` má tri hodnoty:
`employee` (zamestnanec), `internal` (interný človek, ktorý nie je
zamestnanec: funkcionár, člen komisie) a `external` (človek známy len cez
cudzí systém — widget). **`external` sa do intranetu neprihlási**
(`personMaySignIn()`); import správcom mu druh prepíše a tým ho pustí dnu.
Doterajšie druhy `referee` a `official` sa rušia bez migrácie (v dátach ich
nikto nemal, 155 osôb je `employee`) a nahrádzajú ich **skupiny**
`rozhodcovia` a `funkcionari`, ktoré sú v ponuke vždy (`DEFAULT_GROUPS`):
druh hovorí, kto človek je voči organizácii, skupina komu sa čo posiela.
Zamietnutý príznak `widgetOnly` — druhá klasifikácia vedľa druhu.

### D167 — Rola `helpdesk` je oddelená od správcu obsahu

Odpovedá iný človek, než kto schvaľuje normy. `helpdesk` vidí frontu a
tickety svojich kanálov, odosiela odpovede a navrhuje záznamy do FAQ;
schvaľuje ich správca obsahu (`content-admin`). Pridáva sa do
`ASSIGNABLE_ROLES`.

## 3. Zamietnuté

- **Len IMAP** — na M365 slepá ulička (D162). Ján: ponechať IMAP pre
  bežné služby, pridať Graph.
- **Surové maily ako znalosti** — osobné údaje maloletých, zastarané a
  chybné odpovede v indexe (D165).
- **Samostatná kolekcia FAQ párov** — D11 revízia to už raz odmietla;
  dokument má všetko, čo pár potrebuje (D164).
- **Anonymný verejný chat v ISSF** — bez e-mailu niet ticketu (D166).
- **Jeden helpdesk na organizáciu** — kanálov bude viac (D161).

## 4. Poradie prác

1. Toto ADR.
2. **FAQ ako druh dokumentu** (D164): druh v číselníku, editor záznamov,
   členenie po záznamoch, zverejnenie do indexu, expirácia a prístup
   odvodené zo zdrojov.
3. **Kanál a schránka** (D161, D162): `helpdesk_channels`, nastavenie
   v organizácii, adaptér Graph, cron synchronizácia, ťažba histórie do
   návrhov FAQ (D165).
4. **Tickety a obrazovka `/helpdesk`** (D163, D167): fronta, ticket, návrh
   AI, odoslanie cez adaptér, „pridať do FAQ".
5. **Widget a token** (D166), eskalácia z chatu do ticketu. Posledné —
   závisí od Sportnetu.

Kroky 2 a 3 prinášajú hodnotu aj intranetu bez čakania na ISSF.

## 5. Dôsledky

- Nové kolekcie `helpdesk_channels`, `tickets`; nový druh dokumentu FAQ;
  nová rola `helpdesk` a `external`; nový účel spotreby AI.
- Registrácia aplikácie v Entra (SFZ) s Application Access Policy — úloha
  správcu M365, nie kódu; postup bude v `docs/NASADENIE_app.md`.
- `docs/OPEN_DECISIONS.md` D11: „zostáva otvorené helpdesk" sa uzatvára
  odkazom sem; D14 dostáva dodatok o podpísanom tokene.
- Informovanie dotknutých osôb (ADR-022, `/privacy`): nový účel „helpdesk"
  s lehotou; text doplní DPO.
