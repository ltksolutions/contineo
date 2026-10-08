# Zadanie pre Claude Design — KANALY-prehlad

> Podklad pre návrh **prehľadu kanálov** `/channels` (ADR-028, D169, D170).
> Pripravené 8. 10. 2026 proti `main` (`cdea5e1`). Obrazovka vznikla 6.–7. 10.
> a súpis `docs/DESIGN_ODCHYLKY.md` ju nezachytil. Časť „Prompt pre Claude
> Design" sa skopíruje do projektu v Claude Design; zvyšok je kontext pre
> Jána.

## Prečo

Prehľad kanálov je vstup do sekcie Kanály pre správcu organizácie aj pre
riešiteľa. Dnes je poskladaný z blokov, ktoré inde v aplikácii už nahradili
spoločné vzory:

- **Zoznam kanálov** je jedna karta `.detail-block` s nadpisom „Kanály"
  a riadkami s inline flexom: štítok typu · názov (odkaz) · **surový kľúč
  kanála (UUID)** · adresa schránky · „tickety: 6 otvorených z 65". UUID je
  údaj pre vývojára, nie pre správcu.
- **Vstavané rozhrania** (Asistent v intranete, Knižnica v intranete) sú pod
  nadpisom `h3` v tej istej karte ako odseky so štítkom.
- **Nový kanál** je plné tlačidlo v `.page-head`, ktoré len skočí na
  formulár `#new`, a ten je **vždy otvorený** na konci stránky (typ cez
  `Select` z dvoch volieb, názov, tiché „Uložiť kanál"). Nápoveda typov sú
  dve vety spojené bodkou.
- Šírka a okraje cez inline `style`.

## Dnešný obsah

1. `.page-head`: „Kanály" + plné „Nový kanál" (len správca).
2. Podmenu „Kanály · Moje tickety" (len riešiteľ aspoň jedného kanála,
   D170).
3. `p.page-lead`: „Kanál je jedno miesto, kde sa ľudia pýtajú: má vlastný
   obsah (priečinky knižnice), schránku, riešiteľov a widget. Kanálov môže
   byť viac — každý pre iný projekt a publikum."
4. Karta „Kanály": riadok na kanál (údaje vyššie).
5. „Vstavané" (len správca): Widget — Asistent v intranete; Portál —
   Knižnica v intranete; „nenastavuje sa".
6. Formulár „Nový kanál" (len správca).

**Údaje, ktoré kanál má** (`lib/channels.ts`, `HelpdeskChannel`): typ
(widget / portál), názov, publikum, priečinky knižnice, úroveň obsahu
(verejný / interný — widget verejný vždy), tickety áno/nie, schránka
(adresa, posledná synchronizácia, chyba synchronizácie, interval),
riešitelia, jazyky, živé zdroje (konektory), kedy a kto upravil. Počty
ticketov podľa stavu (nový, s návrhom, odoslaný, zavretý, znovu otvorený).

## Rozhodnutia v repozitári, ktoré návrh nemení

- **D169:** dva typy kanála — **widget** (asistent, voliteľne tickety
  a schránka) a **portál** (dnes knižnica). Vstavané rozhrania intranetu
  sú v zozname ako pevné riadky, aby bol obraz úplný.
- **D170:** jedna položka menu pre správcu aj riešiteľa; každý vidí len
  kanály, ku ktorým má prístup. **Správca vidí počty ticketov, nie ich
  obsah**; riešiteľ vidí tickety svojich kanálov. Kliknutie na kanál vedie
  na `/channels/<kľúč>` — rozcestník (riešiteľ na tickety, správca na
  nastavenie).
- **D174 / D176:** widget je verejný; interný obsah ani živý zdroj
  z interného konektora doň nejde.
- Podmenu s jedinou položkou sa nekreslí (správca bez kanálov ako riešiteľ
  nevidí „Moje tickety").
- Bez JavaScriptu; stav v adrese.

## Pravidlá, ktoré návrh musí dodržať

- `.page-head` s jedným plným tlačidlom; otvorená úloha (`?new=1`) ho
  prevezme a hlavičkové sa skryje (P10, MANAGE-COURSE-akcie).
- Zoznam s 2–3 údajmi ostáva **kartami na všetkých šírkach**; tabuľka len
  ak sa porovnávajú stĺpce (CLAUDE.md, SwiftUI `List`/`Table`).
- Zoznam kariet, z ktorých má každá vlastnú akciu → tlačidlá kariet tiché
  (R1).
- Jedna z 2–5 vo formulári = `.choice-row` (fajka), nie `Select`.
- Žiadny údaj pre vývojára (kľúč, UUID) na obrazovke správcu.
- Stav cez `.tag--*`, hlášky `.lnote`; rámy 390 tmavá a 1440 svetlá;
  terč 44 px; texty cez i18n (sk/cs/en).

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Tvar zoznamu.**
- **A (odporúčam):** `.form-group` „Kanály" s kartou `.form-list`, riadok
  na kanál (`List` so šípkou ›): vľavo ikona typu, názov, pod ním
  podnadpis „Widget · helpdesk@futbalsfz.sk · verejný"; vpravo počet
  otvorených ticketov ako štítok (`tag--draft` „6 otvorených", nič pri
  nule). Celý riadok je odkaz na kanál.
- B: karta na kanál (mriežka kariet) s viac údajmi (riešitelia, posledná
  synchronizácia). Viac miesta, menej prehľadné pri 5+ kanáloch.

**Q2 — Stav schránky v zozname.**
- **A (odporúčam):** keď posledná synchronizácia zlyhala (`lastSyncError`)
  alebo meškala viac než dvojnásobok intervalu, riadok dostane
  `tag--expired` „Schránka nesynchronizuje" — správca to inak zistí až
  z ticketov, ktoré neprišli. Inak nič.
- B: stav schránky len v nastavení kanála.

**Q3 — Vstavané rozhrania.**
- **A (odporúčam):** vlastná `.form-group` „Vstavané v intranete" pod
  zoznamom, dva riadky v tom istom tvare ako kanál, ale bez šípky a so
  sivým „nenastavuje sa" — nie sú to odkazy.
- B: skryť ich; obraz bude neúplný (proti D169).

**Q4 — Nový kanál.**
- **A (odporúčam):** plné „Nový kanál" v hlavičke vedie na `?new=1`;
  otvorí sa karta úlohy `.task-card` navrchu (typ ako dva riadky
  `.choice-row` s vysvetlením pod názvom typu, názov kanála, plné
  „Vytvoriť kanál" + „Zrušiť"), hlavičkové tlačidlo sa skryje. Bez
  `?new=1` sa formulár nekreslí.
- B: formulár ostane vždy otvorený na konci stránky.

**Q5 — Pohľad riešiteľa (bez roly správcu).**
- **A (odporúčam):** ten istý zoznam, len jeho kanály, bez Vstavaných a bez
  „Nový kanál"; pri každom kanáli počet otvorených ticketov ako hlavný
  údaj. Prázdny stav `.empty` „Nie ste riešiteľom žiadneho kanála".
- B: riešiteľa presmerovať rovno na Moje tickety.

## Rámy

- 1440 svetlá:
  - správca: dva kanály (widget „ISSF Helpdesk" so schránkou a 6 otvorenými
    ticketmi; portál „Rozhodcovia" bez ticketov), Vstavané;
  - `?new=1` s otvorenou kartou úlohy;
  - widget so zlyhanou synchronizáciou schránky (Q2).
- 390 tmavá:
  - správca so zoznamom;
  - riešiteľ (len jeho kanál, podmenu Kanály · Moje tickety);
  - prázdny stav správcu (žiadny kanál, len Vstavané).

## Prompt pre Claude Design

```
Navrhni KANALY-prehlad — úpravu /channels (prehľad kanálov organizácie,
ADR-028 D169/D170). Je to DIFF proti existujúcej obrazovke; serverové
akcie (saveChannelAction), polia (kind, name) a cesty ostávajú.

Dnes: .page-head „Kanály" + plné „Nový kanál" (skočí na #new); podmenu
Kanály · Moje tickety (len riešiteľ); page-lead; jedna karta .detail-block
„Kanály" s riadkami (inline flex): štítok typu · názov · surový kľúč
kanála (UUID) · adresa schránky · „tickety: 6 otvorených z 65"; v tej istej
karte h3 „Vstavané" s dvomi odsekmi (Widget — Asistent v intranete,
Portál — Knižnica v intranete, „nenastavuje sa"); na konci vždy otvorený
formulár Nový kanál (typ cez Select z dvoch, názov, tiché Uložiť kanál).

Kanál má: typ (widget/portál), názov, publikum, priečinky, úroveň
(verejný/interný; widget vždy verejný), tickety áno/nie, schránku (adresa,
posledná synchronizácia, chyba, interval), riešiteľov, jazyky, počty
ticketov podľa stavu.

Rozhodnutia, ktoré sa nemenia: dva typy widget a portál; vstavané
rozhrania sú v zozname ako pevné riadky; správca vidí počty ticketov,
nie obsah; riešiteľ len svoje kanály; klik na kanál = /channels/<kľúč>
(rozcestník); podmenu s jednou položkou sa nekreslí; bez JavaScriptu.

Pravidlá: jedno plné tlačidlo; otvorená úloha ?new=1 ho prevezme;
zoznam s 2–3 údajmi = karty/List na všetkých šírkach; tlačidlá kariet
tiché; jedna z 2 = .choice-row; žiadne UUID na obrazovke; stav .tag--*,
hlášky .lnote; rámy 390 tmavá a 1440 svetlá; terč 44 px.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. .form-group „Kanály" s .form-list: riadok = ikona typu, názov,
   podnadpis „Widget · helpdesk@futbalsfz.sk · verejný", vpravo štítok
   „6 otvorených" (tag--draft, pri nule nič) a ›; celý riadok odkaz.
2. Zlyhaná alebo meškajúca synchronizácia schránky → tag--expired
   „Schránka nesynchronizuje" v riadku.
3. .form-group „Vstavané v intranete": dva riadky bez šípky, sivé
   „nenastavuje sa".
4. Nový kanál: ?new=1 → .task-card navrchu (typ ako dva .choice-row
   s vysvetlením, názov, plné Vytvoriť kanál + Zrušiť); hlavičkové
   tlačidlo sa skryje; bez ?new=1 sa formulár nekreslí.
5. Riešiteľ: len jeho kanály, bez Vstavaných a Nového kanála, počet
   otvorených ticketov ako hlavný údaj; prázdny stav .empty.

Rámy: 1440 svetlá — správca s dvomi kanálmi (widget ISSF Helpdesk so
schránkou a 6 otvorenými, portál Rozhodcovia) a Vstavanými; ?new=1;
widget so zlyhanou synchronizáciou. 390 tmavá — správca, riešiteľ
(podmenu Kanály · Moje tickety), prázdny stav správcu.

Výstup ako doteraz: KANALY-prehlad.html + .md so sekciami Čo sa mení,
Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
