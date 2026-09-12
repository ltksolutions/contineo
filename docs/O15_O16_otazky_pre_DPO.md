# O15 / O16 — otázky pre DPO a právnika

> **Čo to je:** zoznam rozhodnutí, ktoré Contineo potrebuje od DPO a právnika, aby sa dalo spustiť do ostrej prevádzky. Otázky sú formulované tak, aby sa dalo odpovedať „súhlasím" alebo prepísať návrh.
> **Čo to nie je:** právne stanovisko. Návrhy pri otázkach sú to, čo vyplýva z doterajšej dokumentácie produktu — sú to podklady, nie právny názor.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 12. 9. 2026 · **Odpovede prosíme do:** ____________
> **Súvisiace:** `docs/GDPR_DATA_PROTECTION.md` · `docs/OPEN_DECISIONS.md` (D10, O15, O16) · ADR-003, ADR-005, ADR-006

---

## 0. Kontext na desať riadkov

Contineo je vnútorný systém zväzu. Robí tri veci, pri ktorých vznikajú osobné údaje:

1. **Pridelí** človeku záväzný predpis — „toto si máš prečítať, do dátumu X, lebo Y".
2. **Zaznamená, že sa s ním oboznámil** — doslovné znenie formulky, ktorú potvrdil, spolu s odtlačkom mena, dokumentu a znenia v čase potvrdenia.
3. **Vedie okolo toho reťaz dôkazov** — kedy si znenie prvýkrát otvoril, koľko času nad ním strávil, komu a kedy sa pripomenulo, kto znenie schválil.

Role sú rozhodnuté (D10, 26. 6. 2026): **zväz = prevádzkovateľ, Contineo = sprostredkovateľ.** Osobitné kategórie údajov (čl. 9) sa zámerne nespracúvajú.

Nerozhodnuté zostáva dvoje: **na akom právnom základe** to stojí (O15) a **ako dlho sa to drží** (O16). Kým to nie je rozhodnuté, systém buď zbiera údaj, ktorý nevie zdôvodniť, alebo drží záznam, ktorý nevie zmazať.

---

## Časť A — Právny základ (O15)

### A1. Aký je právny základ pre záznam o oboznámení (`acknowledgements`)?

*Prečo sa pýtame:* od odpovede závisí, čo systém urobí pri prvej žiadosti o výmaz.

**Náš návrh:** plnenie povinnosti zamestnávateľa / oprávnený záujem prevádzkovateľa — **nie súhlas.** Odvolateľný súhlas a nezvratný doklad o oboznámení sú protirečenie: keby sa dal odvolať, doklad by prestal byť dokladom presne vtedy, keď je potrebný.

**Odpoveď:** ☐ súhlasím · ☐ iný základ: ______________________________

### A2. Platí ten istý základ pre celú reťaz, alebo pre každú časť iný?

Ide o `assignments` (pridelenie a jeho dôvod), `document_opens` (prvé otvorenie), `reading_times` (čas nad znením), `approval_rounds` (kto znenie schválil), `reminder_log` (komu sa v ktorý deň odoslalo).

*Prečo sa pýtame:* nie sú to rovnaké údaje. Potvrdenie je doklad o splnení povinnosti, čas čítania je meranie správania.

**Náš návrh:** rovnaký základ pre pridelenie, otvorenie, potvrdenie a schválenie — sú to časti jedného dokladu. **Čas čítania oddelene**, lebo je výslovne informatívny a dôkazom nie je.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

### A3. Ak pôjde o oprávnený záujem — kto vypracuje balančný test a dokedy?

*Prečo sa pýtame:* bez písomného testu je oprávnený záujem tvrdenie, nie doklad.

**Náš návrh:** DPO, pred spustením pilotu. Presný zoznam toho, čo sa zbiera, je v prílohe na konci.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### A4. Potvrdzujete vetu, podľa ktorej sa systém zachová pri žiadosti o výmaz?

Veta je dnes v `GDPR_DATA_PROTECTION.md` §6 a znie:

> „Potvrdenie, pridelenie a otvorenie znenia sú záznamy o splnení povinnosti voči zamestnávateľovi, nie údaje spracúvané so súhlasom — na žiadosť sa nemažú, kým trvá dôvod, pre ktorý existujú."

*Prečo sa pýtame:* je to tvrdenie o práve, nie o technike, a systém sa podľa neho zachová pri prvej žiadosti o výmaz.

**Náš návrh:** potvrdiť v tomto znení. Čas čítania sa naopak na žiadosť **vymaže** — dokladom nie je.

**Odpoveď:** ☐ potvrdzujem · ☐ upraviť takto: ______________________________

### A5. Smie sa pri potvrdení ukladať IP adresa a údaj o prehliadači?

*Prečo sa pýtame:* dnes sa ukladajú (`ip`, `userAgent`) ako okolnosti potvrdenia. Sú to údaje navyše oproti samotnému dokladu.

**Náš návrh:** ponechať — zvyšujú dôkaznú hodnotu pri spore o to, či človek potvrdil. Ak to neobstojí, vieme ich prestať ukladať do týždňa; je to jeden zápis.

**Odpoveď:** ☐ ponechať · ☐ neukladať · ☐ ukladať kratšie: ____________

### A6. Smie personalista vidieť čas čítania pri jednotlivom človeku?

*Prečo sa pýtame:* rozhodnuté 6. 9. 2026, že áno, a tak to dnes funguje. Je to údaj o správaní konkrétnej osoby zobrazený inej osobe. Zoradiť ľudí podľa neho sa zámerne nedá — rebríček by z merania bez následku následok vyrobil.

**Náš návrh:** ponechať, ale výslovne to uviesť v informovaní zamestnancov (C1).

**Odpoveď:** ☐ áno, s informovaním · ☐ len súhrnne za skupinu · ☐ nezobrazovať

### A7. Je „otvoril a nepotvrdil" prípustný údaj o človeku?

*Prečo sa pýtame:* z otvorenia a chýbajúceho potvrdenia vzniká tvrdenie „vedel a neurobil". Je to silnejší údaj než ktorýkoľvek z nich samostatne.

**Náš návrh:** áno — je to presne ten údaj, kvôli ktorému sa pripomína. Ukazovať ho však len personalistovi a vedúcemu, nie kolegom.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

---

## Časť B — Retencia (O16)

Pri každom riadku prosíme o **číslo aj o to, odkedy lehota plynie.**

### B1. `acknowledgements` — doklad o oboznámení

**Náš návrh:** ____ rokov od **skončenia pracovného pomeru**, nie od potvrdenia — aby sa doklad dal použiť aj pri spore, ktorý vznikne po odchode. Číslo prosíme doplniť.

**Odpoveď:** ______ rokov · plynie od: ☐ potvrdenia · ☐ skončenia pomeru · ☐ konca platnosti predpisu

### B2. `assignments` — pridelenie a jeho dôvod

**Náš návrh:** rovnako ako B1. Bez pridelenia sa nedá vysvetliť, prečo mal človek povinnosť — samotné potvrdenie by zostalo bez kontextu.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B3. `document_opens` — prvé otvorenie znenia

**Náš návrh:** rovnako ako B1, je to súčasť tej istej reťaze.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B4. `approval_rounds` — kto znenie schválil alebo zamietol

**Náš návrh:** rovnako ako B1. Schválenie je dôvod, prečo znenie vôbec smelo ísť ľuďom.

**Odpoveď:** ☐ rovnako ako B1 · ☐ inak: ____________

### B5. `reading_times` — čas nad znením

Rozhodnuté 6. 9. 2026: **12 mesiacov**, lehota je vynútená priamo v databáze (TTL).

**Odpoveď:** ☐ potvrdzujem · ☐ zmeniť na ____________

### B6. Audit prístupov — kto čo kedy videl

**Náš návrh:** 24 mesiacov. Je to návrh z D10, doteraz nepotvrdený.

**Odpoveď:** ☐ 24 mesiacov · ☐ ______ mesiacov

### B7. `reminder_log` — komu sa v ktorý deň pripomenulo

Dnes **90 dní** (TTL v databáze). Je to prevádzkový záznam proti dvojitému odoslaniu, nie dôkaz; dôkazom je záznam pri pridelení.

**Odpoveď:** ☐ potvrdzujem · ☐ zmeniť na ____________

### B8. Maže sa, alebo anonymizuje?

*Prečo sa pýtame:* anonymizovaný doklad o oboznámení už nie je doklad — ostane z neho štatistika.

**Náš návrh:** mazať celý riadok. Polovičné riešenie dáva to najhoršie z oboch: údaj o osobe už neposlúži ako dôkaz, ale stále existuje.

**Odpoveď:** ☐ mazať · ☐ anonymizovať · ☐ podľa kolekcie: ____________

### B9. Čo s dokladom, keď predpis prestane platiť?

*Prečo sa pýtame:* potvrdenie sa viaže na konkrétne znenie. Keď ho nahradí nové, starý doklad hovorí o niečom, čo už neplatí — ale práve on dokazuje stav v tom čase.

**Náš návrh:** držať podľa B1 bez ohľadu na to, či predpis ešte platí.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

### B10. Kto dodá dátum, od ktorého lehota plynie?

*Prečo sa pýtame:* zdrojom identity je Sportnet. Ak lehota plynie od skončenia pracovného pomeru, systém ten dátum musí dostať — inak sa lehota nikdy nespustí a nezmaže sa nič.

**Náš návrh:** zväz (HR) odovzdá dátum skončenia; dovtedy sa nemaže nič.

**Odpoveď:** ☐ súhlasím · ☐ inak: ______________________________

---

## Časť C — Čo k tomu patrí

### C1. Informovanie zamestnancov (čl. 13)

Kto text napíše a kedy sa zverejní? Musí obsahovať aspoň štyri veci: že sa **meria čas** nad znením; že ho **personalista vidí aj pri jednotlivcoch**; že sa zaznamenáva **prvé otvorenie**; a že **„otvoril a nepotvrdil"** je sledovaný stav.

**Náš návrh:** text píše DPO, IT dodá presný zoznam údajov (príloha). Zverejniť **pred** pilotom, nie po ňom.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### C2. Záznam o spracovateľských činnostiach (čl. 30)

Doplniť tieto činnosti do záznamu zväzu.

**Odpoveď:** zodpovedá ____________________ · termín ____________________

### C3. DPIA (posúdenie vplyvu)

Dokumentácia ju pri rozsahu 130k+ osôb odporúča pred produkciou.

**Náš návrh:** pre úzky pilot (jedno oddelenie, jednotky ľudí) nie je blokujúca; pred plošným nasadením áno.

**Odpoveď:** ☐ súhlasím · ☐ potrebná hneď · ☐ nie je potrebná, dôvod: ____________

### C4. Zmluvy

DPA medzi zväzom a Contineom a doložka pokrývajúca tok údajov Sportnet → Contineo. Sub-procesori: MongoDB Atlas (EÚ), Vercel (EÚ), Voyage AI (embedding), Anthropic (záložný model, zero-retention, bez trénovania).

**Odpoveď:** ☐ podpísané · ☐ v príprave, termín ____________

---

## Príloha — čo sa presne ukladá

| Kolekcia | Polia s osobným údajom |
|---|---|
| `acknowledgements` | personId, e-mail, meno, oddelenie (odtlačok v čase potvrdenia), dokument a znenie, **doslovná formulka a jej hash**, jazyk rozhrania aj dokumentu, čas potvrdenia, **IP adresa**, **user agent** |
| `assignments` | komu, kým, prečo, dokedy; kedy a koľkokrát sa pripomenulo |
| `document_opens` | personId, znenie, čas prvého otvorenia — **jeden riadok na dvojicu osoba × znenie**, nie záznam o každom zobrazení |
| `reading_times` | personId, znenie, počet sekúnd, prvé a posledné videnie |
| `approval_rounds` | kto predložil, menovaní schvaľovatelia (meno a adresa ako odtlačok), rozhodnutie, dôvod zamietnutia, kedy sa komu ozvalo |
| `reminder_log` | komu a v ktorý deň sa odoslala pripomienka |
| audit prístupov | kto, čo a kedy videl |

Dve veci, ktoré sa zámerne **nezbierajú**: doskrolovanie na koniec dokumentu a záznam o každom jednotlivom zobrazení. A personalista, ktorý si znenie otvorí na kontrolu, sa nezapisuje — zapisuje sa len ten, kto povinnosť má.

---

## Čo sa stane po odpovediach

Do systému pribudne: lehota vynútená priamo v databáze pre každú kolekciu (dnes ju majú len `reading_times` a `reminder_log`), postup pre žiadosť o výmaz, ktorý rozlíši „zmaž konverzácie" od „doklad zostáva", a text informovania viditeľný v rozhraní.

Je to práca na hodiny. Blokuje ju rozhodnutie, nie implementácia.
