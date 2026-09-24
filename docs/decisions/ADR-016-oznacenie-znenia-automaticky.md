# ADR-016 — Označenie znenia z dátumu účinnosti, bez zdroja dátumu a opravy údajov

> **Stav:** prijaté · **Dátum:** 2026-09-24
> **Zadal a odsúhlasil:** Ján Letko (2026-09-24) — „Odkiaľ je dátum ako
> parameter reálne nepotrebujeme, Označenie znenia tiež nie je potrebné,
> tým pádom ani Dôvod opravy nemá zmysel… sme stále v testovaní, ostré
> schvaľovania ešte len prídu."
> **Nadväzuje na:** D28 (formulka potvrdenia), ADR-013 (údaje o znení),
> ADR-014 (postup znenia), ADR-015 (názov novým znením)
> **Mení:** D57 (označenie píše človek) a D82 (zdroj dátumu povinný pri
> zverejnení; oprava označenia a dátumu do prvého potvrdenia)

---

## 1. Kontext

Označenie znenia a „Odkiaľ je dátum" vznikli skôr ako údaje o znení
(ADR-013). Označenie písal človek pri zverejnení a v dátach tak vzniklo
„1.0" pri deviatich normách alebo „Pracovný poriadok SFZ 20260907", ktoré
opakuje názov — oboje doslova vo formulke potvrdenia. Zdroj dátumu mal
prinútiť človeka overiť dátum, kým sa po prvom potvrdení zamkne. Dnes je
dátum účinnosti aj to, kto a kedy predpis schválil, **súčasťou schváleného
znenia** a po predložení sa nedá zmeniť — silnejšia záruka než pole
vyplnené pri zverejnení.

## 2. Rozhodnutie

### D113 — Označenie sa skladá, nezadáva

- Pri zverejnení vznikne označenie z dátumu účinnosti v jazyku dokumentu:
  **„znenie účinné od 1. 1. 2027"** (`autoVersionLabel()`).
- Dve zverejnené znenia s tou istou účinnosťou (chybné nahradené opraveným)
  dostanú „(2)", „(3)" — aby sa formulky dali rozlíšiť aj človekom.
- Formulka potvrdenia: *„… Pracovný poriadok SFZ, znenie účinné od 1. 1. 2027 …"*.

### D114 — Bez zdroja dátumu a bez „Opraviť údaje"

- „Odkiaľ je dátum" sa pri zverejnení nezadáva ani nevyžaduje. Pri starých
  zneniach sa zapísaný zdroj ďalej ukazuje v histórii.
- Panel „Opraviť údaje" (označenie, dátum, zdroj, dôvod opravy) zanikol aj
  so serverovou akciou. História opráv starých znení sa ďalej zobrazuje.
- **Odvolanie potvrdení personalistom ostáva** — samostatný panel pri znení,
  ktoré niekto potvrdil, s povinným dôvodom.
- Dôvody pri zmene zodpovednej osoby, právneho základu, opravy textu na
  vyhľadávanie a odvolaní ostávajú — sú to iné úkony a dôvod je v nich dôkaz.

## 3. Dôsledky

- Staré potvrdenia si nesú svoju kópiu označenia a nemenia sa.
- Existujúce znenia s ručným označením („1.0", „Pracovný poriadok SFZ
  20260907") ostávajú, kým sa nevymenia novým znením alebo jednorazovou
  úpravou dát znení bez potvrdení (samostatný krok so súhlasom).
- Chyba v dátume účinnosti sa po schválení rieši novým znením, nie opravou.
