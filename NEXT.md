# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-10-30 popoludní** (štatistika kanála pre board #510, #513, #514; widget pozná predchádzajúce kolá rozhovoru #512, #515; fronta Na posúdenie s pohľadmi, štatistikou a predchádzajúcimi otázkami #508, #509, #511). Staršie dni sú v `docs/DEVLOG.md`.

---

## Kde sme teraz

Všetko je zlúčené v `main` a nasadené na `intranet.futbalsfz.sk` (hash
v pätičke). Paralelné sessions pracujú každá vo vlastnom `git worktree`
(ADR-020). Podrobný stav po oblastiach k 30. 10. 2026 je v `docs/DEVLOG.md`
(zápis „Stav projektu z NEXT.md"), história v `CHANGELOG.md`.

**Helpdesk a widget ISSF — beží naostro** (ADR-028, ADR-042). Widget
nahrádza formulár Pomoc v ISSF (341 osôb z widgetu k 30. 10.), schránka
helpdesku cez Graph s ticketmi ako vláknom, fronta Na posúdenie s pohľadmi
a štatistikou. **Štatistika kanála** (`/channels/<key>/stats`, #513) s Excelom
pre board; „nenašlo sa" sa počíta až od 30. 10. Prvý týždeň: 114 otázok,
**spokojnosť 44 %**. Widget pozná tri predchádzajúce kolá rozhovoru (#512).
Naživo neoverené: povýšenie kolegu z widgetu pri prihlásení (#506).

**Knižnica a znenia.** Karta znenia (ADR-014–017, 023, 025), asistent
odpovedá podľa znenia platného k dňu (ADR-024), členenie zo štruktúry
Markdownu (ADR-035), druhy a hierarchia dokumentov (ADR-034). Bežný
používateľ vidí dokumenty, nie zdroje (ADR-041, #449–#452) — **naživo
neoverené**. Manuály ISSF sú zverejnené všetky; v hlavičke ostal „Stav k:
9. 10. 2026" — opraviť pri najbližšom znení.

**Zdroje.** Register zdrojov (ADR-039), MCP konektory so Sportnetom ako
živým zdrojom (ADR-029), katalóg legislatívy zo Slov-Lexu s nočným cronom
(ADR-040; Zákon o športe zverejnený, nadradený Stanovám), Contineo ako MCP
server zapnuté a overené (ADR-038).

**Kontrola súladu** (ADR-032) beží: dokument proti záväzným dokumentom
z hierarchie, návrhy z helpdesku do manuálov (ADR-030).

**Ľudia a potvrdzovanie.** 153 osôb SFZ, pozvánky odišli 28. 9.;
potvrdzovanie, trasy a `/dpo` overené naostro. Vzdelávanie (ADR-018) je
zapnuté, **kurz zatiaľ nikto nedokončil**. Kuriér (ADR-033) je vo fáze 1;
živý rozhovor dvoch ľudí a ranný súhrn naostro neoverené.

**AI a dizajn.** Prehľad spotreby AI (`/organisation/ai/overview`),
spotreba nesie `channelKey` od 30. 10. Design system je záväzný (Ján
23. 10.); návrhy obrazoviek vznikajú ako artefakt *Design* (`docs/DESIGN.md`).
Retencia (ADR-012) beží v režime `report`.

## Čo čaká na rozhodnutie Jána

**Widget v ISSF:** voliteľne vzory otázok kanála. Poslať `/design-sync`
(pribudli triedy `.xw-*` vrátane `.xw-pill` a `.xw-help`, sekcia
„Značka v pohybe a zvuku", „Vlákno ticketu" s `.thread-msg` a 30. 10.
`.stat-tiles` a `.period-nav`).

**Dve overenia k manuálom** (kolo 2 je rozhodnuté a manuály zverejnené):
pri zápisoch pre laikov (ISSF-05) — **podnet ŠTK poslaný 27. 10., čaká sa
na odpoveď**, kto zápis uzatvára;
lehotu „žiadosť o predĺženie licencie najskôr 30 dní pred skončením"
(ISSF-00) overiť s Oddelením vzdelávania trénerov.

**Sportnet ako verejný zdroj pre widget ISSF** — Ján prepne sám neskôr
(Organizácia › Zdroje › Konektory, potom „Živé zdroje" kanála ISSF); výber zdrojov
sa vo widgete objaví do hodiny bez nasadenia.

**Podnet legislatíve: RaPP a Stanovy verzus prax ISSF** — päť bodov
(27. 10. pribudol bod 5, zrušenie registrácie hráča aj písomne,
`~/Downloads/Podnet_RaPP_Stanovy_prax_ISSF_2026-10-27.docx`); poslať LPO
a pri poplatku 0,50 € zistiť, na základe čoho ho ISSF účtuje.

**🔴 Ako DPO: súhlas s účelom „história otázok“** (H1) — nasadené 30. 9.
pred súhlasom, na pokyn Jána; záznam o spracúvaní a `/privacy` sú doplnené.

**Lehota uloženia certifikátov** podľa registratúrneho plánu zväzu — DPO
doplní do záznamu o spracúvaní (C2, D132).

**22 osôb z `@sfzmarketing.sk`** sú v tenante SFZ ako `employee` — nechať,
alebo typ `external` / vlastný tenant? A či doplniť ľudí mimo Basic/Standard
licencií (Ján v exporte nebol).

**Ako DPO:** C1 schválené 28. 9.; zostáva záznam o spracovateľských
činnostiach prepísať do záznamu zväzu (C2, doplnené o Vzdelávanie
a pohlavie), DPIA pred pilotom (C3), termín balančného testu (A3, A11).

**Skúšobný poriadok `sfz:test_znenia`** — zmazať, keď kontrola asistenta
(`npm run versions:questions`) prejde na ostrú normu s viacerými zneniami.
Skúšobná smernica je zmazaná (2. 10.).

**Staré pridelenia Oddeleniu IT** — Revízny poriadok (10. 9., Branislav
nepotvrdil) a Skúšobná smernica (8. 9.): odvolať, alebo nechať?

**9 zo 14 platných predpisov nemá právny základ** (výkaz `/dpo`,
1. 10.) — doplní zodpovedná osoba (pri ôsmich je to Ján, pri Smernici
o pracovných cestách Michaela Žikavská).

**Atlas → AI Models → Usage:** či úpravy search indexov 29. 9. prepočítali
vektory (skóre pred a po sú zhodné — nasvedčuje, že nie).

**Zapnúť ostré mazanie** — `RETENTION_MODE=delete` po kontrole výkazu
`retention` v odpovedi cronu; tá istá premenná zapína aj retenciu
Vzdelávania (ADR-021) a od 8. 10. aj tickety a osoby z widgetu (D178,
počty v `retention[].helpdesk`).

**Automatický prevod `.docx` → PDF** (Graph, povolenia v Entra ID) a **D93**
(`docs/D93_plan_vyber_podla_filtra.md`) čakajú ako doteraz.

## Najbližšie kroky

1. **Fronta Na posúdenie:** posúdiť štyri čakajúce podnety (spokojnosť
   kanála je 44 % — 9 × Nesedí za prvý týždeň, stojí za pozretie, na čo
   ľudia reagovali). Od 31. 10. pozrieť v štatistike kanála skutočný podiel
   „nenašlo sa". Staré tickety
   „Fwd:" od kolegov (7) — odpovedať pôvodnému pisateľovi ručne.
   **Poslať podnet legislatíve** (päť bodov); odpoveď ŠTK k ISSF-05
   a overenie s Oddelením vzdelávania trénerov.
2. **Prejsť naživo** Prehľad, `/library` s prepínačom druhu, jeden dokument
   a jeden zákon (ADR-041, #450–#452 nasadené bez pohľadu v prehliadači).
   **Kontrola súladu Stanov proti Zákonu o športe:** existujúca kontrola
   „Stanovy SFZ proti zákonu o športe" z 23. 10. má 13 nerozhodnutých
   nálezov — najprv rozhodnúť, nové kolo (≈ 1,37 USD, 2 min) až potom.
   Nočný beh cronu katalógu je overený (žiadny koncept). **Nahrať
   licenčnú normu trénerov** — päť otázok o trénerských licenciách dnes
   nepokryje žiadny dokument.
3. **Kuriér naostro:** živý rozhovor dvoch ľudí, ranný súhrn v logu
   `courier-digest`, prvý oznam oddeleniu.
4. **Prehľad AI:** zjednotiť meno procesov na pozadí pri zápise spotreby
   (`docs/TODO.md`, „Spotreba AI: jedno meno"). Posuvník `.field-range`
   je v knižnici aj v artefakte design systému (`/design-sync` 25. 10., verzia 10).
5. **Zdroje hľadania naostro:** jedna otázka so zaškrtnutým Sportnetom
   z plachty — hlavička „… a zo zdroja Sportnet dokumentácia", oznam po
   zmene výberu bez nového volania.

Ďalej podľa staršieho plánu: prvý kurz naostro s certifikátom a `/verify`
z telefónu; prvé ostré nové znenie normy cez kartu (nový názov, základ
v príprave, prenos pridelení); čas po prvý token, fáza 3
(`scripts/ratings_overview.mjs`); dátum skončenia na karte osoby pri prvom
odchode.

## Ako sa projekt overuje

Štyri brzdy, overenie nasadenej stránky telom odpovede a pravidlo „skúša
sa to, čo s obrazovkou robia ľudia" sú v `CLAUDE.md`. Sem patrí baseline
a to, čo tam nie je.

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline (30. 10.): **0 errors, 39 warnings, 3145 testov v 273 súboroch.**
Nová chyba alebo nové varovanie je regresia, nie šum.

- Pri zmene rozhrania aspoň jedna snímka na 390 px (tmavá) a 1440 px
  (svetlá); zlomové body sú len 640 a 1024.
- Pri paralelnej session pred zlúčením PR zmergovať `main` do vetvy
  a znova `tsc` a build.
- Pri zmene importov v `lib/` pustiť `importCycles.test.ts` — kruh
  prejde všetkými štyrmi brzdami a padne až v produkcii.
- Stav, ktorý sa naživo nedá vyvolať bez zápisu, sa overuje testom
  vykreslenia s podvrhnutými dátami (`libraryDetailFlow`, `approvalsPage`).
- `npm run build` zhodí bežiaci `npm run dev` (zdieľajú `.next`).
- Pri záťaži stroja `npx vitest run --maxWorkers=3`.

**Lokálne SFZ je na `http://sfz.localhost:3000`**, `localhost` je tenant
LTK. **Lokálny server píše do ostrej databázy** — zápisy sa naživo skúšajú
len so súhlasom Jána.

**Marketingový web** (`web/`): `npx eslint . && npx vitest run && npm run build`;
baseline (21. 10.) 0 errors, 0 warnings, 13 testov, 71 stránok.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
