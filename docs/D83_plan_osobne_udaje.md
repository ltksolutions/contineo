# D83–D88 — evidencia osoby: meno, priezvisko, pozícia, mobil, pracovisko

> **Stav:** ✅ rozhodnuté 2026-09-14 (Ján), **realizované** vrátane interného
> adresára (D87) — polia v `lib/persons.ts`, číselník `workplace`,
> `tenant.phonePrefix`, obrazovka `/directory`, migrácia `npm run migrate:personname`.
> Nadväzuje na D46 (karta osoby), D47 (automatické založenie), D49 (oddelenia),
> D52 (meno a pozícia z adresára), D55 (číselníky na tenanta), D32 (izolácia
> organizácie). Dotýka sa `docs/PRIHLASENIE_A_SPRAVA_OSOB.md`,
> `docs/GDPR_DATA_PROTECTION.md`, `docs/CISELNIKY_governance.md`.

## 1. Čo sa žiada

Pri osobe sa dnes eviduje **jedno pole na meno**. Potrebujeme: Meno, Priezvisko,
Pracovná pozícia, Oddelenie, Mobilný telefón, Pracovisko (mesto/obec, kde človek
štandardne vykonáva prácu).

## 2. Čo v kóde už bolo (overené v kóde, nie v dokumentácii)

| Údaj | Stav pred zmenou |
|---|---|
| `fullName` | jediné pole na meno, povinné, vo formulári aj v importe |
| `givenName`, `surname` | **v schéme sú** (D52), ale plní ich **výhradne Entra adresár**; nie sú vo formulári, v `PersonRow` ani v CSV |
| `jobTitle` | v schéme aj vo formulári karty osoby; **chýba** v pozvánke a v CSV |
| `department` / `departmentId` | hotové (D49) |
| mobil | **neexistuje** |
| pracovisko | **neexistuje** |

## 3. Rozhodnutia

### D83 — meno a priezvisko sa zadávajú, `fullName` sa odvodzuje

Formulár má polia **Meno** a **Priezvisko**. `fullName` sa **dopočíta** ako
`"{givenName} {surname}"` a ďalej sa ukladá do `persons`.

*Prečo nie tri nezávislé polia:* `fullName` sa v okamihu potvrdenia **zamrazuje**
do `acknowledgements` a do auditu ako kópia v čase. Keby sa dalo prepísať
nezávisle od mena a priezviska, zoznam osôb a záznam o potvrdení by o tom istom
človeku tvrdili dve rôzne veci a nebolo by ako rozhodnúť, ktorá platí.

*Čo to nemení:* žiadny existujúci záznam. Potvrdenia, audit, HR výkazy a exporty
čítajú `fullName` ďalej a nevedia, že vznikol inak.

### D84 — tituly sú samostatné polia a **nie sú** v `fullName`

`titleBefore` („Ing.", „Mgr.") a `titleAfter` („PhD.", „CSc.") sú voliteľné
evidenčné polia. Skladá ich zobrazovacia funkcia pre kartu osoby, adresár
a tlačové výstupy.

*Prečo mimo `fullName`:* titul je vec, ktorá počas života pribudne. Keby bol
súčasťou `fullName`, ten istý človek by v starých potvrdeniach vystupoval pod
iným menom než v nových — a rozdiel by nebol zmenou osoby, ale zmenou titulu.
Záznam o potvrdení má niesť **holé meno**, lebo to je údaj, ktorý identifikuje
človeka, nie jeho kvalifikáciu.

### D85 — pracovisko je číselník na tenanta

Nový otvorený číselník `workplace` v `CUSTOM_CODELISTS`. Kľúč v tvare
`banska_bystrica`, popiska `Banská Bystrica`. Spravuje sa v existujúcej záložke
*Číselníky* v `/organisation`, vrátane počítadla použitia a auditu.

*Prečo číselník a nie voľný text:* „BA", „Bratislava" a „bratislava" by boli tri
pracoviská a filter by ani na jedno nesadol — to je presne dôvod, pre ktorý
`CISELNIKY_governance.md` existuje. Zároveň to otvára neskoršie prideľovanie
noriem podľa pracoviska bez ďalšej migrácie.

*Vedomá odchýlka:* `CUSTOM_CODELISTS` boli doteraz komentárom vyhradené pre
číselníky **obsahu** a `codelistUsage()` počíta nad `documents`. Pracovisko
popisuje ľudí, takže počítadlo musí vedieť, nad ktorou kolekciou daný číselník
žije. Komentár pri `CUSTOM_CODELISTS` sa opravuje, nie obchádza.

### D86 — mobil sa normalizuje do E.164, predvoľba je vlastnosť tenanta

Ukladá sa `+421905123456`. Číslo začínajúce `0` sa doplní o **predvoľbu
tenanta** (`Tenant.phonePrefix`, predvolene `+421`); číslo s `+` sa berie ako
medzinárodné a predvoľba sa naň nepoužije. Čo sa po odstránení medzier,
pomlčiek, lomiek a zátvoriek nedá prečítať ako číslo, sa **neuloží** a povie to.

*Prečo predvoľba na tenanta a nie natvrdo `+421`:* Contineo nie je systém jedného
zväzu. Zadrôtovaná slovenská predvoľba by českému zákazníkovi ticho vyrobila
neplatné čísla — a tichá chyba v telefónnom čísle sa zistí až vtedy, keď treba
niekomu zavolať.

### D87 — mobil a pracovisko vidí každý prihlásený v organizácii

Vzniká **interný adresár** — obrazovka pre každú aktívnu osobu tenanta: meno
s titulmi, pozícia, oddelenie, pracovisko, adresa, mobil. Nie je verejný
(len za prihlásením), vyradené osoby v ňom nie sú, mobil je nepovinný.

*Čo to znamená mimo kódu:* mobilný telefón je nová kategória osobného údaja
a sprístupnenie celej organizácii je nové spracovanie. Patrí do záznamu
o spracovateľských činnostiach a do tabuľky kategórií v
`docs/GDPR_DATA_PROTECTION.md`. Kód to nevyrieši.

### D88 — `directorySyncedAt` nahrádza `givenName` ako známka doplnenia z adresára

`missingFromDirectory()` sa dnes pýta „má prázdny `givenName`?" a funguje to len
preto, že `givenName` plní **výhradne** Graph. Od D83 ho vypĺňa aj personalista —
a systém by potom usúdil, že osoba je z adresára vybavená, a **nikdy by si
nevypýtal pozíciu, mobil ani pracovisko**. Preto samostatná známka
`directorySyncedAt`.

## 4. Pravidlá plnenia z okolia

**CSV import.** Pribúdajú hlavičky pre meno, priezvisko, tituly, pozíciu, mobil
a pracovisko. Pracovisko, ktoré v číselníku nie je, sa **nevyplní — a riadok sa
nezahodí**: osoba sa založí bez pracoviska a súhrn importu neznáme hodnoty
vypíše, aby ich personalista doplnil do číselníka a import zopakoval. Prázdna
hodnota sa preskakuje rovnako. Neuložiteľný mobil sa správa rovnako ako
neznáme pracovisko: pole ostane prázdne, riadok prejde, súhrn to povie.

*Prečo sa riadok nezahadzuje:* meno, adresa a oddelenie sú platné aj bez
pracoviska. Zahodiť celého človeka pre jedno evidenčné pole by znamenalo, že
personalista rieši preklep v číselníku namiesto toho, aby mal ľudí v systéme.

**Entra adresár (Graph).** Pribúdajú `mobilePhone`, `officeLocation`, `city`.
Platí doterajšie pravidlo: **dopĺňa sa len to, čo je prázdne** — ručná oprava
vydrží. Pracovisko z adresára sa páruje na číselník podľa normalizovaného názvu;
čo sa nespáruje, ostane nevyplnené.

**Formulár pozvania.** Dopĺňa sa pozícia, mobil a pracovisko.

## 5. Kroky

| # | Krok | Obsah |
|---|---|---|
| 1 | Dátový model a knižnica | `persons.ts`, `people.ts`, číselník `workplace`, odvodenie `fullName`, normalizácia mobilu, testy |
| 2 | Obrazovky HR | karta osoby, pozvánka, zoznam osôb — mobile first |
| 3 | Plnenie z okolia | CSV import, Graph, `auth.ts`, `directorySyncedAt` |
| 4 | Migrácia | skript najprv nasucho, s výpisom |
| 5 | Interný adresár | nová obrazovka + GDPR dokumentácia |
| 6 | Poupratuj | `docs/TODO.md`, `CHANGELOG.md`, `docs/DEVLOG.md`, commit |

## 6. Migrácia existujúcich osôb

1. Kde Graph už `givenName`/`surname` dal — použijú sa, nič sa nehádže.
2. Inak sa `fullName` rozdelí po **prvej medzere**: prvé slovo meno, zvyšok priezvisko.
3. Čo sa rozdeliť nedá (jedno slovo, `fullName` rovné adrese) — **nechá sa prázdne
   a vypíše**. Karta osoby to označí a personalista doplní.
4. **`fullName` migrácia neprepisuje nikdy.** Prepočíta sa až pri prvom uložení karty.

Skript beží najprv nasucho a vypíše, čo by spravil.

## 7. Riziká

| Riziko | Ošetrenie |
|---|---|
| Adresár prestane dopĺňať údaje | D88 — samostatná známka `directorySyncedAt` |
| Zlé rozdelenie mena („Ing. Ján Letko", dvojité priezviská) | beh nasucho; nerozdeliteľné sa nechávajú prázdne; `fullName` sa nemení |
| Mobil celej organizácii | za prihlásením, len aktívne osoby, nepovinné; záznam o spracovaní |
| Únik medzi organizáciami | `companyCode` v podmienke, nie v kontrole nad ňou (D32) — v adresári aj v číselníku |
| Zaplnenie číselníka preklepmi z importu | import pracovisko **nezakladá**, len páruje |
| `npm run build` zhodí bežiaci dev server | overovať testami, build až na záver |
