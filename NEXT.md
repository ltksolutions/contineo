# NEXT — kde sme a čo je ďalší krok

> Jedna strana pre rituál **„Zorientuj sa"**. Podrobnosti a odôvodnenia sú
> v `docs/TODO.md`; sem patrí len to, čo treba vedieť pri štarte.
>
> **Tento súbor je indícia, `git log` je pravda.** Keď si protirečia, verí sa
> gitu a NEXT.md sa opraví. Aktualizuje sa pri rituáli **„Poupratuj"**.

Posledná aktualizácia: **2026-09-22**

---

## Kde sme teraz

Dokončený je celý designový handoff — **PR 0 až 14** (`docs/design/*.md`), každý
na vlastnej vetve zreťazenej nad predchádzajúcou, od `design/pr0-zaklad` po
`design/pr14-admin`. Nad ním stojí vetva `fix/po-handoffe` so štyrmi dorábkami
a upratovaním.

**Nič z toho nie je v `main`.** Otvorených je **17 pull requestov** (#46–#62)
a vetva `fix/po-handoffe` je **103 commitov pred `main`**. Vetvy sú zreťazené,
takže každý PR má ako základ ten predchádzajúci, nie `main` — poradie zlučovania
je dané a nedá sa preskočiť.

Posledné overenie (2026-09-22, `fix/po-handoffe`): `tsc` ✓, `eslint` 0 errors
(42 warnings = baseline), `vitest` 1422 ✓ / 87 súborov, `build` ✓.

## Čo čaká na rozhodnutie Jána

**Zlúčenie stohu do `main`.** Sedemnásť otvorených PR je veľa na to, aby sa
recenzovali jeden po druhom, a čím dlhšie stoja, tým väčšia je šanca na konflikt.
Treba rozhodnúť, či sa zlučuje zdola nahor po jednom, alebo sa celý stoh spojí
do jedného PR proti `main`.

**Migrácia `sectionKey` → `category`** (`app/scripts/migrate_section_to_category.mjs`).
Napísaná, **nespustená** — je to zmena dát. Beží nasucho, zapisuje až s `--zapis`,
a odmietne všetko, ak čo i len jeden dokument nemá `documentKey`. Po nej treba
prekresliť index v Atlase, ktorý stále filtruje na `sectionKey`.

## Tri najbližšie kroky

1. **Rozhodnúť a vykonať zlučovanie stohu** — viď vyššie. Bez toho sa všetko
   ostatné stavia na vetvách, ktoré ešte nikto nevidel v `main`.
2. **Spustiť migráciu `sectionKey`** po rozhodnutí — najprv nasucho, potom
   `--zapis`, potom index v Atlase.
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
zmeny pre používateľa. Rozhodnutia sú v `docs/ADR-*.md` (prijaté) a
`docs/OPEN_DECISIONS.md` (otvorené).

> Poznámka: rituál „Rozhodni“ počíta s `docs/decisions/`, ten v repozitári
> **nie je** — ADR ležia priamo v `docs/` ako `ADR-NNN-nazov.md`. Buď sa nové
> ADR budú zakladať tam, alebo sa zavedie `docs/decisions/` a staré sa presťahujú;
> to je rozhodnutie, nie úprava mimochodom.
