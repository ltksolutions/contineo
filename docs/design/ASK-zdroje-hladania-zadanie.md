# Zadanie pre Claude Design — ASK-zdroje-hladania

> Podklad pre **výber zdrojov na obrazovke odpovede** (`/ask`). Pripravené
> 23. 10. 2026 na pokyn Jána („zapínanie viacerých zdrojov nie je ok…
> hneď ako kliknem na Sportnet dokumentácia, automaticky sa spustí
> vyhľadávanie, to nie je ok, po zmene zdrojov treba ručne spustiť
> vyhľadávanie"). Časť „Prompt pre Claude Design" sa skopíruje do projektu
> „Contineo.app responzivny design"; zvyšok je kontext pre Jána.
>
> **Meradlo je design system Contineo** (`.design-sync/conventions.md`,
> `app/src/app/globals.css`, `docs/DESIGN.md`). `docs/design/README.md` je
> archív prvej vlny — jeho „pilulky rozsahu" (§5) neplatia.

## Prečo

Pod otázkou je rozsah hľadania: **Knižnica** a zapnuté živé zdroje
(konektory MCP, dnes „Sportnet dokumentácia", ADR-029). Dnes:

1. Je nakreslený ako **prepínač pohľadu** `.view-switch`. Ten v design
   systéme znamená „ako to vidím", jedna voľba z 2–4. Tu sa dá zapnúť
   **viac zdrojov naraz** a vtedy svietia obe položky. Nedá sa poznať, či
   je zapnutý jeden, alebo oba.
2. **Klik spustí otázku znova** (`toggleScope` v `components/Search.tsx`).
   Každé spustenie je volanie modelu: stojí peniaze a trvá sekundy. Kto chce
   zapnúť dva zdroje alebo si ovládač len skúša, príde o odpoveď, ktorú
   práve čítal.

## Čo je dnes

- Nadpis = otázka, pod ním „Upraviť otázku" a „Opýtali ste sa o 18:08".
- Pod tým `nav.view-switch.ask-scope`: „Knižnica | Sportnet dokumentácia",
  tlačidlá s `aria-pressed`; aspoň jeden zdroj ostáva zapnutý. Voľba sa
  zapíše do adresy (`?src=library,<id>`).
- Karta odpovede: značka, „ODPOVEĎ Z DOKUMENTOV SFZ", „podľa znení
  platných dnes, …", text s odkazmi `[n]`. Vpravo od 1180 px doslovné
  citácie, pod odpoveďou hodnotenie.
- Kanály (widget, portál) rozsah nemajú. Vyberá ho správca kanála a tento
  návrh sa ich netýka.

## Čo navrhnúť

1. **Výber zdrojov** pod otázkou, kde je jasne vidieť, ktoré zdroje sú
   zapnuté (jeden aj viac), a ktorý nepôsobí ako prepínač pohľadu.
2. **Zmena zdrojov nič nespúšťa.** Odpoveď ostane a pri výbere sa objaví,
   že sa zdroje zmenili a odpoveď je z pôvodných, s akciou **Opýtať sa
   znova**. Zmena späť na pôvodné zdroje oznam skryje.
3. **Hlavička odpovede** hovorí, z čoho odpoveď je („Odpoveď z Knižnice",
   „Odpoveď z Knižnice a Sportnet dokumentácie"), aj pri uloženej odpovedi
   (`/ask/a/[id]`).
4. Stav počas behu (zdroje sa počas písania odpovede nemenia) a stav, keď
   organizácia nemá žiadny živý zdroj (výber sa nekreslí).
5. Mobil 390 px, iPad 834 px, desktop 1440 px, svetlá aj tmavá téma.

## Otázky na rozhodnutie (s odporúčaním)

- **Q1 — Ovládač výberu zdrojov:**
  - A) tiché tlačidlo „Zdroje: Knižnica ▾", ktoré otvorí plachtu (`.sheet`
    / `.popover`, ako menu 9 bodiek). V plachte je karta
    `.form-group-body--rows` s riadkami `.form-row.select-row` (natívny
    checkbox, kruh vľavo) a pod nimi plné **Opýtať sa znova**. Na telefóne
    je to spodná plachta. *(Odporúčam: zodpovedá SwiftUI `Menu` so
    zaškrtnutými položkami, je to riadok výberu z design systému „niekoľko
    zo zoznamu", na obrazovke zaberá jeden riadok a „Opýtať sa znova" je
    priamo pri výbere.)*
  - B) riadky `.select-row` priamo pod otázkou, vždy viditeľné (viac
    miesta, menej klikov).
  - C) nový prvok „prepínacie štítky" (toggle chips). Design system ho
    nemá: `.tag` je len na čítanie a `.pill` bol pri filtroch nahradený
    `.view-switch` (DESIGN_ODCHYLKY P4). Musel by sa doň najprv doplniť.
- **Q2 — Kde je „Opýtať sa znova", keď sa zdroje zmenili:**
  - A) v plachte pod výberom a zároveň v oznamu `.lnote--info` nad
    odpoveďou, keď sa plachta zavrie bez opýtania *(odporúčam: človek, ktorý
    plachtu zavrie, inak nevidí, že odpoveď nesedí s výberom)*;
  - B) len v plachte.
- **Q3 — Odpoveď po zmene zdrojov pred opýtaním:**
  - A) ostane normálne čitateľná, s oznamom nad ňou *(odporúčam: odpoveď
    je stále pravdivá pre pôvodné zdroje a stlmenie by ju robilo horšie
    čitateľnou bez dôvodu)*;
  - B) stlmená.

## Prompt pre Claude Design

> Navrhni **výber zdrojov hľadania** na obrazovke odpovede **Opýtať sa**
> v intranete Contineo. Použi **výhradne design system Contineo**
> (pripojený „Contineo — design system": triedy a tokeny z `styles.css`,
> pravidlá z jeho README). Nevymýšľaj nové triedy, farby ani rozmery. Ak
> niečo v systéme chýba, pomenuj to v `.md` ako odchýlku s odporúčaním.
> Vzor je Apple HIG / SwiftUI na všetkých šírkach, mobile first (390 px,
> iPad 834 px, 1440 px), svetlá aj tmavá téma, farba organizácie cez
> `--accent`, slovenské texty.
>
> Pod otázkou je rozsah hľadania: **Knižnica** a živé zdroje organizácie
> (dnes „Sportnet dokumentácia"). Zapnutých môže byť viac naraz, aspoň
> jeden vždy. Dnes je to sivý prepínač pohľadu a každý klik hneď položí
> otázku znova. Oboje je zle: prepínač pohľadu znamená jednu voľbu
> a každé opýtanie stojí volanie modelu.
>
> Navrhni:
> 1. **Ovládač výberu zdrojov** pod otázkou („Upraviť otázku · Opýtali ste
>    sa o 18:08"). Odporúčaný tvar (Q1 A): tiché tlačidlo „Zdroje:
>    Knižnica ▾". Otvorí plachtu s kartou riadkov `.form-row.select-row`
>    (natívne checkboxy) a plným tlačidlom **Opýtať sa znova**. Na
>    telefóne je to spodná plachta.
> 2. **Zmena zdrojov nič nespúšťa.** Kým sa človek neopýta znova, nad
>    odpoveďou je `.lnote--info` „Zdroje sa zmenili. Odpoveď nižšie je len
>    z Knižnice." s tlačidlom **Opýtať sa znova**. Návrat k pôvodným
>    zdrojom oznam skryje.
> 3. **Hlavička odpovede** menuje zdroje: „Odpoveď z Knižnice" / „Odpoveď
>    z Knižnice a Sportnet dokumentácie".
> 4. Stavy: predvolene (len Knižnica), po zmene zdrojov pred opýtaním,
>    počas písania odpovede (výber nedostupný), po opýtaní s oboma
>    zdrojmi, organizácia bez živého zdroja (výber nie je).
>
> Pravidlá: najviac jedno plné tlačidlo na obrazovke; `.view-switch` len
> na prepnutie pohľadu, nie na výber zdrojov; `.tag` je len na čítanie;
> stav je v adrese (`?src=library,<id>`) a ovládače fungujú aj bez
> JavaScriptu tam, kde to ide (odpoveď sama JavaScript potrebuje); terč
> aspoň 44 px; bez spodnej lišty navyše. Rámy 390 / 834 / 1440, súbory
> `ASK-zdroje-hladania.html` + `.md`, otázky Q1–Q3 s odporúčaním
> v sekcii „Rozhodnuté".
