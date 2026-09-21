# Handoff nového dizajnu Contineo — rozcestník

**Kompletné zadanie pre všetkých 31 obrazoviek aplikácie.** Pre Cowork.
Stav: 21. 9. 2026.

Zadania sú **diffy proti skutočnému kódu**, nie stavba od nuly — každé
začína tabuľkou „Čo je v repozitári UŽ HOTOVÉ“ s číslami riadkov.

---

## Kde začať

1. **`ZADANIE.md`** — ako to zadať Coworku. Presný text na skopírovanie,
   tabuľka 14 PR, čo odpovedať na časté otázky. **Prečítaj prvé.**
2. **`MASTER.md`** — zoznam všetkých rout, pravidlá platné všade,
   a rozhodnutia, ktoré už padli (stavový model, terminológia, stĺpce).
3. **`POSTUP.md`** — poradie PR, riziká, čo sa nesmie bez súhlasu,
   overenie pred commitom.
4. **`ZAKLAD.md`** — spoločný základ. Implementuje sa **prvý**, všetko
   ostatné z neho číta.

`README.md` je **pôvodný** desktopový handoff z prvej vlny (marec–september
2026). Stále platí pre `/organisation` (§7) a `/sign-in` (§8) — tie sa
v tejto vlne nemenia. Zvyšok nahrádzajú zadania nižšie.

---

## Riadenie

| Súbor | Čo je v ňom |
| --- | --- |
| `ZADANIE.md` | ako zadávať Coworku |
| `MASTER.md` | 31 rout, pravidlá, rozhodnutia, chýbajúce dáta |
| `POSTUP.md` | poradie PR, riziká, zákazy |
| `ZAKLAD.md` | tokeny a komponenty — PR 0 |

## Zadania obrazoviek

| PR | Súbor | Obrazovky |
| --- | --- | --- |
| 0 | `ZAKLAD.md` | všetky (tokeny, komponenty) |
| 1 | `PREHLAD.md` | `/` |
| 2 | `DOCUMENTS.md` | `/documents` |
| 3 | `APPROVALS.md` | `/approvals` |
| 4 | `ZNENIE.md` | `/documents/[documentId]` |
| 5 | `DETAIL.md` | `/library/[id]` |
| 6 | `ASK.md` | `/ask` |
| 7 | `NAHRAVANIE.md` | `/library/new` |
| 8 | `PRIECINKY.md` | `/library/folders` |
| 9 | `SPRAVA.md` | `/library/tracks`, `/library/curation`, `/notifications`, `/more` |
| 10 | `HR.md` | `/hr` + 5 podstránok |
| 11 | `POSUDENIE.md` | `/evaluation`, `/acknowledgements` |
| 12 | `OSOBY.md` | `/people` + 4 podstránky |
| 13 | `SPRAVCA.md` | `/admin`, `/guide` |
| — | `KNIZNICA.md` | `/library` — **hotové** (PR 8) |

`/directory`, `/organisation` a `/sign-in` sú hotové z prvej vlny.

## Vizuálne referencie

Statické HTML s reálnymi hodnotami namiesto šablón. **Otvor v prehliadači,
needituj.** Každý obsahuje rámy 1440 / 834 / 390, prázdne a chybové stavy,
dlhé texty a tmavú tému.

| Súbor | Pokrýva |
| --- | --- |
| `ZAKLAD.html` | komponenty vo všetkých stavoch, svetlá + tmavá |
| `PREHLAD.html` | `/` |
| `ASK.html` | `/ask` |
| `DOCUMENTS.html` | `/documents` |
| `APPROVALS.html` | `/approvals` |
| `DETAIL.html` | `/library/[id]` + `/documents/[documentId]` |
| `SPRAVA.html` | nahrávanie, priečinky, kolá, kurácia, upozornenia, Viac |
| `HR.html` | výkaz, prideľovanie, dôkazy, potvrdenia, posúdenie |
| `OSOBY.html` | osoby, karta osoby, admin, príručka |

⚠️ Súbory `*.dc.html` v koreni projektu (nie tu) sú **šablóny** a bez
behového prostredia sa nevykreslia. Needituj ich ani nepoužívaj na
porovnávanie.

---

## Čo platí bez výnimky

- **Žiadny text natvrdo** — i18n sk/cs/en cez `lib/i18n.ts`
- **Nič nevyžaduje JavaScript** — filtre a výber sú odkazy, formuláre sú
  `<form>`, stav nesie adresa; `normalizeQuery`/`toQuery` sa nemenia
- **Breakpointy len 640 a 1024**, mobile first
- **`--accent` `#232a35`**, `darken(hex, 0.16)`, tenant farbu skladá
  `tenantStyle()`
- **`layout.tsx` sa bez Jánovho súhlasu nemení**
- **Nové tokeny do `:root` aj `html[data-theme="dark"]`**
- **Terminológia: Druh, Značka, Oddelenie** (nie Kategória/Štítok/Útvar)

## Čo čaká na rozhodnutie

Označené 🔴 v jednotlivých zadaniach, zhrnutie v `MASTER.md`.
Žiadne z nich nebrzdí PR 0.

Dve padnú počas prvých PR:
1. **termín v `acknowledgementDuties()`** — dáta existujú, schéma sa
   nemení, chýba len v návratovom type (PR 2)
2. **„Uložiť pohľad“** — MASTER.md hovorí, že sa nerobí a odkaz z knižnice
   zmizne; potvrdiť pred PR 0
