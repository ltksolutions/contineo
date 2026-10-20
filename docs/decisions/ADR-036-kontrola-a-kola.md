# ADR-036 — Kontrola je zadanie, beh je jej kolo; spustenie len po potvrdení

> **Stav:** prijaté · **Dátum:** 2026-10-20
> **Rozhodol:** Ján Letko (2026-10-20) — „keď kliknem na Navrhnúť doplnenie
> manuálov, tak sa hneď spustí kontrola, to nie je ok, dajme tam ešte pred
> spustením upozornenie čo sa spustí a až keď to potvrdí osoba sa spustí
> kontrola"; „takto vzniklo zbytočne veľa kontrol… a už sa v tom nevyznám";
> „navrhujem to celé prerobiť, aby som sa lepšie orientoval v kontrolách
> toho istého zadania"; „áno, súhlasím a všetky behy a kontroly manuálov
> rovno zrušme… spravíme to nanovo v novom riešení".
> **Čísla rozhodnutí:** D234–D238; Dodatok 1: D239 (mení D234).
> **Nadväzuje na:** ADR-032 (kontrola súladu, D196–D200), ADR-034 (návrhy
> z helpdesku, D221), D24 (dôkazné záznamy sa nemažú).
> **Implementácia:** krok 1 — `/library/compliance/confirm`, `stopRun`,
> `archiveRun`, `previewRun` v `lib/complianceCheck.ts`. Krok 2 — zoznam
> a detail po kontrolách s kolami podľa návrhu z Claude Design.

---

## 1. Kontext

Kontrola súladu (ADR-032) ukladá **beh**: zadanie, výsledky a rozhodnutia
v jednom zázname `compliance_runs`. Zoznam ukazuje behy, nie zadania.
„Spustiť znova" aj tlačidlo „Navrhnúť doplnenie manuálov" založia nový
samostatný beh **hneď po kliknutí** — bez rekapitulácie a bez ceny.

20. 10. 2026 tak pri návrhoch z helpdesku vznikli dva ďalšie behy toho
istého zadania (43 nerozhodnutých nálezov a druhý rozbehnutý), popri behu
z 13. 10., v ktorom bolo 44 nálezov už rozhodnutých. V zozname sedem kariet,
z nich štyri s rovnakým názvom. Ján: „už sa v tom nevyznám". Každý beh stojí
okolo 5–7 USD.

Zákaz súbežného behu toho istého výberu v kóde bol; nepomohol, lebo druhý
beh vznikol až po dobehnutí prvého.

## 2. Rozhodnutie

**D234 — Kontrola je zadanie, beh je jej kolo.** *(Zmenené Dodatkom 1,
D239: kontrola je vlastný záznam, nie odvodená skupina behov.)* Zadanie tvorí druh
(súlad dokumentov / návrhy z helpdesku), kontrolované dokumenty a pri
helpdesku kanál. Rovnaké zadanie (`sameTask`) určuje stav, neukladá sa
(D27): behy sa zoskupia podľa zadania bez migrácie. Zoznam bude mať jednu
kartu na kontrolu, detail prepínač kôl (krok 2).

**D235 — Spustenie len po potvrdení.** Každý formulár spustenia (nová
kontrola, Spustiť znova, požiadavka na kontrolu, návrhy z helpdesku) vedie
najprv na rekapituláciu `/library/compliance/confirm`: druh, kontrolované
dokumenty, normy (aj keď sa vezmú z hierarchie), model a odhad ceny a času
podľa posledného dobehnutého kola toho istého zadania. Plné tlačidlo
„Spustiť kontrolu" je na konci stránky (R2). Akcia bez `confirmed=1`
nespustí nič — platí aj pre stránky otvorené pred nasadením.

**D236 — Druhé kolo počas behu sa nedá spustiť; nerozhodnuté nálezy sa
ohlásia.** Rekapitulácia pri bežiacom kole toho istého zadania tlačidlo
neukáže. Keď má posledné kolo nerozhodnuté nálezy, povie to — nové kolo ich
neprenesie.

**D237 — Kolo sa dá zastaviť.** „Zastaviť kolo" vyprázdni zvyšok práce,
hotové dokumenty ostanú. Beh na pozadí zapisuje každú dávku s podmienkou
`stoppedAt: null`, takže po zastavení sa už nič nezapíše a slučka skončí.
Upozornenie „kontrola dobehla" po zastavení neodíde.

**D238 — Zrušenie kontroly je archív, nie mazanie.** „Zrušiť kontrolu"
nastaví `archivedAt`: kontrola zmizne zo zoznamu, bežiace kolo sa zastaví
a jej rozhodnutia sa do ďalších kôl **neprenášajú** (`keptDecisions`
ju vynechá). Záznam ostáva — prijaté nálezy sú zapísané v audite
dokumentov a odkazujú naň (D24). Koncepty dokumentov sa zrušením nemenia.

## 3. Dôsledky

- Kontroly manuálov z 10.–20. 10. 2026 sa zrušia (Ján 20. 10.) a kontrola
  sa spustí nanovo nad konceptmi s prijatými zmenami. Prijaté znenia
  v konceptoch ostávajú — sú overené a zapísané v audite.
- Rozhodnutia „ponechať" zo zrušených kontrol sa do novej kontroly
  neprenesú; model môže tie isté miesta nahlásiť znova.
- Krok 2 (zoznam po kontrolách, kolá na detaile, „Nová kontrola" s druhom
  namiesto samostatnej karty návrhov z helpdesku) ide cez návrh v Claude
  Design — mení celú obrazovku.

## 4. Zvážené a zamietnuté

- **Mazanie behov.** Jednoduchšie, ale prijaté nálezy v audite by odkazovali
  na neexistujúci záznam a o rok by sa nedalo zistiť, prečo sa text manuálu
  zmenil (D24).
- **Uložené zadanie ako samostatná kolekcia.** Dalo by kontrole vlastný názov
  a identitu, ale vyžaduje migráciu existujúcich behov. Zadanie sa dá odvodiť
  z behu; ak bude treba niečo, čo odvodiť nejde, pridá sa neskôr. *(Prekonané Dodatkom 1, D239: migrácia nie je potrebná, staré behy sú zrušené.)*
- **Potvrdenie dialógom v prehliadači (`confirm()`).** Nefunguje bez
  JavaScriptu a neukáže, čo sa spustí ani za koľko.

---

## Dodatok 1 — Kontrola je vlastný záznam (D239, 2026-10-20)

> **Rozhodol:** Ján Letko (2026-10-20) — pri implementácii návrhu
> KNIZ-kontroly-a-kola: „áno, napíš dodatok k ADR-036" na odporúčanie
> „nová kolekcia, bez migrácie".
> **Mení:** D234 v časti „zadanie sa neukladá, behy sa zoskupia podľa
> zadania" a bod „Uložené zadanie ako samostatná kolekcia" v časti 4.

### Prečo sa rozhodnutie mení

D234 odvodil kontrolu z behov hlavne preto, aby nebolo treba migrovať
existujúce behy v ostrej databáze. Ten dôvod 20. 10. 2026 zanikol: všetkých
sedem kontrol manuálov je zrušených (D238, `archivedAt`) a v zozname nie
je ani jedna živá kontrola. Návrh KNIZ-kontroly-a-kola zároveň ukázal, čo
odvodené zoskupenie nevie:

- **zmeniť zadanie** — pridaný alebo odobraný dokument by založil inú
  kontrolu a kolá by sa rozpadli presne tak, ako sa rozpadali behy;
- **stabilnú identitu a adresu** — odvodená kontrola by mala adresu
  prvého kola a názov by sa musel zapisovať do všetkých kôl;
- **naviazať požiadavku na kontrolu a pevné väzby** na konkrétnu kontrolu,
  nie na zhodu zoznamu dokumentov.

### D239 — Kontrola je vlastný záznam, kolo nesie `checkId`

- Kolekcia **`compliance_checks`**: `checkId`, `companyCode`, názov, druh
  (súlad dokumentov / návrhy z helpdesku), kontrolované dokumenty, normy
  (prázdne = nadradené z hierarchie), pri helpdesku kanál, kto a kedy
  založil, `archivedAt` / `archivedBy`.
- **Kolo** ostáva záznam v `compliance_runs` a dostane `checkId`. Zadanie
  kola (dokumenty, normy, otázky helpdesku) je v ňom **kópiou** v čase
  behu, ako doteraz — o rok má byť čitateľné, proti čomu sa kontrolovalo,
  aj keď sa zadanie kontroly medzitým zmenilo.
- **Bez migrácie.** Behy bez `checkId` (všetky do 20. 10. 2026, všetky
  zrušené) ostávajú v starom tvare a otvárajú sa z odkazu len na čítanie.
  Nová kolekcia začína prázdna.
- **Zrušenie (D238) platí pre kontrolu:** `archivedAt` na kontrole skryje
  ju aj všetky jej kolá; bežiace kolo sa zastaví. Nič sa nemaže (D24).
- **D235–D237 platia bez zmeny** — potvrdenie pred každým kolom, druhé
  kolo počas behu nie, zastavenie kola. Zhoda zadania (`sameTask`) sa
  nahrádza zhodou `checkId`.
- Rozhodnutia „ponechať" sa prenášajú medzi kolami **tej istej kontroly**.


**Implementácia (krok 2, návrh KNIZ-kontroly-a-kola, PR #402):**
`lib/complianceChecks.ts`; kolo nesie aj poradie `round`. Rozhoduje sa len
v poslednom kole (Q3) — server to stráži (`compliance.olderRound`).
Požiadavka na kontrolu (D200) spustí ďalšie kolo nezrušenej kontroly, ktorá
kontroluje všetky dokumenty požiadavky (Q2), inak založí novú; pevná väzba
nesie `fromCheckId` a po zrušení kontroly ostáva (Q5). Kolo kontroly na
adrese behu presmeruje na `/library/compliance/<checkId>?round=n`.
