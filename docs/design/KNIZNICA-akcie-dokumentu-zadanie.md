# Zadanie pre Claude Design — KNIZNICA-akcie-dokumentu

> Podklad pre návrh **akcií na detaile dokumentu** `/library/<id>` (súpis
> `docs/DESIGN_ODCHYLKY.md`, sekcia 2 „library/[id]" a výnimka pri PR
> „Hlavičky" 6. 10. 2026: „akcie detailu dokumentu (`.detail-actions`)…
> idú s úpravou knižnice"). Pripravené 8. 10. 2026 proti `main` po #317.
> Časť „Prompt pre Claude Design" sa skopíruje do projektu v Claude Design;
> zvyšok je kontext pre Jána.

## Prečo

Detail dokumentu je pracovná obrazovka správcu obsahu. Je to posledná veľká
stránka, ktorá nemá akcie podľa pravidla ZAKLAD-podmenu-a-akcie:

- **Akcie nie sú v `.page-head`.** Nad nadpisom sú štítky (stav, spracovanie,
  kategória), pod ním riadok `documentId · priečinok · platí od`, a až pod
  ním `.detail-actions` so **štyrmi tlačidlami**: Stiahnuť PDF, Stiahnuť
  zdrojový súbor, Upraviť dokument, Nové znenie. Na telefóne sa zalomia do
  dvoch–troch riadkov.
- **„Nové znenie" počas prípravy** ostáva plné, len zošedené
  (`span.button.is-disabled` s `title`). Na dotyk sa `title` neukáže, takže
  človek nevie prečo. Pod ním je karta postupu znenia s vlastným plným
  tlačidlom (Odoslať na schválenie / Prideliť vybraným) — dve plné naraz.
- **„Správa"** je `<details class="detail-tools">` na konci stránky so
  zriedkavými úkonmi: archivácia (nevratná, `button--danger`), pôvod
  z MCP konektora a „Skontrolovať zmeny", text dokumentu a jeho oprava,
  preindexovanie. Od 7. 10. 2026 majú ostatné stránky tieto úkony v karte
  „Ďalšie akcie" (`.more`) s potvrdením nevratného cez adresu
  (ZAKLAD-lista-ulozenia, OSOBY-karta-osoby).
- **Inline štýly** v pásoch archivácie, vo formulári archivácie, v pôvode
  z konektora, v hlavičke bloku Text a v prázdnom stave „nič nie je
  zverejnené".
- **Stránka zodpovednej osoby** (bez roly správcu, D151) má nadpis mimo
  `.page-head` a inline `maxWidth`.

## Dnešný obsah (poradie na stránke, správca obsahu)

1. Štítky: stav dokumentu, spracovanie (len keď nie je hotové), kategória.
2. `h1` názov, pod ním `documentId · priečinok · platí od …`.
3. Karty úlohy „Určiť právny základ", keď je správca sám zodpovednou osobou
   (ADR-023, D151).
4. `.detail-actions`: Stiahnuť PDF · Stiahnuť zdrojový súbor (len keď je) ·
   Upraviť dokument · **Nové znenie** (plné; pri FAQ „Upraviť záznamy").
5. Dva stĺpce od 1024 px: vľavo karta postupu znenia (kroky 1–4: Príprava,
   Schválenie, Zverejnenie, Pridelenie), pás archivácie, platné znenie,
   zverejnená novela, staršie znenia; vpravo zhrnutie (stav potvrdení,
   zodpovedná osoba).
6. „Správa" (`<details>`): Archivovať predpis (dátum, dôvod, danger) ·
   Pôvod z konektora + Skontrolovať zmeny · Text (otvoriť editor, členenie
   pre asistenta, oprava textu) · Preindexovať.

## Rozhodnutia v repozitári, ktoré návrh nemení

- **„Nové znenie" je hlavné tlačidlo**, nie formulár schovaný v správe
  (DETAIL, bod 1 rámu). Kým sa jedno znenie pripravuje, nové sa začať nedá
  (`hasChangesToPublish`) — súbory sa vymieňajú v príprave.
- **FAQ (ADR-028, D164)** nemá čo nahrávať; hlavné tlačidlo je „Upraviť
  záznamy" a je dostupné vždy, aj počas prípravy.
- **Úprava dokumentu má vlastnú adresu** `/library/<id>/edit` (R4).
- **Karta postupu znenia** a jej plné tlačidlo v kroku sú „odoslanie po
  náhľade" (R2) — ostávajú pri obsahu, nie v hlavičke.
- **Archivácia** je nevratná pre čitateľov (ADR-025, D156); dátum môže byť
  aj v budúcnosti; obnovenie je tichá akcia v páse archivácie.
- **Zodpovedná osoba bez roly** vidí len svoje karty úlohy (D151).
- **Stránka funguje bez JavaScriptu**, stav je v adrese.

## Pravidlá, ktoré návrh musí dodržať

- **`.page-head`** s nadpisom a akciami vpravo (SwiftUI `toolbar`): najviac
  jedno plné tlačidlo na obrazovke.
- **Zriedkavé a nevratné úkony** v karte „Ďalšie akcie" (`.more`) pod
  obsahom; nevratné `.button--danger` s potvrdením cez adresu (`?archive=1`).
- **Menu** (viac podobných akcií pod jedným tlačidlom) ako `<details>`
  plachta / popover — vzor menu 9 bodiek, bez JavaScriptu.
- **Žiadne zošedené tlačidlo bez vysvetlenia**, ktoré sa na dotyk nedá
  prečítať.
- **Rozmery:** mobile first, rámy 390 (tmavá) a 1440 (svetlá), terč 44 px.
- **Texty** cez i18n (sk/cs/en); existujúce kľúče `library.flow.*`
  ostávajú, nové sa pomenujú.

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Hlavička a akcie.**
- **A (odporúčam):** `.page-head`: vľavo nadpis, pod ním `p.page-lead`
  (`documentId · priečinok · platí od`) a štítky; vpravo toolbar:
  **Nové znenie** (plné), **Upraviť** (tiché), **Stiahnuť ▾** (tiché menu:
  PDF, zdrojový súbor). Na telefóne pod nadpisom v jednom riadku: plné
  cez celú šírku a vedľa neho dve ikony-tlačidlá (44 px) s textom pre
  čítačku.
- B: ako dnes riadok tlačidiel pod nadpisom, len zoradený (plné prvé,
  sťahovanie tiché). Menej zmien, ale akcie ostávajú mimo `.page-head`.

**Q2 — „Nové znenie" počas prípravy.**
- **A (odporúčam):** keď sa znenie pripravuje, v toolbare je namiesto neho
  tichý odkaz **„Pokračovať v príprave"** na kartu postupu (`#flow`).
  Plné tlačidlo je potom len v karte postupu. Žiadne zošedené tlačidlo.
- B: zošedené „Nové znenie" ostane, pod ním veta, prečo sa nedá
  (viditeľná aj na dotyk).

**Q3 — „Správa" → „Ďalšie akcie".**
- **A (odporúčam):** karta `.more` „Ďalšie akcie" na konci hlavného
  stĺpca, riadky `.more-row`:
  - **Text dokumentu** — odkazy Otvoriť editor · Členenie pre asistenta,
    pri potrebe oprava textu;
  - **Skontrolovať zmeny zo zdroja** (len pri článku z konektora, tiché,
    s pôvodom ako poznámkou);
  - **Preindexovať** (tiché);
  - **Archivovať predpis** (`button--danger` → `?archive=1#more`;
    potvrdenie s dátumom a dôvodom v riadku, `.more-confirm`).
- B: ostane `<details>` „Správa", len bez inline štýlov.

**Q4 — Pás archivovaného predpisu.**
- **A (odporúčam):** `.lnote--warn` (naplánovaná archivácia) /
  `.lnote--bad` (archivovaný) nad obsahom: kedy, kto, dôvod; „Obnoviť"
  ako tichá akcia v riadku hlášky.
- B: ostane karta `archive-banner`, len bez inline štýlov.

**Q5 — Stránka zodpovednej osoby (bez roly správcu).**
- **A (odporúčam):** `.page-narrow` + `.page-head` (nadpis) +
  `p.page-lead` (veta úlohy · odkaz „Čítať dokument"); karty úloh bez
  zmeny.
- B: bez zmeny.

## Rámy

- 1440 svetlá:
  - platný dokument bez rozpracovaného znenia (toolbar s plným Nové znenie,
    menu Stiahnuť otvorené), dole Ďalšie akcie;
  - dokument s bežiacim schvaľovaním (krok 2) — toolbar s „Pokračovať
    v príprave", plné tlačidlo len v karte postupu;
  - Ďalšie akcie s otvoreným `?archive=1`.
- 390 tmavá:
  - hlavička s toolbarom (platný dokument);
  - archivovaný predpis (pás s Obnoviť);
  - stránka zodpovednej osoby s jednou kartou úlohy.

## Prompt pre Claude Design

```
Navrhni KNIZNICA-akcie-dokumentu — úpravu hlavičky a akcií na detaile
dokumentu /library/<id> (správca obsahu) a hlavičky stránky zodpovednej
osoby. Je to DIFF proti existujúcej obrazovke; karta postupu znenia,
platné a staršie znenia, pravý panel a serverové akcie ostávajú.

Dnes: nad nadpisom štítky (stav, spracovanie, kategória), pod ním
„documentId · priečinok · platí od", pod tým .detail-actions so štyrmi
tlačidlami (Stiahnuť PDF, Stiahnuť zdrojový súbor, Upraviť dokument,
Nové znenie plné). Počas prípravy znenia je Nové znenie zošedené
(span.is-disabled s title — na dotyk sa nedá prečítať) a karta postupu
má vlastné plné tlačidlo. Na konci <details> „Správa": Archivovať predpis
(dátum, dôvod, danger), pôvod z MCP konektora + Skontrolovať zmeny, Text
(editor, členenie, oprava textu), Preindexovať. Archivovaný predpis má
kartu-pás s Obnoviť. Stránka zodpovednej osoby bez roly správcu: h1 mimo
.page-head, inline maxWidth, karty úlohy „Určiť právny základ".

Rozhodnutia, ktoré sa nemenia: Nové znenie je hlavná akcia; kým sa
pripravuje znenie, nové sa začať nedá; FAQ má namiesto neho „Upraviť
záznamy" (vždy dostupné); úprava dokumentu je /library/<id>/edit; plné
tlačidlo kroku v karte postupu je odoslanie po náhľade (R2) a ostáva pri
obsahu; archivácia môže mať dátum v budúcnosti, obnovenie je tiché;
zodpovedná osoba vidí len svoje karty úlohy; bez JavaScriptu.

Pravidlá: .page-head s akciami vpravo (toolbar), najviac jedno plné
.button na obrazovke; zriedkavé a nevratné úkony v karte „Ďalšie akcie"
(.more), nevratné .button--danger s potvrdením cez adresu; menu ako
<details> plachta/popover (vzor menu 9 bodiek); žiadne zošedené tlačidlo
bez viditeľného dôvodu; rámy 390 tmavá a 1440 svetlá; terč 44 px.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. .page-head: nadpis, p.page-lead (documentId · priečinok · platí od),
   štítky; vpravo Nové znenie (plné), Upraviť (tiché), Stiahnuť ▾ (tiché
   menu: PDF, zdrojový súbor). Na telefóne plné cez šírku + dve
   ikony-tlačidlá 44 px s textom pre čítačku.
2. Počas prípravy namiesto Nové znenie tichý odkaz „Pokračovať
   v príprave" na #flow; plné len v karte postupu.
3. „Správa" → karta „Ďalšie akcie" (.more) na konci hlavného stĺpca:
   Text dokumentu (Otvoriť editor · Členenie pre asistenta, oprava
   textu) · Skontrolovať zmeny zo zdroja (len pri konektore) ·
   Preindexovať · Archivovať predpis (danger → ?archive=1#more,
   potvrdenie s dátumom a dôvodom v riadku .more-confirm).
4. Archivovaný predpis: .lnote--warn (naplánované) / .lnote--bad
   (archivované) nad obsahom s kedy, kto, dôvod a tichým Obnoviť.
5. Stránka zodpovednej osoby: .page-narrow + .page-head + p.page-lead
   (veta úlohy · Čítať dokument); karty úloh bez zmeny.

Rámy: 1440 svetlá — platný dokument (menu Stiahnuť otvorené, dole Ďalšie
akcie); dokument s bežiacim schvaľovaním (krok 2, „Pokračovať v
príprave"); Ďalšie akcie s ?archive=1. 390 tmavá — hlavička s
toolbarom; archivovaný predpis s Obnoviť; stránka zodpovednej osoby
s jednou kartou úlohy.

Výstup ako doteraz: KNIZNICA-akcie-dokumentu.html + .md so sekciami Čo
sa mení, Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré
v modeli neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná
prvá) a Prompt pre Claude Code.
```
