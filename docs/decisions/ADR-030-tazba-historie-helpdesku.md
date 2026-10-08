# ADR-030 — Ťažba histórie helpdesku v troch krokoch: analýza bez zápisu, pilot, archív po témach

> **Stav:** prijaté · **Dátum:** 2026-10-08
> **Rozhodol:** Ján Letko (2026-10-08) — „navrhujem sa zamyslieť nad analýzou
> 2–3 roky e-mailov, kde boli otázky a odpovede, pripraviť ich na opravu
> a schválenie kurátorom"; k návrhu troch krokov „áno, rozhodni a začni
> analýzou bez zápisu".
> **Nadväzuje na:** ADR-028 D165 (história schránky sa ťaží do návrhov,
> surové maily do indexu nejdú), D162 (schránka cez adaptér, Graph zúžený na
> schránku kanála), D163 (obsah príloh sa neťahá), D158 (spotreba AI bez
> znenia), ADR-022 (lehoty podľa organizácie), D27 (stav sa odvodzuje).
> **Spresňuje:** D165 — postup pri veľkej histórii, zoskupenie pred modelom,
> zaobchádzanie s protirečivými odpoveďami a poradie pre kurátora.
> **Implementácia:** krok 1 (analýza bez zápisu) — `lib/historyAnalysis.ts`,
> `GraphMailbox.listHeaders()`, `/api/cron/helpdesk-history`, obrazovka
> `/channels/[key]/history`. Kroky 2 a 3 sú otvorené v `docs/TODO.md`.

---

## 1. Kontext

D165 rozhodol, že história schránky helpdesku sa ťaží do návrhov FAQ
a návrhy schvaľuje správca obsahu. Prvá implementácia (`lib/faqMining.ts`,
6. 10. 2026) je stavaná na stovky vlákien:

- číta **posledných N správ** (najviac 2000) jedným behom serverovej akcie;
- vlákna posiela modelu **po 12 bez zoskupenia** — duplicity medzi dávkami
  chytá len doslovná zhoda otázky;
- vlákno, v ktorom si odpovede **protirečia, vynechá**;
- `sources` záznamu je prázdne — odkaz na článok normy, ktorý D165 sľubuje,
  nevzniká;
- všetky návrhy pristanú do **jedného konceptu** FAQ dokumentu.

Schránka `helpdesk@futbalsfz.sk` má za 2–3 roky rádovo desaťtisíce správ.
Pri takom objeme nestačí ani čas behu (Vercel, 60 s), ani zoskupenie, ani
schvaľovanie: 500 návrhov v jednom koncepte nikto neprejde. Za tri roky sa
navyše menili predpisy, poplatky aj obrazovky ISSF — staršia odpoveď môže
byť dnes nesprávna a práve rozpor medzi starou a novou odpoveďou je to, čo
kurátor potrebuje vidieť.

Nevieme pritom základné čísla: koľko je v schránke vlákien, koľko z nich
má odpoveď, aké témy sa opakujú a ako sa menia v čase. Bez nich sa nedá
odhadnúť cena behu modelu ani navrhnúť frontu pre kurátora.

## 2. Rozhodnutie

### D179 — Tri kroky: analýza bez zápisu, pilot, archív po témach

1. **Analýza bez zápisu** nad celým obdobím (predvolene 36 mesiacov):
   počty, témy, početnosť, vývoj v čase. Do FAQ ani do ticketov sa nič
   nezapíše.
2. **Pilot:** jedna až dve najčastejšie témy za posledných 12 mesiacov →
   návrhy do fronty kurátora. Meria sa, koľko záznamov kurátor za hodinu
   reálne schváli.
3. **Archív po témach** podľa výsledku pilota.

Ďalší krok sa začína až po vyhodnotení predchádzajúceho; čísla z kroku 1
idú do rozhodnutia o kroku 2.

### D180 — Analýza číta len hlavičky správ; ukladá sa len mesačný súhrn

Krok 1 **nečíta telá správ** a **nič neposiela modelu**. Z Graphu sa berú
len `receivedDateTime`, `conversationId`, odosielateľ, predmet a priečinok
(`GraphMailbox.listHeaders()`, bez `body`). Dôvod: krok 1 má odpovedať na
„koľko a o čom", na to hlavičky stačia, a analýza tak nerozširuje
spracúvanie oproti synchronizácii, ktorá tie isté hlavičky číta každých
5 minút.

Ukladá sa **jeden dokument na kanál** v kolekcii `mailbox_analyses`
s mesačným súhrnom:

- počet prijatých a odoslaných správ, návratov od poštového servera,
  správ v nevyžiadanej a odstránenej pošte (tie sa nepočítajú do vlákien);
- nové vlákna zvonku, vlákna s odpoveďou helpdesku, medián času do prvej
  odpovede;
- počet rôznych odosielateľov (len číslo) a podiel z vlastnej domény
  organizácie;
- **časté slová a dvojice slov z predmetov**, a to len tie, ktoré sa
  v mesiaci objavili aspoň v **5 vláknach od aspoň 3 rôznych
  odosielateľov**. Predmet sa pred počítaním očistí rovnako ako pri ťažbe
  (`scrubPersonalData`: adresy, čísla, odkazy).

Neukladajú sa adresy, mená, predmety ani identifikátory správ. Prah
5 vlákien / 3 odosielatelia je ochrana pred tým, aby sa do súhrnu dostalo
priezvisko z predmetu („Prestup — Novák") — to sa v jednom mesiaci od troch
rôznych ľudí neopakuje. Súhrn nie je dôkazný záznam (D24): nový beh ho
prepíše.

Analýza beží **po mesiacoch, od najnovšieho**, a mesiac sa číta s presahom
14 dní na obe strany, aby sa odpoveď na otázku z konca mesiaca našla
a vlákno začaté v predchádzajúcom mesiaci sa nepočítalo ako nové. Spustí
ju správca organizácie v nastavení kanála; ďalšie mesiace dopĺňa cron
`/api/cron/helpdesk-history` každých 5 minút, kým nie je hotová. Stav behu
(ďalší mesiac, chyba) je na tom istom dokumente.

### D181 — Pilot (krok 2): zoskupiť pred modelom, rozpor označiť, nevynechať

Spresnenie D165 pre krok 2, implementuje sa až s ním:

- **Pred modelom sa vlákna zoskupia** podľa podobnosti otázky
  (embeddingy z rovnakého poskytovateľa ako knižnica). Model píše **jeden
  záznam za skupinu**, nie za dávku 12 vlákien. Veľkosť skupiny je
  početnosť otázky.
- **Protirečivé odpovede sa nevynechávajú.** Záznam vznikne z najnovšej
  odpovede a nesie príznak „odpovede sa v čase menili" a dátum najstaršej
  a najnovšej odpovede. Pokyn v `MINING_SYSTEM` („záznam nevytváraj") sa
  tým mení.
- Záznam dostane **návrh článku normy** z knižnice kanála; keď sa odpoveď
  s platným znením rozchádza, je to druhý príznak.
- **Pred krokom 2 je potrebný súhlas DPO** s účelom „Ťažba FAQ" v rozsahu
  archívu schránky a zápis do záznamu o spracúvaní. Telá správ (aj očistené)
  pri ňom idú modelu a mená pravidlom očistiť nevieme; súhlas sa
  nezískava dodatočne.

### D182 — Fronta kurátora namiesto jedného konceptu

Návrhy z krokov 2 a 3 nepristanú naraz do konceptu FAQ dokumentu, ale do
**fronty kurátora** (správca obsahu podľa D165):

- poradie podľa početnosti a čerstvosti (koľko vlákien, kedy naposledy);
- úkony **schváliť** (záznam ide do konceptu FAQ a ďalej postupom znenia),
  **opraviť**, **zlúčiť** s iným návrhom, **zamietnuť**;
- pri návrhu je vidieť počet vlákien, obdobie, príznaky z D181 a navrhnutý
  článok normy;
- témy sa môžu rozdeliť do viacerých FAQ dokumentov kanála.

Tvar fronty (nová kolekcia alebo stav záznamu v koncepte) sa rozhodne
s krokom 2, keď budú čísla z kroku 1.

## 3. Dôsledky

- Krok 1 sa dá spustiť hneď: nepotrebuje kľúč AI, nevzniká spotreba
  modelu a nečaká na DPO.
- Analýza beží v produkcii — tajomstvo schránky sa lokálne nedá
  rozšifrovať (`OAUTH_SECRET_ENCRYPTION_KEY` v `.env.local` nie je).
- Témy z predmetov sú hrubé: predmet „Otázka" alebo „RE: info" povie
  málo. Presné témy dá až krok 2 (zoskupenie podľa obsahu). Krok 1 je
  na objem, trend a prvý odhad tém, nie na konečný zoznam.
- `faqMining.ts` ostáva, kým nevznikne krok 2 — na malé dávky ručne.

## 4. Zvažované a zamietnuté

- **Analýza nad telami správ modelom hneď v kroku 1** — presnejšie témy,
  ale znamená poslať modelu celý archív pred súhlasom DPO a bez znalosti
  ceny. Zamietnuté; to je krok 2 v menšom rozsahu.
- **Uložiť hlavičky (alebo predmety) do databázy a analyzovať nad nimi** —
  jednoduchšie dotazy, ale vznikla by kópia archívu s osobnými údajmi bez
  účelu a lehoty. Zamietnuté; ukladá sa len súhrn.
- **Jeden dlhý beh lokálnym skriptom** — tajomstvo schránky je lokálne
  nečitateľné a beh by závisel od Jánovho počítača. Zamietnuté.
