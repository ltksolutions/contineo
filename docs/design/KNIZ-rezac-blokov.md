# KNIZ-rezac-blokov — Členenie na úseky ako vizuálny rezač

> Návrh z 15. 10. 2026, vytvorený ako Design artefakt priamo z Claude Code
> s pripojeným dizajnovým systémom „Contineo — design system":
> **https://claude.ai/artifact/3Z9mwiKcK2dnD7YyWajXaq** (súkromný, Ján).
> Rámy sú v `docs/design/KNIZ-rezac-blokov/` (`*.dc.html` + `cut.css` +
> `canvas.json`). Zadanie: `KNIZ-rezac-blokov-zadanie.md`. Stiahnuté
> 16. 10. 2026 na pokyn „stiahni design — KNIZ-rezac-blokov"; bez
> komentárov na plátne.

## Čo sa mení

Stránka **Členenie na úseky** (`/library/[id]/chunks`) prestáva byť zoznam
úsekov s formulárom parametrov a stáva sa **rezačom**:

1. **Text znenia celý na obrazovke, úseky ako farebné bloky.** Každý úsek
   je `section.cut-block` so šiestimi striedavými tónmi odvodenými od farby
   organizácie (`color-mix` nad `--accent`, nie dúha) a ľavým pruhom.
   V hlavičke bloku (`.cut-head`) číslo (`.cut-no`), rozpoznaný nadpis
   alebo článok (`.cut-ref`), tokeny (`.cut-tokens`) a štítky
   `tag--expired` „veľký" / `tag--draft` „úlomok" / „bez nadpisu" s vetou
   prečo (`.cut-note`). Blok s nálezom má pruh vo farbe nálezu
   (`.is-oversized` → `--bad-fg`, `.is-fragment` → `--warn-fg`).
2. **Súhrn ako jeden riadok** nad textom (`.cut-summary.card`): znenie,
   spôsob členenia (podľa nadpisov / článkov), počet úsekov, tokeny
   min–priemer–max s cieľom, štítok „N úseky nesedia" alebo „bez nálezov",
   vpravo **`.view-switch` Dnes · Návrh · Rozdiel** (stav v adrese
   `?view=`).
3. **Návrh AI ako prekrytie** v pohľadoch Návrh a Rozdiel: nová hranica
   `div.cut-boundary.cut-boundary--new` (zelená čiara, popis „nová hranica ·
   pred 1.3 Stav podania", zdôvodnenie), zrušená hranica
   `.cut-boundary--removed` (červená, prečiarknutý popis) vnútri spojeného
   bloku, zhodné hranice bez zvýraznenia; v hlavičke bloku tokeny
   „1 420 → 560" a štítky „nový úsek", „už nie veľký", „spojené".
   `div.lnote` nad textom zhrnie, čo model prečítal a koľko hraníc mení.
   Tiché „Navrhnúť rezy" v `.page-tools` (prvé kolo), „Zahodiť návrh".
4. **Čo nesedí** (`fieldset.form-group` s `textarea.field-input`
   a tichým „Navrhnúť znova"): model dostane dnešný návrh a poznámku,
   vráti opravené hranice a vetu, čo zmenil.
5. **Kolá návrhu** (`.card.cut-rounds` > `.cut-round`): číslo kola, kto
   a kedy a model, poznámka kurátora (alebo „automaticky pri nahratí"), čo
   model zmenil; aktuálne kolo štítok `tag--new`, staršie „Vrátiť sa
   k tomuto".
6. **Jediné plné tlačidlo „Prijať a preindexovať"** v karte na konci
   stránky (R2) s vetou, čo sa uloží (profil, alebo ručné hranice pri
   znení) a že text a potvrdenia sa nemenia.
7. **Karta postupu v detaile dokumentu** dostane krok **„Skontrolovať
   členenie"** (Q5 A) po nahratí a prevode textu: veta o stave návrhu
   („Návrh AI je hotový: 7 úsekov, bez nálezov. Dnešný rez má 2 úseky,
   ktoré nesedia"), tlačidlá Otvoriť Členenie / Odložiť; zverejnenie sa
   nebráni („členenie je odporúčanie, nie brána").
8. **Fáza 2 (neskôr):** `div.cut-handle` medzi blokmi s úchytom
   (`.cut-handle-grip`) na ťahanie, `.cut-handle-add` „+" medzi odsekmi
   na vloženie hranice; ručná zmena je ďalšie kolo s poznámkou „ručne".
   Vyžaduje JavaScript (Tiptap z editora chatu, keď bude v `main`).

Zaniká: zoznam `details.chunk-item`, formulár „Skúsiť iný rez" so štyrmi
poľami (hodnoty profilu ostávajú ako výsledok návrhu, nie ako vstup
kurátora), sekcia „Rozbor textu" (jej fakty idú do vety nad textom
a do zdôvodnení pri hraniciach).

## Kde

- `app/src/app/library/[id]/chunks/page.tsx` — prestavba vykresľovania;
  dáta ostávajú (`inspectChunking`, profily), pribudne návrh hraníc
  a kolá.
- `app/src/lib/chunkingAdvice.ts` — vstup modelu je **celý text** (Q1 A),
  výstup hranice ako index bloku + zdôvodnenie + veta „čo som zmenil";
  druhé kolo dostane predošlý návrh a poznámku.
- `app/src/lib/chunker.mjs` + `chunkingProfile.ts` — spôsob členenia
  „ručné hranice" (Q3 A) má prednosť pred profilom.
- `app/src/lib/documents.ts` — pri znení `chunkBoundaries` (index bloku),
  `chunkRounds[]` (kto, kedy, model, poznámka, hranice, zmena),
  `chunkingReviewedAt`.
- `app/src/app/library/[id]/page.tsx` — krok „Skontrolovať členenie"
  v karte postupu.
- `app/src/app/globals.css` — triedy z `cut.css`.
- Automatický návrh pri nahratí (Q2 A): beh na pozadí ako kontrola súladu
  (`lib/backgroundKick.ts`), nie v požiadavke nahratia.

## Prečo

Ján 15. 10. dvakrát nenašiel, ako si pozrieť úseky v indexe; keď stránku
našiel, nedostal odpoveď „sedí to?". Dnešné Členenie je nástroj pre toho,
kto rozumie analyzátoru; rezač je pre toho, kto rozumie dokumentu. Manuál
(ADR-034) nemá články a profil „Článok, 300–900 tokenov" mu nesedí od
začiatku — model s celým textom navrhne hranice tam, kde ich analyzátor
podľa slova článku nenájde (tabuľka patriaca k vete, odsek k predošlému
nadpisu).

## Rozhodnutia v repozitári

- ADR-027 / ADR-034: spôsob členenia sa viaže na druh dokumentu; návrh AI
  ho dostane ako východisko.
- D79: dokument nesie pomenovaný profil; existujúce profily sa nemenia.
- ADR-026: model z nastavení AI organizácie, spotreba bez obsahu.
- Rozhodnutie z 5. 10. 2026 (štruktúra, nie text) je pre návrh rezov
  **nahradené Q1 A** (Ján 15. 10.).
- Preindexovanie ostáva v detaile dokumentu; Členenie nič neuloží bez
  „Prijať".
- Jedno plné tlačidlo; `.view-switch` sivý; stav v adrese; bez JavaScriptu
  okrem fázy 2; terč 44 px; svetlá aj tmavá téma; zlomy 640 a 1024.

## Rámy

| súbor | rám | obsah |
|---|---|---|
| `Main.dc.html` | 1440 svetlá | pohľad Dnes: 7 blokov, štítky veľký a úlomok, súhrn, prepínač |
| `Rozdiel.dc.html` | 1440 svetlá | pohľad Rozdiel: nová a zrušená hranica so zdôvodnením, Čo nesedí, kolá 1 a 2, Prijať a preindexovať |
| `Mobil-navrh.dc.html` | 390 tmavá | pohľad Návrh, tabuľka s posuvom, Čo nesedí, Prijať |
| `Mobil-karta.dc.html` | 390 tmavá | karta postupu s krokom Skontrolovať členenie; sekcia Text s Editor textu / Členenie |
| `Faza2.dc.html` | 1440 svetlá | neskôr: úchyty hraníc, + na vloženie, hranica v ťahu |

Text manuálu ISSF-08 na rámoch je **ukážkový**, tokeny a nálezy ilustračné.

## Údaje, ktoré v modeli neexistujú

- hranice úsekov pri znení ako index bloku v Markdowne (`chunkBoundaries`);
- kolá návrhu (`chunkRounds[]`: kto, kedy, model, poznámka, hranice,
  „čo zmenil", zdroj `ai | manual`);
- spôsob členenia „ručné hranice" vedľa „články" a „nadpisy";
- stav „členenie skontrolované / odložené" pri znení (`chunkingReviewedAt`,
  `chunkingDeferredAt`);
- zdôvodnenie hranice (text od modelu) — súčasť kola, nie znenia.

## Rozhodnuté

- **Q1 A** (Ján 15. 10. 2026) — modelu ide celý text znenia cez kľúč
  organizácie.
- **Q3 A** (Ján 15. 10. 2026) — rez mimo profilu = ručné hranice pri znení,
  index bloku, história kôl; nové znenie začína bez nich.
- Odporúčania z návrhu, bez námietky Jána pri sťahovaní: **Q2 A** návrh
  beží automaticky pri nahratí a novom znení; **Q4 A** fáza 1 serverovo
  bez Tiptapu; **Q5 A** krok „Skontrolovať členenie" v karte postupu.

## Otázky

Žiadne otvorené. Pri implementácii sa pomenujú odchýlky od rámov (iné
rozmery, chýbajúca trieda, text navyše) v PR.

## Prompt pre Claude Code

```
Implementuj docs/design/KNIZ-rezac-blokov.md (fáza 1, body 1–7; bod 8 nie).
Rámy: docs/design/KNIZ-rezac-blokov/*.dc.html, triedy v cut.css → globals.css.
Rozhodnuté Q1 A, Q2 A, Q3 A, Q4 A, Q5 A. Najprv model (hranice pri znení,
kolá, spôsob „ručné hranice" v chunkeri s testami), potom chunkingAdvice
s celým textom a druhým kolom s poznámkou, potom stránka /chunks s tromi
pohľadmi a Prijať, nakoniec krok v karte postupu a automatický návrh pri
nahratí cez backgroundKick. Jeden PR, bez JavaScriptu, i18n sk/cs/en,
testy vykreslenia pre Dnes a Rozdiel.
```
