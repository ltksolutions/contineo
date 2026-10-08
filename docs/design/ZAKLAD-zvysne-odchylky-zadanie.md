# Zadanie pre Claude Design — ZAKLAD-zvysne-odchylky

> Podklad pre **posledné štyri body** súpisu `docs/DESIGN_ODCHYLKY.md`
> (overenie 8. 10. 2026, po PR #321), ktoré nie sú mechanické. Pripravené
> 8. 10. 2026 proti `main`. Časť „Prompt pre Claude Design" sa skopíruje do
> projektu v Claude Design; zvyšok je kontext pre Jána.

## Prečo

Všetko ostatné zo súpisu je hotové. Tieto štyri body nemajú hotový vzor,
preto idú cez návrh. Sú malé, preto v jednom návrhu s rámom pre každý bod.

## 1. Výber značiek na zlúčenie (`/learning/manage/tags`)

**Dnes:** značky sú zoskupené podľa kľúča, každý kľúč je `.card.tgk`
s hlavičkou (názov kľúča, použitie, odkaz „Premenovať kľúč"). Riadok
hodnoty `.tgv`: holý checkbox 16 px (`.tgv-main`, `accent-color`) +
pilulka značky, vpravo použitie („3 kurzy · 12 otázok · 1 test") a odkaz
„Premenovať". Vybraný riadok má podklad `--accent-soft` a pruh vľavo.
Premenovanie sa otvára v riadku (`?rename=`, pole + plné „Premenovať" +
„Zrušiť"). Pri výbere sa dole objaví lišta `MergeSelectionBar` (klient):
„N vybraných · Zlúčiť do… · Zrušiť výber". Zlúčenie potom otvorí kartu
„Čo ostane" (už `.choice-row`, PR #321).

**Pravidlo:** výber viacerých zo zoznamu je `.select-row` — kruh 22 px
vľavo, celý riadok je `<label>`, 44 px (ZAKLAD-vyber-a-prepinace).

**Otázka Q1.**
- **A (odporúčam):** riadok `.form-row.select-row` (kruh vľavo, pilulka
  značky, pod ňou použitie ako `.form-row-sub`), „Premenovať" ako tichý
  odkaz vpravo mimo `<label>`. Karta kľúča ostáva ako `.form-group`
  (nadpis kľúča nad kartou, „Premenovať kľúč" v hlavičke skupiny).
  Lišta výberu ostáva.
- B: ponechať holý checkbox, len zväčšiť na 22 px.

## 2. Správna odpoveď v editore otázky (`/learning/tests/questions/…`)

**Dnes:** riadok odpovede `.ansr` = pole s textom odpovede + vpravo
`label.mc-check` s rádiom (jedna správna) alebo checkboxom (viac
správnych) a slovom „Správna". Riadkov je 4–5 (+1 voľný), max. `MAX_ANSWERS`.
Bez JavaScriptu.

**Otázka Q2.**
- **A (odporúčam):** kruh vľavo pred poľom odpovede, ako `.select-row`
  (viac správnych) a `.choice-row` s fajkou (jedna správna) — značka
  „správna" je vlastnosť riadku, nie ďalší ovládač za ním. Slovo
  „Správna" ostáva pre čítačku (`aria-label`) a ako nápoveda nad
  zoznamom („Označte správne odpovede").
- B: ponechať vpravo, len ako `.toggle` „Správna".

## 3. `npm run person` na `/hr/assign`

**Dnes:** keď organizácia nemá skupiny ani trasy, pod výberom Komu je
veta „Skupiny sa zadávajú pri importe osôb (stĺpec „skupiny") alebo
príkazom `npm run person`." Príkaz je pre vývojára.

**Fakty:** skupinu dnes vytvorí aj karta osoby (pole „Hľadať alebo
pridať", PR #312) a import osôb; trasu `/hr/tracks` („Nová trasa").

**Otázka Q3.**
- **A (odporúčam):** veta s dvomi odkazmi namiesto príkazu — „Skupiny
  pridáte na karte osoby alebo importom osôb; trasy v Trasách." (odkazy
  `/people`, `/people/import`, `/hr/tracks`). Tvar `.empty` v karte Komu.
- B: len veta bez odkazov.

## 4. `npm run domains` na `/admin`

**Dnes:** pod zoznamom organizácií veta „Stav domén vo Verceli ukáže
`npm run domains`; do obrazovky pribudne v rozsahu C…". Stav domén je
pritom **už v detaile organizácie** (`/admin/tenants/<kód>`, riadky
domén: nie vo Verceli / čaká na zákazníka / nastavené, neoverené).

**Otázka Q4.**
- **A (odporúčam):** vetu zmazať; pri karte organizácie, ktorá má
  doménu s problémom, ukázať štítok („doména čaká", `tag--draft`) s
  odkazom do detailu. Ak by to vyžadovalo volanie Vercelu pri každom
  zobrazení zoznamu, stačí vetu zmazať.
- B: vetu nahradiť odkazom „Stav domén je v detaile organizácie".

## Rámy

- 1440 svetlá: zoznam značiek s dvomi kľúčmi, dve vybrané hodnoty
  a lišta výberu; editor otázky „Jedna správna" a „Viac správnych".
- 390 tmavá: zoznam značiek s otvoreným premenovaním; editor otázky
  „Viac správnych"; `/hr/assign` bez skupín a trás; `/admin` (karta
  organizácie so štítkom domény, ak Q4 A).

## Prompt pre Claude Design

```
Navrhni ZAKLAD-zvysne-odchylky — štyri malé úpravy, ktoré ostali zo
súpisu odchýlok. Je to DIFF proti existujúcim obrazovkám; mená polí,
serverové akcie a texty ostávajú, nové texty pomenuj.

1. /learning/manage/tags — výber značiek na zlúčenie. Dnes: karta na
   kľúč (.card.tgk, hlavička: kľúč, použitie, „Premenovať kľúč"), riadok
   hodnoty .tgv = holý checkbox 16 px + pilulka značky, vpravo použitie
   („3 kurzy · 12 otázok · 1 test") a odkaz „Premenovať"; vybraný riadok
   --accent-soft s pruhom vľavo; premenovanie v riadku (pole + Premenovať
   + Zrušiť); dole lišta výberu „N vybraných · Zlúčiť do… · Zrušiť výber".
   Odporúčam: riadok .form-row.select-row (kruh 22 px vľavo, pilulka,
   použitie ako .form-row-sub), „Premenovať" tichý odkaz vpravo mimo
   label; kľúč ako .form-group (nadpis nad kartou, „Premenovať kľúč" v
   hlavičke skupiny); lišta výberu ostáva.
2. Editor otázky testu — správna odpoveď. Dnes: riadok = pole odpovede +
   vpravo rádio/checkbox „Správna" (.mc-check). Odporúčam: kruh vľavo
   pred poľom (viac správnych: .select-row kruh; jedna správna:
   .choice-row fajka), slovo „Správna" pre čítačku a nápoveda nad
   zoznamom „Označte správne odpovede".
3. /hr/assign bez skupín a trás — dnes veta s príkazom „npm run person".
   Odporúčam: .empty v karte Komu s vetou a odkazmi na kartu osoby
   (/people), import osôb (/people/import) a Trasy (/hr/tracks).
4. /admin — dnes veta „Stav domén vo Verceli ukáže npm run domains".
   Stav domén je už v detaile organizácie. Odporúčam: vetu zmazať, pri
   karte organizácie s problémom domény štítok tag--draft s odkazom do
   detailu (len ak to nevyžaduje volanie Vercelu pri každom zobrazení).

Pravidlá: výber viacerých = .select-row (kruh vľavo, celý riadok label,
44 px); jedna z mála = .choice-row (fajka); najviac jedno plné .button
na obrazovke; žiadny príkaz pre vývojára na obrazovke; bez JavaScriptu
(lišta výberu je doplnok); rámy 390 tmavá a 1440 svetlá; terč 44 px.

Rámy: 1440 svetlá — značky (dva kľúče, dve vybrané, lišta), editor
otázky Jedna správna a Viac správnych. 390 tmavá — značky s otvoreným
premenovaním, editor Viac správnych, /hr/assign bez skupín, /admin.

Výstup ako doteraz: ZAKLAD-zvysne-odchylky.html + .md so sekciami Čo sa
mení, Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
