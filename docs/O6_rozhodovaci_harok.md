# O6 — rozhodnutia o medzerách rozhrania

> **Stav: ✅ ROZHODNUTÉ 2026-09-14.** Všetkých dvanásť otázok má odpoveď od
> Jána Letka. Hárok zostáva ako **zápis rozhodnutí a ich dôvodov**, nie ako
> formulár — pri každej otázke je, čo systém vtedy vedel, čo som navrhoval
> a ako sa rozhodlo.
> **Zdroj:** `docs/DESIGN_GAP.md`, `docs/design/README.md`, `docs/TODO.md` O6.
>
> **Dvakrát ma rozhodnutie prehlasilo a v oboch prípadoch právom** — pri
> zvončeku (bod 5) a pri rozsahoch hľadania (bod 8). Obe moje odmietnutia
> stáli na tom, čo systém vie **dnes**; Ján odpovedal z toho, kam smeruje.
> Je to zapísané pri tých bodoch, nie zahladené.

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

**Rozhodnutie: ❌ NIE, ikony budú vlastné** (Ján Letko, 2026-09-14) — *„za tých pár ikon to nestojí, aspoň budeme originálnejší.“* Žiadna závislosť. Z toho plynie úloha: **zladiť tých sedem existujúcich** (hrúbka ťahu, optická veľkosť, `viewBox`) a dokresliť ikony hlavnej navigácie v tom istom rukopise. A prestať sa pri tom odvolávať na README — je to odteraz vedomá odchýlka, nie nedopatrenie.

## 2. Položky navigácie

**Otázka:** Ktoré položky má mať hlavná navigácia a v akom poradí?

**Čo systém dnes vie.** Dnes: Prehľad · Voľné otázky · Na potvrdenie · Na
schválenie · Adresár · Knižnica · Pridelené normy · Reťaz dôkazov · Osoby.
*(Zlatá sada tu bola do 2026-09-15, viď ADR-008.)* Položky sú **podmienené
rolami** (D32) — to je zámer a nemení sa.
Návrh v README má: Prehľad · Knižnica · Opýtať sa · Nahrávanie · **Posledný
dokument** · Nastavenia. „Posledný dokument" ako obrazovka **neexistuje** a nie
je to preklep prototypu — je to riadok v tabuľke položiek s kľúčom `doc`.

**Návrh.** Zoznam nechať náš (návrh vznikol pred schvaľovaním, adresárom aj
reťazou dôkazov). Prevziať z návrhu **počty pri položkách** — tie už máme —
a **„Posledný dokument" nezavádzať**: je to skratka na jednu obrazovku, ktorú
si človek otvorí z Prehľadu, a v navigácii by zaberala miesto trvalej položke.

**Čo to stojí.** Nič, ak sa prijme návrh. „Posledný dokument" by znamenal nový
stav na osobu, teda zmenu schémy.

**Rozhodnutie: ✅ ÁNO** (2026-09-14) — zoznam zostáva náš, „Posledný dokument“ sa nezavádza.

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

**Rozhodnutie: ✅ ÁNO** (2026-09-14) — spraviť zásuvku.

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

**Rozhodnutie: ❌ NIE** (2026-09-14).

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

**Rozhodnutie: ✅ ÁNO** (Ján Letko, 2026-09-14) — a **môj návrh stál na zlom predpoklade**.

Odmietol som zvonček s tým, že počty pri položkách navigácie hovoria to isté. Hovoria to isté **len o povinnostiach**. Ján mieri inam: *„prídu notifikácie o indexovaní dokumentu a podobne“* — teda na **udalosti systému o rozrobenej práci**, ktoré žiadny počet nepokrýva: dokument sa doindexoval, prepis dobehol, dávka skončila, pripomienky odišli.

Je to vlastná kategória a vlastný dôvod existencie. Rozsah teda: zvonček **nezdvojuje počty povinností**, ukazuje udalosti, o ktorých sa človek inak nedozvie.

**Čo to stojí.** Kolekcia upozornení so stavom prečítania (zmena schémy), zdroj udalostí tam, kde dnes beží indexovanie a prepis, a obrazovka. Deň až dva. Retencia patrí k O16.

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

**Rozhodnutie: ✅ ÁNO, ale inak — a s opravou názvoslovia** (Ján Letko, 2026-09-14).

**„Útvar“ už neexistuje, používame „Oddelenie“.** Pojem zostal v návrhu aj v tomto hárku ako pozostatok; opravený je aj v `i18n.ts`, kde bol vo viditeľnom texte („Vyber menovite ľudí, nie útvar“).

**A je to iná otázka, než akú som položil.** Ja som navrhoval počítať z `assignments`, teda **komu bol dokument pridelený**. Ján navrhuje **nepovinné pole na dokumente: ktoré oddelenie ho má na starosti.** To nie je to isté:

| | otázka | zdroj |
|---|---|---|
| vlastníctvo | *kto ten predpis spravuje* | nové nepovinné pole na dokumente |
| adresáti | *komu bol uložený* | `assignments`, počíta sa |

Vlastníctvo je to, čo v knižnici chýba, a je **výrazne lacnejšie** — pole a filter, žiadna agregácia naprieč kolekciami. Adresáti sa dajú doplniť neskôr ako druhý filter, ak sa ukáže, že treba.

**Čo to stojí.** Pole + formulár + filter: pol dňa.

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

**Rozhodnutie: ✅ ÁNO** (2026-09-14) — menovateľom sú pridelení ľudia a píše sa pri čísle.

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

**Rozhodnutie: ✅ PONECHAŤ V PLÁNE** (Ján Letko, 2026-09-14) — **a moje odmietnutie bolo krátkozraké.**

Napísal som, že „nič také v systéme nie je“. To je pravda o dnešku a nepravda o zámere. Architektúra na `contineo.app/sk/technologia` má **vrstvu obsahu a integrácií**: PDF dokumenty a predpisy, FAQ, weby (RSS), interné smernice, e-mail (IMAP) a MCP konektory (Drive, SharePoint, Confluence, Notion, Slack). Všetko sa **zjednocuje do jedného indexu**. Knižnica už existuje, web a ISSF prídu.

Práve preto rozsahy zmysel dávajú: keď je všetko v jednom indexe, filter podľa **pôvodu** je jediný spôsob, ako povedať „hľadaj len v predpisoch“ alebo „len na webe“. Nie je to predstieraná voľba — je to voľba, ktorá **zatiaľ nemá na čom stáť**.

**Ako to teda spraviť.** Filter sa oprie o provenienciu (`source.{type,connector,…}`), ktorá je už naplánovaná v etape ingescie. A **pilulky sa zobrazia až vtedy, keď je zdrojov viac než jeden** — dovtedy by človek klikal na voľbu, ktorá nič nemení. Objavia sa teda samy, keď pribudne druhý zdroj.

**Čo to stojí.** Teraz nič navyše, je to súčasť ingescie. Samotné pilulky pol dňa, keď bude čo filtrovať.

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

**Rozhodnutie: ❌ NIE** (2026-09-14) — číslo, ktoré nie je porovnateľné medzi režimami hľadania, sa neukazuje.

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

**Rozhodnutie: ✅ STĹPEC „Platné do“** (2026-09-14), nie facet.

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

**Rozhodnutie: ✅ ÁNO, ale nepovinné** (Ján Letko, 2026-09-14). Normy SFZ číslo
majú, ale je **interné, nie úradné, a nie všetky ho majú**. Pole teda bude
nepovinné a nikde sa nevynucuje. Dôsledok, ktorý z toho plynie: **nesmie sa
dostať do potvrdzovacej formulky** — tá je v niektorých dokumentoch prázdna
a veta „…, číslo …" s dierou by vyzerala ako chyba systému. Je to údaj do
zoznamu a na detail, nie do dôkazu.

---

## 12. Pohodlie — poradie

**Otázka:** V akom poradí doplniť hľadanie vo filtroch, „Uložiť pohľad",
súvisiace predpisy, „Ďalšie zhody v knižnici" a „Nahlásiť nepresnosť"?

**Návrh poradia.** 1. **Nahlásiť nepresnosť** (je to spätná väzba na odpovede,
teda jediný spôsob, ako sa dozvieme, že systém odpovedá zle), 2. hľadanie vo
filtroch, 3. Uložiť pohľad, 4. súvisiace predpisy, 5. ďalšie zhody.

**Rozhodnutie: ✅ ÁNO** (2026-09-14) — poradie podľa návrhu.

---

## Čo sa nerozhoduje tu

- **Krok 3 nahrávania (schvaľovatelia)** a zoznam **„Verzie a schválenie"** na
  detaile — to je grafika k hotovému rozhodnutiu (ADR-006), netreba k tomu ďalšie.
- **Tlačidlo „Nová verzia" na detaile** — rieši O3.
- **Branding** — **už je nastavený** (overené v databáze 2026-09-14): názov, skratka „SFZ", akcentová farba `#1450DF`, logo PNG 127 kB, kontaktná adresa. Nečaká sa na nič. Zápis v `TODO.md`, že „hodnoty chýbajú", bol zastaraný a je opravený.
