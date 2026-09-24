# C1 — Informovanie dotknutých osôb (čl. 13 GDPR)

> **Čo to je:** návrh textu, ktorý dostane každý, kto v Contineu potvrdzuje
> predpisy. Ide o zamestnancov, rozhodcov, funkcionárov aj externých
> spolupracovníkov. K textu patrí návrh, kde a ako sa v systéme zobrazí.
> **Čo to nie je:** právne stanovisko. Text pripravilo IT z toho, čo systém
> naozaj ukladá; znenie posúdi a schváli DPO.
> **Pripravil:** IT (Ján Letko) · **Dátum:** 24. 9. 2026
> **Súvisiace:** ADR-012 · `GDPR_DATA_PROTECTION.md` · `O15_O16_otazky_pre_DPO.md`
> (príloha „čo sa presne ukladá")

---

## 1. Návrh riešenia

| Kde | Čo |
|---|---|
| **Stránka `/privacy`** v Contineu | celý text nižšie, v jazyku prostredia (sk, cs, en); dostupná každému prihlásenému |
| **Karta potvrdenia** pri každom predpise | jedna veta pod tlačidlom: „Čo sa pri potvrdení ukladá a ako dlho → Ochrana osobných údajov" |
| **Prvé prihlásenie** | rovnaká veta na úvodnej obrazovke |
| **Pozvánka e-mailom** | odkaz na `/privacy` v päte |

Kontakt na DPO sa na stránke **nevypisuje natvrdo**. Berie sa z osôb, ktoré majú
v systéme rolu **DPO** (ADR-012, D104). Keď sa DPO zmení, text sa opraví sám.

Text sa **nepotvrdzuje**. Informovanie podľa čl. 13 je povinnosť prevádzkovateľa,
nie súhlas dotknutej osoby. Stačí, že bol dostupný skôr, než sa údaje začali
zbierať, a že sa to dá preukázať (dátum zverejnenia verzie textu).

**Podmienka pred pilotom (C1):** text schváli DPO a zverejní sa **skôr**, než
prvý človek v pilote dostane predpis na potvrdenie.

---

## 2. Text

> Hranaté zátvorky doplní systém z nastavenia organizácie.

### Ochrana osobných údajov v systéme Contineo

**Kto je prevádzkovateľ.** Vaše osobné údaje spracúva **[Slovenský futbalový
zväz, Tomášikova 30C, 821 01 Bratislava, IČO 00 687 308]** (ďalej „zväz").
Systém Contineo prevádzkuje pre zväz dodávateľ ako sprostredkovateľ na základe
zmluvy o spracúvaní osobných údajov.

**Zodpovedná osoba (DPO).** [meno] · [e-mail]

**Na čo systém slúži.** Zväz v ňom zverejňuje záväzné predpisy a interné
smernice a eviduje, kto sa s nimi oboznámil. Systém odpovedá aj na otázky
k obsahu predpisov.

**Aké údaje a prečo**

| Údaj | Prečo |
|---|---|
| meno, e-mail, pracovná pozícia, oddelenie, typ vzťahu so zväzom | aby vám zväz mohol prideliť predpisy, ktoré sa vás týkajú, a aby ste sa mohli prihlásiť |
| **pridelenie** predpisu: kto vám ho pridelil, prečo a dokedy | doklad o tom, že ste mali povinnosť sa s predpisom oboznámiť |
| **prvé otvorenie** znenia predpisu | doklad, že vám bolo znenie sprístupnené; ukladá sa jeden záznam na znenie, nie každé zobrazenie |
| **potvrdenie oboznámenia**: čas, znenie predpisu, doslovný text potvrdenia, IP adresa a údaj o prehliadači | doklad o oboznámení s predpisom |
| **čas strávený nad znením** | informatívny údaj pre personalistu, nie doklad; nič sa podľa neho nevyhodnocuje |
| **pripomienky**: komu a kedy sa odoslali | aby vám rovnaká pripomienka neprišla dvakrát |
| **otázky, ktoré systému položíte**, a jeho odpovede | aby sa dala preveriť správnosť odpovedí |
| mobilný telefón, pracovisko a fotografia, ak ich vyplníte | interný adresár zväzu; vyplniť ich nemusíte |

**Personalista vidí pri každom človeku**, či predpis otvoril, či ho potvrdil
a koľko času nad ním strávil. Stav „otvoril a nepotvrdil" je sledovaný stav.
Personalista vás podľa neho môže upozorniť, že potvrdenie chýba.

**Pri každom predpise je uvedená zodpovedná osoba** (meno a e-mail). Na ňu sa
môžete obrátiť s otázkou k predpisu.

**Právny základ.** Určuje sa pri každom predpise zvlášť a vidíte ho pri ňom:

- **plnenie zákonnej povinnosti** (čl. 6 ods. 1 písm. c) GDPR) pri predpisoch,
  ktorých oboznámenie vyžaduje zákon, napríklad bezpečnosť a ochrana zdravia
  pri práci; pri predpise je uvedený konkrétny zákon;
- **oprávnený záujem zväzu** (čl. 6 ods. 1 písm. f) GDPR) pri interných
  smerniciach. Záujmom zväzu je preukázať, že s pravidlami, ktoré vydal,
  oboznámil tých, ktorých sa týkajú.

Údaje v adresári (mobil, pracovisko, fotografia) sa spracúvajú na základe
oprávneného záujmu zväzu na vnútornej komunikácii.

**Ako dlho**

| Údaj | Lehota |
|---|---|
| potvrdenie, pridelenie, otvorenie znenia | **3 roky od skončenia** pracovného pomeru alebo vzťahu so zväzom; ak zväz dátum skončenia nemá, od vyradenia zo systému; najdlhšie **5 rokov** od poslednej udalosti, ak nie je známy ani jeden dátum |
| schválenie predpisu a zodpovedná osoba | kým existuje aspoň jeden doklad o oboznámení s daným znením |
| čas strávený nad znením | 12 mesiacov |
| pripomienky | 90 dní |
| záznam o prístupoch (audit) | 24 mesiacov |

Po uplynutí lehoty sa záznam **zmaže celý**, neanonymizuje sa.

**Komu sa údaje dostanú.** Personalistom a správcom obsahu zväzu v rozsahu ich
úlohy. Kolegom vo zväze len údaje z adresára. Mimo zväzu sprostredkovateľom
dodávateľa, ktorí zabezpečujú prevádzku:

| Kto | Na čo | Kde |
|---|---|---|
| MongoDB Atlas | databáza a vyhľadávanie | EÚ (Frankfurt) |
| Vercel | beh aplikácie | EÚ |
| Anthropic | tvorba odpovedí na otázky; bez uchovávania a bez trénovania na dátach | [doplniť podľa zmluvy] |
| Voyage AI (cez MongoDB) | vyhľadávanie v texte predpisov | [doplniť podľa zmluvy] |
| Ecomail | odosielanie e-mailov (prihlásenie, pripomienky) | EÚ |

Údaje sa nepredávajú a nepoužívajú sa na reklamu ani na trénovanie modelov
umelej inteligencie. O nikom sa nerozhoduje automatizovane.

**Vaše práva.** Máte právo na prístup k svojim údajom, ich opravu, obmedzenie
spracúvania a prenosnosť. **Pri predpisoch s oprávneným záujmom máte právo
namietať.** Námietku posúdi DPO jednotlivo a doklad sa do jej rozhodnutia
nemaže. Výmaz dokladu o oboznámení pred uplynutím lehoty nie je možný, kým je
potrebný na preukázanie, uplatnenie alebo obhajobu právnych nárokov. Máte právo
podať sťažnosť Úradu na ochranu osobných údajov SR (dataprotection.gov.sk).

Žiadosti posielajte zodpovednej osobe (DPO) na [e-mail].

*Verzia textu: [dátum zverejnenia]*

---

## 3. Otvorené pre DPO

1. **Schválenie znenia textu.** Odpoveď: napíšte „schvaľujem" alebo opravy
   priamo do textu (sledovanie zmien).
2. **Presná rezidencia Anthropic a Voyage.** Doplní IT podľa zmluvy (C4).
3. **Termín zverejnenia.** Odpoveď: dátum.
