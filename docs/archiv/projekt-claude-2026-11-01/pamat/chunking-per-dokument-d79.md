---
name: chunking-per-dokument-d79
description: Pomenované profily členenia (D79) — čo je hotové, ako sa rozlišuje profil dokumentu a pasca s odtlačkom; čítať pred zásahom do chunkera alebo záložky Členenie
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

**Etapa 1 hotová 2026-09-13 (commit `9df0f0f`).** Etapa 2 (analyzátor, dávková
analýza, stratégia „voľný text", obrazovky) čaká za Fázou 8 — `docs/TODO.md`,
sekcia **O5**.

**Korpus Contineo nie je homogénny.** Ján potvrdil, že do knižnice pôjdu
súčasne predpisy SFZ (`Článok`), zákony a vyhlášky (`§`), manuály a zápisnice
(bez formálneho členenia) a zmluvy iných tenantov.

How to apply:

- profil sa **nepodáva zvonku**. `publish()`, `reindex()`, `fixText()`,
  `reindexState()` a `reindexAll()` si ho rozlíšia samy, z dokumentu. Podávaný
  z obrazovky znamenal, že dávkové preindexovanie prerezalo aj dokumenty
  s vlastným profilom;
- reťaz: profil dokumentu → základný profil organizácie (`zakladny`) →
  `tenant.chunking` (organizácia spred D79) → `undefined`. Tretí článok je
  nutný, inak by organizácii bez profilov začali dokumenty rezať predvolenými
  hodnotami namiesto jej vlastných;
- **len pomenované profily, žiadne výnimky na dokumente.** Dokument nesie iba
  kľúč. Keď nesadne ani jednému profilu, vzniká nový pomenovaný profil;
- záložka Členenie zapisuje do **základného profilu**, nie do `tenant.chunking`
  — inak by od zavedenia profilov nemala žiadny účinok;
- `rozlišovanie` sa dá pozrieť cez `npm run chunking:status`, migrácia je
  `npm run migrate:profiles`.

**Pasca s odtlačkom (R1).** `chunkingFingerprint()` hashuje profil tak, ako ho
dostane. Kľúč ani menovka profilu doň **nesmú** — inak sa zmení `chunkingId`
každého dokumentu a celá knižnica vyzerá nepreindexovaná, hoci sa v texte
nezmenilo nič. Hashuje sa výhradne výstup `toChunkerProfile()`; je to napísané
ako test v `tests/chunking.test.ts`. Potvrdenia ohrozené nie sú — D57 oddelilo
`versionId` (len text) od `chunkingId`.

**Otvorený nález.** Deväť z desiatich dokumentov má uložené `chunkingId`, ktoré
nesedí s dnešným výstupom chunkera — a nesedelo ani pred D79 (`chunking:status`
to ukazuje v oboch stĺpcoch rovnako). Pravdepodobne ich `scripts/import.mjs`
narezal s iným breadcrumbom, než aký skladá `reindex()`. Vedené v `TODO.md`, O2.

Súvisí s [[identita-dokumentu-d80]].
