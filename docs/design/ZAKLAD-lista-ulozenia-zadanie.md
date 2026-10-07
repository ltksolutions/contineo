# Zadanie pre Claude Design — ZAKLAD-lista-ulozenia

> Podklad pre návrh **lišty na uloženie na stránkach s viacerými formulármi**
> (súpis `docs/DESIGN_ODCHYLKY.md`, P9). Pripravené 7. 10. 2026 proti `main`
> po #298. Časť „Prompt pre Claude Design" sa skopíruje do projektu
> v Claude Design; zvyšok je kontext pre Jána.

## Prečo

Pravidlo hovorí, že na obrazovke je **najviac jedno plné tlačidlo**. Päť
nastavovacích obrazoviek má pritom niekoľko samostatných formulárov a každý
má vlastné plné „Uložiť". Na niektorých sú naraz tri až päť plných tlačidiel
a človek nevie, ktoré „Uložiť" uloží čo.

Vzor už v aplikácii je: `/organisation/general`, `/organisation/ai`
(nastavenia) a `/channels/<kľúč>` majú **jeden formulár** `.card.set-form`
so sekciami `section.set-sec`. Na konci je **lišta `.set-savebar`** s jediným
plným „Uložiť" a krátkou vetou. Lišta je `position: sticky; bottom: 0`,
takže je stále na dosah. Na `/channels` sú vedľajšie akcie (overiť,
synchronizovať, odstrániť) v samostatnej karte pod formulárom a všetky sú
tiché, odstránenie je `button--danger`.

```css
.set-savebar {
  position: sticky; bottom: 0; z-index: 5; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  padding: 14px 22px; background: var(--surface); border-top: 1px solid var(--line);
  border-radius: 0 0 var(--radius) var(--radius);
}
@media (max-width: 639px) { .set-savebar > .button { width: 100%; min-height: 44px; } }
```

## Dnešný stav piatich obrazoviek

| Obrazovka | Formuláre | Plné naraz |
|---|---|---|
| `/organisation/signin` | Microsoft (client ID, tajomstvo, tenant), Google (client ID, tajomstvo, doména), automatické zakladanie (domény). Pri vlastnom nastavení ešte tiché „Odstrániť" s potvrdením kódom organizácie. | **3** |
| `/organisation/gdpr` | Kontakt na zodpovednú osobu, lehoty uchovávania (4 čísla + varovanie), doplnok k vyhláseniu (text v každom jazyku). Už `.set-form` + `.set-sec`, ale tri formuláre a tri „Uložiť" v tele sekcií. Kto nie je DPO, vidí len čítanie. | **3** |
| `/organisation/domains` | Zoznam aktívnych domén (tiché „Zrušiť"), čakajúce domény s **plným malým „Overiť"** v každom riadku, pole „Požiadať o doménu" (tiché). | 1 za každú čakajúcu doménu |
| `/admin/tenants/<kód>` | Vzhľad a údaje organizácie (názov, logo, farba, e-mail, jazyky, domény), Microsoft, Google, „Poslať pokyny" pri čakajúcich doménach, zapnúť/vypnúť organizáciu. | **3–5** |
| `/hr/tracks/<kľúč>` | Premenovať (`<details>`), termín (`<details>`), pridať krok (stále otvorené), kroky (tiché ↑ ↓ Odobrať), pridať ľudí (`<details>`, **súhrn je plné tlačidlo**), aktivovať/deaktivovať (tiché). | **až 4** (+ plný súhrn) |

Spoločné nálezy:
- **Rozloženie:** okrem GDPR žiadna obrazovka nepoužíva `.set-sec`. Majú
  vlastné karty s množstvom inline štýlov (odsadenia, medzery).
- **Duplicitný komponent:** `ProviderRow` je dvakrát, v organizácii aj
  v admin, takmer rovnaký.
- **Pri `/hr/tracks` nejde o nastavenia, ale o detail objektu s úlohami:**
  - dva formuláre nastavenia trasy (názov, termín);
  - dve úlohy (pridať krok, pridať ľudí).
  Možno potrebuje iné riešenie než lištu.

## Pravidlá, ktoré návrh musí dodržať

Z `CLAUDE.md` a `.design-sync/conventions.md`:
- **Tlačidlá:**
  - najviac jedno plné `.button` na obrazovke;
  - pri nastaveniach je to „Uložiť" v `.set-savebar`, inak vpravo
    v `.page-head`; ostatné `.button--quiet`;
  - v zozname, kde má každý riadok vlastnú akciu, sú tlačidlá tiché (R1).
- **Formuláre** sú `.form-group` / `.set-sec` a voľby `.form-row`,
  `.choice-row` a `input.toggle`. Nevratná akcia je `button--danger` alebo
  potvrdenie.
- **Bez JavaScriptu:** stav je v adrese, ovládače sú odkazy a formuláre.
  Lišta nemôže vedieť o neuložených zmenách, preto netvrdí „máte neuložené
  zmeny".
- **Rozmery:** mobile first, rámy 390 (tmavá) a 1440 (svetlá), terč aspoň
  44 px.

## Otázky (s odporúčaním — odporúčaná je prvá)

**Q1 — Nastavovacie stránky s viacerými formulármi (signin, gdpr, admin
organizácie).**
- **A (odporúčam):** jeden formulár `.set-form` so sekciami `.set-sec`
  a jednou lištou `.set-savebar`, ako `/organisation/general`. Server uloží
  všetky sekcie naraz. Prázdne pole tajomstva znamená „ponechať", ako dnes.
  Človek vidí jedno „Uložiť" a nemusí premýšľať, ktorá sekcia sa uloží.
- B: formuláre ostanú samostatné, ich „Uložiť" budú tiché a plné nebude
  žiadne.

**Q2 — Vedľajšie a nevratné akcie na týchto stránkach** (odstrániť vlastné
prihlásenie, vypnúť organizáciu, poslať pokyny k doménam).
- **A (odporúčam):** samostatná karta „Ďalšie akcie" pod formulárom, ako na
  `/channels/<kľúč>`. Akcie sú tiché, nevratné `button--danger`
  s potvrdením. Do lišty nepatria, lebo lišta ukladá formulár.
- B: ostanú v sekcii, ku ktorej patria, ako tiché tlačidlá pod jej poľami.

**Q3 — `/organisation/domains`.**
- **A (odporúčam):** bez lišty, lebo na stránke nie je čo „uložiť".
  - Je to zoznam s akciami riadkov, takže „Overiť" je tiché (R1).
  - „Požiadať o doménu" je jediné plné tlačidlo vpravo v `.page-head`
    a otvorí pole (`?request=1`).
- B: „Požiadať" ostane formulárom pod zoznamom a všetko je tiché.

**Q4 — `/hr/tracks/<kľúč>`.**
- **A (odporúčam):**
  - Hlavná akcia „Pridať ľudí" je jediné plné tlačidlo v `.page-head`
    a otvorí úlohu `?add=people`, ktorá prevezme plné tlačidlo (vzor
    MANAGE-COURSE-akcie).
  - Názov, popis a termín sú jedna sekcia „Nastavenia trasy" s tichým
    „Uložiť".
  - „Pridať krok" je tichý formulár pod krokmi.
  - `<details>` s plným súhrnom zmizne.
- B: celá trasa ako nastavovacia stránka s lištou (názov, termín, kroky,
  ľudia v jednom formulári). Kroky a ľudia sú ale zoznamy s okamžitými
  akciami, takže by sa zmiešali dva spôsoby ukladania.

**Q5 — Text v lište.**
- **A (odporúčam):** krátka veta, čo tlačidlo uloží, ako na
  `/organisation/general` („Uloží všetky sekcie na tejto stránke."). Bez
  počtu zmien, lebo bez JS sa nedá zistiť.
- B: bez vety, len tlačidlo (ako `/organisation/ai`).

## Rámy

- 1440 svetlá: `/organisation/signin` (oba poskytovatelia, jeden vlastný),
  `/admin/tenants/<kód>` (čakajúca doména, organizácia zapnutá),
  `/hr/tracks/<kľúč>`.
- 390 tmavá: `/organisation/gdpr` (lišta prilepená dole pri dlhom
  formulári), `/organisation/domains` (dve čakajúce domény),
  `/hr/tracks/<kľúč>` s otvoreným „Pridať ľudí".

## Prompt pre Claude Design

```
Navrhni ZAKLAD-lista-ulozenia — jedno plné tlačidlo na stránkach, ktoré
dnes majú niekoľko samostatných formulárov, každý s vlastným plným
„Uložiť" (súpis DESIGN_ODCHYLKY P9). Je to DIFF proti existujúcim
obrazovkám, polia a ich význam ostávajú.

Vzor v aplikácii: /organisation/general — jeden form.card.set-form so
sekciami section.set-sec (set-sec-head + set-sec-body) a na konci
.set-savebar (sticky bottom:0, jedno plné „Uložiť" + krátka veta
.quiet). Vedľajšie akcie ako na /channels/<kľúč>: samostatná karta pod
formulárom, tiché tlačidlá, odstránenie button--danger.

Obrazovky a dnešný stav:
1. /organisation/signin — Microsoft, Google a automatické zakladanie:
   tri formuláre, tri plné „Uložiť"; pri vlastnom nastavení tiché
   „Odstrániť" s potvrdením kódom organizácie.
2. /organisation/gdpr — kontakt DPO, lehoty uchovávania, doplnok
   k vyhláseniu: už .set-sec, ale tri formuláre a tri plné „Uložiť";
   kto nie je DPO, vidí len čítanie.
3. /organisation/domains — zoznam domén, pri čakajúcich plné malé
   „Overiť" v každom riadku, pod zoznamom pole „Požiadať o doménu".
4. /admin/tenants/<kód> — vzhľad a údaje organizácie, Microsoft, Google,
   „Poslať pokyny" pri čakajúcich doménach, zapnúť/vypnúť: 3–5 plných.
5. /hr/tracks/<kľúč> — premenovať a termín v <details>, „Pridať krok"
   otvorené, zoznam krokov (↑ ↓ Odobrať), „Pridať ľudí" v <details> so
   súhrnom ako plným tlačidlom, aktivovať/deaktivovať.

Pravidlá: najviac jedno plné .button na obrazovke; v zozname s akciami
riadkov sú tlačidlá tiché; formuláre .form-group / .set-sec, voľby
.form-row / .choice-row / input.toggle; všetko bez JavaScriptu (stav
v adrese), lišta preto netvrdí „neuložené zmeny"; rámy 390 tmavá
a 1440 svetlá; žiadne inline štýly — ak treba nový rozmer, nová trieda.

Moje odporúčania (navrhni podľa nich, odchýlku zdôvodni):
1. signin, gdpr, admin organizácie: jeden .set-form so sekciami a jednou
   .set-savebar; server uloží všetko naraz; prázdne tajomstvo = ponechať.
2. Vedľajšie a nevratné akcie (odstrániť vlastné prihlásenie, vypnúť
   organizáciu, poslať pokyny) v karte „Ďalšie akcie" pod formulárom,
   tiché, nevratné button--danger s potvrdením.
3. domains bez lišty: „Overiť" tiché v riadku, „Požiadať o doménu" plné
   v .page-head a otvorí pole (?request=1).
4. hr/tracks: „Pridať ľudí" plné v .page-head → úloha ?add=people, ktorá
   prevezme plné tlačidlo; názov, popis a termín jedna sekcia
   „Nastavenia trasy" s tichým Uložiť; „Pridať krok" tichý formulár pod
   krokmi; <details> s plným súhrnom preč.
5. V lište krátka veta, čo sa uloží („Uloží všetky sekcie na tejto
   stránke."), bez počtu zmien.

Rámy: 1440 svetlá — signin (oba poskytovatelia, jeden vlastný), admin
organizácie (čakajúca doména, zapnutá), hr/tracks. 390 tmavá — gdpr
(lišta prilepená dole), domains (dve čakajúce), hr/tracks s otvoreným
Pridať ľudí.

Výstup ako doteraz: ZAKLAD-lista-ulozenia.html + .md so sekciami Čo sa
mení, Kde, Prečo, Rozhodnutia v repozitári, Rámy, Údaje, ktoré v modeli
neexistujú, Rozhodnuté, Otázky (každá s odporúčaním, odporúčaná prvá)
a Prompt pre Claude Code.
```
