# Zadanie pre Claude Design — OSOBY-karta-osoby

> Podklad pre návrh **karty osoby bez karty v karte** (súpis
> `docs/DESIGN_ODCHYLKY.md`, sekcia people/[id]). Pripravené 8. 10. 2026
> proti `main` po #308. Časť „Prompt pre Claude Design" sa skopíruje do
> projektu v Claude Design; zvyšok je kontext pre Jána.

## Prečo

`/people/<id>` je najdlhší formulár v aplikácii (12 polí a tri výbery).
Vznikal po kúskoch, takže dnes:

- **Karta v karte:** celý formulár je jedna `.card` s vlastným odsadením
  (inline `padding: 20`). Výbery Skupiny, Trasy a Roly sú `.form-group`
  s vlastnou kartou, teda karta v karte. Konvencia a SwiftUI `Form` majú
  sekcie vedľa seba, nie vnorené.
- **Polia bez zoskupenia:** sú pod sebou v jednom stĺpci — e-mail, meno,
  priezvisko, tituly, pozícia, mobil, pracovisko, oddelenie, typ osoby, jazyk,
  pohlavie. Pri 12 poliach sa na telefóne hľadá posúvaním.
- **„Uložiť":** jediné plné tlačidlo je až na konci dlhého formulára. Na
  telefóne je to 3–4 obrazovky posúvania.
- **„Prístup a členstvo"** (`<details>`): pozvánka, vylúčenie s potvrdením
  kódom, dátum skončenia vzťahu, návrat. Tvar sa od 7. 10. 2026 líši od
  ostatných stránok, kde sú takéto akcie v karte „Ďalšie akcie" pod
  formulárom (ZAKLAD-lista-ulozenia).
- **Hlavička:** pod nadpisom sú dva riadky s inline štýlmi (e-mail, predošlé
  adresy, posledné prihlásenie, cez čo sa prihlasuje).
- **Povinnosti osoby** (stav potvrdení s časovou osou) sú na konci stránky
  v ďalšej karte s inline štýlmi.

## Dnešný obsah (poradie na stránke)

1. Hlavička: meno s titulmi + stav osoby (`tag`), e-mail (+ predošlé),
   „naposledy …" / „pozvaná, ešte sa neprihlásila" · „prihlasuje sa cez …".
2. Formulár (jedna karta), v tomto poradí:
   - e-mail (s vysvetlením, že zmena adresy nemení históriu);
   - meno a priezvisko vedľa seba, titul pred a za menom vedľa seba
     (s poznámkou o evidencii);
   - pozícia a mobilný telefón (krajina + číslo);
   - pracovisko a oddelenie (výber; pri prázdnom číselníku odkaz na
     nastavenia);
   - typ osoby (zamestnanec, externý, rozhodca…), jazyk prostredia, pohlavie;
   - **Skupiny** (ValueSelect od #308), **Trasy**, **Roly** — `.form-group`
     s riadkami `.select-row`;
   - „Uložiť" (plné).
3. „Prístup a členstvo" (`<details>`):
   - pozvánka (len kým sa osoba neprihlásila);
   - vylúčiť (dátum, potvrdenie e-mailom, `button--danger`);
   - dátum skončenia vzťahu (pre vylúčenú);
   - vrátiť (tiché).
4. Povinnosti: zoznam dokumentov so stavom a časovou osou
   (`EvidenceTimeline`), odkaz „Všetci ľudia".

## Pravidlá, ktoré návrh musí dodržať

- **Tlačidlá:** najviac jedno plné. Pri dlhom formulári je to „Uložiť" v lište
  `.set-savebar`, ako `/organisation/general` a stránky z ZAKLAD-lista-ulozenia.
  Vedľajšie a nevratné akcie sú v karte „Ďalšie akcie" (`.more`), nevratné
  `.button--danger` s potvrdením cez adresu.
- **Formuláre:**
  - `.form-group` (nadpis nad kartou) pre výbery;
  - `.set-sec` (nadpis vľavo, polia vpravo) pre nastavenia;
  - žiadna karta v karte.
- **Hlavička:** `.page-head` + `p.page-lead`, bez inline štýlov.
- **Bez JavaScriptu:** stav je v adrese.
- **Rozmery:** mobile first, rámy 390 (tmavá) a 1440 (svetlá), terč 44 px.
- **Mená polí sa nemenia:** `givenName`, `surname`, `groups`… server ich
  ukladá jednou akciou `savePersonAction`.

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Tvar formulára.**
- **A (odporúčam):** jeden `form.card.set-form` so sekciami `.set-sec`
  (nadpis a vysvetlenie vľavo, polia vpravo od 1024 px, pod sebou na
  telefóne), ako `/organisation/general`. Návrh sekcií:
  - **Osoba** (meno, priezvisko, tituly);
  - **Kontakt** (e-mail, mobil);
  - **Zaradenie** (pozícia, pracovisko, oddelenie, typ osoby);
  - **Prostredie** (jazyk, pohlavie);
  - **Skupiny a trasy**;
  - **Roly**.

  Výbery v sekciách sú riadky bez vlastnej karty: riadky `.select-row` priamo
  v tele sekcie, oddelené čiarou. Je to rovnaký tvar ako nastavenia
  organizácie, a ľudia aj organizácia sú „záznam, ktorý sa upravuje".
- B: bez vonkajšej karty — každá skupina polí je `.form-group` s vlastnou
  kartou pod sebou (iOS `Form` so sekciami). Na telefóne je to bližšie
  k iOS, na počítači je to dlhý stĺpec.

**Q2 — Uloženie.**
- **A (odporúčam):** `.set-savebar` prilepená dole s plným „Uložiť"
  a vetou „Uloží všetky sekcie na tejto stránke."
- B: tlačidlo len na konci formulára, ako dnes.

**Q3 — „Prístup a členstvo".**
- **A (odporúčam):** karta „Ďalšie akcie" pod formulárom, ako
  na `/organisation/signin` a `/admin/tenants/<kód>`:
  - poslať / znova poslať pozvánku (tiché);
  - vylúčiť (`button--danger` → `?exclude=1`, potvrdenie e-mailom
    a dátum v riadku);
  - dátum skončenia vzťahu a vrátiť (tiché).
- B: ostane `<details>` „Prístup a členstvo".

**Q4 — Povinnosti osoby.**
- **A (odporúčam):** ostanú na tej istej stránke pod „Ďalšími akciami" ako
  `.form-group` „Povinnosti" so zoznamom (dokument, stav, posledný krok
  časovej osi). Celá os sa rozbalí v riadku (`<details>`).
- B: vlastná podstránka `/people/<id>/duties` s podmenu Údaje · Povinnosti.
  Podmenu s dvomi položkami pre jednu osobu je viac navigácie, než stránka
  potrebuje.

**Q5 — Hlavička.**
- **A (odporúčam):** `.page-head` s menom a stavom, pod ním `p.page-lead`
  s e-mailom a „naposledy …". Predošlé adresy a „prihlasuje sa cez" idú do
  sekcie Kontakt ako poznámka pod e-mailom. Hlavička tak ostane na dva
  riadky.
- B: ako dnes, všetko pod nadpisom.

## Rámy

- 1440 svetlá:
  - aktívna osoba s 2 skupinami, 1 trasou, rolou hr a 3 povinnosťami;
  - pozvaná osoba (riadok pozvánky v Ďalších akciách);
  - otvorené vylúčenie `?exclude=1`.
- 390 tmavá:
  - aktívna osoba (lišta prilepená dole);
  - vylúčená osoba (dátum skončenia, Vrátiť).

## Prompt pre Claude Design

```
Navrhni OSOBY-karta-osoby — úpravu /people/<id> (karta osoby) bez karty
v karte, s jedným plným tlačidlom. Je to DIFF proti existujúcej obrazovke;
polia, ich mená (givenName, surname, titleBefore, titleAfter, email,
mobilePhone + krajina, jobTitle, workplace, departmentId, personType,
language, gender, groups + groupsNew, track, roles) a jedna serverová akcia
savePersonAction ostávajú.

Dnes: celý formulár je jedna .card (inline padding 20), polia v jednom
stĺpci pod sebou, výbery Skupiny / Trasy / Roly sú .form-group s vlastnou
kartou — karta v karte; „Uložiť" až na konci (na telefóne 3–4 obrazovky
posúvania). Pod formulárom <details> „Prístup a členstvo" (pozvánka,
vylúčiť s potvrdením e-mailom a dátumom, dátum skončenia vzťahu, vrátiť).
Na konci Povinnosti osoby (dokument, stav, časová os). Hlavička: meno
s titulmi + stav, pod ním dva riadky s inline štýlmi (e-mail, predošlé
adresy, posledné prihlásenie, cez čo sa prihlasuje).

Pravidlá: najviac jedno plné .button; dlhý formulár = .set-form so
sekciami .set-sec a .set-savebar (sticky, „Uložiť" + veta), ako
/organisation/general; vedľajšie a nevratné akcie v karte „Ďalšie akcie"
(.more) pod formulárom, nevratné .button--danger s potvrdením cez adresu;
výbery .select-row; žiadna karta v karte; .page-head + p.page-lead bez
inline štýlov; bez JavaScriptu (stav v adrese); rámy 390 tmavá a 1440
svetlá; terč 44 px.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. Jeden form.card.set-form so sekciami .set-sec: Osoba (meno,
   priezvisko, tituly) · Kontakt (e-mail, mobil) · Zaradenie (pozícia,
   pracovisko, oddelenie, typ osoby) · Prostredie (jazyk, pohlavie) ·
   Skupiny a trasy · Roly. Výbery v sekcii sú riadky .select-row priamo
   v tele sekcie (oddelené čiarou), bez vlastnej karty.
2. .set-savebar prilepená dole: plné „Uložiť" + „Uloží všetky sekcie na
   tejto stránke."
3. „Prístup a členstvo" → karta „Ďalšie akcie": pozvánka (tiché),
   Vylúčiť (danger → ?exclude=1, potvrdenie e-mailom a dátum v riadku),
   dátum skončenia vzťahu a Vrátiť (tiché).
4. Povinnosti ostávajú na stránke pod Ďalšími akciami ako .form-group
   „Povinnosti": riadok = dokument · stav · posledný krok; celá časová os
   v <details> v riadku.
5. Hlavička: .page-head (meno s titulmi + stav) a p.page-lead (e-mail ·
   naposledy …); predošlé adresy a „prihlasuje sa cez" ako poznámka pod
   e-mailom v sekcii Kontakt.

Rámy: 1440 svetlá — aktívna osoba (2 skupiny, 1 trasa, rola hr,
3 povinnosti), pozvaná osoba (pozvánka v Ďalších akciách), otvorené
vylúčenie ?exclude=1. 390 tmavá — aktívna osoba (lišta prilepená dole),
vylúčená osoba (dátum skončenia, Vrátiť).

Výstup ako doteraz: OSOBY-karta-osoby.html + .md so sekciami Čo sa mení,
Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
