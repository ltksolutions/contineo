# ADR-025 — Archivácia predpisu

> **Stav:** prijaté · **Dátum:** 2026-10-02
> **Rozhodol:** Ján Letko (2026-10-02) — „archivácia je lepšie riešenie než
> mazanie"; názov **Archivovať**, dátum **aj v budúcnosti**, nepotvrdené
> pridelenia sa **odvolávajú**.
> **Nadväzuje na:** D6 (platnosť znenia), D24 (dôkazy sa nemažú), D27 (stav sa
> odvodzuje), D143 (nahradené znenie platí do účinnosti nového), ADR-005
> **Implementácia:** `lib/documentArchive.ts`, `lib/documentArchiveState.ts`,
> karta `/library/[id]`, pilulka v zozname, denný beh `/api/cron/overdue`.

---

## 1. Kontext

Predpis sa dal ukončiť len novým znením. Zrušený predpis (uznesením, nahradený
iným dokumentom) ostával v systéme ako platný: asistent z neho odpovedal,
dal sa prideliť, pripomienky chodili. Mazanie nie je odpoveď — potvrdenia
o oboznámení sú doklady (ADR-005, D24) a musia ostať čitateľné aj s predmetom.

## 2. Rozhodnutie

### D156 — Archivovať predpis ku dňu

Správca obsahu na karte dokumentu (Správa → **Archivovať predpis**) zadá
**deň, od ktorého predpis neplatí**, a **povinný dôvod**.

- **Zápis:** poslednému zverejnenému (platnému) zneniu sa nastaví koniec
  platnosti `effectiveTo` — ten istý mechanizmus ako pri novele (D143) — a do
  `versions[].archives[]` záznam: kto, kedy, prečo, ku dňu. Text, PDF ani
  potvrdenia sa nemenia. Audit `document / archived`.
- **Dátum môže byť aj v budúcnosti** — dovtedy predpis platí normálne a karta
  ukazuje „Archivuje sa — platí ešte do …".
- **Od dňa účinnosti** predpis neplatí. Z toho, čo už počíta
  `effectiveVersion()`, vyplýva: asistent z neho neodpovedá, nedá sa
  prideliť, výkaz DPO ho nemá, čitatelia ho v knižnici nevidia.
- **Pridelenia predpisu sa odvolajú** (`revokedAt`, dôvod „Predpis
  archivovaný") dňom účinnosti — hneď pri zápise, ak je dátum dnes alebo
  v minulosti, inak v dennom behu **pred** pripomienkami. Overené odpovede
  z predpisu sa ukončia ako pri novom znení. Raz (`settledAt`).
- **Kedy sa nedá:** predpis bez platného znenia, už archivovaný, so
  zverejnenou novelou, ktorá ešte neplatí, s rozpracovaným novým znením
  alebo bežiacim kolom schvaľovania — zverejnenie by archiváciu ticho prebilo.
- **Obnoviť platnosť** (omyl): koniec platnosti sa zruší, záznam sa uzavrie
  (`restoredAt`), nezmaže. Audit `document / validity-restored`. Odvolané
  pridelenia sa **neobnovujú** — prideliť sa dá znova.
- **Stav sa odvodzuje** (D27): archivovaný = posledné zverejnené znenie má
  koniec platnosti a otvorený záznam v `archives[]`. Zoznam knižnice ukazuje
  pilulku **„Archivovaný"**.

## 3. Čo sa tým vedome nerieši

- Nové znenie archivovaného predpisu sa zverejniť dá; tým predpis znova
  platí (nové znenie má vlastnú platnosť). Archivácia ho neblokuje.
- Filter „Archivované" v zozname knižnice — pilulka áno, filter neskôr.
- Testovacie dokumenty sa nearchivujú, mažú sa (`npm run docs:delete`) —
  ich potvrdenia nie sú doklady.
