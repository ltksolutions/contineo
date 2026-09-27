> **Stav projektu (2026-09-24):** platný je len tento priečinok. Staré živé prototypy (`*.dc.html`, `support.js`, `ios-frame.jsx`) sú v `_archiv/` v koreni projektu — len na dohľadanie, nie ako zadanie. Nové návrhy: `<OBRAZOVKA>-<zmena>.html` + `.md` s rovnakým menom v tomto priečinku.

# Handoff nového dizajnu Contineo — rozcestník

**Kompletné zadanie pre všetkých 31 obrazoviek aplikácie.** Pre Cowork.
Stav: 21. 9. 2026.

Zadania sú **diffy proti skutočnému kódu**, nie stavba od nuly — každé
začína tabuľkou „Čo je v repozitári UŽ HOTOVÉ“ s číslami riadkov.

---

## Kde začať

1. **`PROMPT.md`** — hotový text na skopírovanie do Coworku, pre každý PR.
   **Toto otvor prvé.**
2. **`ZADANIE.md`** — ako balík dostať do repozitára a čo odpovedať na
   časté otázky.
3. **`MASTER.md`** — zoznam všetkých rout, pravidlá platné všade,
   a rozhodnutia, ktoré už padli (stavový model, terminológia, stĺpce).
4. **`POSTUP.md`** — poradie PR, riziká, čo sa nesmie bez súhlasu,
   overenie pred commitom.
5. **`ZAKLAD.md`** — spoločný základ. Implementuje sa **prvý**, všetko
   ostatné z neho číta.

`README.md` je **archív prvej vlny** (marec–september 2026). Platí z neho
len `/organisation` (§7) a `/sign-in` (§8) — tie sa v tejto vlne nemenia.
Zvyšok je neplatný (staré názvoslovie tried) a je v ňom o tom varovanie.

---

## Riadenie

| Súbor | Čo je v ňom |
| --- | --- |
| `PROMPT.md` | hotové prompty na skopírovanie |
| `ZADANIE.md` | ako balík nasadiť, časté otázky |
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
| 13 | `ADMIN.md` | `/admin`, `/guide` |
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
| `PEOPLE.html` | osoby, karta osoby, admin, príručka |

⚠️ Súbory `*.dc.html` v koreni projektu (nie tu) sú **šablóny** a bez
behového prostredia sa nevykreslia. Needituj ich ani nepoužívaj na
porovnávanie.

---

## Modul Vzdelávanie (`/learning`, ADR-018) — rámy 2026-09-27

Zadanie: `docs/design/LEARNING-zadanie.md` (a6c7ddc). Spoločné nové triedy
(`.stag`, `.notice--info`, `.tabs`) sú opísané v prvom ráme, kde sa objavia.

| # | Rám | Routa | Stav |
| --- | --- | --- | --- |
| 1 | `LEARNING-moje-kurzy` | `/learning` | ✅ Q1, Q2 rozhodnuté |
| 2 | `COURSE-prehlad-kurzu` | `/learning/[courseKey]` | ✅ Q1 rozhodnutá |
| 3 | `PART-cast-kurzu` | `/learning/[courseKey]/[partKey]` | ✅ Q1, Q2 rozhodnuté |
| 4 | `MANAGE-sprava-kurzov` | `/learning/manage` | ✅ Q1 rozhodnutá (alternatíva) |
| 5 | `MANAGE-COURSE` | `/learning/manage/[courseKey]` | ďalší |
| 6–9 | `TESTS`, `TEST-ATTEMPT`, `RESULT`, `CERTIFICATE` | L2–L3 | čaká |

### Pre knižnice L1 (bez obrazoviek) — čo rámy potrebujú od modelu

Nad rámec ADR-018 (podrobne v sekcii „Údaje, ktoré v modeli zatiaľ nie sú"
každého `.md`):

- **Kurz / verzia:** `sequential` (poradie častí postupne / ľubovoľne) —
  ADR-018 ho nemá, zadanie áno · `subtitle`, `description`,
  `estimatedMinutes`, `issuesCertificate`, `openEnrollment`, `topicId`,
  `smartTags[]`, `version.publishedAt`.
- **Zápis:** `source` (`assignment` | `self`) + kto pridelil (veta
  „Pridelené 22. 9. · Oddelenie ľudských zdrojov").
- **Časť:** `required`, `estimatedMinutes` (alebo súčet z blokov).
- **Blok video:** `durationSec`, `requireFullWatch`, poster; externé video
  `requireFullWatch` mať nemôže.
- **Odvodené (neukladá sa, D119):** stav časti (hotová / rozpracovaná /
  dostupná / zamknutá), „prvá nehotová povinná časť", „N z M povinných",
  dátum dokončenia kurzu, percento a najďalej pozreté miesto videa z
  `video_watch` rozsahov (hranica 90 %).
- **Témy:** číselník s `retiredAt` (vyradiť, nie zmazať).
- **smart:tagy:** agregácia počtov naprieč kurzami / otázkami / testami
  (odvodená); premenovanie mení tag všade (MANAGE Q1, 27. 9.).
- **Navigácia:** `NavKey` `"learning"` (všetci pri zapnutom module),
  `tabbarItems()` — „Vzdelávanie" na 3. pozíciu, len keď v zozname nie je
  `library` (LEARNING Q1 ✅).

Adresár `_tools/` v koreni projektu sú generátory rámov — nie je súčasť
handoffu, nesťahovať.

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
