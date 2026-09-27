# ADR-020 — Každá súbežná session pracuje vo vlastnom `git worktree`

> **Stav:** prijaté · **Dátum:** 2026-09-27
> **Rozhodol:** Ján Letko („nechám na teba, rozhodni“ — 27. 9. 2026, po
> pravidle „dve sessions = dve vetvy“ v `CLAUDE.md` z toho istého dňa).
> **Nadväzuje na:** `CLAUDE.md` § Dve sessions v jednom repozitári = dve
> vetvy; § Kto smie commitovať priamo do `main` (automatické mazanie vetvy).

---

## 1. Kontext

27. 9. 2026 bežali v repozitári dve sessions naraz. Jedna spravila commit
`12d7f3b` (PR #145) a `git add -A` do neho zobral aj rozrobenú prácu druhej
(import osôb, ADR-019) vrátane pomocného súboru, ktorý do repa nepatril.
Pravidlo „každá session na vlastnej vetve“ (`CLAUDE.md`, `e0d0b93`) tomu
**nebráni**: `git checkout -b` prepne vetvu, ale pracovná kópia zostáva
jedna a rozrobené súbory sa presunú s ňou. Dve vetvy v jednej pracovnej
kópii sú stále jedna pracovná kópia.

Ešte v ten deň sa tabuľka náhľadu importu (PR #148) robila prvýkrát
v samostatnom worktree (`.worktrees/import-preview`), kým druhá session
pracovala na `learning-l3-certificates` s rozrobeným `i18n.ts`. Fungovalo:
`tsc`, lint, testy aj `next build` bežali nezávisle, do commitu sa
nedostalo nič cudzie.

## 2. Rozhodnutie

### D127 — Vlastný worktree, nie len vlastná vetva

Session, ktorá začína prácu v repozitári, kde už niekto pracuje (cudzí `M`
alebo `??` v `git status`, iná aktívna vetva), si založí **vlastný
worktree**:

```
git fetch origin
git worktree add -b <vetva> .worktrees/<nazov> origin/main
cd .worktrees/<nazov>/app && npm ci && cp ../../app/.env.local .env.local
```

- Worktree žije v **`.worktrees/<nazov>`** vnútri repozitára (aby ho videli
  nástroje s prístupom len k tomuto priečinku) a priečinok `.worktrees/` je
  v `.git/info/exclude` — nie v `.gitignore`, lebo je to lokálna
  usporiadanosť stroja, nie vlastnosť projektu.
- **`node_modules` sa inštalujú, nie linkujú.** Turbopack odmieta symlink,
  ktorý ukazuje mimo koreňa projektu („points out of the filesystem root“);
  `npm ci` trvá dve minúty a je to jednorazovo.
- `.env.local` sa kopíruje z hlavnej kópie; hodnoty sa nikam nezapisujú.
- Prvá session v repe worktree nepotrebuje; potrebuje ho každá ďalšia.

### D128 — Worktree sa po zlúčení odstráni spolu s vetvou

Pravidlo automatického mazania vetvy po bezproblémovom zlúčení (súhlas
Jána 2026-09-23) sa rozširuje na worktree: po `merged` + nasadenie
`success` sa spustí `git worktree remove .worktrees/<nazov>` a vetva sa
zmaže lokálne aj na `origin`. Nezlúčená vetva alebo vetva, pri ktorej niečo
zlyhalo, si worktree ponechá — je to rozrobená práca, nie odpad.

### D129 — Konflikt v `globals.css` a `i18n.ts` je očakávaný, rieši sa v worktree

Obidva súbory sú spoločné celému projektu a každá vetva do nich pridáva na
koniec, takže sa zrážajú takmer vždy. Riešenie je vždy „ponechať oboje“
a **skontrolovať vyváženosť zátvoriek** — pri zlúčení PR #148 git zaradil
zatvárajúcu `}` bloku `@media` do spoločnej časti a jej prepísanie by
rozbilo všetok CSS za ňou. Po konflikte sa v worktree znova spúšťa celá
sada (`tsc`, lint, testy, build), nie len dotknutý súbor.

## 3. Zamietnuté

- **Sériová práca (jedna session čaká na druhú):** nereálne, keď jedna
  session je človek a druhá asistent, a stráca sa práve tá paralelnosť, kvôli
  ktorej sú dve.
- **Klon repozitára vedľa (`contineo-2/`):** funguje rovnako, ale duplikuje
  `.git`, nie je viditeľný nástrojom s prístupom len k `contineo/` a vetvy sa
  medzi klonmi nevidia bez `push`/`fetch`.
- **Symlink `node_modules` do worktree:** rýchle, ale build padá (viď D127).

## 4. Dôsledky

- `CLAUDE.md` § Dve sessions odkazuje sem; postup vyššie je záväzný pre
  asistenta aj pre ľudí.
- Prvý worktree (`import-preview`) sa odstráni hneď po zlúčení PR #148
  podľa D128.
