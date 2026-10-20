# Zadanie pre Claude Design — KNIZ-kontroly-a-kola

> Podklad pre **prestavbu Kontroly súladu** (`/library/compliance`) podľa
> ADR-036: kontrola je zadanie, beh je jej kolo. Pripravené 20. 10. 2026
> na pokyn Jána („celé tie Kontroly sú veľmi neprehľadné… navrhujem to celé
> prerobiť, aby som sa lepšie orientoval v kontrolách toho istého zadania,
> jedného typu súladu a kontroly"). Časť „Prompt pre Claude Design" sa
> skopíruje do projektu v Claude Design; zvyšok je kontext pre Jána.

## Prečo

Zoznam kontrol ukazuje **behy**, nie zadania. Každé „Spustiť znova" a každé
„Navrhnúť doplnenie manuálov" pridá novú kartu s rovnakým názvom. 20. 10.
bolo v zozname sedem kariet, z toho štyri „Návrhy z helpdesku do manuálov
— ISSF Helpdesk" s rôznym stavom (44 rozhodnutých, 43 nerozhodnutých,
rozbehnutá 4 z 10). Ján nevedel, ktorá platí, a všetky kontroly manuálov
zrušil, aby začal nanovo.

Krok 1 ADR-036 je už v kóde: rekapitulácia pred spustením
(`/library/compliance/confirm`), „Zastaviť kolo", „Zrušiť kontrolu"
(archív). Tento návrh je krok 2: ako vyzerá zoznam a detail, keď sa behy
zoskupia do kontrol s kolami.

## Čo je dnes

**Zoznam `/library/compliance`** (šírka 880, karty):

1. Nadpis, úvodná veta, hlásenie.
2. **Požiadavky na kontrolu** (pri novom znení dokumentu v pevnej väzbe,
   D200): karta s dokumentom a normami, „Spustiť kontrolu" a „Nevyžaduje
   kontrolu" s dôvodom.
3. **Formulár novej kontroly**: názov, kontrolované dokumenty (výber),
   referenčné normy (výber, prázdne = nadradené z hierarchie), plné
   „Skontrolovať súlad".
4. **Kontroly**: samostatná karta „Návrhy z helpdesku do manuálov — kanál"
   s tlačidlom „Navrhnúť doplnenie manuálov"; pod ňou karta každého behu:
   názov, stav (`N nálezov, M nerozhodnutých` / `Skontrolované X z Y` /
   zastavené), kto a kedy, „10 → Proti: normy…", „Otvoriť".
5. **Pevné väzby**: dokument → normy, „Zrušiť".

**Detail `/library/compliance/[runId]`** (KNIZ-kontrola-suladu-detail):
nadpis = názov behu, „10 dokumentov proti 7 normám · spustil … dátum",
akcie Spustiť znova / Uložiť ako pevné väzby / Premenovať, pás priebehu
(„62 z 62 nálezov rozhodnutých", druhy nálezov, údaje o behu: model,
minúty, cena), dvojstĺpec: zoznam dokumentov vľavo, súhrn a nálezy
dokumentu vpravo (Nerozhodnuté · Rozhodnuté · Všetky), rozhodnutie
nálezu (Ponechať / Prijať a upraviť, dôvod, „Uložiť a ďalší").

## Model po ADR-036

- **Kontrola** = zadanie: druh (*súlad dokumentov* alebo *návrhy
  z helpdesku*), kontrolované dokumenty, pri helpdesku kanál. Normy sa
  môžu medzi kolami meniť (nové znenie normy), zadanie nie.
- **Kolo** = jeden beh. Má dátum, kto spustil, stav (beží X z Y / dobehlo /
  zastavené / zlyhalo), model, minúty, cenu a nálezy s rozhodnutiami.
- Rozhodnutia „ponechať" sa prenášajú do ďalšieho kola; prijaté sú už
  v koncepte dokumentu.
- **Zrušená kontrola** v zozname nie je (archív, D238).
- Názov patrí kontrole (dnes je pri behu).

## Čo navrhnúť

1. **Zoznam kontrol** — jedna karta na kontrolu: názov, druh, čo proti
   čomu, stav posledného kola (beží / dobehlo s N nerozhodnutými /
   všetko rozhodnuté), počet kôl, dátum posledného. Ako odlíšiť kontrolu,
   ktorá čaká na rozhodnutie, od uzavretej.
2. **Nová kontrola** — jeden vstup pre oba druhy (súlad / návrhy
   z helpdesku), nie samostatná karta s tlačidlom. Po vyplnení ide na
   rekapituláciu (už existuje, môže sa upraviť).
3. **Detail kontroly s kolami** — ako sa prepína medzi kolami (posledné
   predvolene, staršie na čítanie), kde sú akcie kontroly (Nové kolo,
   Premenovať, Pevné väzby, Zrušiť) a kde akcie kola (Zastaviť), ako je
   vidieť, čo sa medzi kolami zmenilo (nové nálezy / prenesené
   ponechania).
4. **Požiadavky na kontrolu a pevné väzby** — ostávajú na zozname; ako
   sa majú k novej štruktúre (požiadavka = podnet na nové kolo existujúcej
   kontroly?).
5. Mobil 390 px a iPad.

## Otázky na rozhodnutie (s odporúčaním)

- **Q1 — Kolá na detaile:** A) prepínač pohľadu `.view-switch`
  „Kolo 3 · Kolo 2 · Kolo 1" nad pásom priebehu *(odporúčam: 2–4 kolá sú
  typický prípad a prepínač je už zavedený prvok)*; B) rozbaľovací výber
  kola; C) zoznam kôl pod pásom priebehu.
- **Q2 — Požiadavka na kontrolu:** A) spustí nové kolo existujúcej
  kontroly s tými istými dokumentmi *(odporúčam: väzba vznikla z kontroly,
  patrí k nej)*; B) samostatnú kontrolu ako dnes.
- **Q3 — Staré kolá:** A) na čítanie, rozhodovať sa dá len v poslednom
  *(odporúčam: rozhodnutie v starom kole by sa do posledného nepremietlo)*;
  B) rozhodovať v ktoromkoľvek.

## Prompt pre Claude Design

> Navrhni prestavbu obrazovky **Kontrola súladu dokumentov** v intranete
> Contineo (Knižnica). Dizajnový systém Contineo, vzor Apple HIG /
> SwiftUI na všetkých šírkach, mobile first (390 px, iPad, ≥ 1024 px),
> svetlá aj tmavá téma, slovenské texty.
>
> Dnes zoznam ukazuje každý beh kontroly ako samostatnú kartu a ľudia sa
> v tom strácajú (štyri karty s rovnakým názvom). Nový model: **kontrola
> je zadanie** (druh: súlad dokumentov alebo návrhy z helpdesku do
> manuálov; kontrolované dokumenty; pri helpdesku kanál), **beh je jej
> kolo** (dátum, kto, stav, model, cena, nálezy s rozhodnutiami
> Ponechať / Prijať a upraviť).
>
> Navrhni tri obrazovky:
> 1. **Zoznam kontrol** — požiadavky na kontrolu hore, jedna karta na
>    kontrolu (názov, druh, čo proti čomu, stav posledného kola, počet
>    kôl), pevné väzby dole. Jedno plné tlačidlo „Nová kontrola" vpravo
>    v hlavičke.
> 2. **Nová kontrola** — druh (súlad / návrhy z helpdesku s výberom
>    kanála), názov, kontrolované dokumenty, normy (prázdne = nadradené
>    z hierarchie). Pokračuje na rekapituláciu s odhadom ceny.
> 3. **Detail kontroly** — hlavička s názvom a zadaním, prepínač kôl
>    (posledné predvolene, staršie len na čítanie), pás priebehu kola
>    (rozhodnuté z celku, druhy nálezov, model · minúty · cena), dvojstĺpec
>    dokumenty / nálezy ako dnes. Akcie kontroly: Nové kolo (plné),
>    Premenovať, Uložiť ako pevné väzby, Zrušiť kontrolu (na konci,
>    nenápadne). Akcia kola: Zastaviť kolo, kým beží.
>
> Pravidlá: najviac jedno plné tlačidlo na obrazovke; prepínač pohľadu je
> sivý `.view-switch`, podmenu má farbu organizácie; stav je v adrese
> (`?round=2`); bez spodnej lišty navyše; terč aspoň 44 px.
