# RESULT — Výsledok pokusu (`…/test/[testKey]/[attemptId]/result`)

Referencia: `RESULT-vysledok-pokusu.html`. Základ: `ZAKLAD.md`, `TEST-ATTEMPT-pokus.md`, `TESTS-testy-a-banka.md` (`showAnswers`, bodovanie). Zadanie: `docs/design/LEARNING-zadanie.md`, rám 8 z 9 (L2). Model: ADR-018 (D119, D120, D121).

## Čo sa mení

Nová obrazovka výsledku. Nové komponenty: **karta skóre** (`AttemptScore`), **prehľad otázok** (`AttemptReviewList`).

## Karta skóre

- Kicker: „Test: … · pokus 2 z 3 · 25. 9. 2026 10:22".
- Hláška: prešiel `.notice` (+ ak je tým časť hotová: „Časť 4 … je hotová — pokračovať na časť 5") / neprešiel `.notice--error` („chýba 20 percentných bodov do hranice 80 %").
- Skóre 56 px, `--ok-fg` / `--bad-fg` + „18 z 21 bodov · Prešiel" (body = súčet váh; „viac správnych" všetko alebo nič — TESTS Q2 ✅).
- Pás 10 px so skóre a zvislou čiarou hranice + popis „hranica 80 %".
- Fakty: Hranica · Čas · Zostáva pokusov · Ďalší pokus.
- Akcie:

| Stav | Primárne | Sekundárne | Veta |
| --- | --- | --- | --- |
| prešiel | „Späť na časť" | „Prehľad kurzu" | — |
| neprešiel, pokus hneď | „Skúsiť znova" | „Späť na časť" | „Otázky sa vylosujú znova." |
| neprešiel, pauza | vypnuté „Skúsiť znova" | „Späť na časť" | „Ďalší pokus je možný o 30 minút (10:52) — test má pauzu medzi pokusmi." |
| neprešiel, vyčerpané | vypnuté „Skúsiť znova" | „Späť na časť" | „Využili ste 3 z 3 pokusov. Ďalší pokus môže povoliť zodpovedná osoba testu — {meno}." |

Vypnuté tlačidlo má vždy vetu (`aria-describedby`). Na 390 tlačidlá na celú šírku, 48 px.

## Prehľad otázok

Len ak `showAnswers` to v tomto stave dovolí (`after_submit`; `after_pass` pri prešiel; `after_last_attempt` pri vyčerpaných).
- Hlavička „Prehľad otázok" + `.view-switch` Všetky / Nesprávne (`?only=wrong`).
- Riadok: značka ✓ `--ok` / ✕ `--bad` / ! `--warn` (nezodpovedaná) · „Otázka 7 · váha 2 · viac správnych" · znenie · „Vaša odpoveď" (nesprávna preškrtnutá `--bad-fg`) · „Správna odpoveď" `--ok-fg` · vysvetlenie v `--bg` rámiku.
- Obsah **zo snímky pokusu** (D120) — zmena otázky v banke ho nezmení.

Inak karta: „Správne odpovede sa nezobrazujú" + dôvod podľa nastavenia + počet nesprávnych (bez toho, ktoré).

## 1440

Obsah 1fr + bočný stĺpec 320 px: „Vaše pokusy" (dátum, skóre) a „Kto vidí výsledok" — „Vy a zodpovedné osoby testu (…). Personálne oddelenie skóre nevidí." (D121).

## Rámy

- **390**: prešiel · neprešiel s pauzou a skrytými odpoveďami · neprešiel s pokusom hneď · vyčerpané · tmavá.
- **834**: prešiel.
- **1440**: prešiel · neprešiel s pauzou.

## Čo je v repozitári UŽ HOTOVÉ — nerob znova

| Čo | Kde |
| --- | --- |
| `.notice`, `.notice--error`, `.card`, `.button`, `.view-switch`, `.pager` | `globals.css` |
| `aria-disabled` / vypnutý stav s vetou | ZAKLAD úloha 3 |
| Notice, Skeleton | komponenty |

Nové: `AttemptScore`, `AttemptReviewList`, `.rs-*`, `.ri-*`.

## Údaje, ktoré v modeli zatiaľ nie sú

- `test_attempts.score` (percento), `points`, `maxPoints`, `passed`, `durationSec` — vyhodnocuje server pri uzavretí.
- Čas ďalšieho pokusu = `submittedAt` posledného + `test.pauseMinutes` (odvodené).
- Zodpovedné osoby testu (mená do vety pri vyčerpaných pokusoch).

## Otázky pre Jána

- Žiadne — správanie vychádza z TESTS (Q1, Q2 ✅) a TEST-ATTEMPT (Q1, Q2 ✅).
