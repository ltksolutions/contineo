# ADR-027 — Členenie sa nenastavuje v organizácii, ale podľa druhu dokumentu

> **Stav:** prijaté · **Dátum:** 2026-10-05
> **Rozhodol:** Ján Letko (2026-10-05) — „áno, súhlasím, začni krokom 1".
> **Nadväzuje na:** D58 (profil členenia per organizácia), D79 (pomenované
> profily, plán `docs/D79_plan_clenenie_per_dokument.md`), D57 (`versionId` ≠ `chunkingId`)
> **Implementácia:** krok 1 — časť `/organisation/chunking` zrušená, skript
> `npm run chunking:reindex`; krok 2 — `docs/TODO.md`, O5.

---

## 1. Kontext

Nastavenia organizácie mali časť **Členenie**: slovo článku, slovo prílohy,
prah opakovanej hlavičky, veľkosť úseku v tokenoch a tlačidlo „Preindexovať
všetko". Stav 5. 10. 2026: jediný profil „Základný" s predvolenými hodnotami,
nikdy nezmenený; 13 dokumentov, všetko normy, poriadky a smernice členené na
„Článok N", ktorým predvolený profil sadne (92–99 % úsekov s článkom).

Parametre sú technické a správca organizácie nemá dôvod im rozumieť. A pre
dokumenty, kvôli ktorým by sa mali meniť — manuál, zmluva, zápisnica bez
článkov — **žiadne číslo nepomôže**: celý text spadne do jedného bloku
„Úvodné ustanovenia". Treba iný algoritmus, nie iné nastavenie (D79 §2).

## 2. Rozhodnutie

### D160 — Členenie podľa druhu dokumentu, nie v nastaveniach organizácie

1. **Teraz:** časť Členenie sa z nastavení organizácie odstraňuje. Parametre
   ostávajú predvolené v kóde, dátový model (pomenované profily, kľúč profilu
   na dokumente) sa nemení, nič sa nepreindexuje. Stará adresa vedie na
   rozcestník. Preindexovanie celej knižnice (len pri zmene algoritmu) je
   úloha prevádzkovateľa: `npm run chunking:reindex -- --company SFZ`.
   Jeden dokument sa dá preindexovať v jeho detaile ako doteraz.
2. **S prvým dokumentom iného druhu:** spôsob členenia sa určí **pri druhu
   dokumentu** (Číselníky → Druhy dokumentov) — po článkoch, paragrafoch,
   bodoch alebo podľa nadpisov — a pri nahratí sa odvodí z druhu, ktorý človek
   vyberá aj tak. Stratégia „podľa nadpisov" je nový `chunkerPlain.mjs`.

## 3. Dôsledky

- Menej obrazovky, ktorej nikto nerozumie; žiadny dokument sa nenareže inak.
- Krok 2 sa robí až so skutočným textom — algoritmus odladený bez neho by
  bol odhad (rovnaký dôvod ako odklad D79 etapy 2).

## 4. Editor členenia pri dokumente (2026-10-05)

Rozhodnutie Jána: úpravy cez **pomenované profily** (D79 ostáva), AI dostane
**štruktúru**, nie celý text, editor používa **správca obsahu**.

- **Krok A** — `/library/[id]/chunks`: uložené úseky, súhrn, upozornenia,
  rozbor analyzátorom, stav oproti dnešnému rezu (`chunkingInspect.ts`).
- **Krok B** — skúšobný rez (GET, nič neukladá), porovnanie, použitie
  existujúceho profilu alebo nový pomenovaný profil z hodnôt skúšky
  (`chunkingProfilesDb.ts`). Existujúci profil sa tu nemení.
- **Krok C** — návrh AI (`chunkingAdvice.ts`): štruktúra (nadpisy, články,
  začiatky odsekov do 60 znakov, strop 400 riadkov) ide modelu z nastavenia
  „Odpovede asistenta"; odpoveď je JSON podľa schémy, hodnoty sa orežú;
  posledný návrh sa ukladá pri dokumente (`documents.chunkingAdvice`) a
  spotreba ide pod účel „Analýza členenia". Pracovný poriadok: ~12,7 tis.
  tokenov vstupu, ~$0,03, ~13 s.

---

## Dodatok 1 — D179: druh je typ dokumentu, značky sú témy (2026-10-08)

**Rozhodol:** Ján Letko, 8. 10. 2026 („áno, súhlasím, začni") — na otázku,
či zaviesť „typ" dokumentu alebo použiť značky.

- **Typ dokumentu je Druh** (`category`), nové pole sa nezavádza. Druh má
  dokument práve jeden a riadi sa podľa neho správanie: FAQ má záznamy namiesto
  súboru (`chunking: "entries"`, ADR-028 D164) a podľa § 2 tohto ADR sa podľa
  neho bude riadiť aj spôsob členenia.
- **Značky sú témy** — žiadna, jedna aj päť, nič nespúšťajú. Typ do nich
  nepatrí; nápoveda pri značkách to hovorí.
- **Dva základné spôsoby vzniku** — dokument zo súboru a FAQ — ukazuje
  rozcestník na `/library/new` (tretí zdroj je import zo servera, ADR-029).
  Vo výbere Druhu pri nahratí súboru FAQ nie je; má vlastnú cestu.
- Druh ostáva **povinný vo formulári, nepovinný na serveri** (rozhodnutie
  z 21. 9. 2026: import, seed a staré dokumenty bez druhu sa nerozbijú).
- Značky „Poriadok" a „Smernica" v SFZ duplikujú druh; odstránia sa
  samostatne po kontrole, že dotknuté dokumenty majú druh vyplnený.

