# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-22** (po zlúčení do `main` a nasadení)

---

## Kde sme teraz

Celý designový handoff — **PR 0 až 14** (`docs/design/*.md`) — plus štyri
dorábky a upratanie sú **zlúčené v `main`**: merge commit `415d5d7`, 105
commitov, PR #46–#62. Všetkých 17 PR je zavretých, vetvy zostali.

**Nasadené do produkcie** 2026-09-22: Vercel projekt `contineo-app`, domény
`intranet.futbalsfz.sk` a `app.contineo.app`. Prítomnosť znenia sa dá overiť
v pätičke — píše sa tam krátky hash nasadeného commitu.

Overenie pred zlúčením: `tsc` ✓, `eslint` 0 errors (42 warnings = baseline),
`vitest` 1422 ✓ / 87 súborov, `build` ✓. Po nasadení prešlé naostro: prehlád,
knižnica (tabuľka aj karty), filter stavu vrátane **expirované**, `/hr`
s pásikom potvrdení, odpoveď na otázku so **stupňami zhody** pri zdrojoch,
a mobilné zobrazenie na 390 px.

## Čo čaká na rozhodnutie Jána

**Migrácia `sectionKey` → `category`** (`app/scripts/migrate_section_to_category.mjs`).
Napísaná, **nespustená** — je to zmena dát. Beží nasucho, zapisuje až s `--zapis`,
a odmietne všetko, ak čo i len jeden dokument nemá `documentKey`. Po nej treba
prekresliť index v Atlase, ktorý stále filtruje na `sectionKey`.

## Tri najbližšie kroky

1. **Spustiť migráciu `sectionKey`** — najprv nasucho, potom `--zapis`, potom
   prekresliť index v Atlase. Čaká na rozhodnutie, viď vyššie.
2. **Prázdny stav knižnice pri filtri, ktorý nič nenájde** — dnes sa napíše
   „Zatiaľ tu nie je nič. Začni nahratím prvého dokumentu", hoci dokumenty sú
   a len im nevyhovuje filter. Podmienka pozerá len text hľadania, nie filtre.
   Vidno to od filtra **expirované**, ktorý vracia nulu najčastejšie.
   Podrobnosti v `docs/TODO.md`.
3. **„Všetko, čo vyhovuje filtru" namiesto zoznamu ID v adrese** — strop výberu
   (`MAX_PICKED = 200`) rieši rezervu, nie princíp. Chce vlastný plán: mení sa
   sémantika hromadnej akcie. Podrobnosti v `docs/TODO.md`.

Ďalšie otvorené veci (história zmien na osobe, obsah príručky, rozsah hľadania
čakajúci na druhý vstupný kanál) sú v `docs/TODO.md` — nie sú na rade.

## Ako sa projekt overuje

Všetko sa púšťa z adresára `app/`:

```
cd app && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
```

Baseline, proti ktorej sa porovnáva: **0 errors, 42 warnings, 1422 testov
v 87 súboroch.** Nová chyba alebo nové varovanie znamená regresiu, nie šum.

Rozhranie sa overuje **mobile first**: 390 px tmavá a 1440 px svetlá.
Zlomové body sú len **640 a 1024**, iné nepribúdajú.

`npm run build` zhodí bežiaci `npm run dev` — zdieľajú `.next`. Buildom sa
overuje až po zastavení dev servera.

## Mapa dokumentácie

`CLAUDE.md` sú konvencie repozitára a rituály. **`NEXT.md` (tento súbor)** je
stav a ďalší krok. `docs/TODO.md` je dlhý backlog s odôvodneniami — čo sa
nerobí a prečo. `docs/DEVLOG.md` je datovaný denník práce. `CHANGELOG.md` sú
zmeny pre používateľa. **Rozhodnutia sú v `docs/decisions/`** (prijaté ADR,
rozcestník v `README.md` toho priečinka, konvencia MADR) a `docs/OPEN_DECISIONS.md`
(otvorené, očíslované `D1`, `D2`…). Plány `docs/D79_plan_*.md` a `docs/O7_plan_*.md`
sú návrhy postupu, nie rozhodnutia, a zostávajú v `docs/`.
