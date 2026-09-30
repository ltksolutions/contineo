# SHELL — plachta menu (9 bodiek) v hlavičke

Referencia: `SHELL-menu-v-hlavicke.html`. Doplnok k `SHELL-rozcestnik` (plachta, obsah a správanie bez zmeny). Základ: `ZAKLAD.md`, `ASK-otazka-z-hlavicky` (pole v hlavičke).
Zdroj: `components/Header.tsx`, `components/SectionsSheet.tsx` a `Breadcrumbs.tsx` (z promptu `SHELL-rozcestnik`), `lib/appNav.ts`.

Požiadavka používateľa 30. 9. 2026: ikonu 9 bodiek (plachta celého menu) dať aj vhodne do hlavičky; na mobile nahradiť „Viac" ikonou 9 bodiek s plachtou.

## Čo sa mení

1. **Ikona 9 bodiek ide do hlavičky** na ≥ 640 px, na každej stránke vrátane Prehľadu. Tlačidlo 40 × 40, radius 10, ikona `grid` 18.
2. **Poloha** — dve možnosti v ráme:
   - **A (odporúčam):** vľavo pred logom. Plachta sa otvorí pod hlavičkou vľavo (left 10).
   - **B:** vpravo medzi poľom otázky a zvončekom. Plachta vpravo (right 10).
3. **Pás cesty** stratí ikonu aj deliacu čiaru, ostane len cesta. Na Prehľade pás nie je (bez zmeny).
4. **834:** ikona v hlavičke, názov organizácie sa skryje (miesto pre pole), plachta 2 stĺpce.
5. **< 640:** ikona v hlavičke nie je. Posledná položka spodnej lišty **„Viac" → „Menu" s ikonou 9 bodiek**; ťuknutie otvorí **spodnú plachtu** s tým istým obsahom (1 stĺpec, 48 px). Lišta ostáva viditeľná, „Menu" aktívne. Zavrie: „Menu" znova, ×, závoj, potiahnutie nadol, Esc, výber, zmena pathname. Odznak na „Menu" = súčet počtov sekcií, ktoré nie sú v lište. `/more` ostáva ako cieľ odkazu bez JS a pre priame adresy.

## Prečo

Doteraz sa plachta dala otvoriť len z podstránky; na Prehľade chýbala. V hlavičke je na tom istom mieste na každej stránke. Jedna ikona na jednom mieste namiesto dvoch.

## Konflikt s rozhodnutím

`SHELL-rozcestnik` Q3 (29. 9.): „do hlavičky žiadne menu" a Q5: ikona v páse cesty. Tento návrh ich mení na žiadosť používateľa 30. 9. Hlavička ostáva bez stáleho menu (žiadne položky ani pás), pribudne len jedno tlačidlo. Q3 a Q5 v `SHELL-rozcestnik.md` sa upravia po rozhodnutí Q1.

## Rozhodnutia 30. 9. 2026

- **Q1 ✅ A** — ikona vľavo pred logom. Možnosť B sa neimplementuje.
- **Q2 ✅** — „Preskočiť na obsah" ako prvý prvok (doplniť, ak `AppShell` nemá), potom menu, logo, pole otázky.

- **Q3 ✅** Popis položky lišty „Menu" (nie „Viac").
- **Q4 ✅** Plachta na mobile ukazuje celé menu, rovnako ako desktop; `/more` ten istý obsah.
- **Lišta ✅ (používateľ 30. 9.)** „Opýtať sa" z lišty preč (otázka je v hlavičke). V lište **obe** Knižnica aj Vzdelávanie: **Prehľad · Knižnica · Vzdelávanie · Úlohy · Menu**. Mení pravidlo v `tabbarKeys()` („Vzdelávanie u správcu obsahu pod Viac", rám LEARNING Q1 27. 9.).

- **Q5 ✅ (používateľ 30. 9.)** Knižnica aj Vzdelávanie sú v lište aj v plachte menu **vždy**, pre každého — pozície sú u všetkých rovnaké. Keď organizácia nemá zapnutý modul Vzdelávanie, `/learning` ukáže úvodnú obrazovku „Vzdelávanie nie je pre vašu organizáciu zapnuté" (ikona, veta, „Otvoriť úlohy", „Späť na Prehľad"; správca organizácie vidí aj „Modul zapína prevádzkovateľ Contineo" + kontakt). 
- **Knižnica pre každého ✅ (používateľ 30. 9.)** Položku Knižnica vidí v lište aj v menu každý. **Obsah** knižnice sa filtruje podľa prístupu — nie každý uvidí všetky dokumenty. Filtrovanie sa neprekresľuje, platia existujúce pravidlá prístupu (`accessLevel`, D9, roly D32). Akcie správy obsahu (nahrať, nové znenie, schvaľovanie) vidí len rola správy obsahu. Keď osoba nevidí žiadny dokument, `/library` ukáže prázdny stav „Zatiaľ tu pre vás nie sú žiadne dokumenty", nie 403.

## Rámy

- **1440** Prehľad: A a B vedľa seba, plachta otvorená.
- **1440** podstránka (A): pás len s cestou.
- **834** (A) plachta.
- **390** lišta s „Menu" · spodná plachta otvorená na podstránke.
- **1440** Vzdelávanie vypnuté (zamestnanec) · **390** Vzdelávanie vypnuté (správca organizácie).

## Rozmery

Tlačidlo 40 × 40, radius 10, hover `--surface-2`, otvorené `--surface-2`. A: `padding-left` hlavičky 8, medzera k logu 4, pole otázky `margin-left` 24. Plachta: top 60 (pod hlavičkou 56 + 4), šírka 760, radius 14, závoj od spodku hlavičky. Pás cesty: `padding` 0 32 (834: 0 24), bez ikony. Mobil: plachta od hornej hrany lišty, max. výška po hlavičku − 24, radius 18 hore, úchyt 36 × 4, nadpis 16/650, × 44, skupina 10.5 verzálky, položka 48 / ikona 19 / text 15, závoj 28 % medzi hlavičkou a lištou.

## i18n

`learning.off.title` „Vzdelávanie nie je pre vašu organizáciu zapnuté", `learning.off.lead` („Kurzy, testy a certifikáty tu uvidíte, keď ho organizácia zapne. Povinné normy na potvrdenie nájdete v Úlohách."), `learning.off.admin` („Modul zapína prevádzkovateľ Contineo. Napíšte na {kontakt}."), `learning.off.tasks` „Otvoriť úlohy", `learning.off.back` „Späť na Prehľad"; `library.emptyForYou` „Zatiaľ tu pre vás nie sú žiadne dokumenty.", `nav.menu` „Menu" (sk/cs „Menu", en „Menu") namiesto `nav.more` v lište; `nav.allSections` ostáva (nadpis plachty).

## Údaje, ktoré v modeli neexistujú

Žiadne. 🔴 Zmena schémy: **žiadna**.

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/SHELL-menu-v-hlavicke.html + .md
(rozhodnutia Q1–Q5 30. 9. 2026). Nadväzuje na SHELL-rozcestnik (SectionsSheet,
Breadcrumbs) a ASK-otazka-z-hlavicky (pole v hlavičke) — rob na ich vetve, ak nie sú
v main. Najprv prečítaj Header.tsx, AppShell.tsx, AppNav.tsx, lib/appNav.ts
(tabbarKeys, inTabbar, tabbarItems, navItems + testy), app/learning/, app/more/,
docs/decisions/ a DEVLOG k lište a modulu Vzdelávanie (rám LEARNING Q1 27. 9.).

Rozsah (vetva design/shell-menu-v-hlavicke):
1. Header.tsx: tlačidlo 9 bodiek (Icon "grid", 40×40, radius 10) ako prvý prvok
   hlavičky pred logom na ≥ 640 px, na každej stránke vrátane Prehľadu; otvára
   SectionsSheet pod hlavičkou vľavo (left 10). „Preskočiť na obsah" ako úplne prvý
   fokusovateľný prvok (doplniť, ak chýba). Z Breadcrumbs ikonu aj deliacu čiaru
   odstrániť.
2. Lišta < 640 px: Prehľad · Knižnica · Vzdelávanie · Úlohy · Menu — vždy, pre
   každého (Q5). „Opýtať sa" z lišty preč. tabbarKeys/inTabbar prepísať, testy
   upraviť. Knižnica: navItems() ju dáva každému (nie len roli správy obsahu);
   /library a /library/[id] filtrujú dokumenty podľa existujúcich pravidiel prístupu
   (accessLevel D9, roly D32) — over, že zoznam, vyhľadávanie, detail aj priamy odkaz
   na nepovolený dokument (→ 404) to rešpektujú; akcie správy obsahu len pre rolu.
   Prázdny zoznam → library.emptyForYou. Ak pravidlo „kto smie čítať ktorý dokument"
   v kóde neexistuje, zastav sa a opýtaj — nevymýšľaj ho.
3. „Menu" (Icon "grid", nav.menu): <a href="/more"> bez JS; s JS button
   aria-expanded, otvára spodnú plachtu (ten istý SectionsSheet, celé menu, 1 stĺpec,
   48 px, × 44, úchyt, závoj medzi hlavičkou a lištou, potiahnutie nadol / Esc /
   výber / zmena pathname zavrie). Odznak = súčet počtov sekcií mimo lišty. /more
   ukazuje ten istý obsah.
4. /learning pri vypnutom module organizácie: úvodná obrazovka podľa rámu (ikona,
   learning.off.*, „Otvoriť úlohy", „Späť na Prehľad"; správca organizácie aj veta
   s kontaktom prevádzkovateľa). Nie 404, nie presmerovanie.
i18n sk/cs/en podľa .md. Zapíš do docs/DEVLOG.md (mení LEARNING Q1 z 27. 9. a
SHELL-rozcestnik Q3/Q5).
Overenie: tsc, eslint (baseline), vitest, build; render 1440 / 834 / 390: plachta
z hlavičky na Prehľade aj podstránke, lišta + spodná plachta, /learning s vypnutým
modulom (zamestnanec aj správca); klávesnica (Tab poradie, Esc); bez JS (Menu → /more);
svetlá aj tmavá.
```
