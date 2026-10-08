# Zadanie pre Claude Design — EVAL-posudok

> Podklad pre návrh **panela posudku `Rating`** a fronty hodnotiteľa
> `/evaluation` (súpis `docs/DESIGN_ODCHYLKY.md`, sekcia 6 „evaluation"
> a bod 6 plánu „`Rating`"). Pripravené 8. 10. 2026 proti `main` po #314.
> Časť „Prompt pre Claude Design" sa skopíruje do projektu v Claude Design;
> zvyšok je kontext pre Jána.

## Prečo

`Rating.tsx` je posledný väčší komponent, ktorý celý stojí na inline
štýloch. Vznikol 15. 9. 2026 pred zavedením spoločných ovládačov:

- **Voľby Áno/Nie** sú vlastné `<button>` s farbami natvrdo (`Choice`:
  zelená/červená výplň, hrúbka písma podľa stavu). Ostatné voľby
  v aplikácii sú `.choice-row` s rádiom (test, zdroj časti kurzu).
- **Nadpis panela** je `h3` veľkými písmenami — podnadpis, ktorý P7 inde
  nahradil `.form-group-head`.
- **Polia** majú vlastný `fieldStyle` namiesto `.field-input`.
- **„Doplniť správnu odpoveď a §"** je `<button>` so štýlom odkazu,
  ktorý otvára tri polia.
- **Panel je karta s inými farbami** (`--teal-100` okraj, `--surface-2`
  pozadie). Na `/evaluation` je **karta v karte** (položka fronty je `.card`
  a panel v nej znova `.card`).
- **Režim čitateľa** pod odpoveďou: „Sedí táto odpoveď?" + Sedí / Nesedí
  rovnakými vlastnými tlačidlami, pri „Nesedí" formulár `ReportInaccuracy`
  s plným „Odoslať".

Na `/evaluation` je okrem toho položka fronty plná inline štýlov: štítky
s vlastnou veľkosťou písma, citát čitateľa (`borderLeft` červený),
`<details>` „Zobraziť odpoveď" so zdrojmi, nadpis druhej časti „Pripraviť ako
overenú odpoveď" ako vlastný `h2`.

## Dnešný obsah

### Pod odpoveďou na „Opýtať sa" (`/`, `.ask-rating`)

- **Čitateľ:** „Sedí táto odpoveď?" · Sedí · Nesedí.
  - „Sedí" sa uloží hneď a panel sa zmení na „Ďakujeme. Odpoveď si pozrie
    hodnotiteľ."
  - „Nesedí" sa uloží hneď a otvorí sa pole „Čo je na odpovedi zle?"
    s plným „Odoslať" (`ReportInaccuracy`).
- **Hodnotiteľ** (rola `evaluator`): karta „Ako hodnotíte túto odpoveď?"
  so stavom uloženia vpravo (ukladám… / uložené / neuložilo sa):
  - „Je odpoveď vecne správna?" — Áno / Nie;
  - „Tvrdí niečo, čo v zdrojoch nie je?" — Áno, vymyslel si / Nie, všetko
    má oporu;
  - „Doplniť správnu odpoveď a §" → Ako mala odpoveď znieť? (textarea),
    Ktoré predpisy a § to upravujú? (pole), Poznámka (textarea).

### Fronta `/evaluation`

1. `.page-head` „Na posúdenie" + štítok s počtom, `p.page-lead`.
2. Položka (`.card`): štítky „Nesedí" / „Nahlásené", dátum otázky vpravo;
   otázka; doslovná poznámka čitateľa; `<details>` odpoveď a zdroje;
   panel `Rating` v režime hodnotiteľa.
3. „Pripraviť ako overenú odpoveď": zoznam posúdených odpovedí ako formuláre
   (otázka, odpoveď, zdroje `.select-row`, § z posudku, tiché „Uložiť"
   v každej položke — R1).

## Rozhodnutia v repozitári, ktoré návrh nemení

- **Hodnotiteľ nemá tlačidlo Uložiť** — voľba sa uloží po kliknutí,
  text po opustení poľa, stav uloženia je vidieť (komentár v `Rating.tsx`,
  rozhodnutie Jána 15. 9. 2026). Je to jediné miesto, kde aplikácia ukladá
  bez odoslania formulára; zdôvodnenie: väčšina posudkov sú dve kliknutia.
- **Čitateľ má Odoslať** — veta, čo je zle, sa odosiela vedome.
- **Do fronty ide len to, čo čitateľ označil „Nesedí" alebo nahlásil**
  (rozhodnutie 15. 9. 2026). Prvý posudok záznam z fronty vyradí, na
  obrazovke ostane do obnovenia.
- **Slová čitateľa sa vypisujú doslovne a celé.**
- **Jedna cesta zápisu** `PATCH /api/rating` pre panel pod odpoveďou aj
  frontu.

## Pravidlá, ktoré návrh musí dodržať

- **Voľby:** `.choice-row` s rádiom (SwiftUI `Picker` v `Form`), nie
  farebné tlačidlá. Farba nesie stav až po voľbe, nie ovládač.
- **Žiadna karta v karte.** Panel vo fronte je časť položky, nie ďalšia
  karta.
- **Polia** `.field` + `.field-input`; podnadpisy `.form-group-head`.
- **Tlačidlá:** najviac jedno plné na obrazovke. Na `/evaluation` plné nie
  je (posudok sa ukladá sám, „Uložiť" pri overenej odpovedi je tiché).
- **Hlášky** `.lnote` (napr. poďakovanie čitateľovi, neuložilo sa).
- **Rozmery:** mobile first, rámy 390 (tmavá) a 1440 (svetlá), terč 44 px.
- **Texty** cez `i18n` (sk/cs/en); kľúče `rating.*`, `evaluation.*`
  ostávajú, nové sa pomenujú.

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Voľby Áno/Nie u hodnotiteľa.**
- **A (odporúčam):** každá otázka je `fieldset` s `legend` a dvomi
  riadkami `.choice-row` (rádio vľavo), uloženie na zmenu ostáva. Je to
  tvar odpovede v teste, ktorý ľudia poznajú.
- B: dve voľby vedľa seba ako segmentový prepínač. Bližšie dnešku, ale
  `.view-switch` je vyhradený na prepnutie pohľadu (ZAKLAD-podmenu-a-akcie)
  a dve rovnako vyzerajúce veci by sa dali zameniť.

**Q2 — Čitateľ pod odpoveďou.**
- **A (odporúčam):** riadok „Sedí táto odpoveď?" s dvomi tichými
  tlačidlami `.button--quiet .button--sm` (Sedí / Nesedí). Je to jednorazová
  akcia, nie voľba vo formulári, a pod odpoveďou má byť nenápadná. Po
  „Nesedí" pole a **tiché** „Odoslať" — plné patrí na stránke otázke.
- B: rovnaký tvar ako u hodnotiteľa (rádiá). Pre čitateľa ťažkopádne —
  jedným kliknutím má byť hotovo.

**Q3 — Doplnenie (správne znenie, §, poznámka).**
- **A (odporúčam):** `<details>` „Doplniť správnu odpoveď a §" — funguje
  bez JavaScriptu a je to rovnaký vzor ako „Časová os" na karte osoby.
- B: polia vždy otvorené. Pri väčšine posudkov zbytočne dlhá položka.

**Q4 — Položka fronty.**
- **A (odporúčam):** položka je `.card` so zložkami bez inline štýlov:
  hlavička (štítky + dátum), otázka, citát čitateľa ako `.lnote--warn`
  (alebo nová `.quote`), odpoveď v `<details>`, oddeľovač a posudok ako
  sekcia v tej istej karte so stavom uloženia vpravo v jej hlavičke.
- B: posudok ako samostatná karta pod položkou (dve karty na jednu
  odpoveď).

**Q5 — „Pripraviť ako overenú odpoveď".**
- **A (odporúčam):** ostáva na tej istej stránke ako `.form-group--lg`
  s nadpisom a vysvetlením; každá položka karta s tichým „Uložiť" (R1
  platí). Robí to ten istý človek hneď po posudku.
- B: podmenu „Na posúdenie · Overené odpovede" (dve adresy). Viac navigácie
  pri dvoch krátkych zoznamoch.

## Rámy

- 1440 svetlá:
  - `/evaluation` s dvomi položkami — jedna neposúdená, jedna s vybranými
    voľbami a otvoreným doplnením (stav „uložené");
  - pod ňou „Pripraviť ako overenú odpoveď" s jednou položkou.
- 390 tmavá:
  - pod odpoveďou čitateľ — po „Nesedí" s otvoreným poľom;
  - pod odpoveďou hodnotiteľ;
  - položka fronty so stavom „neuložilo sa".

## Prompt pre Claude Design

```
Navrhni EVAL-posudok — úpravu panela posudku Rating (pod odpoveďou na
„Opýtať sa" a vo fronte /evaluation) a položky fronty bez inline štýlov.
Je to DIFF proti existujúcim obrazovkám; texty (kľúče rating.*,
evaluation.*), ukladanie cez PATCH /api/rating a rozhodnutia ostávajú.

Dnes: voľby Áno/Nie sú vlastné tlačidlá s farbami natvrdo (zelená/červená
výplň); nadpis panela h3 veľkými písmenami; polia s vlastným štýlom;
„Doplniť správnu odpoveď a §" je tlačidlo-odkaz; panel je karta s inými
farbami a vo fronte karta v karte. Čitateľ pod odpoveďou: „Sedí táto
odpoveď?" Sedí / Nesedí, pri Nesedí pole „Čo je na odpovedi zle?" s plným
Odoslať. Hodnotiteľ: „Je odpoveď vecne správna?" Áno/Nie, „Tvrdí niečo,
čo v zdrojoch nie je?" Áno, vymyslel si / Nie, všetko má oporu, doplnenie
(Ako mala odpoveď znieť?, Ktoré predpisy a §?, Poznámka); stav uloženia
vpravo (ukladám… / uložené / neuložilo sa). Fronta: položka s štítkami
Nesedí / Nahlásené, dátum, otázka, doslovná poznámka čitateľa, odpoveď
v <details>, panel; pod frontou „Pripraviť ako overenú odpoveď" (formuláre
s tichým Uložiť).

Rozhodnutia, ktoré sa nemenia: hodnotiteľ nemá Uložiť — voľba sa uloží
po kliknutí, text po opustení poľa, stav uloženia je vidieť; čitateľ
odosiela vedome; slová čitateľa sa vypisujú doslovne a celé.

Pravidlá: voľby .choice-row s rádiom, farba nesie stav až po voľbe;
žiadna karta v karte; polia .field + .field-input, podnadpisy
.form-group-head; najviac jedno plné .button na obrazovke (na
/evaluation žiadne); hlášky .lnote; rámy 390 tmavá a 1440 svetlá;
terč 44 px.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. Hodnotiteľ: každá otázka fieldset s legend a dvomi riadkami
   .choice-row (rádio vľavo), uloženie na zmenu ostáva.
2. Čitateľ: riadok „Sedí táto odpoveď?" s tichými .button--quiet
   .button--sm Sedí / Nesedí; po Nesedí pole a tiché Odoslať.
3. Doplnenie v <details> „Doplniť správnu odpoveď a §".
4. Položka fronty = jedna .card: hlavička (štítky + dátum), otázka,
   citát čitateľa (.lnote--warn alebo nová .quote), odpoveď v
   <details>, oddeľovač, posudok ako sekcia tej istej karty so stavom
   uloženia vpravo v jej hlavičke.
5. „Pripraviť ako overenú odpoveď" ostáva na stránke ako .form-group--lg, položky karty
   s tichým Uložiť.

Rámy: 1440 svetlá — /evaluation s dvomi položkami (neposúdená; posúdená
s otvoreným doplnením a stavom „uložené") a „Pripraviť ako overenú odpoveď" s jednou
položkou. 390 tmavá — čitateľ pod odpoveďou po Nesedí, hodnotiteľ pod
odpoveďou, položka fronty so stavom „neuložilo sa".

Výstup ako doteraz: EVAL-posudok.html + .md so sekciami Čo sa mení, Kde,
Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
