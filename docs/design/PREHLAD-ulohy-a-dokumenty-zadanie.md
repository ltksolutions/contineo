# Zadanie pre Design — PREHLAD-ulohy-a-dokumenty

> Podklad pre nový návrh **Prehľadu** (`/`) bežného používateľa: bloky
> **Moje úlohy** a **Dokumenty**. Pripravené 26. 10. 2026 proti `main`
> (po #455) na Jánovu požiadavku: „Moje úlohy, to je tragédia… nedáme to
> navrhnúť designu?" a „prečo nepoužijeme pre druhy dokumentov vo widgete
> tab prepínač, napríklad so živým vyhľadávaním?".
>
> Vzniká v Claude ako artefakt typu *Design* s pripojeným artefaktom
> „Contineo — design system" (`docs/DESIGN.md`, „Prechod do Claude").
> Časť **Prompt pre Design** sa vloží do artefaktu, zvyšok je kontext pre
> Jána a pre implementáciu.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `app/src/components/`). Rozhodnutie
> v repozitári má prednosť: ADR-041 (D270–D274) platí, návrh mení tvar,
> nie obsah.

## Prečo

ADR-041 (26. 10.) dal Prehľadu správny obsah — čo odo mňa niekto čaká
a aké dokumenty mám — ale tvar som poskladal z existujúcich panelov bez
návrhu. Naživo (Jánove snímky 26. 10.):

- **Moje úlohy** je zoznam s červeným chipom a rámovaným tlačidlom
  „Otvoriť" v každom riadku; nepovie, čo s úlohou urobiť, ako dlho to
  trvá, ani čo je najnaliehavejšie.
- **Dokumenty**: pri všetkých šiestich riadkoch chip `nové` (celá knižnica
  manuálov vyšla v ten istý deň, takže nové je všetko a chip nehovorí nič)
  a rámované „Opýtať sa" v každom riadku — zoznam vyzerá ako stĺpec
  tlačidiel. Druh dokumentu je len slovo v sivom riadku; prepnúť sa naň
  nedá. Hľadanie na Prehľade nie je.
- Chyby šírky, nadpisu dvakrát, označenia znenia a „do …" po termíne sú
  opravené v #455 — nie sú predmetom návrhu.

## Čo je dnes (po #455)

Poradie zhora: oslovenie „Dobrý deň, {meno}" · **Moje úlohy** · **Dokumenty**
· rozcestník **Organizácia** (Adresár, Knižnica, Vzdelávanie) · **Správa**
(len rolám — dlaždice sekcií, bez zmeny).

**Moje úlohy** (`.card.panel`, na celú šírku): hlavička s počtom, riadok =
názov (odkaz) · druhý riadok „znenie účinné od {dátum}" · termínový chip
(`due-chip--soon/over`, po termíne „po termíne o N dní") · `.panel-action`
„Otvoriť" / „Rozhodnúť". Najviac 6 riadkov (schválenia najviac 2), päta
„Všetky úlohy →" na `/documents` (s počtom, keď panel niečo skrýva).
Prázdny stav dva riadky.

**Dokumenty** (`.card.panel`): hlavička s počtom, riadok = názov (odkaz na
čitateľský detail) · „Manuál · znenie účinné od 24. 10. 2026" · chip `nové`
alebo `expiruje` · `.panel-action` „Opýtať sa". 6 riadkov podľa dátumu
účinnosti, päta „Zobraziť všetkých 28 →" na `/library` (Knižnica na
čítanie, má `.view-switch` podľa druhu a hľadanie).

## Dáta, ktoré sú k dispozícii

**Úloha** (`lib/pending.ts`, `PendingItem`; `roundsWaitingFor()`):

| druh | čo má | akcia |
|---|---|---|
| potvrdiť znenie | názov, dátum účinnosti, **termín** (môže chýbať), pridelené kedy, `isNew` (od posledného prihlásenia), trasa a poradie kroku („Krok 2 z 5"), alebo „zatiaľ nedostupné" s dôvodom | prečítať a potvrdiť na detaile |
| rozhodnúť kolo schválenia | názov dokumentu, kto predložil, kedy | `/approvals` |

Kurzy a testy **termín nemajú** (`MyCourse`), preto v Moje úlohy dnes nie
sú — TODO P. Ďalšie zdroje úloh (kurácia, helpdesk) sú v type pripravené,
ale nie zapnuté. Čas čítania dokumentu sa meria, ale odhad dopredu nie je.

**Dokument** (`mergeReaderDocuments()`): názov, **druh** (číselník
`category`, názov z číselníka organizácie), dátum účinnosti platného
znenia, `nové` (zverejnené za 7 dní), `expiruje` (koniec do 30 dní),
odkaz na detail, odkaz na otázku nad ním (`/ask?src=library&doc=` —
pri zákone nad celou Legislatívou). Zákony z katalógu sú druh **Zákon**.

**SFZ dnes (ilustračne):** 28 dokumentov v **5 druhoch** — Poriadok 11,
Manuál 10, Zákon 5 (1 v knižnici + 4 z katalógu), Smernica 2, Stanovy 1.
Typický človek: 0–5 úloh, z toho časť po termíne; 3 úlohy v snímke sú
po termíne o 15 dní.

## Čo navrhnúť

1. **Moje úlohy** — tvar, ktorý povie *čo, dokedy a čo s tým urobím*:
   - poradie podľa naliehavosti (po termíne → do týždňa → bez termínu)
     a jasne odlíšené „po termíne";
   - čo je v riadku: druh úlohy (potvrdiť / rozhodnúť), druh dokumentu,
     trasa a krok, ak sú; a či je akcia tlačidlo, alebo je odkazom celý
     riadok (Q2);
   - prázdny stav, keď nič nečaká (dnes dva riadky textu).
2. **Dokumenty** ako **hľadanie s rozsahmi** (SwiftUI `.searchable` +
   `.searchScopes`): pole hľadania a pod ním rozsahy **Všetky · Poriadok
   · Manuál · Zákon · Smernica · Stanovy** s počtami. Hľadanie je
   `LiveFilter` (mení adresu, výsledky skladá server, bez JavaScriptu
   obyčajný GET formulár); rozsah je `.view-switch` v adrese
   (`?kind=`). **Háčik:** `.view-switch` je v systéme na 2–4 krátke voľby
   a SFZ má 5 druhov, iná organizácia viac (Q1).
3. **Čo s chipom `nové`**, keď je nové všetko (Q3).
4. **Akcia pri dokumente**: dnes „Opýtať sa" v každom riadku. Navrhni, či
   ostáva, kde (napr. len pri prejdení / v ⋯), a či je odkazom celý riadok
   (Q2).
5. **Rozmiestnenie od 1024 px**: Moje úlohy a Dokumenty pod sebou na celú
   šírku (dnes), alebo vedľa seba (Q4). Pri mobile first: 390, 834, 1440;
   svetlá aj tmavá téma.
6. **Vzťah k rozcestníku**: Organizácia (Adresár, Knižnica, Vzdelávanie)
   a Správa ostávajú; dlaždica Knižnica a päta „Všetky dokumenty" vedú na
   to isté miesto (Q5).

## Otázky (odporúčaná je vždy prvá)

- **Q1 — Rozsahy pri piatich a viac druhoch.**
  **A Pás rozsahov s vodorovným rolovaním na telefóne, na počítači všetky
  v rade** (`.view-switch` rozšírený o pretečenie — odchýlka). B Prvé tri
  druhy podľa počtu + „Ďalšie ▾" (menu). C `<select>` „Druh" vedľa poľa
  hľadania.
  *Odporúčam A:* je to správanie `searchScopes` na iPhone, druhy sú
  krátke slová a menu (B) schová práve to, čo chce človek vidieť;
  `<select>` (C) je ovládač formulára, nie pohľad.
- **Q2 — Akcia v riadku.**
  **A Celý riadok je odkaz na detail; „Opýtať sa" je na detaile, nie
  v zozname.** B Riadok je odkaz + tichá akcia vpravo (dnes). C Riadok
  + ⋯ menu s akciami.
  *Odporúčam A:* zoznam je na výber, nie na akcie; detail už „Opýtať sa"
  má (#448) a dotyková plocha celého riadku je na telefóne lepšia než
  44 px tlačidlo.
- **Q3 — Chip `nové`.**
  **A Len pri dokumentoch nových pre mňa — zverejnených od môjho
  predchádzajúceho prihlásenia (ako `isNew` pri úlohách, D39).**
  B Ponechať 7 dní pre všetkých. C Vynechať úplne.
  *Odporúčam A:* „nové" má zmysel len vtedy, keď niečo odlišuje; pri
  úlohách to pravidlo už platí.
- **Q4 — Rozmiestnenie od 1024 px.**
  **A Pod sebou na celú šírku, úlohy prvé.** B Vedľa seba (úlohy užšie
  vľavo, dokumenty vpravo).
  *Odporúčam A:* úloha je dôvod otvoriť Prehľad, a keď nie je žiadna,
  panel sa zmenší na jeden riadok — vedľa seba by vpravo ostala prázdna
  plocha.
- **Q5 — Dlaždica Knižnica v Organizácii.**
  **A Ostáva** (rozcestník je rovnaký na všetkých šírkach a v menu).
  B Zaniká, lebo Dokumenty na Prehľade sú knižnica.
  *Odporúčam A:* rozcestník kreslí `navItems()` rovnako ako lišta
  a plachta; vynechať ho len tu by tie tri miesta rozišlo.

## Technicky (pre implementáciu, nie pre návrh)

- `app/src/app/page.tsx`, `lib/overview.ts` (`mergeReaderDocuments`),
  `lib/pending.ts`; hľadanie a rozsah v adrese Prehľadu (`?q=` je
  obsadené presmerovaním na `/ask` — iný kľúč, napr. `?find=`;
  `lib/urlParams.ts`).
- `LiveFilter` už existuje (knižnica); `.view-switch` s pretečením
  (Q1 A) je nový stav triedy → `globals.css` + `conventions.md`
  s Jánovým súhlasom.
- `nové pre mňa` (Q3 A) potrebuje čas predchádzajúceho prihlásenia —
  `isNewFor(person, …)` v `pending.ts` ho už počíta.

## Prompt pre Design

> Navrhni **Prehľad** (úvodná obrazovka `/`) intranetu Contineo pre
> **bežného používateľa** — bloky **Moje úlohy** a **Dokumenty**. Použi
> **výhradne design system Contineo** (pripojený artefakt „Contineo —
> design system"): jeho triedy, tokeny a komponenty. Čo v ňom chýba,
> pomenuj ako **odchýlku** s odporúčaním a pridaj čo najmenej, z
> existujúcich tokenov. Vzor je Apple HIG / SwiftUI (pod 640 px iOS,
> 640–1023 px iPadOS, od 1024 px macOS), web ostáva webom: stav je
> v adrese, ovládače sú odkazy a formuláre, stránka funguje bez
> JavaScriptu. Rámy **390, 834, 1440**, svetlá aj tmavá téma, slovenské
> texty, farba organizácie podľa `tenantStyle`. Ciele na dotyk aspoň
> 44 px, WCAG AA.
>
> **Poradie stránky:** oslovenie „Dobrý deň, Ján Letko" · Moje úlohy ·
> Dokumenty · rozcestník Organizácia (Adresár, Knižnica, Vzdelávanie) ·
> Správa (dlaždice sekcií len pre roly — nemeň ich). Hlavička aplikácie
> s poľom „Opýtajte sa svojich dokumentov…" je nad tým a nemení sa.
>
> **Moje úlohy** — čo odo mňa niekto čaká. Úlohy sú dvoch druhov:
> (1) **prečítať a potvrdiť znenie dokumentu** — názov, druh dokumentu,
> „znenie účinné od 7. 9. 2026", termín (môže chýbať), niekedy trasa
> a krok („Nástup do SFZ · krok 2 z 5"), niekedy „zatiaľ nedostupné"
> s dôvodom; (2) **rozhodnúť kolo schválenia** — názov dokumentu,
> „predložil Peter Novák". Ilustrácia: 3 úlohy po termíne o 15 dní
> (Pracovný poriadok SFZ, Finančná smernica SFZ, Smernica o pracovných
> cestách a poskytovaní cestovných náhrad SFZ), 1 do 5 dní, 1 schválenie.
> Dnes je to zoznam s červeným chipom „po termíne o 15 dní" a rámovaným
> „Otvoriť" v každom riadku — nehovorí, čo je najnaliehavejšie ani čo
> s úlohou urobiť. Navrhni poradie podľa naliehavosti, jasné „po
> termíne", obsah riadku, akciu a prázdny stav („Nič od vás nikto
> nečaká"). Najviac 6 riadkov, ďalej „Všetky úlohy (N) →".
>
> **Dokumenty** — čo mám k dispozícii, bez ohľadu na to, odkiaľ obsah
> prišiel (knižnica alebo zákon zo Slov-Lexu). Jediné členenie je
> **druh**. Navrhni ho ako **hľadanie s rozsahmi** podľa SwiftUI
> `.searchable` + `.searchScopes`: pole hľadania (filtruje počas písania,
> bez JavaScriptu GET formulár) a pod ním rozsahy **Všetky 28 · Poriadok
> 11 · Manuál 10 · Zákon 5 · Smernica 2 · Stanovy 1** — prepínač pohľadu
> `.view-switch` (sivý, nie farbou organizácie). Pozor: `.view-switch` je
> v systéme na 2–4 krátke voľby a tu je 5 (inde viac) — navrhni, ako sa
> správa (Q1). Riadok: názov, druh, „znenie účinné od 24. 10. 2026",
> príp. „expiruje" (koniec platnosti do 30 dní). Dnes má každý riadok
> chip „nové" (všetko vyšlo v ten istý deň) a rámované „Opýtať sa" —
> navrhni, či a kde akcia ostáva (Q2) a kedy je dokument „nový" (Q3).
> Ukáž aj prázdny výsledok hľadania. 6–8 riadkov, ďalej „Všetky dokumenty
> (28) →" do knižnice.
>
> Pravidlá systému: na obrazovke najviac jedno plné tlačidlo (tu
> pravdepodobne žiadne); v zozname kariet s vlastnou akciou sú tlačidlá
> tiché; odkaz „← Späť" sa nekreslí; spodok obrazovky patrí len hlavnej
> lište aplikácie.
>
> Do `.md` k návrhu napíš sekciu **„Rozhodnuté"** s otázkami Q1–Q5,
> pri každej s odporúčaním (odporúčaná prvá):
> Q1 rozsahy pri 5+ druhoch (A pás s rolovaním na telefóne, B prvé tri +
> „Ďalšie ▾", C `<select>`); Q2 akcia v riadku (A celý riadok je odkaz,
> „Opýtať sa" len na detaile, B riadok + tichá akcia, C ⋯ menu);
> Q3 „nové" (A len nové od môjho predchádzajúceho prihlásenia, B 7 dní
> pre všetkých, C nič); Q4 od 1024 px (A pod sebou, B vedľa seba);
> Q5 dlaždica Knižnica v rozcestníku (A ostáva, B zaniká) —
> a **zoznam odchýlok** od design systému.
