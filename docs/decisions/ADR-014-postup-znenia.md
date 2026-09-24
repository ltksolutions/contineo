# ADR-014 — Postup znenia v štyroch krokoch

> **Stav:** prijaté · **Dátum:** 2026-09-24
> **Zadal:** Ján Letko cez rám z Claude Design `KNIZNICA-postup-znenia`
> („mame opravene zadavanie a schvalovanie dokumentov", 2026-09-24)
> **Odsúhlasil:** Ján Letko (2026-09-24) — otázky Q1–Q4 v
> `docs/design/KNIZNICA-postup-znenia.md`, všetky „áno"
> **Nadväzuje na:** ADR-006 (schvaľovanie), ADR-011 (PDF), ADR-013 (údaje
> o znení), D28, D30, D73, D80, D91
> **Mení:** D91 — zodpovedná osoba sa smie určiť už v príprave, nielen pri
> zverejnení

---

## 1. Kontext

Nové znenie prechádzalo **deviatimi krokmi na štyroch obrazovkách**
(nahratie, detail, `/approvals`, `/documents/[id]`, `/hr`) a nikde nebolo
vidieť, v ktorom kroku je a čo príde. Formulár nového znenia bol schovaný
v „Úpravy a správa", platné znenie bolo sedem `<details>` pod sebou a údaje
o znení a predloženie boli dva formuláre s dvomi tlačidlami.

## 2. Rozhodnutie

Na detaile dokumentu je **jedna karta** so štyrmi krokmi: **Príprava →
Schválenie → Zverejnenie → Pridelenie**. Krok sa **odvodzuje** z konceptu,
kôl a pridelení (D27, `lib/versionFlow.ts`) — v modeli nepribudol žiadny stav.
Nemení sa nič z ADR-006, ADR-011 ani ADR-013: schvaľuje sa znenie, menovaní
schvaľovatelia, nie sám sebe, zamietnutie s dôvodom, PDF povinné, zámok
údajov počas kola.

### D109 — Zodpovedná osoba už v príprave (Q1, mení D91)

Zodpovednú osobu nového znenia možno určiť **v kroku 1** spolu s údajmi
o znení a schvaľovateľmi. Ukladá sa na koncepte ako `draftResponsible`
(odtlačok zo záznamu osoby); pri zverejnení prejde do znenia a z konceptu
zmizne. Pri zverejnení sa už len potvrdí, dá sa ešte zmeniť.

- **Nie je súčasťou schválenia** — neschvaľuje sa, kto bude ľuďom odpovedať,
  takže nevstupuje do identity konceptu a dá sa meniť aj počas kola.
- **Nededí sa** (D91 platí): pri novom znení ju niekto vyberie vedome;
  predvolená je len osoba zvolená v **tejto** príprave.
- **Právny základ** určuje zodpovedná osoba **po zverejnení**, ako doteraz.
  Upozornenie jej príde hneď pri zverejnení. Určenie základu už počas
  schvaľovania by potrebovalo miesto, kde koncept vidí aj osoba bez prístupu
  do knižnice — to je samostatná úloha (`docs/TODO.md`).

### D110 — Schvaľovatelia predvyplnení z posledného kola (Q2)

Formulár prípravy predvyplní schvaľovateľov z **posledného kola dokumentu**
(aj z kola predošlého znenia). Kto medzi ponúkanými nie je (vyradený,
predkladateľ sám — D69), vypadne. Dá sa zmeniť.

### D111 — Prenos pridelení ako voľba pri zverejnení (Q4)

Ak mali doterajšie znenia pridelenia, krok 3 ponúkne **zaškrtnutú** voľbu
„Prideliť nové znenie tým istým publikám" s tými istými poľami ako karta
prenosu: publiká, **nový povinný dôvod** (D30), termín. **Pôvodný termín sa
neprenáša, e-maily sa neposielajú.** Tlačidlo je „Zverejniť a prideliť".

- Dôvod a termín sa overia **pred** zverejnením. Keby prenos aj tak zlyhal,
  zverejnenie sa nevracia — hlásenie to povie a krok 4 zostane na detaile.
- Prideľuje sa **práve zverejnené znenie**, aj s účinnosťou v budúcnosti.
  Brána D73 je splnená: znenie je schválené a má dátum.
- Prideľovať smie len personalista (D67); inak sa voľba neponúka.
- Po odškrtnutí zostáva samostatná karta prenosu ako **krok 4**.

### Návrh označenia znenia (Q3)

Označenie sa v kroku 3 predvyplní z dátumu účinnosti: „úplné znenie od
1. 10. 2026". Je to návrh, píše ho a potvrdzuje človek (D57 — nie vymyslené
číslo). „Odkiaľ je dátum" (D82) sa predvyplní zo schválených údajov o znení
(„VV SFZ, 22. 9. 2026").

## 3. Dôsledky

- **Nové znenie** je hlavné tlačidlo v hlavičke detailu a vedie na
  `/library/[id]/version`. Kým sa jedno znenie pripravuje, je neaktívne.
- **Jedno tlačidlo** „Uložiť a predložiť na schválenie" (`prepareDraftAction`)
  uloží údaje, osobu a otvorí kolo; identita kola sa počíta **po** uložení,
  lebo údaje o znení sú jej súčasťou (D107).
- **Príprava sa pozná aj podľa PDF**: koncept s tým istým textom a iným PDF
  je nové znenie (ADR-011). Dovtedy sa karta ukázala len pri inom texte.
- Platné znenie je súhrn so štyrmi faktami a odkazmi; formuláre (zmena
  osoby, právneho základu, oprava údajov, história) sa otvárajú adresou
  `?open=…`, bez JavaScriptu.

## 4. Čo sa nerobí

- „Zahodiť koncept" — funkcia neexistuje, rám ju kreslil; nepridáva sa.
- Veta „schvaľovatelia uvidia, že sa nič nezmenilo" — `/approvals` kolá
  neporovnáva, veta by klamala.
- Počet článkov textu v kroku 2 — údaj sa nikde neukladá.
