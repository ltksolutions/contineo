# Rozdiel medzi návrhom a implementáciou

> Prvý zápis 2026-09-08, prerátané proti kódu **2026-09-11**. Zoznam je indícia;
> pravdou je kód a `git log`. Kde sa to od 8. 9. zmenilo, je to napísané pri tom
> mieste — nie prepísané tak, aby to vyzeralo, že to tak bolo vždy.

Zápis vznikol po tom, čo Ján Letko postavil vedľa seba návrh a produkciu a povedal,
že „hlavička nie je ok, nič nie je ok". **Mal pravdu.** Tento súbor je zoznam
rozdielov overený v kóde, nie z pamäte, a plán, čo s tým.

## Prečo to moje overenie nezachytilo

Toto je dôležitejšie než samotný zoznam, lebo to je príčina.

**Overoval som proti sebe.** Skúšobné strany (`unified.html`, `polish.html`,
`pick.html`…) som napísal sám z toho, ako som si návrh prečítal, a potom som
porovnával snímky **tých strán** s CSS. Dvadsať renderov zhodných na pixel
dokazuje jedinú vec: že premenovanie tried nič nezmenilo. **Nedokazuje, že to,
čo som napísal, je návrh.** Kruhové overenie — a znie presvedčivo, čo je na ňom
najhoršie.

**Odškrtával som si vlastné odškrtnutia.** Krok som označil v `TODO.md` za hotový
a od tej chvíle som veril tomu zápisu namiesto obrázka. Pri kroku 7 som napísal
„tým je dizajnový balík prejdený celý" — to bolo nepravdivé tvrdenie.

**A na tom istom predpoklade som zmazal handoff** vrátane dvoch kanvasov
`.dc.html`, ktoré **sú** ten návrh. Odôvodnenie „všetko podstatné je v `docs/`"
stálo na presvedčení, že implementácia návrhu odpovedá. Nestála. Poradie bolo
obrátené: najprv som mal porovnať obrazovku s obrazovkou, až potom mazať.

## Čo som mal nesprávne aj v prvej verzii tohto zápisu

Prvá verzia stála na siedmich snímkach. Po prečítaní `docs/design/README.md`
(40 kB zadania, nie obrázky) padli dve moje tvrdenia:

- **„Predvolený variant navigácie je bočný panel."** Nie je. README hovorí
  doslova „implementovať oba, default `topbar`". Topbar ako predvolený je
  správne a bol správne od začiatku. (Zavádzalo ma, že kanvas má `sideNav`
  ako placeholder — to je nastavenie prototypu, nie zadanie.)
- **„‚Posledný dokument‘ je artefakt prototypu."** Nie je. Je to riadok
  v tabuľke položiek navigácie so kľúčom `doc`. Zámerné. Route preň síce
  nemáme, ale je to vec na rozhodnutie, nie vec na vyhodenie.

Držím si z toho poučenie: **obrázok nie je zadanie.** Zadanie je README, ktoré
má pri každej obrazovke rozmery, stavy a dôvody.

## Zoznam rozdielov

Overené proti `docs/design/README.md` a `docs/design/Contineo Intranet.dc.html`.

### Hlavička — najviditeľnejší rozdiel

| návrh | dnes |
|---|---|
| logo tenanta 26×26, `radius 7px`, iniciála ako fallback | ✓ |
| **celý názov organizácie** `13.5px/600`, elipsa pri `max-width: 30vw` | skratka „SFZ" |
| **prepínač organizácie** — názov je tlačidlo, dropdown 280 px so zoznamom organizácií (dlaždica, názov, doména, ✓) a odkazom „Nastavenia organizácie…" | nie je |
| **globálne hľadanie** `flex: 1 1 240px`, výška 32, ikona `⌕`, placeholder „Opýtajte sa svojich dokumentov…  ⌘K", fokus `0 0 0 3px var(--accent-soft)`, **fokus naviguje na „Opýtať sa"** | nie je |
| **zvonček upozornení** 30×30 + bodka `6×6` v `--bad-fg` | nie je |
| avatar 28×28 s iniciálami | ✓ |
| hlavička `min-height: 52px`, `padding: 8px 14px`, **`flex-wrap: wrap`** | `height: 56px` **napevno, bez zalamovania** |
| (v návrhu avatar = odhlásenie) | avatar = osobné menu s témou, nastaveniami a odhlásením — **naše je lepšie, nechávam** |

Zalamovanie je odpoveď návrhu na úzku obrazovku: hlavička sa zlomí do dvoch
riadkov. Naša má výšku napevno, takže sa zlomiť nemôže a hľadanie by sa do nej
nezmestilo.

### Navigácia

| návrh | dnes |
|---|---|
| Prehľad **6** · Knižnica **148** · Opýtať sa · Nahrávanie **3** · Posledný dokument · Nastavenia | Voľné otázky · Na potvrdenie · Knižnica · Pridelené normy · Osoby · Zlatá sada |
| **počty pri položkách** | žiadne |
| ikony pri položkách | žiadne |

Na telefóne je pás `overflow-x: auto` bez náznaku, že sa dá posúvať —
posledná položka je odseknutá v polovici slova („Pridelené no…").

**Oprava môjho tvrdenia:** nazval som to chybou implementácie. Nie je. Kanvas
má v topbare presne to isté `overflow-x: auto` a odseknutú položku — overené
vykreslením návrhu, nie čítaním. Návrh to rieši inde: krok 7 handoffu žiada
**mobilnú zásuvku** („drawer + karty + 44 px hit targety"). Takže to je
neurobená položka návrhu, nie odchýlka od neho. Na výsledku to nič nemení —
odseknuté slovo na telefóne zostáva —, ale je rozdiel medzi „pokazili sme to"
a „nedošli sme k tomu".

Predvolený variant je **topbar** — to máme správne. Bočný panel je druhý
variant a v ňom navyše pribúda sekcia „Uložené pohľady" a dole karta
upozornenia; v topbare uložené pohľady patria do ľavého panelu Knižnice.

Dve veci na rozhodnutie, nie na slepé prevzatie:

1. **Zoznam položiek.** Návrh má Prehľad · Knižnica · Opýtať sa · Nahrávanie ·
   Posledný dokument · Nastavenia. Naša navigácia je podmienená rolami zámerne
   (D32) a „Posledný dokument" ako route neexistuje. Prevziať treba **počty,
   ikony a chovanie na telefóne**; pri zozname sa treba dohodnúť.
2. **Ikony.** README výslovne: „nahradiť ikonovým setom projektu (SVG,
   `currentColor`, 16 px). **Nekresliť nové SVG od ruky.**" Projekt ikonový set
   **nemá** — máme len jednotlivé ručne kreslené ikony v `Header.tsx`. Buď sa
   vyberie set (a to je rozhodnutie o závislosti), alebo navigácia zostane bez
   ikon. Kresliť šesť vlastných by bolo presne to, čo README zakazuje.

### Prehľad (dashboard) — ✅ **hotové 2026-09-11**

Návrh má prvú obrazovku „Prehľad": oslovenie, pole na otázku s tromi príkladmi,
**štyri dlaždice** (Na potvrdenie 6 · Čaká na schválenie 3 · Nové za 7 dní 12 ·
Expiruje do 30 dní 2), zoznam **„Vyžaduje vašu pozornosť"** s termínom a
tlačidlom na každom riadku, a **„Novinky v knižnici"** so štítkami stavu.

**Toto už neplatí.** Prehľad je od 2026-09-11 na `/` (obrazovka otázok sa presťahovala
na `/ask`, `/prehlad` trvalo presmeruje na `/`). Má hero s otázkou a tromi príkladmi,
štyri dlaždice, zoznam „Vyžaduje vašu pozornosť" s termínovým chipom a tlačidlom na
riadku, a „Novinky v knižnici". Overené na produkcii pri 390 px.

Dve vecné odchýlky od návrhu, obe napísané v kóde pri tom mieste:
dlaždica „Čaká na schválenie" počíta kolá, ktoré čakajú na **prihláseného človeka**,
nie na celú organizáciu; a „Nové" počíta `publishedAt` **znenia**, nie `updatedAt`
dokumentu (oprava preklepu v názve nie je novinka v knižnici).

### Knižnica

Hotové: facety s počtami, prepínač Tabuľka/Karty, query builder, stránkovanie,
výber prežívajúci stránkovanie.

Chýba: **hľadanie vo filtroch**, facet **Útvar/Stredisko**, facet
**Autor/Schvaľovateľ**, **Export CSV**, **Uložiť pohľad**, a v tabuľke stĺpce
**Verzia**, **Platnosť od** a **Útvar** (dnes sú Dokument · Druh · Stav ·
Zmenené). Podnadpis s identifikátorom predpisu (`RPP-2026-04`) pod názvom tiež nie.

### Opýtať sa

Hotové: odpoveď, zdroje ako karty, hodnotenie.

Chýba: **pilulky rozsahu** (Knižnica/Intranet/Verejný web/Archív), **skóre zhody**
pri zdroji (`0,94`), **„Ďalšie zhody v knižnici"** s úryvkami, **„Nahlásiť
nepresnosť"**. Prvé dve sú v `TODO.md` už zapísané ako veci, ktoré by dnes
**predstierali** voľbu a hodnotu, ktorá v systéme nie je — to platí ďalej a
nezmenilo sa to na chybu implementácie. Druhé dve sú skutočne len neurobené.

### Nahrávanie

Návrh má **tri kroky** (Súbor · Metadáta · **Schválenie**), v metadátach
**Priradiť útvarom** a **Schvaľovatelia**, prepínač **Vyžadovať potvrdenie
prečítania** a **Schvaľovaciu cestu**.

Dnes sú **dva** číslované úseky (1 Súbor, 2 Metadáta). Tretí krok, schvaľovatelia
ani schvaľovacia cesta nie sú.

**Dôvod, ktorý tu stál 8. 9., už neplatí.** Vtedy tu bolo napísané, že schvaľovacie
workflow v systéme neexistuje a stavy sú len `draft`/`published`, takže stepper
s tretím krokom by bola atrapa. To bola pravda vtedy; ADR-006 (kolá, menovaní
schvaľovatelia, brána pri prideľovaní) je odvtedy nasadené. **Tretí krok je teda
odblokovaný a zostáva len neurobený** — čo je iný stav a patrí sem tak napísané.
Ten istý komentár stojí aj v `app/src/app/library/new/page.tsx`; pri tej práci ho
treba prepísať, lebo dnes tvrdí nepravdu.

### Detail dokumentu

Hotové: percento potvrdení s pruhom, prehľad metadát, chips v hlavičke.

Chýba: **záložky Obsah | Zmeny | Citované časti | Audit** (dnes žiadne),
**rámik „Zmena oproti v4.1"**, odkaz **„Kto nepotvrdil →"**, **Súvisiace
predpisy**, zoznam **Verzie a schválenie** so stavom Aktuálna/Archív, a tlačidlá
**Nová verzia** / **Stiahnuť PDF** v hlavičke detailu.

### Nastavenia organizácie

Hotové: paleta, vlastná hodnota, živý náhľad, logo aj jeho odstránenie.

Chýba: tabuľka **„Organizácie v systéme"** (organizácia · domény · osoby ·
dokumenty · farba) s „Pridať organizáciu". Domény dnes existujú, ale ako zoznam
v samostatnej záložke, nie ako tento prehľad naprieč organizáciami s počtami.

## Plán

Rozdelený podľa toho, čo dnešné dáta unesú — nie podľa toho, čo je na obrázku
najkrikľavejšie.

### A — dá sa postaviť na dnešných dátach

Poradie je podľa toho, čo človek vidí najskôr.

1. ~~**Hlavička**~~ ✅ **hotové** (`feat/design-header`) — celý názov organizácie
   (13.5 px/600, elipsa na 30 vw), globálne pole (`flex: 1 1 240px`, 32 px,
   ikona, fokusový prstenec z `--accent-soft`), zalamovanie hlavičky namiesto
   pevnej výšky, veľkosť položiek navigácie 13 px a aktívna záložka
   **podčiarknutím** v páse / dlaždicou v bočnom paneli.
   Merané, nie odhadnuté: názov 13.5 px/600 a šírka 189 px v návrhu aj u nás,
   pole 13 px/32 px v oboch, hlavička 52 vs 53 px (rozdiel je obrys).
   Vedomá odchýlka: položka navigácie má 44 px na výšku namiesto 35 px
   z prototypu — krok 7 handoffu žiada 44 px terče na dotyk.
   **Skratka na telefóne, celý názov na desktope** — rozhodnutie Jána Letka
   a odchýlka od návrhu (ten skracuje elipsou v oboch). Dôvod: elipsu
   („Slovenský fut…") človek neprečíta, skratku áno, a na 390 px zožral názov
   celý prvý riadok. Prepína to `@media`, nie JavaScript, takže sa po pripojení
   nič nepreskočí.
   Pole má na telefóne **vlastný riadok** (`order` + `flex-basis: 100%`).
   Prvý pokus zmenšoval jeho základ tak, aby sa všetko zmestilo do jedného
   riadka; pri 390 px to vyšlo, pri 320 px nie — a hlavne to záviselo od dĺžky
   skratky tenanta. Overené na 320 / 360 / 390 / 759 px: hlavička 81 px,
   avatar pri pravom okraji prvého riadka, pole celé v druhom.
   **Zámerne bez:** zvončeka upozornení a počtov pri položkách (obe potrebujú
   ten istý dotaz, robia sa spolu v bode 2). `⌘K` funguje ako skratka, ale nie
   je v placeholderi — ukázať „⌘K" človeku na Windows by bola nepravda.
2. ~~**Počty pri položkách + zvonček + mobilná zásuvka**~~ ✅ **hotové 2026-09-12** (`feat/nav-counts-drawer`) — okrem zvončeka, ktorý sa vedome nerobil: systém nemá čo oznamovať a bodka by bola tretia cesta k tomu istému číslu. Pôvodný zámer — jedno PR, lebo počet
   nepotvrdených je ten istý dotaz pre badge aj pre bodku na zvončeku. Platiť sa
   má raz: obaliť `hrContext()`/`libraryContext()`/`peopleContext()` do `cache()`
   z Reactu (už zapísané v `TODO.md`) a pridať jeden `countDocuments`.
   Zásuvka namiesto rolovacieho pásu na telefóne — krok 7 handoffu.

3. **Prepínač organizácie** — ✅ *rozhodnuté (Ján Letko)*: ukázať ho **len
   tomu, kto má prístup do viac než jednej organizácie**. Pre bežnú osobu SFZ
   je dropdown s jedinou položkou horší než obyčajný text. Znamená to spočítať
   organizácie, do ktorých človek smie, takže to ide spolu s bodom 2 — je to
   ten istý druh dotazu. Prepnutie mení názov **aj hlavnú farbu** (`--accent`
   z `branding.accentColor`), presne ako to už robí `tenantStyle()`.
4. ~~**Prehľad** ako nová obrazovka~~ ✅ **hotové** (`feat/prehlad`, `feat/front-door`): dlaždice a zoznam „Vyžaduje vašu pozornosť"
   sa dajú spočítať z `duties()` v `hrReport.ts` a z `documents` — teda z toho
   istého zdroja ako výkaz, nie z druhej kópie pravidiel.
   ✅ *rozhodnuté (Ján Letko) 8. 9.*: dlaždica „Čaká na schválenie" sa nahradí
   **„Koncepty"**, lebo workflow neexistuje. **Rozhodnutie sa medzitým stalo
   bezpredmetným** — ADR-006 je nasadené, takže dlaždica ukazuje skutočné kolá
   čakajúce na prihláseného človeka. Presne to, čo rozhodnutie predpokladalo:
   význam existujúcej dlaždice sa neprepisoval, len prestal byť prázdny.

   **Čo z Prehľadu dnešné dáta unesú** (overené v kóde, nie odhadnuté):

   | prvok návrhu | zdroj | stav |
   |---|---|---|
   | pole na otázku + tri príklady | `Search`, `t.ask` | ✅ existuje |
   | dlaždica „Na potvrdenie" | `pendingForPerson()` → `total` | ✅ existuje, už sa volá na `/` |
   | dlaždica „Koncepty" | `documents.status = draft` | ✅ dopočítateľné |
   | dlaždica „Nové za 7 dní" | `documents.updatedAt` | ✅ dopočítateľné |
   | dlaždica „Expiruje do 30 dní" | `versions.effectiveTo` | ✅ pole existuje (D6) |
   | zoznam „Vyžaduje vašu pozornosť" | `pendingForPerson()` → `items` | ✅ existuje (názov, meta, „nové" podľa D39) |
   | **termínový chip „do 12. 9."** | — | ❌ **v dátach nie je** |
   | „Novinky v knižnici" so štítkom stavu | `documents` + `status` | ✅ dopočítateľné |

### ~~❌ Blokuje Prehľad: termín potvrdenia v dátach neexistuje~~ — ✅ vyriešené (ADR-004)

Návrh má pri každom riadku „Vyžaduje vašu pozornosť" termín (`do 12. 9.`) a
farbí ho podľa toho, ako je blízko (do 7 dní `--bad-*`, do 30 dní `--warn-*`).
**Také pole v systéme nie je.** Prehľadané: `PendingItem` nesie `assignedAt`,
nie termín; `assignments` termín nemá; jediné číslo v okolí je prah pripomienok
`DEFAULT_DAYS = 14`, a to je spúšťač e-mailu, nie termín daný človeku.

Toto je presne ten druh veci, na ktorom som sa už raz sekol pri schvaľovacom
workflowe — preto to nedomýšľam. Tri možnosti:

1. **Zatiaľ bez termínu** (odporúčam pre teraz) — chip ukáže, ako dlho vec
   čaká („čaká 5 dní"), čo je pravda, ktorú vieme dnes. Prehľad sa dá postaviť
   hneď a nič sa netvári.
2. **Termín = `assignedAt` + prah pripomienok** — lacné, ale znamená, že
   z interného spúšťača e-mailu sa stane sľub daný človeku. Kto potvrdí na
   15. deň, bol „po termíne", hoci mu nikto termín nedal.
3. **`dueAt` na pridelení** (odporúčam ako cieľ) — HR určí termín pri
   prideľovaní, teda tam, kde už dnes povinne zadáva dôvod (D30) a platnosť
   (D6). Je to **zmena schémy**, takže podľa dohody až s tvojím súhlasom.
   Pri trasách treba doriešiť, či termín plynie od príchodu osoby.

**Rozhodlo sa pre možnosť 3 a je nasadená** (ADR-004, D61–D63): `assignments.due`
existuje, termín zadáva HR pri prideľovaní a Prehľad ním farbí chip na riadku.
Prah pripomienok zostal tým, čím bol — spúšťačom e-mailu, nie termínom daným
človeku.

5. **Knižnica** — ✅ *hotové 2026-09-12*: stĺpec **Platnosť od** a **Export CSV**
   (`/library/csv`, tá istá cesta ako obrazovka). Stĺpec s verziou a identifikátor pod
   názvom **boli hotové už predtým** a tento zápis o tom nevedel — overené v kóde
   2026-09-12, nie prevzaté z pamäte.
   ❌ *zostáva*: **hľadanie vo filtroch** a **Uložiť pohľad**.
6. **Detail**: záložky Obsah | Zmeny | Audit, „Kto nepotvrdil →" (výkaz to už
   vie), Súvisiace predpisy, zoznam verzií so stavom. „Citované časti" až keď
   bude čo citovať.
7. **Nastavenia**: tabuľka organizácií s počtami.

### B — najprv rozhodnutie, potom kód

- ~~**Schvaľovací workflow**~~ ✅ **rozhodnuté a nasadené** (ADR-006): kolá,
  menovaní schvaľovatelia (D69), jedno zamietnutie zastaví kolo (D71), brána pri
  prideľovaní (D73), obrazovka `/approvals`, hodnoty schvaľovania vo facete Stav.
  Bolo to naozaj nová dimenzia v modeli, nie prílepok. **Zostáva z toho grafika:**
  krok 3 nahrávania a zoznam „Verzie a schválenie" v detaile dokumentu.
- **Facet a stĺpec Útvar** — dokument útvar nenesie; už zapísané v `TODO.md`.
- **Pilulky rozsahu a skóre zhody** — už zapísané; bez rozhodnutia, čo tie
  rozsahy sú, by predstierali voľbu.

### Riziká

- Bod 3 (Prehľad) je nová obrazovka, nie úprava — najväčší kus a jediný, kde sa
  dá znova odchýliť od návrhu. Preto sa robí **proti obrázku**, nie proti mojej
  predstave, a snímka ide na porovnanie skôr, než sa merguje.
- Bod 1 mení hlavičku, ktorú vidí každá obrazovka — regresia je viditeľná všade.
- Poučenie z tohto zápisu: **žiadna moja skúšobná strana už neplatí ako
  overenie.** Overením je snímka z produkcie alebo z náhľadu postavená vedľa
  obrázka návrhu.

## Kde návrh teraz žije

`docs/design/` — `README.md` (zadanie s rozmermi a dôvodmi), `Contineo
Intranet.dc.html` (všetkých 7 obrazoviek, oba varianty navigácie, dáta ukážky),
`MultiSelect.dc.html`, `github.md` (mapa obrazovka → súbor) a `support.js`
(runtime prototypu, **do produkcie nepatrí**).

Je to v repozitári zámerne, hoci to je vstup a nie kód: raz som ho zmazal
s odôvodnením „všetko podstatné je v `docs/`" a mýlil som sa. Verzovaný vstup
sa nedá stratiť ani prekrútiť spamäti.

Kanvas sa otvára v prehliadači a je klikateľný; variant navigácie a hustotu
prepína panel Tweaks.
