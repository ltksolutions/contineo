# Ťažba FAQ z histórie schránky helpdesku — podklad a otázky pre DPO

> **Čo to je:** podklad k rozhodnutiu, či a za akých podmienok smie Contineo
> z doterajších e-mailov v schránke `helpdesk@futbalsfz.sk` pripraviť návrhy
> otázok a odpovedí (FAQ). Na konci je 10 otázok. Pri každej sú očíslované
> možnosti, prvá je náš návrh. Do riadku „Odpoveď“ stačí napísať číslo,
> prípadne vlastný text.
> **Čo to nie je:** právne stanovisko. Návrhy sú podklad z pohľadu IT.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 9. 10. 2026 · **Odpovede prosíme do:** ____________
> **Súvisiace:** ADR-030 (postup v troch krokoch), ADR-028 D165 (ťažba
> histórie), `docs/C2_zaznam_o_spracovatelskych_cinnostiach.md`,
> `docs/C3_DPIA_predbezne_posudenie.md`, časť Helpdesk na `/privacy`.

---

## Odpovede DPO (prijaté 9. 10. 2026)

Odpovede zapísal do dokumentu **Ján Letko, ktorý je zodpovednou osobou
(DPO) zväzu** a zároveň za IT pripravil tento podklad; doplnil v chate
9. 10. 2026: „ja som ich zapísal, ja som tiež DPO", k otázke 2
„pseudonymizácia podľa kap. 2".

| # | Odpoveď | Čo s tým systém robí |
|---|---|---|
| 1 | 1 — oprávnený záujem s testom zlučiteľnosti účelu (čl. 6 ods. 4) | test zlučiteľnosti spíše DPO; podklady sú v kap. 3 |
| 2 | **„komplet analýza s anonymizáciou osobných údajov"** — namiesto pilota celé obdobie; spresnené: **pseudonymizácia podľa kap. 2** (pravidlá + pokyn modelu + kurátor) | ťažba ide nad celými 36 mesiacmi (ADR-030 D183); pilot sa vynecháva |
| 3 | 1 — Anthropic za rovnakých podmienok ako odpovede asistenta | záruky pre prenos sa doplnia v C4 |
| 4 | 1 — Voyage AI smie | **nepoužije sa** — témy priraďuje model bez ukladania textu (ADR-030 D184), teda menej spracúvania, než bolo schválené |
| 5 | 1 — pôvod návrhu držať do rozhodnutia kurátora, potom zmazať | pri schválení, zlúčení aj zamietnutí sa zmažú identifikátory vlákien a správ; ostáva počet a obdobie (D185) |
| 6 | **3 — DPIA netreba** | C3 sa nemení |
| 7 | 1 — veta na `/privacy` | doplnené 9. 10. 2026 (verzia textu 9. 10. 2026) |
| 8 | 1 — činnosť 5 „Helpdesk" v C2, text pripraví IT | doplnené v C2 9. 10. 2026 |
| 9 | 1 — opatrenia z kap. 2 pri maloletých | bez ďalšieho vylúčenia |
| 10 | 1 — kto namietne, jeho e-maily sa z ťažby vylúčia | zoznam vylúčených adries pri kanáli (odtlačok adresy, nie adresa), D186 |

**Poznámka k otázke 2:** v kap. 3 sa celý archív označoval ako rozsiahle
spracúvanie, o ktorom sa rozhodne po pilote. Odpoveďou 2 a 6 DPO rozhodol
hneď o celom archíve bez DPIA.

---

## 1. O čo ide

Helpdesk zväzu odpovedá e-mailom na otázky klubov, hráčov, rodičov,
rozhodcov a funkcionárov — najčastejšie k ISSF. Rovnaké otázky sa opakujú
roky. Chceme z doterajších odpovedí pripraviť **všeobecné FAQ bez osobných
údajov**, ktoré potom asistent použije pri odpovediach a ktoré sa zobrazí
aj v okne pomoci v ISSF. Každý záznam FAQ pred zverejnením prečíta, opraví
a schváli **správca obsahu** (kurátor).

Postup má tri kroky (ADR-030):

| Krok | Čo sa robí | Stav |
|---|---|---|
| 1. Analýza bez zápisu | z hlavičiek e-mailov (dátum, vlákno, odosielateľ, predmet) sa spočíta, koľko otázok prišlo a o čom zhruba boli; telá sa nečítajú, umelej inteligencii nič neodchádza; ukladá sa len mesačný súhrn bez adries a mien | **beží od 8. 10. 2026** — nepredstavuje nové spracúvanie oproti bežnej synchronizácii schránky |
| 2. Pilot | 2 témy za posledných 12 mesiacov → návrhy FAQ pre kurátora | **čaká na tento súhlas** |
| 3. Archív po témach | ďalšie témy a obdobia podľa výsledku pilota | samostatne po vyhodnotení pilota |

**Čo už vieme z kroku 1** (september 2024 – september 2026): 3 423 otázok
zvonku, 74 % s odpoveďou. Najčastejšie témy podľa predmetu: registračný
preukaz v ISSF (~320), predĺženie licencie (~220), obnova hesla v ISSF
(~190), zamietnutie žiadosti v ISSF (~180), výzva na úhradu členskej
faktúry (~130).

## 2. Čo presne sa v pilote deje s údajmi

**Výber vlákien.** Len vlákna z posledných 12 mesiacov, ktorých predmet
zodpovedá dvom témam pilota: **obnova hesla v ISSF** a **predĺženie
licencie**. Odhad: 150–300 vlákien. Ostatné e-maily sa nečítajú.

**Čo sa prečíta.** Prvá správa vlákna (otázka) a odpovede helpdesku.
Citovaná staršia korešpondencia sa odreže. **Prílohy sa nečítajú** (len
názov a veľkosť, D163).

**Očistenie pred odoslaním.** Z textu sa pravidlami odstránia e-mailové
adresy, telefónne čísla, rodné čísla, čísla účtov (IBAN) a odkazy.
**Pravidlá nechytia mená, názvy klubov a kratšie čísla** (napríklad
registračné číslo). Preto:
- pokyn modelu zakazuje uvádzať mená, adresy, čísla a kluby a vyžaduje
  všeobecný tvar („hráč“, „klub“, „rodič“);
- pred pilotom rozšírime pravidlo aj na čísla od 6 číslic (registračné
  čísla ISSF);
- každý návrh pred zverejnením prečíta kurátor (bod „Kurátor“).

**Komu to ide.** Očistený text ide modelu **Anthropic** (Claude) —
rovnaký sprostredkovateľ, ktorý už dnes tvorí odpovede asistenta; podľa
C2 kap. 4 bez uchovávania a bez trénovania, záruky pre prenos do USA sa
dopĺňajú podľa zmluvy (C4). Na **zoskupenie rovnakých otázok** sa očistená
otázka prevedie na vektor cez **Voyage AI** (cez MongoDB) — rovnaký
sprostredkovateľ ako pri vyhľadávaní v knižnici, trénovanie vypnuté.

**Čo sa uloží.**
- Návrh záznamu FAQ: otázka, varianty otázky, odpoveď, komu je určená,
  počet vlákien a obdobie. **Bez osobných údajov.**
- Pôvod návrhu: identifikátory vlákien a správ v schránke (`messageId`),
  z ktorých vznikol. Sú to technické označenia; text e-mailu ani adresu
  neobsahujú, ale **dovolia dohľadať pôvodný e-mail v schránke**. Otázka 5
  sa týka toho, ako dlho ich držať.
- **Telá e-mailov sa neukladajú** — prečítajú sa, spracujú a zabudnú.
  E-maily ďalej ostávajú len v schránke zväzu v Microsoft 365, ako doteraz.

**Kurátor.** Správca obsahu vidí len návrh záznamu, nie pôvodné e-maily.
Návrh schváli, opraví, zlúči s iným alebo zamietne. Až schválený záznam
sa stane súčasťou FAQ a môže sa zobraziť navonok (okno pomoci v ISSF).

**Spotreba.** Volania modelu sa evidujú pod účelom „Ťažba FAQ“ bez znenia
textu (D158).

## 3. Prečo si myslíme, že je to v poriadku — a kde sú riziká

- **Nový účel.** Text na `/privacy` uvádza ako účel helpdesku „vybaviť
  otázku, ktorú ste sami položili“. FAQ je iný účel — preto je potrebný
  test zlučiteľnosti (čl. 6 ods. 4 GDPR). Argumenty za: úzka súvislosť
  (ide o tie isté otázky, z ktorých má osoh ďalší člen s rovnakým
  problémom), rozumné očakávanie (zväz sa učí z vlastnej podpory), výsledok
  bez osobných údajov, pseudonymizácia pred odoslaním, ľudská kontrola.
  Časť helpdesku na `/privacy` už dnes hovorí, že z histórie schránky
  môže vzniknúť FAQ a že osobné údaje sa pred spracovaním odstraňujú.
- **Maloletí.** V schránke sú otázky rodičov a klubov o registrácii
  maloletých hráčov. Technicky ich vlákna spoľahlivo oddeliť nevieme. Témy
  pilota (heslo, licencia) sa maloletých týkajú zriedka; pri registrácii
  hráča (krok 3) to bude inak.
- **Zvyškové riziko.** Meno, ktoré pravidlo neodstráni, prejde k modelu.
  Do výsledku sa dostane, len keby ho model porušením pokynu prepísal do
  návrhu a kurátor ho prehliadol.
- **Rozsah.** Pilot je malý a ohraničený (2 témy, 12 mesiacov). Celý
  archív (krok 3) by bol rozsiahle spracúvanie — o ňom rozhodneme po
  pilote, s jeho číslami.

## 4. Otázky

**1. Právny základ ťažby FAQ**
1. oprávnený záujem (čl. 6 ods. 1 písm. f) s testom zlučiteľnosti účelu podľa čl. 6 ods. 4 — test spíše DPO, podklady sú v kap. 3 (návrh)
2. oprávnený záujem bez samostatného testu — stačí balančný test helpdesku
3. iný základ: ____________

Odpoveď: ____________

**2. Rozsah pilota**
1. 2 témy (obnova hesla v ISSF, predĺženie licencie), posledných 12 mesiacov, výber podľa predmetu (návrh)
2. iné témy alebo obdobie: ____________
3. pilot nepovoľujem

Odpoveď: ____________

**3. Odoslanie očisteného textu modelu Anthropic (USA)**
1. súhlasím za rovnakých podmienok ako pri odpovediach asistenta; záruky pre prenos sa doplnia v C4 (návrh)
2. súhlasím až po doplnení záruk v C4
3. nesúhlasím

Odpoveď: ____________

**4. Zoskupenie otázok cez Voyage AI (vektory)**
1. súhlasím — rovnaký sprostredkovateľ ako pri vyhľadávaní, posiela sa len očistená otázka (návrh)
2. nesúhlasím — zoskupovať len podľa predmetu (horšia kvalita, viac duplicít pre kurátora)

Odpoveď: ____________

**5. Pôvod návrhu (identifikátory e-mailov)**
1. držať, kým kurátor o návrhu nerozhodne; potom zmazať a ponechať len počet vlákien a obdobie (návrh)
2. držať rovnako dlho ako tickety (24 mesiacov)
3. neukladať vôbec (kurátor nebude vedieť overiť návrh v schránke)

Odpoveď: ____________

**6. Posúdenie vplyvu (DPIA)**
1. pre pilot stačí doplniť predbežné posúdenie v C3 o túto činnosť; o plnom DPIA rozhodnúť pred krokom 3 (návrh)
2. plné DPIA už pred pilotom
3. DPIA netreba

Odpoveď: ____________

**7. Informovanie dotknutých osôb**
1. veta na `/privacy` v časti Helpdesk stačí; doplníme do nej, že pôvod návrhu sa drží len do rozhodnutia kurátora (návrh)
2. doplniť text: ____________

Odpoveď: ____________

**8. Záznam o spracovateľských činnostiach**
1. doplniť do C2 činnosť 5 „Helpdesk“ vrátane ťažby FAQ — návrh textu pripraví IT (návrh)
2. doplní DPO sám

Odpoveď: ____________

**9. Maloletí**
1. pre pilot súhlasím s opatreniami z kap. 2 (očistenie, pokyn modelu, kurátor); pred krokom 3 sa k nim vrátime (návrh)
2. vlákna týkajúce sa maloletých z ťažby vylúčiť (spoľahlivo sa to nedá — vylúčili by sa celé témy, napr. registrácia hráča)

Odpoveď: ____________

**10. Námietka**
1. kto namietne, toho e-maily (podľa adresy) sa z ťažby vylúčia a jeho podiel na už vytvorených návrhoch sa preverí (návrh)
2. iný postup: ____________

Odpoveď: ____________

---

*Poznámka DPO:* ____________
