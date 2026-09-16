# O17 — v `evaluations` je e-mail, stačí `personId` (plán realizácie)

> **Stav:** ⬜ návrh na schválenie. **Založené:** 2026-09-16 (podnet Ján Letko:
> „pri O17 potrebujeme e-mail? nestačí nejaké internal/external ID?").
> **Nadväzuje na:** D10 a `docs/GDPR_DATA_PROTECTION.md` kap. 3 (minimalizácia),
> D24 (dôkazné záznamy), D32 (izolácia organizácie), O15/O16 (otázky pre DPO).

---

## 1. Čo je zle

`GDPR_DATA_PROTECTION.md` kap. 3 má zásadu **„`userId`/`sessionId`
pseudonymizovať; neukladať zbytočné PII"**. Kolekcia `evaluations` pritom
ukladá e-mailovú adresu doslovne, a to na piatich poliach:

| Pole | Kto to je | Kde sa zapisuje |
|---|---|---|
| `reviewer` | kto sa pýtal (a pri posudku sa prepíše na hodnotiteľa) | `recordAnswer()`, `saveVerdict()` |
| `readerNoteBy` | kto nahlásil nepresnosť | `saveReaderFeedback()` |
| `evaluatedBy` | kto posudok potvrdil alebo opravil | `saveVerdict()` |
| `curation.preparedBy` | hodnotiteľ, ktorý pripravil overenú odpoveď | `saveCurationDraft()` |
| `curation.publishedBy` | správca obsahu, ktorý ju zverejnil | `publishCuration()` |

## 2. Prečo tu e-mail nie je potrebný (na rozdiel od potvrdení)

**`acknowledgements` e-mail držia zámerne a to sa nemení.** Je to dôkaz
o oboznámení so záväzným predpisom a platí pri ňom „kópia, nie odkaz" (D24):
o rok musí byť čitateľný bez dohľadávania v kolekcii, ktorá sa medzitým zmenila.

**`evaluations` dôkaz nie sú.** Je to meranie kvality odpovedí. Nikto sa naň
nebude odvolávať pred súdom a nikto z neho nebude rekonštruovať stav spred roka.
Odkaz teda stačí — a má vlastnosť, ktorú kópia nemá: **keď osobu z `persons`
zmažeme, väzba zmizne s ňou.** Presne to sa pri žiadosti o výmaz očakáva.

**Nič sa o e-mail neopiera.** Mimo `lib/ratings.ts` sa tie polia čítajú na dvoch
miestach: `scripts/ratings_overview.mjs` ho vypíše do konzoly a
`scripts/delete_test_data.mjs` podľa `reviewer: "anonym"` filtruje testovacie
dáta. Ani jedno e-mail nepotrebuje.

## 3. Rozsah dát (overené 2026-09-16 na produkcii)

7 záznamov, z toho 7 s e-mailom, 0 s `anonym`; 1 hlásenie nepresnosti,
2 posudky, 1 pripravená a 1 zverejnená overená odpoveď. **Rôznych e-mailov: 1**,
a ten sa v `persons` nachádza. Migrácia je jednorazová a triviálna — robí sa
teraz práve preto, že je lacná.

## 4. Kroky

1. **Typ a zápis** (`lib/ratings.ts`, `lib/curation.ts`) — päť polí zmení význam
   z e-mailu na `personId`. Názvy polí sa **nemenia**; mení sa obsah a JSDoc to
   povie menovite.
2. **Volajúci** (`api/rating/route.ts`, `evaluation/actions.ts`,
   `library/curation/actions.ts`) — namiesto `ctx.person.email` sa odovzdá
   `ctx.person.id`.
3. **Zobrazenie** — kde človek potrebuje vidieť meno, doplní sa `$lookup` do
   `persons` (fronta hodnotiteľa, `ratings_overview.mjs`). Zoznam je krátky,
   dotaz lacný.
4. **Migrácia** `scripts/migrate_eval_personid.mjs` — vzorom je
   `migrate_role_content.mjs`: **náhľad je predvolený, zápis až `--zapisat`.**
   E-mail sa mapuje na `persons.email` → `personId`; čo sa nenamapuje, dostane
   `null` a e-mail sa zahodí tak či tak.
5. **Invariant v `npm run check`** — v tých piatich poliach nesmie byť znak `@`.
   Bez neho by sa e-mail vrátil pri prvom zabudnutom volajúcom a nikto by si to
   nevšimol.
6. **Dokumentácia** — `GDPR_DATA_PROTECTION.md` kap. 2 a 4, príloha
   `O15_O16_otazky_pre_DPO.md`, `CHANGELOG.md`, devlog.

## 5. Riziká

- **Migrácia je nevratná** — e-mail sa zahadzuje, to je celý jej zmysel. Preto
  náhľad ako predvolený režim a záloha Atlasu pred spustením.
- **Dohľadateľnosť po zmazaní osoby zanikne.** Je to zámer, nie strata, ale HR
  a DPO to majú vedieť: po výmaze osoby sa už nezistí, kto sa pýtal.
- **Zámena s `acknowledgements`.** Niekto raz môže chcieť „zjednotiť" obe
  kolekcie na jeden vzor. Nesmie — dôvod je v bode 2 a patrí do JSDoc oboch.
- **Vetva bez osoby.** `caller()` v `api/rating/route.ts` má fallback na token
  bez záznamu v `persons`; vtedy `personId` neexistuje. Viď otvorenú otázku.

## 6. Otvorené — na rozhodnutie pred realizáciou

1. **Čo do poľa, keď volajúci nemá záznam v `persons`?** Dnes tam ide e-mail
   z tokenu, prípadne `"anonym"`. Návrh: `null` a zachovať literál `"anonym"`
   pre testovacie dáta, aby `delete_test_data.mjs` fungoval ďalej.
2. **Migrovať aj `curation.preparedBy` a `publishedBy`?** Návrh: áno — je to tá
   istá kolekcia a dve pravidlá v jednom zázname sa raz zamenia.
3. **Zahodiť e-mail pri migrácii úplne?** Návrh: áno. Ponechať ho „pre istotu"
   znamená, že sa nič nevyriešilo.
