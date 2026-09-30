# ASK — história otázok

Referencia: `ASK-historia-otazok.html`. Nadväzuje na `ASK-otazka-z-hlavicky` (plachta) a `ASK-odpoved-dva-stlpce` (rozloženie odpovede). Základ: `ZAKLAD.md`, `ASK.md`, `SHELL-rozcestnik`.
Zdroj: `lib/ratings.ts` (`recordAnswer`, `RATINGS_COLLECTION = "evaluations"`, `reviewer`), `app/api/rating/route.ts`, `components/Search.tsx`, `components/Answer.tsx`, `lib/retentionDb.ts`, `lib/retention.ts`.

Požiadavka používateľa 30. 9. 2026: pridať históriu otázok pre používateľa.

## Čo sa mení

1. **Plachta otázky:** pri prázdnom poli „Nedávne otázky" (5, čas, × skryť) nad „Napríklad". Pri písaní „Z vašich otázok" filtrované podľa textu (bez diakritiky, AND, max. 5), vzory skryté. ↑/↓ + Enter. Odkaz „Celá história".
2. **`/ask/history` „Moje otázky":** po dňoch, filter, 30 na stranu + „Načítať staršie". Riadok: otázka, čas, stav (počet citácií · „nič sa nenašlo" · vlastné hodnotenie), ×. „Vymazať celú históriu" s potvrdením. Veta o dĺžke uchovania.
3. **`/ask/a/{id}` uložená odpoveď:** rozloženie ako živá (dva stĺpce pri citáciách), bez značiek `[n]`. Žltý pás s dátumom a „Opýtať sa znova" (`/ask?q=`). Keď má citovaný dokument dnes iné platné znenie ako `source.version`, pás to pomenuje.
4. **Po `done`** klient zmení adresu z `/ask?q=` na `/ask/a/{id}` (`replaceState`) — obnovenie stránky nespúšťa beh znova, odkaz sa dá poslať.
5. **Skrytie** (× alebo „Vymazať celú históriu") = `hiddenForAsker: true` na zázname, s „Vrátiť" 5 s. Záznam pre hodnotenie kvality ostáva.

## Prečo

Ľudia sa pýtajú opakovane na to isté (prestupy, lehoty). Nájsť starú odpoveď je rýchlejšie a lacnejšie ako nový beh modelu. Uložená odpoveď s dátumom a upozornením na nové znenie je poctivejšia ako tichý nový beh.

## Rozhodnutia 30. 9. 2026

- **H1 ✅** Zdroj histórie = `evaluations` (každá odpoveď s osobou v `reviewer`), nová kolekcia sa nezakladá. Účel „história otázok" sa doplní do záznamu o spracúvaní a na `/privacy`; schváliť s DPO pred nasadením. `reviewer` sa nepremenúva, len okomentuje („kto sa pýtal").
- **H2 ✅** `evaluations` idú do `runRetention` s lehotou `privacy.retention.answersMonths` (predvolene 12, nastaviteľné). Veta na `/ask/history` berie lehotu odtiaľ. „Vymazať" = skryť z vlastnej histórie (`hiddenForAsker`), záznam pre hodnotenie ostáva do konca lehoty.
- **H3 ✅** `/ask/a/{id}` otvorí len ten, kto sa pýtal, a roly s prístupom k hodnoteniu (D32); inak 404. Zdieľanie odpovede je mimo tohto rámu.
- **H4 ✅** Po `done` `replaceState` z `/ask?q=` na `/ask/a/{id}` — obnovenie stránky nespúšťa beh znova.

Odsúhlasil používateľ 30. 9. 2026.

## Rámy

- **1440** plachta: prázdne pole s nedávnymi · písanie „prestup" (filtrované).
- **1440** `/ask/history` (dni, stav, filter, ×, vymazať).
- **1440** `/ask/a/{id}` s pásom o novom znení.
- **834** plachta. **390** plachta na celú obrazovku · `/ask/history`.

## Rozmery

Nedávne v plachte: riadok 40 (390: 48), ikona hodín 15, čas 12 `--muted`, × 30 (390: 44, stále viditeľné). `/ask/history`: max. 900, nadpis dňa 12/700 verzálky, riadok padding 12/16, otázka 14.5/600, stav 12.5, × 36 (390: 44). Pás uloženej odpovede: `--warn-bg`, radius 10, text 13.5, tlačidlo 36. Toast „Vrátiť" dole v strede, 5 s.

## i18n (sk/cs/en)

`ask.history.recent` „Nedávne otázky", `ask.history.matching` „Z vašich otázok", `ask.history.all` „Celá história", `ask.history.title` „Moje otázky", `ask.history.lead`, `ask.history.filter`, `ask.history.remove`, `ask.history.removed` „Otázka odstránená z histórie", `ask.history.undo` „Vrátiť", `ask.history.clearAll`, `ask.history.clearConfirm`, `ask.history.retention` („Otázky a odpovede sa uchovávajú {n} mesiacov…"), `ask.history.status.none`, `ask.history.status.rated`, `ask.saved.banner` („Odpoveď z {dátum}. Predpisy sa odvtedy mohli zmeniť."), `ask.saved.newVersion` („{dokument} má odvtedy nové znenie ({označenie}, účinné od {dátum})."), `ask.saved.askAgain` „Opýtať sa znova", `sheet.hint` doplniť o ↑↓.

## Údaje, ktoré v modeli neexistujú

- `evaluations.hiddenForAsker: boolean` (+ `hiddenAt`) — 🔴 **nové pole**, bez migrácie (chýba = viditeľné).
- Index `{companyCode, reviewer, createdAt: -1}` na `evaluations`.
- `privacy.retention.answersMonths` v nastavení organizácie (H2, predvolene 12).
- Poloha citácií v uloženej odpovedi — nie je (preto bez značiek).

## Prompt pre Claude Code

```
Implementuj design_handoff_contineo_intranet/ASK-historia-otazok.html + .md.
Nadväzuje na ASK-otazka-z-hlavicky a ASK-odpoved-dva-stlpce (rob na ich vetve, ak nie sú
v main). H1–H4 sú rozhodnuté (30. 9. 2026), pozri .md. H1: pred nasadením schváliť s DPO.
Najprv prečítaj lib/ratings.ts, app/api/rating/route.ts, Search.tsx, Answer.tsx,
lib/retention.ts, lib/retentionDb.ts, docs/decisions/ (D9, D32, D90, D102) a DEVLOG k
hodnoteniu a ochrane údajov.

Rozsah (vetva design/ask-historia):
1. lib/askHistory.ts: listHistory(companyCode, personId, {q, before, limit 30}),
   recent(…, 5), hide(id, personId), unhide, hideAll(personId). Filter: zhoda slov bez
   diakritiky (AND). Len záznamy s reviewer === personId a hiddenForAsker ≠ true.
   Index {companyCode, reviewer, createdAt:-1}. Testy vrátane cudzej osoby a organizácie.
2. API: GET /api/ask/history, POST /api/ask/history/{id}/hide|unhide, POST
   /api/ask/history/hide-all. Osoba a organizácia z prihlásenia (D32).
3. AskSheet: Nedávne otázky / Z vašich otázok podľa .md, ↑/↓/Enter, ×, „Celá história".
4. /ask/history: po dňoch, filter, načítať staršie, stav riadku, ×+Vrátiť (5 s),
   Vymazať celú históriu s potvrdením, veta o lehote z retentionSettings.
5. /ask/a/[id]: vlastník alebo rola s prístupom k hodnoteniu, inak 404 (H3). Answer z
   uloženého záznamu bez značiek, pás s dátumom; porovnať source.version s dnešným
   platným znením a pomenovať zmenu; „Opýtať sa znova" → /ask?q=.
6. Search: po done replaceState na /ask/a/{id} (id z recordAnswer) (H4).
7. Retencia (H2): evaluations do runRetention s privacy.retention.answersMonths
   (default 12), retention_log counts.answers; DPO dokumentácia/záznam o spracúvaní
   doplniť o účel „história otázok".
i18n sk/cs/en podľa .md. Zapíš do docs/DEVLOG.md.
Overenie: tsc, eslint (baseline), vitest, build; render 1440 / 834 / 390: plachta s
históriou aj bez nej, filtrovanie, /ask/history, skrytie + vrátiť, /ask/a/{id} s novým
znením aj bez, cudzie id → 404; svetlá aj tmavá.
```
