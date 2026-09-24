# ADR-013 — Údaje o znení: autor, schválil, dátum schválenia, dátum účinnosti

> **Stav:** prijaté · **Dátum:** 2026-09-24
> **Zadal:** Ján Letko — „každý dokument môže mať aj údaje ako Autor (osoba
> alebo organizácia, komisia a podobne), Schválil (väčšinou osoba alebo nejaký
> orgán, napríklad Výkonný výbor SFZ), Dátum schválenia, Dátum účinnosti…
> toto potrebujeme doplniť už pri zadávaní dokumentu alebo novej verzie do
> systému. Po schválení zodpovednou osobou sa to už nemôže meniť." (2026-09-24)
> **Odsúhlasil:** Ján Letko (2026-09-24) — dátum účinnosti je to isté ako
> „Platné od"; údaje sú súčasťou schválenia; Autor a Schválil ako text
> s návrhmi; predvyplnenie z tabuľky na prvej strane `.docx` ako návrh.
> **Nadväzuje na:** ADR-006 (schvaľovanie), ADR-011 (D96 identita konceptu),
> D6, D28, D82
> **Mení:** D96 — do identity konceptu vstupujú aj údaje o znení; D82 —
> dátum účinnosti sa po schválení nedá opraviť ani pred prvým potvrdením.

---

## 1. Rozhodnutie

### D106 — Štyri údaje pri každom znení

| Údaj | Tvar | Príklad |
|---|---|---|
| **Autor** | text — osoba, útvar, komisia | Oddelenie ľudských zdrojov |
| **Schválil** | text — osoba alebo orgán | Výkonný výbor SFZ |
| **Dátum schválenia** | dátum | 7. 9. 2026 |
| **Dátum účinnosti** | dátum — **to isté ako „Platné od"** (D6) | 7. 9. 2026 |

Zadávajú sa **pri nahratí** dokumentu alebo nového znenia. Kým beží kolo
schvaľovania alebo je koncept schválený, **nedajú sa zmeniť**. Server zmenu
odmietne, nestačí, že formulár nie je vidieť.

Dátum účinnosti sa pri zverejnení **už nezadáva**, prevezme sa z konceptu. Zostáva
„Odkiaľ je dátum" (D82). **Označenie znenia** zostáva pri zverejnení a dá sa
opraviť ako doteraz.

Autor a Schválil sú **voľný text s návrhmi**: ponúkajú sa hodnoty už použité
v organizácii a názvy jej útvarov. Číselník orgánov by pri každej novej komisii
znamenal krok v nastavení navyše.

### D107 — Údaje sú súčasťou schválenia

Schvaľovateľ ich vidí pri PDF a schvaľuje ich jedným rozhodnutím s PDF aj textom.
Preto vstupujú do **identity konceptu** (`draftIdentity`, D96). Zmena údaja by
schválenie zrušila rovnako ako zmena PDF. Zámok z D106 zaručí, že sa to po
predložení nestane.

**Zámok (D106) presnejšie:** počas kola vždy; po schválení len vtedy, keď údaje
boli súčasťou schválenia. Koncept schválený ešte bez údajov (pred ADR-013) ich
doplniť smie. Obrazovka upozorní, že uložením schválenie prestane platiť.

**Koncept bez údajov si identitu zachová** — existujúce kolá a znenia sa
nepreraďujú. Keď sa ku konceptu údaje doplnia, identita sa zmení a predošlé
schválenie prestane platiť. Týka sa to napríklad Pracovného poriadku SFZ,
ktorý treba schváliť novým kolom. Tak to má byť: schválené bolo niečo bez týchto údajov.

Na predloženie na schválenie je **dátum účinnosti povinný**. Bez neho sa znenie
nedá potvrdiť (D6) a potvrdzovacia formulka ho obsahuje (D28). Ostatné tri údaje
sú nepovinné, lebo nie každý dokument má autora alebo orgán.

Po zverejnení sa údaje uložia k zneniu (`versions[]`) a **každé potvrdenie si
ich uloží ako kópiu** (rovnako ako názov a označenie). Dátum účinnosti znenia
so schválenými údajmi sa cez opravu znenia (D82) **nedá zmeniť**. Nové znenie
áno.

### D108 — Predvyplnenie z prvej strany `.docx` ako návrh

Predpisy SFZ majú na prvej strane tabuľku (Schválil, Dátum schválenia, Dátum
účinnosti, Orgán / Oddelenie). Prevod ju zachová. Pri nahratí sa z nej hodnoty
prečítajú ako **návrh** (`draftMetaSuggestion`) a formulár nimi predvyplní
prázdne polia. **Do údajov sa nič nezapíše, kým ich správca neuloží.**
Nahratie s vyplnenými poľami ich uloží hneď, lebo ich človek videl.

---

## 2. Čo sa tým vedome kazí

- **Preklep v dátume účinnosti po schválení** sa opraví len novým kolom, teda
  novým nahratím. Je to cena za to, že dátum je súčasťou schváleného.
- **Voľný text** pripúšťa „VV SFZ" aj „Výkonný výbor SFZ" vedľa seba. Návrhy to
  zmierňujú, nevylučujú.
