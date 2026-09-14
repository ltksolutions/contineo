# O6 — rozhodovací hárok k medzeram rozhrania

> **Na čo to je:** aby sa desať otázok o rozhraní dalo prejsť naraz a odklikať,
> nie riešiť po jednej pri každej obrazovke.
> **Ako to čítať:** pri každej otázke je **čo systém dnes vie** (overené v kóde,
> nie z pamäte), **návrh** a **čo to stojí**. Stačí napísať „áno", „nie" alebo
> vlastnú odpoveď do riadku *Rozhodnutie*.
> **Zdroj:** `docs/DESIGN_GAP.md`, `docs/design/README.md`, `docs/TODO.md` O6.
> **Dátum:** 2026-09-14

Pri troch otázkach je podľa mňa správna odpoveď **nerobiť to**. Sú označené ⛔
a je pri nich napísané prečo — nie preto, že je to práca navyše, ale preto, že
by výsledok tvrdil niečo, čo nie je pravda.

---

## 1. Ikonový set

**Otázka:** Zavedieme ikonový set ako závislosť, alebo zostanú ručne kreslené ikony?

> **Oprava z 2026-09-14.** Prvá verzia tohto bodu tvrdila, že „README zakazuje
> kresliť vlastné SVG". To bolo **zavádzajúce** a Ján Letko to správne
> spochybnil. V projekte sú **dve rôzne pravidlá o SVG** a majú spolu len
> meno:
>
> 1. **`lib/branding.ts` — bezpečnosť.** SVG je zakázané ako **nahrané logo
>    tenanta**, doslova: *„je to spustiteľný dokument, môže obsahovať skript,
>    a servírovať ho z našej domény by znamenalo pustiť cudzí kód na doménu,
>    na ktorej sa potvrdzujú smernice."* Toto platí a nemení sa.
> 2. **`docs/design/README.md` — vzhľad, nie bezpečnosť.** *„Ikony sú
>    v prototype textové znaky — v produkcii ich nahradiť ikonovým setom
>    projektu (SVG, `currentColor`, 16 px). Nekresliť nové SVG od ruky."*
>    Je to pravidlo o jednotnosti ikon, nie o riziku. Naše vlastné SVG
>    v komponentoch je náš kód, nie cudzí obsah.
>
> Rozhodnutie je teda **estetické a údržbové**, nie bezpečnostné.

**Čo systém dnes vie.** Navigácia je bez ikon. V `Header.tsx` je **sedem
ručne kreslených SVG** (téma v troch stavoch, nastavenia, odhlásenie, návod,
moje potvrdenia) — dve z nich pribudli 14. 9. 2026. Projekt teda to pravidlo
z README **už dnes nedodržiava**.

**Návrh.** Zaviesť jeden set (Lucide alebo Heroicons, oba MIT, oba
`currentColor` a 16/24 px) a prekresliť naň aj tých sedem. Dôvod je ten, ktorý
mal README na mysli: ručne kreslené ikony sa rozchádzajú vo váhe ťahu
a v optickej veľkosti, a je to vidieť až vtedy, keď stoja vedľa seba
v jednom menu.

**Protiargument, ktorý stojí za zváženie:** sedem ikon je málo a závislosť je
navždy. Ak povieš „ručne kreslené sú náš vzhľad", je to legitímna odpoveď —
len potom treba zladiť tie existujúce a prestať sa odvolávať na README.

**Čo to stojí.** Set: nová závislosť (~50 kB, tree-shakeable), pol dňa
vrátane prekreslenia. Zladiť ručné: pár hodín, žiadna závislosť.

**Rozhodnutie:** ______________________________________________

## 2. Položky navigácie

**Otázka:** Ktoré položky má mať hlavná navigácia a v akom poradí?

**Čo systém dnes vie.** Dnes: Prehľad · Voľné otázky · Na potvrdenie · Na
schválenie · Adresár · Knižnica · Pridelené normy · Reťaz dôkazov · Osoby ·
Zlatá sada. Položky sú **podmienené rolami** (D32) — to je zámer a nemení sa.
Návrh v README má: Prehľad · Knižnica · Opýtať sa · Nahrávanie · **Posledný
dokument** · Nastavenia. „Posledný dokument" ako obrazovka **neexistuje** a nie
je to preklep prototypu — je to riadok v tabuľke položiek s kľúčom `doc`.

**Návrh.** Zoznam nechať náš (návrh vznikol pred schvaľovaním, adresárom aj
reťazou dôkazov). Prevziať z návrhu **počty pri položkách** — tie už máme —
a **„Posledný dokument" nezavádzať**: je to skratka na jednu obrazovku, ktorú
si človek otvorí z Prehľadu, a v navigácii by zaberala miesto trvalej položke.

**Čo to stojí.** Nič, ak sa prijme návrh. „Posledný dokument" by znamenal nový
stav na osobu, teda zmenu schémy.

**Rozhodnutie:** ______________________________________________

---

## 3. Navigácia na telefóne

**Otázka:** Zásuvka (drawer), alebo zostane posúvateľný pás?

**Čo systém dnes vie.** Pás má `overflow-x: auto` bez náznaku, že sa dá
posúvať, takže posledná položka je odseknutá v polovici slova („Pridelené
no…"). **Nie je to odchýlka od návrhu** — kanvas má to isté. Návrh to rieši
v kroku 7: zásuvka, karty, 44 px plochy na dotyk. Ten krok sa neurobil.

**Návrh.** Urobiť zásuvku. Mobile-first je pri tomto projekte povinnosť a
odseknuté slovo v navigácii je prvá vec, ktorú človek na telefóne uvidí.

**Čo to stojí.** Deň práce. Zásuvka potrebuje klientsky stav, takže pribúda
JavaScript na obrazovke, ktorá dnes funguje aj bez neho — treba ju nechať
funkčnú aj bez skriptu (pás zostane ako záloha).

**Rozhodnutie:** ______________________________________________

---

## 4. Prepínač organizácie v hlavičke

**Otázka:** Má hlavička ponúkať prepnutie medzi organizáciami?

**Čo systém dnes vie.** Nie je. Organizácia sa určuje **z domény** (D29/D32) a
človek patrí do jednej. Prepínač by dnes nemal medzi čím prepínať — okrem
správcu platformy, ktorý má `/admin`.

**Návrh.** ⛔ Nerobiť, kým nebude existovať človek, ktorý patrí do dvoch
organizácií. Dovtedy by to bola ponuka s jednou položkou.

**Čo to stojí.** Nerobiť: nič. Urobiť: hlavička + model členstva vo viacerých
organizáciách, čo je zmena schémy a prístupových pravidiel.

**Rozhodnutie:** ______________________________________________

---

## 5. Zvonček upozornení

**Otázka:** Zaviesť v hlavičke zvonček s počtom neprečítaných?

**Čo systém dnes vie.** Nie je. Upozornenia existujú ako **e-maily**
(pridelenie, termín, schválenie) a `reminder_log` je prevádzkový záznam, ktorý
sa po 90 dňoch maže. Stav „prečítané/neprečítané" v systéme **nie je**.

**Návrh.** Zatiaľ nie. Počty pri položkách navigácie („Na potvrdenie 1",
„Na schválenie 3") už hovoria to isté a sú tam, kde sa na ne klikne. Zvonček
by k tomu pridal druhé miesto s tou istou informáciou a nový stav na osobu.

**Čo to stojí.** Nerobiť: nič. Urobiť: nová kolekcia upozornení so stavom
prečítania, teda zmena schémy a nový zdroj pravdy vedľa odvodeného stavu (D27).

**Rozhodnutie:** ______________________________________________

---

## 6. Facet a stĺpec „Útvar"

**Otázka:** Má sa dať knižnica filtrovať podľa útvaru?

**Čo systém dnes vie.** **Dokument útvar nenesie.** Pridelenie žije
v `assignments` (`audience.kind` = `department` / `group` / `track`). Filter aj
stĺpec teda znamenajú spojenie naprieč kolekciami.

**Návrh.** Počítať z `assignments` agregáciou pri zobrazení, **nedenormalizovať**
na dokument. Uložený zoznam adresátov na dokumente je druhá kópia pravdy, ktorá
sa raz rozíde s prvou — a rozišla by sa presne vtedy, keď sa mení pridelenie,
teda keď na správnosti záleží (to je to isté pravidlo ako pri progrese trasy, D27).

**Čo to stojí.** Deň práce. Agregácia pri každom zobrazení knižnice; pri dnešnej
veľkosti (148 dokumentov) bez problémov, pri desaťnásobku treba zmerať.

**Rozhodnutie:** ______________________________________________

---

## 7. Stĺpec „Potvrdenia %"

**Otázka:** Má knižnica ukazovať, koľko percent ľudí dokument potvrdilo?

**Čo systém dnes vie.** Neukazuje. Údaj by bol agregácia nad `acknowledgements`
a nad počtom adresátov. **Menovateľ nie je zrejmý:** sú to pridelení ľudia,
alebo celá organizácia? Pri dokumente pridelenom trom ľuďom by „100 %" a „2 %"
boli obe pravdivé podľa toho, čo sa zvolí.

**Návrh.** Zaviesť, ale **menovateľom sú pridelení ľudia** a musí to byť
napísané pri čísle („12 z 14 pridelených"), nie len percento. Percento bez
menovateľa je číslo, ktoré si každý vyloží po svojom.

**Čo to stojí.** Pol dňa, ak sa počíta pri zobrazení. Predpočítavať zatiaľ
netreba.

**Rozhodnutie:** ______________________________________________

---

## 8. Pilulky rozsahu hľadania

**Otázka:** Zaviesť „Hľadať len v: Knižnica / Intranet / Verejný web / Archív"?

**Čo systém dnes vie.** **Nič také v systéme nie je.** Prehľadáva sa
`document_chunks` jednej organizácie a jediné delenie je `accessLevel`
(verejné / interné). Žiadny „intranet", „verejný web" ani „archív" ako rozsah
neexistuje.

**Návrh.** ⛔ Nerobiť. Pilulky by predstierali voľbu, ktorá nič nemení — človek
by klikol na „Archív", dostal tú istú odpoveď a stratil dôveru v celé
vyhľadávanie. Ak to raz chceme, najprv treba **rozhodnúť, čo tie rozsahy sú**
(typ zdroja? stav znenia? archív = `effectiveTo` v minulosti?), a až potom ich
pridať do `SearchOptions` a preniesť cez `/api/chat`.

**Čo to stojí.** Nerobiť: nič. Urobiť naslepo: pol dňa práce a klamlivé
rozhranie.

**Rozhodnutie:** ______________________________________________

---

## 9. Skóre zhody pri zdroji

**Otázka:** Ukazovať pri zdroji číslo zhody (napr. „0,94")?

**Čo systém dnes vie.** `score` z vyhľadávania existuje (`ChunkResult.score`),
ale `buildSources()` ho klientovi neposiela. Doplniť je pár riadkov. **Problém
nie je technický:** pri `$rankFusion` a reranku nie je skóre v rozsahu 0–1 a
medzi režimami hľadania (fulltext / vektor / hybrid) nie je porovnateľné.

**Návrh.** ⛔ Nerobiť ako číslo. Ukázať „zhoda 94 %" pri hodnote, ktorá
percentom nie je, je horšie než neukázať nič — a pri norme, podľa ktorej sa
koná, je to horšie dvojnásobne. Ak chceme čitateľovi povedať, ktorý zdroj je
najsilnejší, stačí **poradie** (zdroje už sú zoradené) prípadne doplnené
slovom, nie desatinné číslo.

**Čo to stojí.** Nerobiť: nič. Urobiť správne (kalibrovať skóre naprieč
režimami): to je samostatná úloha na dni, nie na hodiny.

**Rozhodnutie:** ______________________________________________

---

## 10. Stav „Expirovaný" v knižnici

**Otázka:** Je „expirovaný" štvrtá hodnota facetu Stav, alebo stĺpec „Platné do"?

**Čo systém dnes vie.** Dá sa odvodiť z `effectiveTo` v minulosti (D27). Ale
**nie je to iný stav dokumentu** — je to publikované znenie po dátume.

**Návrh.** Stĺpec **„Platné do"**, nie facet. Facet Stav hovorí, kde je
dokument v procese (koncept → na schválenie → publikované); dátum platnosti je
iná os a zmiešať ich znamená, že sa raz nedá vyfiltrovať „publikované aj
expirované naraz".

**Čo to stojí.** Hodiny. Údaj v dátach je.

**Rozhodnutie:** ______________________________________________

---

## 11. Identifikátor predpisu pod názvom

**Otázka:** Má mať dokument krátky úradný identifikátor (napr. `RPP-2026-04`)?

**Čo systém dnes vie.** Nemá. Dokument má `documentKey` (`sutazny_poriadok`),
ktorý je technický, a názov, ktorý je dlhý. Návrh počíta s tretím údajom —
úradným označením predpisu.

**Návrh.** Rozhodni ty, lebo je to vecná otázka, nie technická: **majú normy
SFZ úradné číslo, ktorým sa na ne odvoláva?** Ak áno, je to pole navyše
a zobrazenie. Ak nie, nezavádzajme ho — vymyslené číslo na záväznom predpise je
horšie než žiadne.

**Čo to stojí.** Pole v `documents` + formulár + zobrazenie: pol dňa. Bez
migrácie, staré dokumenty ho jednoducho nemajú.

**Rozhodnutie:** ______________________________________________

---

## 12. Pohodlie — poradie

**Otázka:** V akom poradí doplniť hľadanie vo filtroch, „Uložiť pohľad",
súvisiace predpisy, „Ďalšie zhody v knižnici" a „Nahlásiť nepresnosť"?

**Návrh poradia.** 1. **Nahlásiť nepresnosť** (je to spätná väzba na odpovede,
teda jediný spôsob, ako sa dozvieme, že systém odpovedá zle), 2. hľadanie vo
filtroch, 3. Uložiť pohľad, 4. súvisiace predpisy, 5. ďalšie zhody.

**Rozhodnutie:** ______________________________________________

---

## Čo sa nerozhoduje tu

- **Krok 3 nahrávania (schvaľovatelia)** a zoznam **„Verzie a schválenie"** na
  detaile — to je grafika k hotovému rozhodnutiu (ADR-006), netreba k tomu ďalšie.
- **Tlačidlo „Nová verzia" na detaile** — rieši O3.
- **Branding** — **už je nastavený** (overené v databáze 2026-09-14): názov, skratka „SFZ", akcentová farba `#1450DF`, logo PNG 127 kB, kontaktná adresa. Nečaká sa na nič. Zápis v `TODO.md`, že „hodnoty chýbajú", bol zastaraný a je opravený.
