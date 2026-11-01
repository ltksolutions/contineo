---
name: viacjazycnost-d35
description: "D35 — Contineo je viacjazyčné v prostredí (SK/CS/EN), nie v obsahu; ako to je v kóde"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

# D35 — Viacjazyčnosť: prostredie áno, obsah nie (2026-08-27)

Formulácia používateľa: *„Multijazyčné je len prostredie. Nie obsah. Ale obsah by mal mať určený základný jazyk, v ktorom je napísaný."*

| Vrstva | Viacjazyčná? | Riadi |
|---|---|---|
| **Prostredie** — rozhranie, e-maily, znenie potvrdzovacej formulky | **áno**, SK · CS · EN | `persons.language`, zoznam v `app/src/lib/jazyky.ts` |
| **Obsah** — smernice a normy | **nie**, neprekladáme | `documents.language` z číselníka `language` v `app/src/codelists/` |

**Dokument v inom jazyku je samostatný dokument (vlastné `documentId`), nie preklad.** Preto neriešime, ktoré jazykové znenie je záväzné — každý dokument je sám sebou. Otázka „binding language" pri Contineu nevzniká.

**Dva nezávislé zoznamy — nemiešať.** Číselník `language` hovorí, čím môže byť otagovaný obsah; `JAZYKY_UI` v `jazyky.ts` hovorí, v čom vieme viesť rozhovor. Že sa dnes prekrývajú, je zhoda okolností.

## Dôsledky v kóde

- `app/src/lib/jazyky.ts` — `JAZYKY_UI`, `normalizujJazyk()` (zvláda `sk-SK`, `cs_CZ`; neznáme padá na **sk**, nie en), `datum()`, `SLOVNIK` (formulka + texty prihlasovacieho e-mailu per jazyk).
- `acknowledgements` ukladá **`language`** (v čom človek formulku videl) aj **`documentLanguage`** (v čom je smernica). Bez oboch sa pri audite nedá odpovedať, či český rozhodca potvrdzoval slovenský text.
- `persons.language` → prihlasovací e-mail ide v jazyku osoby. Pri neznámej osobe alebo nedostupnej DB slovenčina — zlý jazyk je nepríjemnosť, neodoslaný odkaz sú zavreté dvere.
- **Opakovaný import bez stĺpca jazyka jazyk NEPREPÍŠE** (`if (r.language !== undefined)`), rovnaká pasca ako pri `status`.
- **Anglická formulka používa slovný mesiac** (`1 September 2026`) — v právnom texte nesmie byť pochybnosť medzi britským a americkým poradím čísel. Žiadne `toLocaleDateString`: znenie je dôkaz a nesmie závisieť od locale servera.

## Jazyk v `app/` — z profilu, NIE z URL

Na rozdiel od marketingového webu (`web/`, `[lang]` routing) sa v `app/` jazyk berie z `persons.language` a URL nemá jazykový prefix. Dôvod je bezpečnostný: `middleware.ts` je definovaný ako „všetko okrem", aby bola nová stránka chránená automaticky. Pridať do matchera jazykový segment znamená hrabať sa v jedinom mieste, ktoré stojí medzi internými smernicami a internetom. Za pohodlie zdieľateľného odkazu to nestojí.

## Otvorené

- Preklad samotného rozhrania portálu (SK hotové; CS/EN po termíne — **SFZ prvá vlna je len po slovensky**).
- **Pre HR/právnika:** má formulka pomenovať jazyk dokumentu, keď sa líši od jazyka prostredia? Napr. *„…s dokumentom „X" (v slovenčine), verzia…"*. Dnes to nerobí; v zázname je to dohľadateľné cez `documentLanguage`, ale v samotnom znení nie.
