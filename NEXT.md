# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-10-27 večer** (widget ako riadok otázky s plachtou 80 %, históriou, vzormi, prepínačom SK / CZ / EN, posúvaním, úvodným tipom a pätkou s verziou, ADR-042 Dodatok 2, #474–#480, druhá session; zadanie pre vývojára ISSF `docs/ZADANIE_ISSF_WIDGET.md`; predtým: widget kanála ISSF Helpdesk nahrádza formulár Pomoc, ADR-042 kroky 1–5 a Dodatok 1, #463–#471, druhá session; manuály ISSF-00, 02, 03 so zjednoteným zrušením registrácie hráča zverejnené, podnet legislatíve s bodom 5; krúžok v päte karty postupu #470; cesta priečinka po migrácii ADR-034 #472, `check` bez rozporov; Prehľad podľa návrhu PREHLAD-ulohy-a-dokumenty #458; predtým 2026-10-26 večer: Prehľad a detail dokumentu pre bežného používateľa — ADR-041, kroky B → C → A, #449–#452; otázka nad jedným dokumentom `?doc=` D269, #448, druhá session; detail predpisu s celým textom a tlačidlo „Pridať do knižnice" #446, dátum kontroly pri predpise #445; prvé nočné behy cronu katalógu overené, bez konceptov; predtým 2026-10-25 neskoro večer: MCP overený naostro z Claude Desktop aj Claude Code; stropy úsekov `search_library` posuvníkmi v AI asistentoch a nový prvok `.field-range`, #441; smernica o pracovných cestách — zoznamy, poznámky a písmená podľa PDF opravené bez novej verzie; predtým katalóg legislatívy ADR-039 fázy 1–2, #432, #436; register zdrojov ADR-040 kroky 1–3, Organizácia → Zdroje, #433, #434, #437; Zdroje → Web / RSS → Slov-Lex a návod pre zdroje, ADR-040 Dodatok 1, #439; MCP server so zdrojmi a Legislatívou #438 a prihlásenie z Claude Code #440, druhá session; návrat oznamu Legislatívy #435; predtým 2026-10-24 večer: Prehľad spotreby AI #425, #426 — prvý návrh z artefaktu *Design*; Contineo ako MCP server fáza 1, ADR-038, #422, #424; oprava textu znenia a PDF konceptu #427–#429; design system ako artefakt v Claude, `/design-sync` 24. 10.; predtým výber zdrojov na Opýtať sa bez automatického opýtania #418, už v plachte otázky #421, widget kanála so zdrojmi a hlavičkou odpovede #420; design system Contineo záväzný v `CLAUDE.md`, `/design-sync` 23. 10.; predtým 2026-10-23: kontrola manuálov nanovo: ADR-036 potvrdenie pred spustením, zastavenie, zrušenie #401, kontrola konceptu D240 #403, kolo 2 nad konceptmi 41 nálezov, nález v celom odseku #419; delenie dlhých odsekov a zoznamov #398; podnet legislatíve pripravený; predtým ADR-037: Zákon o športe zo Slov-Lexu ako sledovaný zdroj, koncept v knižnici nad Stanovami, #405; Členenie veľkého dokumentu — číslovanie zoznamov, nadpisy, návrh rezov len ako zmeny, jedno meranie úseku, #406–#414; ponuka „⋯“ v Knižnici zrušená #407, #409; požiadavky na kontrolu len z hierarchie D241, #404; predtým ADR-035: členenie zo štruktúry Markdownu, profily zanikli, rezač blokov s návrhom AI, #389–#394; strážca zápisu v editore textu a Myersov rozdiel #396–#397; Súťažný poriadok bez „Stránka | N"; Kuriér editor s lištou a odkazmi von #390–#395; predtým ADR-034: úloha a záväznosť druhu, Stanovy/Poriadok/Zákon, hierarchia dokumentov, návrhy z helpdesku do manuálov, FAQ zrušené — #385–#388; ISSF-01 nové znenie 13. 10.; predtým: Kuriér ADR-033 fáza 1 celá v `main`, #376–#379; manuály ISSF zverejnené; zrušené kolo ≠ zamietnuté #373; kontrola súladu ADR-032 v prevádzke, #343–#363, #367, #375; FAQ z histórie helpdesku ADR-030 dobehlo, 54 návrhov vo fronte; PDF z textu konceptu ADR-031 a #365; FAQ ku kanálu D201; jedno bežiace kolo #372; rozhranie #368–#371; staršie: súpis DESIGN_ODCHYLKY vybavený 8. 10., MCP konektory ADR-029, helpdesk ADR-028)

---

## Kde sme teraz

**Manuály ISSF sú zverejnené všetky (24.–27. 10.).** Kolo 2 kontroly
rozhodnuté, sedem nových znení od 24. 10.; ISSF-00, 02 a 03 majú ďalšie
znenie od 25. 10. so zjednotenou vetou o zrušení registrácie hráča
(žiadosť v ISSF alebo písomne na Matrike SFZ, aj e-mailom — rozhodnutie
Jána). Index a členenie overené nad produkciou. V hlavičke manuálov
ostal „Stav k: 9. 10. 2026" — opraviť pri najbližšom znení.

**Widget kanála ISSF Helpdesk (27. 10., ADR-042, #463–#471, druhá
session)** nahrádza formulár Pomoc v ISSF: vlákno ticketu cez potvrdenie
e-mailom, osoba ako e-mailový kontakt so zoznamom účtov, údaje z ISSF
pri tickete, vzhľad a správanie ako nastavenie kanála (zmluva s ISSF je
len `script src` a token), ponuka správy helpdesku
a `ContineoHelpdesk.open()`. Večer po ukážke v ISSF (Dodatok 2,
#474–#478): zatvorený widget je **riadok otázky hore v strede** (dá sa
posunúť za úchyt), plachta 80 % × 80 % s nedávnymi otázkami a vzormi,
widget vyká, prepínač jazyka SK / CZ / EN, úvodný tip pri prvej návšteve,
pätka s odkazom na Contineo, ochranou údajov a verziou (#480);
externý widget je v design systéme (`.xw-*`). Ďalší krok je u vývojára
ISSF: **zadanie** `docs/ZADANIE_ISSF_WIDGET.md` (token, obnova tokenu,
vloženie, odkazy „Pomoc", zrušenie formulára). Naostro neoverené — kanál
nemá tajný kľúč.

**Prehľad a detail pre bežného používateľa (26. 10., ADR-041, #449–#452).**
Bežný človek vidí **dokumenty, nie zdroje**: jeden zoznam podľa druhu
(predpis z katalógu je druh Zákon), pripojené systémy ostávajú len vo výbere
zdrojov na Opýtať sa. Prehľad (`/`) má **Moje úlohy** (povinnosti s termínom,
kolá schválenia) a **Dokumenty** (knižnica + odoberané predpisy, chipy
`nové` a `expiruje`, akcia Opýtať sa) a pod nimi rozcestník; KPI dlaždice
a „Pre vás" zanikli. Čitateľský detail `/documents/<id>` má riadok druh ·
znenie · účinné od, kartu údajov (zodpovedná osoba, právny základ, prijal,
autor, nadradené, jazyk, pôvod, moje potvrdenie — bez priečinka, prístupu,
značiek a cudzích potvrdení) a prepínanie zverejnených znení `?version=`;
zákon má čitateľskú adresu `/documents/law/<actId>` (správcovská ostáva);
správca obsahu má na detaile jediný tichý odkaz. Knižnica na čítanie
(`/library` bez roly) má prepínač podľa druhu `?kind=`. **Otázka nad jedným
dokumentom** `?doc=` (D269, #448, druhá session). **Naživo neoverené.**

**Zdroje a katalóg legislatívy (25. 10., ADR-039, ADR-040, #432–#437).**
Organizácia → **Zdroje** je register zdrojov obsahu (knižnica, schránky
helpdesku, MCP konektory, legislatíva) s podmenu **Register · Konektory ·
Web / RSS**; sekcia Konektory zanikla, staré adresy sa prekladajú.
**Slov-Lex** (`/organisation/sources/web/slov-lex`, vo výbere zdrojov
„Legislatíva SR", id `slov-lex`) je zdroj druhu Web / RSS (ADR-040 D268): predpisy sa
držia raz pre všetky organizácie v katalógu (`law_*`, bez `companyCode`,
menovitá výnimka z D90), organizácia si ich odoberá a asistent z nich
odpovedá v znení účinnom v deň otázky s odkazom na paragraf. SFZ odoberá
440/2015, 1/2014, 83/1990 a 18/2018 (katalóg: 16 znení, 1 638 úsekov;
cron o 4:15 dopĺňa históriu po štyroch zneniach na predpis). Odber do
knižnice ide z katalógu, zo Slov-Lexu sa sťahuje len záväzné PDF; zverejnený
dokument knižnice má pri odpovedi prednosť pred katalógom. Cron zakladá
koncepty nových znení a posiela `lawVersionDraft` správcom obsahu —
**prvé nočné behy 25. a 26. 10. prebehli** (12 + 11 nových znení, 0 chýb,
0 konceptov; katalóg 27 znení, 2 776 úsekov; log `[legislativa] cron:` vo
Vercel Runtime Logs). Správa katalógu: `/admin/law`; pri každom predpise
v Zdroje → Web / RSS → Slov-Lex je dátum poslednej kontroly a chyba (#445),
detail predpisu so zneniami a celým textom (#446).
Návod `/guide` má kapitolu pre každého (zdroje pri otázke) a pre správcu
zdrojov (katalóg verzus knižnica). MCP server zdroje aj Legislatívu číta
(`list_sources`, `list_law_acts`, `get_law_act`, #438, druhá session).

**Zákon o športe zo Slov-Lexu (ADR-037, 20.–21. 10., #405–#414).** Knižnica →
Nahrať → **Predpis zo Slov-Lexu** (od 25. 10. aj s výberom z katalógu);
Zákon č. 440/2015 Z. z. je v SFZ **zverejnený od 23. 10.** (`sfz:zakon_440_2015`,
znenie účinné od 1. 1. 2026), verejný, druh Zákon, **nadradený Stanovám**;
prijatý rez je kolo 3 (176 úsekov, 5 nálezov — dva veľké paragrafy a tri
zlomky). Krok C (cron a upozornenie) je od 25. 10. spoločný cron katalógu
(ADR-039 D261).

**Prehľad spotreby AI (24. 10., #425, #426).** Organizácia → Umelá
inteligencia → **Prehľad** (`/organisation/ai/overview`): obdobie Od–Do
ako Spotreba s rýchlym výberom, pohľady Osoby / Účely / Modely, graf po
mesiacoch alebo rebríček, matica položka × mesiac, porovnanie s minulým
rokom, Excel. Každé číslo vedie do Spotreby s filtrom (`person=none`,
`model=`, `unpriced=1`). Osoby sú podľa `personId` s menom z registra —
kontrola súladu, ktorú niekto spustil, je pod ním. Na produkcii rok 2026:
$59.77, 594 volaní, len október (zápis od 5. 10.). Prvý návrh vytvorený
**ako artefakt *Design* v Claude** — postup a poznatky v `docs/DESIGN.md`;
nové prvky systému `.chart-*`, `.matrix-*`, `.spark` sú v artefakte design
systému (verzia 9).

**Contineo ako MCP server (ADR-038, 24. 10., #422, #424, druhá session).**
Fáza 1: AI asistenti sa pripoja na `/mcp` (OAuth vydáva Contineo, súhlas ako
dôkazný záznam) a čítajú knižnicu (`search_library`, `get_document`,
`ask`…). V SFZ **zapnuté a overené naostro 25. 10.** z Claude Desktop aj
Claude Code (#440). `search_library` nemá `limit`; strop úsekov pre každý
zdroj nastaví organizácia posuvníkmi v Organizácia → Prístup → AI asistenti
(knižnica a konektory 3–15, predvolene 8; Legislatíva 1–8, predvolene 4;
#441). Fázy 2 a 3 v `docs/TODO.md`.

**Oprava textu znenia (24. 10., #427–#429, druhá session).** Po oprave
ISSF-00 a ISSF-05 už karta nehlási „Nové znenie v príprave" a koncept bez
vlastného zdroja dostane PDF zo zdroja zverejneného znenia.

**Zdroje hľadania (23.–24. 10., #418, #420, #421).** Na Opýtať sa sa zdroje
vyberajú tichým tlačidlom „Zdroje: Knižnica ▾" s riadkami `.select-row` —
**v plachte otázky už pred prvou odpoveďou** (#421) aj na obrazovke
odpovede (#418). Zdroje sú vždy vymenované, zmena nič nespúšťa (volanie
modelu je až „Opýtať sa (znova)"), oznam „Zdroje sa zmenili…" pri odpovedi
z iných zdrojov. Hlavička odpovede menuje, **v čom sa hľadalo**, aj keď zo
zdroja nič neprišlo; uložená odpoveď si to pamätá (`searchedScope`). Znenie
„Odpoveď z dokumentov SFZ" ostáva (Ján, Q3). **Widget kanála** (#420) má to
isté — výber z povolených zdrojov kanála, hlavičku pri každej odpovedi
a tokeny design systému v Shadow DOM. V ISSF sa výber zatiaľ nekreslí:
Sportnet je interný konektor (D174) a kanál má jediný zdroj; Ján ho prepne
na verejný neskôr sám. Platené overenie naostro (otázka so Sportnetom)
ešte neprebehlo.

**Design system Contineo je záväzný (Ján 23. 10.).** `CLAUDE.md` má sekciu,
podľa ktorej každá zmena frontendu a každé zadanie pre Claude Design musí
splniť design system; zdroj pravdy je repozitár (`.design-sync/conventions.md`,
`globals.css`, `app/src/components/`), Claude Design je zrkadlo cez
`/design-sync` (23. 10. dvakrát: ikony, `.ask-scope-pop`, `.lnote--action`).
`docs/design/README.md` je archív a neplatí.

**Manuály ISSF — nové znenia (20.–23. 10.).** Koncepty ISSF-00, 01, 02,
03, 04, 05 a 07 obsahujú prijaté doplnenia z helpdesku (18. 10.), e-mail
Oddelenia vzdelávania trénerov a podnadpisy 4.1/4.2 v ISSF-05. Kontrola
„Manuály ISSF — nové znenia (október 2026)" má **kolo 2 nad konceptmi:
41 nálezov** (2,28 USD); Ján ich rozhoduje s kolegami z oddelení
(odporúčania: 30 prijať, 1 upraviť, 10 ponechať — z toho 7 rozporov
z podnetu pre legislatívu). Kolo 1 (zverejnené znenia) sa nerozhoduje.
Staré kontroly manuálov z 10.–20. 10. sú zrušené (ADR-036 D238).
**Podnet pre legislatívu** (poplatok 0,50 €, preukaz „sám pre seba",
fotografia, oznámenie klubového ISSF manažéra) je pripravený ako Word
pre LPO, odoslanie je na Jánovi.

**Návrh rezov AI** beží bez premýšľania, vracia len pridané a zrušené
hranice a nový úsek nad 1 350 tokenov odmietne; Návrh, Rozdiel aj Dnes
merajú úsek rovnako, s riadkom kontextu (`chunkSize.ts`). Pohľad Dnes
kreslí text ako Markdown, zoznamy v predpise sa neprečíslúvajú.

**Členenie (ADR-035, 15.–17. 10., #389–#397).** Prvý rez úsekov sa berie
zo štruktúry Markdownu — úrovne nadpisov a číslovanie, cieľ 300–900
tokenov, článok, § a príloha sú celok; profily členenia zanikli celé.
Stránka **Členenie** (karta dokumentu) je rezač blokov: pohľady Dnes,
Návrh, Rozdiel, návrh AI nad celým textom s pripomienkami a kolami,
prijatý návrh = ručné hranice k textu. Preindexované 23 z 23 dokumentov
(16. 10.) a 10 manuálov ISSF po oprave citácie prvého oddielu (17. 10.).
**Editor textu** má strážcu zápisu: zmena len značiek Markdownu zastaví
uloženie (Uložiť s pôvodným zápisom / Uložiť aj tak); dokument s platným
znením sa otvára v Markdowne. **Súťažný poriadok** má od 17. 10. opravený
text bez 57 značiek „Stránka | N" (ADR-007). Strážca bol naostro zatiaľ
použitý raz — pred opravou #397.

**Kuriér (ADR-033, 12. 10., #376–#379) je v `main` celý vo fáze 1** —
interný messenger: obálka v hlavičke oddelená od zvončeka (D214), 1:1
správa od kohokoľvek, oznam publiku len od správcu osôb, HR a správcu
obsahu s náhľadom príjemcov (D204), odpoveď na oznam súkromne autorovi
(D205), autor vidí len počet prečítaní (D206), e-mail raz ráno ako zoznam
predmetov (D207, cron `courier-digest` 5:30 UTC, prepínač v plachte účtu),
ľahký Markdown bez príloh (D208), retencia `courierMonths` a odsek na
`/privacy` s verziou 12. 10. (D209), živé spojenie cez SSE len v otvorenom
Kuriérovi, change stream ako budík nad `poll()` (D210, D211). Kolegovia
(Cyril Janoško, Agáta Galková) už odpovedali v 1:1 vláknach; živý rozhovor
dvoch ľudí a prvý ranný súhrn (13. 10.) sú ešte neoverené naostro. Fáza 2
a 3 v `docs/TODO.md` („Kuriér — fáza 2 a 3“). Lokálne sa Kuriér neskúša
(dev nad ostrou DB, prihlásenie e-mailom) — overuje sa na intranete.

**Manuály ISSF (10) sú zverejnené (12. 10., schválila Agáta Galková).** Prešli
dvoma kontrolami súladu proti 7 normám (ADR-032; 104 nálezov, všetky
rozhodnuté a zapísané do konceptov), PDF sú vyrobené z aktuálneho textu
(ADR-031, #365). Staré kolá ISSF-04 a ISSF-05 zo starých PDF sú zrušené; od
#372 sa kolo starej podoby konceptu ruší samo a druhé kolo vedľa bežiaceho
sa predložiť nedá; zrušené kolo nie je zamietnutie a „Schválil“ je „Prijal
(orgán)“ (#373, D202, D203). Zverejnenie založilo šesť požiadaviek „Čaká na
kontrolu“ len cez návrhy FAQ — od #375 sa pri nezmenenom texte nezakladajú. Pevné väzby (D200) sú od 20. 10. zrušené
(D241, #404) — nové znenie založí požiadavku „Čaká na kontrolu" len podľa
nadradených dokumentov v hierarchii; Kontrola súladu je od #407 v Správe.

**Kontrola súladu (ADR-032)** je v prevádzke: dokument proti záväzným
dokumentom, beh na pozadí, rola `compliance`, Opus 5.5, cena pri behu.
**ADR-034 (13.–14. 10., #385–#388):** druh dokumentu nesie úlohu
(záväzný / výkladový / záznam) a poradie záväznosti (zákon › stanovy ›
poriadok › smernica › manuál); Norma sa rozdelila na Stanovy a Poriadok
(poriadky v priečinku „Poriadky SFZ"); **hierarchia dokumentov** s viacerými
nadradenými je naplnená (20 dokumentov aj so zákonom; Knižnica → pohľad Hierarchia, ponuka „⋯“ od #407 nie je) a
kontrola si z nej berie meradlá. **FAQ je zrušené** aj s dátami; ťažba
histórie helpdesku (ADR-030) ukladá otázky do `helpdesk_questions` a z nich
**„Návrhy z helpdesku do manuálov"** (Kontrola súladu) navrhnú doplnenie
manuálov — prvý beh 14. 10.: 44 návrhov do 7 manuálov, 4,66 USD. **ISSF-01**
má nové znenie od 13. 10. (prihlasovacie meno, zmena e-mailu cez Môj účet
alebo na matrike, lehota registrácie hráča).

**MCP konektory (ADR-029, 7.–8. 10., PR #307) sú v `main`.** Konektor je
pripojenie organizácie k cudziemu MCP serveru s viacerými použitiami; fáza 1
je **živý zdroj**: pri otázke sa predvolene hľadá len v knižnici, konektor
sa zapína výberom zdrojov (od #418 tlačidlo „Zdroje: … ▾") alebo nastavením *Používať predvolene* (PR #313); vtedy
sa hľadá súbežne v knižnici aj na serveri, citácia
nesie štítok „Živý zdroj — neoverené kurátorom", prístupová úroveň je
vlastnosť konektora (interný sa do e-mailov nedostane), rozsahy per kanál,
výber zdrojov na `/ask` aj v plachte otázky (#418, #421), stopa volaní v `connector_calls`.
Prvý server `mcp.sportnet.online` je **založený a pripojený v SFZ** pod
Jánovým účtom (zapísaná odchýlka od servisného účtu). **Overené naostro 8. 10.:** pripojené,
otázka „Ako si zmením heslo v ISSF?" odpovedala z 5 citácií zo Sportnetu so
štítkom Živý zdroj. **Fáza 2 — import** (PR #311): Knižnica → Nahrať →
Import zo servera, koncept s PDF a pôvodom `source.*`, blok Zdroj s kontrolou
zmien. Kanál ISSF (widget, verejný) živý zdroj nedostane — podľa D176 ide
von len to, čo kurátor importuje a schváli. Fáza 3 (nástroje asistenta)
a servisný účet Sportnetu sú v `docs/TODO.md` E2. Júnový zápis
`INGESTION_zdroje_reconciliation.md` kap. 2.2 je prekonaný.

**Helpdesk (ADR-028) beží naostro od 7. 10.; rozhodnutia doplnili D169,
D170 a ADR-029.** Schránka SFZ je pripojená cez Microsoft Graph (aplikácia
v Entra zúžená na schránku), synchronizácia Doručenej aj Odoslanej pošty
beží každých 5 minút (Vercel cron, interval pri kanáli), e-mail je ticket
s celým vláknom a odpovede z Outlooku sa k nemu pripoja. **Kanály** sú
sekcia s typom widget / portál (D169) a jediná položka v menu aj pre
riešiteľa — Helpdesk ako samostatná časť zanikol, správca obsah ticketov
nečíta (D170). Živý zdroj z konektora do verejného kanála nejde (ADR-029,
D176). Od 8. 10. večer: hromadné akcie nad ticketmi, návraty od poštového servera
sa nezakladajú ako tickety, nastavenie kanála ukazuje, čo asistent vidí,
a má hotový kód na vloženie widgetu so vzorom tokenu a kontaktom pri výpadku
(`helpdesk@futbalsfz.sk`). **Čaká na Jána:** zavrieť 56 starých návratov
(zoznam ticketov → Vybrať všetky → Zavrieť vybrané, bez piatich skutočných
otázok). Otvorené (`docs/TODO.md`): widget pre ISSF u prevádzkovateľa ISSF
(kód na vloženie z nastavenia kanála), upozornenie riešiteľom na nový ticket,
tickety v „čo čaká na mňa", IMAP adaptér. Helpdesk je na `/privacy` od 8. 10.
(D178); tickety a osoby z widgetu maže dávka, keď sa zapne ostré mazanie.

Všetko je **zlúčené v `main` a nasadené** na `intranet.futbalsfz.sk`. Hash
nasadeného commitu je v pätičke. Staršia história je v `CHANGELOG.md`
a `docs/DEVLOG.md`. **Od 27. 9. pracujú v repe dve sessions naraz** —
každá vo vlastnom `git worktree` (ADR-020); rozrobené vetvy druhej session
vidno v `git branch -a`, nie v tomto súbore.

**Potvrdzovanie je overené naostro (30. 9. – 1. 10., PR #196–#208)** na
`sfz:test_znenia`: pridelenie osobe, oddeleniu, trase aj krok trasy dajú
jednu úlohu a jedno potvrdenie ich splní; e-mail s výzvou, potvrdenie
z počítača aj z iPhonu, záznam s odtlačkom PDF a kópiou oddelenia, výkaz HR.
Cestou opravené: D50 mimo trás, náhľad PDF (strany cez pdf.js aj na
telefóne, bez textu na vyhľadávanie), odvolanie pridelenia cez potvrdzovaciu
stránku, „adresát" namiesto „publikum", pätička e-mailov **Contineo.app**,
po potvrdení späť na „Na potvrdenie", menu 9 bodiek pod tlačidlom a **druhé
potvrdenie z iného zariadenia sa odmieta**. **D151** (dodatok ADR-023):
úloha „určiť právny základ" je na karte v správe, zodpovedná osoba bez roly
správcu tam vidí len ju. **D152:** formulka podľa rodu (`persons.gender`,
nevyplnené „oboznámil(a)"). Zvyšky v `docs/TODO.md`, „Test potvrdzovania naostro".

**Osoby SFZ sú v systéme (27. 9.):** 153 osôb z licenčného zoznamu M365
(150 nových + 3 doplnené), bez technických kont. Do oddelení sa zaraďujú
a pohlavie dopĺňa priebežne v bežnej prevádzke (Ján 8. 10.). **ADR-019:** import existujúcim dopĺňa
len prázdne polia; prepis je prepínač „Aktualizovať existujúcich".
Náhľad importu je tabuľka s rozdielom „dnes → po" a hľadaním.
**Pozvánky odišli 28. 9.** (146 hromadne + 1); stav osoby je „Nová", kým
pozvánka neodíde, potom „Pozvaná". Portál sa volá **Intranet SFZ**.

**Návrhy z Claude Design zo súpisu `docs/DESIGN_ODCHYLKY.md` sú
zapracované všetky (7.–8. 10.):** lišta uloženia (#306), výber skupín
a značiek s poľom „Hľadať alebo pridať" (#308, #312), správa kurzu (#298),
karta osoby so sekciami a Ďalšími akciami (#314), posudok odpovede (#317)
a akcie na detaile dokumentu (#319, oprava ponuky #320). **Súpis
`docs/DESIGN_ODCHYLKY.md` je vybavený celý** — mechanické odchýlky #321,
posledné štyri na návrh (značky, správna odpoveď v teste, príkazy pre
vývojára na `/hr/assign` a `/admin`) #322. Postup: Ján napíše
**„priprav podklad"** (zadanie `docs/design/<NÁZOV>-zadanie.md` s promptom),
návrh vznikne v Claude Design, **„stiahni design — <NÁZOV>"** ho stiahne
cez DesignSync do `docs/design/` a implementuje sa vo vlastnom worktree,
jeden návrh = jeden PR. Keď návrh protirečí rozhodnutiu v repozitári,
rozhoduje Ján (8. 10.: výnimka `.seg` v posudku; „Nové znenie" pri
archivovanom predpise ostáva podľa ADR-025).

**Znenie predpisu po štyroch rozhodnutiach (24.–25. 9.):**

- **ADR-014** — karta Príprava → Schválenie → Zverejnenie → Pridelenie;
  zodpovedná osoba už v príprave, schvaľovatelia z posledného kola, prenos
  pridelení pri zverejnení.
- **ADR-015** — názov dokumentu so zverejneným znením sa mení len novým
  znením a schvaľuje sa s ním.
- **ADR-016** — bez označenia znenia, zdroja dátumu a opravy údajov; formulka
  „… v znení účinnom od {dátum} …".
- **ADR-017** — viac právnych základov pri znení; zákonná povinnosť má
  prednosť (námietka nemaže).

**ADR-012 (retencia a DPO)** beží v režime `report`; DPO je Ján. **ADR-013**
(údaje o znení) je súčasťou schválenia.

**ADR-023:** právny základ určuje zodpovedná osoba už v príprave;
nahradené znenie platí do účinnosti nového (D143).

**Naostro overené 29. 9.:** predloženie → schválenie (Michaela Žikavská)
→ zverejnenie cez kartu, trikrát na `sfz:test_znenia`, vrátane novely
s budúcou účinnosťou. Formulka „v znení účinnom od" a kombinácia právnych
základov v zázname potvrdenia overené 1. 10. **Naostro neoverené:**
zverejnenie s novým názvom, prenos pridelení, určenie základu v príprave
(ADR-023), vyradená osoba.

**`/dpo` je overené naostro (1. 10.):** výkaz, CSV (so stĺpcom
`categories`, PR #214), dve námietky podané v aplikácii a zamietnuté — nič
sa nezmazalo; zvonček, e-maily a záložka GDPR len na čítanie pre správcu
osôb bez roly DPO. **D153** (ADR-012, Dodatok 1): kontakt GDPR organizácie
(*Ján Letko, gdpr@futbalsfz.sk*) na `/privacy`; námietku podá prihlásená
osoba priamo tam, DPO dostane e-mail aj zvonček, osoba potvrdenie.
**D154** (ADR-022, Dodatok 1): kontakt, lehoty a doplnok sú v Nastaveniach
organizácie, **záložka GDPR**; upravuje len DPO, správca osôb ju vidí na
čítanie. Výkaz DPO s hľadaním a filtrami (PR #218) nahradil dlaždice pásom
čakajúcej námietky.

**Asistent odpovedá podľa znenia platného k dňu otázky (ADR-024, PR
#170–#176).** Hľadá v zneniach platných k dňu (z `documents`, nie podľa
`isActive` úseku), rozpozná otázku „k dátumu" aj „čo sa zmenilo" (porovná
dve znenia po článkoch), nad odpoveďou je štítok dňa, pri zdroji znenie.
Overuje sa `npm run versions:questions` na skúšobnom `sfz:test_znenia`
(6 z 6). Ostré normy majú zatiaľ po jednom znení.

**Knižnica (2. 10., PR #223–#227):** deväť pôvodných noriem má PDF pri
platnom znení (`npm run files:version-pdf`), takže „Stiahnuť PDF" aj PDF pri
potvrdzovaní; právny základ smie určiť aj **správca obsahu** (D155, ADR-023
Dodatok 2); predpis sa dá **archivovať ku dňu** (aj v budúcnosti, s dôvodom;
pridelenia sa odvolajú, potvrdenia ostávajú; D156, **ADR-025**). Skúšobná
smernica `sfz:test_onboarding` je zmazaná; `sfz:test_znenia` ostáva.

**Trasy (2.–3. 10., PR #228–#239, druhá session):** trasy sú v Pridelených
dokumentoch („Pridelené normy" → „Pridelené dokumenty"), ľudia na trase,
termín potvrdenia pri trase, e-mail pridaným, náhodný kľúč trasy.

**Karta dokumentu (PR #183–#186):** platné znenie = platí dnes, novela vopred
ako „Pripravované znenie“; preindexovanie každého znenia; oprava textu platného
aj pripravovaného znenia (**D150**, dodatok k ADR-007), minulé nie.

**Nové rozhranie (29.–30. 9., PR #188–#194):** menu 9 bodiek v hlavičke,
Prehľad ako rozcestník, spodná lišta rovnaká pre každého; **Knižnica pre
každého** (platné dokumenty organizácie, čitateľský detail). **Otázka sa kladie
v hlavičke**, odpoveď s citáciami vedľa seba (≥ 1180 px). **História otázok**
(`/ask/history`, skrytie, vymazanie, lehota `answersMonths`) je nasadená —
súhlas DPO sa získava dodatočne (`docs/TODO.md`, 🔴).

**Vzdelávanie (modul `learning`, ADR-018) je L0–L3 v produkcii** (PR
#130–#153): kurzy s verziami a videom, banka otázok a testy, výsledky pre
zodpovedné osoby, certifikát s overením `/verify/…?h=`, tlačou a PDF s QR.
Pre SFZ **zapnutý**, Ján je `learning-admin`. **Naostro zatiaľ nikto kurz
nedokončil** — žiadny certifikát v databáze, PDF ani odvolanie neboli
skúšané na živých dátach. Rozpis zvyšku je v `docs/TODO.md`, sekcia P.

**Pohlavie osoby** (`persons.gender`, muž / žena): formulár, pozvanie,
import CSV (stĺpec `pohlavie`). Na certifikáte „absolvoval / absolvovala",
nevyplnené = „absolvoval(a)". Zatiaľ ho nemá nikto.

**Ochrana osobných údajov** — text `/privacy` schválil DPO 28. 9. (C1).
**ADR-021:** vzdelávanie má lehotu dokladov, podrobnosti sa orežú rok po
dokončení, **vydaný certifikát sa nemaže**. **ADR-022:** krajina sídla,
sprostredkovatelia z profilu, lehoty a doplnkový text si organizácia
nastaví v Nastaveniach, záložka GDPR (D154). Otvorená karta po nasadení ponúkne
„Obnoviť" (inak posiela akcie starej verzii).

## Čo čaká na rozhodnutie Jána

**Widget v ISSF:** vytvoriť **tajný kľúč kanála** ISSF Helpdesk a poslať
ho vývojárovi ISSF zvlášť od zadania; adresu testovacieho ISSF pridať medzi
povolené pôvody; voliteľne vzory otázok kanála. Poslať `/design-sync`
(pribudli triedy `.xw-*`).

**Dve overenia k manuálom** (kolo 2 je rozhodnuté a manuály zverejnené):
pri zápisoch pre laikov (ISSF-05) — **podnet ŠTK poslaný 27. 10., čaká sa
na odpoveď**, kto zápis uzatvára;
lehotu „žiadosť o predĺženie licencie najskôr 30 dní pred skončením"
(ISSF-00) overiť s Oddelením vzdelávania trénerov.

**Sportnet ako verejný zdroj pre widget ISSF** — Ján prepne sám neskôr
(Organizácia › Zdroje › Konektory, potom „Živé zdroje" kanála ISSF); výber zdrojov
sa vo widgete objaví do hodiny bez nasadenia.

**Podnet legislatíve: RaPP a Stanovy verzus prax ISSF** — päť bodov
(27. 10. pribudol bod 5, zrušenie registrácie hráča aj písomne,
`~/Downloads/Podnet_RaPP_Stanovy_prax_ISSF_2026-10-27.docx`); poslať LPO
a pri poplatku 0,50 € zistiť, na základe čoho ho ISSF účtuje.

**🔴 Ako DPO: súhlas s účelom „história otázok“** (H1) — nasadené 30. 9.
pred súhlasom, na pokyn Jána; záznam o spracúvaní a `/privacy` sú doplnené.

**Lehota uloženia certifikátov** podľa registratúrneho plánu zväzu — DPO
doplní do záznamu o spracúvaní (C2, D132).

**22 osôb z `@sfzmarketing.sk`** sú v tenante SFZ ako `employee` — nechať,
alebo typ `external` / vlastný tenant? A či doplniť ľudí mimo Basic/Standard
licencií (Ján v exporte nebol).

**Ako DPO:** C1 schválené 28. 9.; zostáva záznam o spracovateľských
činnostiach prepísať do záznamu zväzu (C2, doplnené o Vzdelávanie
a pohlavie), DPIA pred pilotom (C3), termín balančného testu (A3, A11).

**Skúšobný poriadok `sfz:test_znenia`** — zmazať, keď kontrola asistenta
(`npm run versions:questions`) prejde na ostrú normu s viacerými zneniami.
Skúšobná smernica je zmazaná (2. 10.).

**Staré pridelenia Oddeleniu IT** — Revízny poriadok (10. 9., Branislav
nepotvrdil) a Skúšobná smernica (8. 9.): odvolať, alebo nechať?

**9 zo 14 platných predpisov nemá právny základ** (výkaz `/dpo`,
1. 10.) — doplní zodpovedná osoba (pri ôsmich je to Ján, pri Smernici
o pracovných cestách Michaela Žikavská).

**Atlas → AI Models → Usage:** či úpravy search indexov 29. 9. prepočítali
vektory (skóre pred a po sú zhodné — nasvedčuje, že nie).

**Zapnúť ostré mazanie** — `RETENTION_MODE=delete` po kontrole výkazu
`retention` v odpovedi cronu; tá istá premenná zapína aj retenciu
Vzdelávania (ADR-021) a od 8. 10. aj tickety a osoby z widgetu (D178,
počty v `retention[].helpdesk`).

**Automatický prevod `.docx` → PDF** (Graph, povolenia v Entra ID) a **D93**
(`docs/D93_plan_vyber_podla_filtra.md`) čakajú ako doteraz.

## Najbližšie kroky

1. **Widget v ISSF:** poslať vývojárovi zadanie
   (`~/Downloads/Zadanie-ISSF-pomocnik-Contineo.docx`), tajný kľúč zvlášť,
   na testovacom ISSF prejsť kontrolný zoznam zo zadania.
   **Poslať podnet legislatíve** (päť bodov); odpoveď ŠTK k ISSF-05
   a overenie s Oddelením vzdelávania trénerov.
2. **Prejsť naživo** Prehľad, `/library` s prepínačom druhu, jeden dokument
   a jeden zákon (ADR-041, #450–#452 nasadené bez pohľadu v prehliadači).
   **Kontrola súladu Stanov proti Zákonu o športe:** existujúca kontrola
   „Stanovy SFZ proti zákonu o športe" z 23. 10. má 13 nerozhodnutých
   nálezov — najprv rozhodnúť, nové kolo (≈ 1,37 USD, 2 min) až potom.
   Nočný beh cronu katalógu je overený (žiadny koncept). **Nahrať
   licenčnú normu trénerov** — päť otázok o trénerských licenciách dnes
   nepokryje žiadny dokument.
3. **Kuriér naostro:** živý rozhovor dvoch ľudí, ranný súhrn v logu
   `courier-digest`, prvý oznam oddeleniu.
4. **Prehľad AI:** zjednotiť meno procesov na pozadí pri zápise spotreby
   (`docs/TODO.md`, „Spotreba AI: jedno meno"). Posuvník `.field-range`
   je v knižnici aj v artefakte design systému (`/design-sync` 25. 10., verzia 10).
5. **Zdroje hľadania naostro:** jedna otázka so zaškrtnutým Sportnetom
   z plachty — hlavička „… a zo zdroja Sportnet dokumentácia", oznam po
   zmene výberu bez nového volania.

Ďalej podľa staršieho plánu: prvý kurz naostro s certifikátom a `/verify`
z telefónu; prvé ostré nové znenie normy cez kartu (nový názov, základ
v príprave, prenos pridelení); čas po prvý token, fáza 3
(`scripts/ratings_overview.mjs`); dátum skončenia na karte osoby pri prvom
odchode.

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva (24. 10.): **0 errors, 39 warnings,
2951 testov v 255 súboroch.** Pri zmene rozhrania aj „mechanickej" aspoň jedna snímka
na 390 px — #321 prešiel štyrmi brzdami a typ otázky aj tak pretekal o 65 px. Pri paralelnej session pred zlúčením PR
zmergovať `main` do vetvy a pustiť `tsc` — 6. 10. prešiel zelený PR a build
`main` padol na zmene z druhej vetvy (`Notice` s povinným `language`). Pri veľkej záťaži stroja pomôže
`npx vitest run --maxWorkers=3` (inak niektoré testy stránok padajú na 5 s). Nová chyba alebo nové varovanie znamená regresiu, nie šum.

**Tieto štyri brzdy nevidia chyby za behu.** 23. 9. prešli všetky štyri
a produkcia aj tak spadla (dočasná mŕtva zóna v `library/page.tsx`). Preto
je odteraz `@typescript-eslint/no-use-before-define` zapnuté ako **chyba** —
`tsc` túto triedu chýb chytiť nevie, hlási len priamy odkaz v tom istom
mieste, nie odkaz vnútri callbacku.

**Stránka sa overuje telom odpovede, nie stavovým kódom.** Next servíruje
chybovú stránku s kódom **200**, takže `curl -o /dev/null -w '%{http_code}'`
o ničom nevypovedá. Hľadá sa reťazec „A server error occurred" v tele.

**A overuje sa to, čo ľudia s obrazovkou robia, nie to, čo sa menilo.**
Knižnica nasadená bez vyskúšaného filtra nie je overená knižnica.

Stav, ktorý sa naživo nedá vyvolať bez zápisu (karta v kroku 2, námietka),
sa overuje **testom vykreslenia** s podvrhnutými dátami
(`tests/libraryDetailFlow.test.ts`, `approvalsPage`, `dpoPage`).

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

**Lokálne SFZ je na `http://sfz.localhost:3000`, nie na `localhost`** — ten
patrí tenantovi LTK a osoba Jána tam nie je (D90), takže knižnica hlási
„Stránka sa nenašla" aj pri prihlásení. Prihlasuje sa zvlášť; odkaz z e-mailu
má v `callbackUrl` https, po prihlásení treba ručne otvoriť `http://`.
**Lokálny server píše do ostrej databázy** — zápisy (presun, audit) sa
naživo skúšajú len so súhlasom Jána.

**Marketingový web má vlastnú sadu** a púšťa sa z `web/`:

```
cd web && npx eslint . && npx vitest run && npm run build
```

Baseline (21. 10.): **0 errors, 0 warnings, 13 testov v 2 súboroch,
71 predgenerovaných stránok**. `next lint` tu už neexistuje —
volá sa priamo `eslint`.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
